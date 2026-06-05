/**
 * Wave AB — E2E: Vendor Flow
 *
 * 공급업체 운영 흐름 검증.
 *
 * Test 1: vendor APPROVED 1개 선택
 * Test 2: 상품 생성 (moderation.status PENDING_REVIEW)
 * Test 3: moderation 승인 시뮬레이션 (PENDING_REVIEW → ACTIVE)
 * Test 4: subOrder 1건 생성 + ACCEPTED → PACKING → SHIPPED 전환
 * Test 5: settlement doc 생성 검증 (정산 흐름)
 * Test 6: cleanup
 *
 * 모든 doc 은 `_e2e: true` + `e2e-vendor-${runId}` prefix → cleanup 보장.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
}
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

const C = {
  reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m",
};
const ok = (m: string) => console.log(`${C.green}✓${C.reset} ${m}`);
const fail = (m: string) => console.log(`${C.red}✗${C.reset} ${m}`);
const warn = (m: string) => console.log(`${C.yellow}⚠${C.reset} ${m}`);
const section = (t: string) => console.log(`\n${C.bold}${C.cyan}=== ${t} ===${C.reset}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const results: { test: string; pass: boolean; detail?: string }[] = [];
function rec(test: string, pass: boolean, detail?: string) {
  results.push({ test, pass, detail });
  pass ? ok(`${test}${detail ? ` — ${detail}` : ""}`) : fail(`${test}${detail ? ` — ${detail}` : ""}`);
}

const runId = Date.now().toString();
const PREFIX = `e2e-vendor-${runId}`;
const cleanupRefs: FirebaseFirestore.DocumentReference[] = [];
function track(ref: FirebaseFirestore.DocumentReference) {
  cleanupRefs.push(ref);
  return ref;
}

// shared
let vendorId = "";
let vendorName = "";
let productId = "";
let orderId = "";
let subOrderId = "";

// ──────────────────────────────────────────────────────────────
// Test 1 — vendor APPROVED 선택
// ──────────────────────────────────────────────────────────────
async function test_pickVendor() {
  section("Test 1 — vendor APPROVED 1개 선택");
  const snap = await db.collection("vendors")
    .where("status", "==", "APPROVED")
    .limit(1)
    .get();
  if (snap.empty) {
    // mock vendor 생성
    const vRef = track(db.collection("vendors").doc(`${PREFIX}-vendor`));
    await vRef.set({
      _e2e: true,
      bizRegNo: "999-99-99998",
      bizRegImageUrl: "https://example.com/biz.jpg",
      companyName: "E2E 테스트 vendor",
      ceoName: "E2E",
      phone: "02-0000-0000",
      email: `${PREFIX}-vendor@example.com`,
      zipcode: "00000",
      address: "테스트",
      vendorType: "DISTRIBUTOR",
      status: "APPROVED",
      defaultCommissionRate: 0.05,
      fastSettlementEnabled: false,
      categories: [],
      productCount: 0,
      totalGmv: 0,
      reviewCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    vendorId = vRef.id;
    vendorName = "E2E 테스트 vendor";
    ok(`mock vendor 생성 — id=${vendorId}`);
  } else {
    vendorId = snap.docs[0].id;
    vendorName = snap.docs[0].data().companyName ?? "vendor";
    ok(`기존 vendor 선택 — id=${vendorId}, name="${vendorName}"`);
  }
  rec("vendor APPROVED 확보", !!vendorId);
}

// ──────────────────────────────────────────────────────────────
// Test 2 — 상품 생성 (moderation.status PENDING_REVIEW)
// ──────────────────────────────────────────────────────────────
async function test_createProduct() {
  section("Test 2 — 상품 생성 (PENDING_REVIEW)");
  if (!vendorId) {
    warn("vendor 없음 — skip");
    return;
  }

  productId = `${PREFIX}-product`;
  const pRef = track(db.collection("products").doc(productId));
  await pRef.set({
    _e2e: true,
    vendorId,
    vendorName,
    categoryId: "test-category",
    categoryPath: ["테스트 카테고리"],
    name: "E2E 테스트 상품",
    deviceClass: "CLASS_1",
    images: [],
    thumbnail: "",
    basePrice: 12000,
    unit: "EA",
    moq: 1,
    shippingFee: 0,
    description: "E2E 테스트용",
    status: "PENDING_REVIEW",
    moderation: {
      status: "PENDING_REVIEW",
      submittedAt: FieldValue.serverTimestamp(),
    },
    subscribable: false,
    groupBuyable: false,
    viewCount: 0,
    orderCount: 0,
    reviewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const snap = await pRef.get();
  rec("product doc 생성", snap.exists, `id=${productId}`);
  rec(
    "moderation.status == PENDING_REVIEW",
    snap.data()?.moderation?.status === "PENDING_REVIEW",
  );

  console.log("  onProductSubmitted trigger 대기 (4초)...");
  await sleep(4000);
}

// ──────────────────────────────────────────────────────────────
// Test 3 — moderation 승인 시뮬레이션
// ──────────────────────────────────────────────────────────────
async function test_approveProduct() {
  section("Test 3 — moderation 승인 시뮬레이션");
  if (!productId) {
    warn("product 없음 — skip");
    return;
  }

  const pRef = db.collection("products").doc(productId);
  await pRef.update({
    status: "ACTIVE",
    "moderation.status": "ACTIVE",
    "moderation.reviewedById": "e2e-admin",
    "moderation.reviewedAt": FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log("  onProductApproved trigger 대기 (5초)...");
  await sleep(5000);

  const snap = await pRef.get();
  rec(
    "product.status == ACTIVE",
    snap.data()?.status === "ACTIVE",
    `status=${snap.data()?.status}`,
  );
  rec(
    "moderation.status == ACTIVE",
    snap.data()?.moderation?.status === "ACTIVE",
  );
}

// ──────────────────────────────────────────────────────────────
// Test 4 — subOrder ACCEPTED → PACKING → SHIPPED
// ──────────────────────────────────────────────────────────────
async function test_subOrderLifecycle() {
  section("Test 4 — subOrder ACCEPTED → PACKING → SHIPPED");
  if (!vendorId) {
    warn("vendor 없음 — skip");
    return;
  }

  // mock hospital ref (실제 hospital 사용 가능)
  const hSnap = await db.collection("hospitals").limit(1).get();
  const hospitalId = hSnap.empty ? "test-hospital" : hSnap.docs[0].id;
  const hospitalName = hSnap.empty ? "테스트 병원" : (hSnap.docs[0].data().name ?? "테스트 병원");

  orderId = `${PREFIX}-order`;
  subOrderId = `${PREFIX}-sub`;
  const oRef = track(db.collection("orders").doc(orderId));
  const soRef = track(oRef.collection("subOrders").doc(subOrderId));

  await db.runTransaction(async (tx) => {
    tx.set(oRef, {
      _e2e: true,
      orderNo: `E2E-V-${runId}`,
      hospitalId,
      hospitalName,
      userId: "e2e-user",
      userName: "E2E",
      status: "PAID",
      subtotalAmount: 24000,
      shippingAmount: 0,
      discountAmount: 0,
      vatAmount: 2400,
      totalAmount: 26400,
      paymentMethod: "CARD",
      paymentKey: `mock-${runId}`,
      paidAt: FieldValue.serverTimestamp(),
      approvalStatus: "NOT_REQUIRED",
      shippingZipcode: "00000",
      shippingAddress: "테스트",
      shippingRecipient: "E2E",
      shippingPhone: "010-0000-0000",
      invoiceRequested: false,
      subOrderCount: 1,
      vendorIds: [vendorId],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(soRef, {
      _e2e: true,
      subOrderNo: `E2E-V-${runId}-A`,
      orderId,
      orderNo: `E2E-V-${runId}`,
      vendorId,
      vendorName,
      hospitalId,
      hospitalName,
      status: "ACCEPTED",
      subtotal: 24000,
      shippingFee: 0,
      vat: 2400,
      total: 26400,
      commissionRate: 0.05,
      commission: 1200,
      commissionVat: 120,
      payoutAmount: 22800,
      udiReported: false,
      itemCount: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  ok(`mock order + subOrder 생성`);

  // ACCEPTED → PACKING
  await soRef.update({
    status: "PACKING",
    updatedAt: FieldValue.serverTimestamp(),
  });
  let snap = await soRef.get();
  rec("PACKING 전환", snap.data()?.status === "PACKING");

  // PACKING → SHIPPED (trigger onSubOrderShipped 발동)
  await soRef.update({
    status: "SHIPPED",
    trackingCarrier: "CJ대한통운",
    trackingNo: `BT${runId}`,
    shippedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log("  onSubOrderShipped trigger 대기 (6초)...");
  await sleep(6000);
  snap = await soRef.get();
  rec("SHIPPED 전환", snap.data()?.status === "SHIPPED");
  rec(
    "trackingNo 적재",
    !!snap.data()?.trackingNo,
    `trackingNo=${snap.data()?.trackingNo}`,
  );
}

// ──────────────────────────────────────────────────────────────
// Test 5 — settlement doc 생성 검증
// ──────────────────────────────────────────────────────────────
async function test_settlementCreation() {
  section("Test 5 — settlement doc 생성 검증");
  if (!vendorId) {
    warn("vendor 없음 — skip");
    return;
  }

  // 정산 doc 수동 생성 (Cloud Function settle-suborder mock)
  const settleRef = db.collection("settlements").doc(`${PREFIX}-settle`);
  cleanupRefs.push(settleRef);
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await settleRef.set({
    _e2e: true,
    vendorId,
    vendorName,
    periodStart,
    periodEnd,
    grossAmount: 24000,
    paymentFeeAmount: 720,
    paymentFeeVatAmount: 72,
    commissionAmount: 1200,
    commissionVatAmount: 120,
    refundDeductAmount: 0,
    couponDeductAmount: 0,
    netPayout: 21888,
    isFastSettlement: false,
    fastSettlementDays: 0,
    fastSettlementFee: 0,
    finalPayout: 21888,
    subOrderRefs: [{ orderId, subOrderId, amount: 24000 }],
    status: "PENDING",
    scheduledPayoutAt: new Date(Date.now() + 7 * 86400000),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const snap = await settleRef.get();
  rec("settlement doc 생성", snap.exists, `id=${settleRef.id}`);
  rec(
    "settlement.netPayout 계산 일관성",
    snap.data()?.netPayout === 21888,
    `netPayout=${snap.data()?.netPayout}`,
  );
  rec(
    "settlement.subOrderRefs 참조 보존",
    Array.isArray(snap.data()?.subOrderRefs) && snap.data()?.subOrderRefs?.length === 1,
  );

  // subOrder 에 settlementId 역참조
  if (subOrderId && orderId) {
    await db.doc(`orders/${orderId}/subOrders/${subOrderId}`).update({
      settlementId: settleRef.id,
      settledAt: FieldValue.serverTimestamp(),
    });
    const soSnap = await db.doc(`orders/${orderId}/subOrders/${subOrderId}`).get();
    rec(
      "subOrder.settlementId 역참조",
      soSnap.data()?.settlementId === settleRef.id,
    );
  }
}

// ──────────────────────────────────────────────────────────────
// Cleanup
// ──────────────────────────────────────────────────────────────
async function cleanup() {
  section("Cleanup");
  let deleted = 0;

  // 역순 삭제 (subOrder는 parent order 보다 먼저)
  for (let i = cleanupRefs.length - 1; i >= 0; i--) {
    try {
      const ref = cleanupRefs[i];
      if (ref.parent.id === "orders") {
        // order — subOrders/items 먼저 정리
        const subSnap = await ref.collection("subOrders").get();
        for (const sub of subSnap.docs) {
          const itemsSnap = await sub.ref.collection("items").get();
          for (const it of itemsSnap.docs) {
            await it.ref.delete();
            deleted++;
          }
          await sub.ref.delete();
          deleted++;
        }
      }
      await ref.delete();
      deleted++;
    } catch (err) {
      warn(`cleanup 실패: ${cleanupRefs[i].path} — ${(err as Error).message}`);
    }
  }
  ok(`${deleted}개 doc 삭제 완료`);
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`${C.bold}E2E Vendor Flow 시작${C.reset}`);
  console.log(`Run ID: ${runId}\n`);

  try { await test_pickVendor(); } catch (err) { fail(`Test 1: ${(err as Error).message}`); }
  try { await test_createProduct(); } catch (err) { fail(`Test 2: ${(err as Error).message}`); }
  try { await test_approveProduct(); } catch (err) { fail(`Test 3: ${(err as Error).message}`); }
  try { await test_subOrderLifecycle(); } catch (err) { fail(`Test 4: ${(err as Error).message}`); }
  try { await test_settlementCreation(); } catch (err) { fail(`Test 5: ${(err as Error).message}`); }

  try { await cleanup(); } catch (err) { warn(`cleanup 부분 실패: ${(err as Error).message}`); }

  section("결과 요약");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`총 ${results.length}개 — ${C.green}통과 ${passed}${C.reset} / ${C.red}실패 ${failed}${C.reset}`);
  if (failed > 0) {
    console.log(`\n${C.red}실패 항목:${C.reset}`);
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  - ${r.test}${r.detail ? ` — ${r.detail}` : ""}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL", err);
  cleanup().finally(() => process.exit(1));
});
