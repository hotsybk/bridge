import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

// Σ-2 — Firestore Security Rules 검증.
// 민감 컬렉션(settlements/payouts/auditLogs)의 클라이언트 접근 차단,
// row-level 격리(hospitalId/vendorId), role 변경 차단 등 핵심 invariant 를 회귀 방지.
//
// 사전조건: Firestore 에뮬레이터(8080) 가 떠 있어야 함.
//   firebase emulators:exec --only firestore "pnpm test:rules"

const PROJECT_ID = "bridge-rules-test";

let testEnv: RulesTestEnvironment;

// 인증 컨텍스트 헬퍼 — custom claims(role/hospitalId/vendorId) 주입
function authed(uid: string, claims: Record<string, unknown>) {
  return testEnv.authenticatedContext(uid, claims).firestore();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("민감 컬렉션 — 클라이언트 직접 접근 차단", () => {
  it("settlements: vendor 본인 것은 read 가능, write 는 불가", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "settlements/s1"), {
        vendorId: "v1",
        amount: 1000,
      });
    });
    const vendorDb = authed("u-vendor", { role: "VENDOR_OWNER", vendorId: "v1" });
    await assertSucceeds(getDoc(doc(vendorDb, "settlements/s1")));
    await assertFails(
      setDoc(doc(vendorDb, "settlements/s1"), { amount: 9999 }),
    );
  });

  it("settlements: 다른 vendor 는 read 불가", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "settlements/s1"), { vendorId: "v1" });
    });
    const otherVendor = authed("u-v2", { role: "VENDOR_OWNER", vendorId: "v2" });
    await assertFails(getDoc(doc(otherVendor, "settlements/s1")));
  });

  it("payouts: write 는 클라이언트 전면 불가", async () => {
    const vendorDb = authed("u-vendor", { role: "VENDOR_OWNER", vendorId: "v1" });
    await assertFails(
      setDoc(doc(vendorDb, "payouts/p1"), { vendorId: "v1", amount: 1 }),
    );
  });

  it("auditLogs: admin 만 read, write 는 누구도 불가", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "auditLogs/a1"), { action: "X" });
    });
    const admin = authed("u-admin", { role: "ADMIN" });
    const buyer = authed("u-buyer", { role: "BUYER_OWNER", hospitalId: "h1" });
    await assertSucceeds(getDoc(doc(admin, "auditLogs/a1")));
    await assertFails(getDoc(doc(buyer, "auditLogs/a1")));
    await assertFails(setDoc(doc(admin, "auditLogs/a2"), { action: "Y" }));
  });

  it("_retryQueue: read/write 전면 차단", async () => {
    const admin = authed("u-admin", { role: "ADMIN" });
    await assertFails(getDoc(doc(admin, "_retryQueue/r1")));
    await assertFails(setDoc(doc(admin, "_retryQueue/r1"), { type: "X" }));
  });
});

describe("row-level 격리", () => {
  it("orders: 본인 hospital 주문만 read", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "orders/o1"), {
        hospitalId: "h1",
        vendorIds: ["v9"],
        userId: "u-buyer",
      });
    });
    const mine = authed("u-buyer", { role: "BUYER_OWNER", hospitalId: "h1" });
    const other = authed("u-x", { role: "BUYER_OWNER", hospitalId: "h2" });
    await assertSucceeds(getDoc(doc(mine, "orders/o1")));
    await assertFails(getDoc(doc(other, "orders/o1")));
  });

  it("orders: 클라이언트 update 전면 차단 (Cloud Function only)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "orders/o1"), {
        hospitalId: "h1",
        vendorIds: [],
        userId: "u-buyer",
      });
    });
    const mine = authed("u-buyer", { role: "BUYER_OWNER", hospitalId: "h1" });
    await assertFails(updateDoc(doc(mine, "orders/o1"), { status: "PAID" }));
  });

  it("carts: 본인 hospital 카트만 read/write", async () => {
    const mine = authed("u-buyer", { role: "BUYER_OWNER", hospitalId: "h1" });
    const other = authed("u-x", { role: "BUYER_OWNER", hospitalId: "h2" });
    await assertSucceeds(setDoc(doc(mine, "carts/h1"), { items: [] }));
    await assertFails(setDoc(doc(other, "carts/h1"), { items: [] }));
  });
});

describe("권한 상승 차단", () => {
  it("users: 본인 문서의 role 변경 불가", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/u1"), {
        name: "홍길동",
        role: "BUYER_STAFF",
      });
    });
    const me = authed("u1", { role: "BUYER_STAFF" });
    // 이름 변경은 OK
    await assertSucceeds(updateDoc(doc(me, "users/u1"), { name: "김철수" }));
    // role 상승은 차단
    await assertFails(updateDoc(doc(me, "users/u1"), { role: "ADMIN" }));
  });

  it("products: 비ACTIVE 상품은 비소유 vendor/비로그인 read 불가", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "products/p1"), {
        status: "DRAFT",
        vendorId: "v1",
        moderation: { status: "DRAFT" },
      });
    });
    const owner = authed("u-v1", { role: "VENDOR_OWNER", vendorId: "v1" });
    const stranger = authed("u-v2", { role: "VENDOR_OWNER", vendorId: "v2" });
    await assertSucceeds(getDoc(doc(owner, "products/p1")));
    await assertFails(getDoc(doc(stranger, "products/p1")));
  });
});
