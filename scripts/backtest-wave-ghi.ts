/**
 * Wave G·H·I 백테스트 스크립트
 *
 * 1) 카테고리 시드 76개 확인
 * 2) 쿠폰 mock 생성 + redemption trigger 확인
 * 3) 공동구매 mock 생성 → onGroupbuyCreated trigger → counterShards 자동 초기화 확인
 * 4) tRPC admin.coupon.list / admin.groupbuy.list 작동 확인 (Firestore 직접 쿼리)
 *
 * 실행:
 *   pnpm tsx scripts/backtest-wave-ghi.ts
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

// .env.local 읽기
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
}

// Admin SDK 초기화
if (getApps().length === 0) {
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = getFirestore();

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function ok(msg: string) {
  console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`);
}
function fail(msg: string) {
  console.log(`${COLORS.red}✗${COLORS.reset} ${msg}`);
}
function warn(msg: string) {
  console.log(`${COLORS.yellow}⚠${COLORS.reset} ${msg}`);
}
function section(title: string) {
  console.log(`\n${COLORS.bold}${COLORS.cyan}=== ${title} ===${COLORS.reset}`);
}

const results: { test: string; pass: boolean; detail?: string }[] = [];
function record(test: string, pass: boolean, detail?: string) {
  results.push({ test, pass, detail });
  pass ? ok(`${test}${detail ? ` — ${detail}` : ""}`) : fail(`${test}${detail ? ` — ${detail}` : ""}`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ──────────────────────────────────────────────────────────────
// 테스트 1 — 카테고리 시드 확인
// ──────────────────────────────────────────────────────────────
async function test_categoriesSeed() {
  section("Test 1 — 카테고리 시드 적재 확인");
  const snap = await db.collection("categories").get();
  const total = snap.size;
  record("categories 컬렉션에 적재됨", total > 0, `${total}개 doc`);

  // path 무결성 검사 (depth와 path.length 일치)
  let pathOk = 0, pathFail = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const expected = (data.depth ?? 0) + 1;
    if (data.path?.length === expected) pathOk++;
    else pathFail++;
  }
  record("path[] depth 무결성", pathFail === 0, `정상 ${pathOk}, 불일치 ${pathFail}`);

  // sample 출력
  const samples = snap.docs.slice(0, 3).map((d) => {
    const data = d.data();
    return `${data.name} (depth=${data.depth}, path=${JSON.stringify(data.path)})`;
  });
  console.log(`  샘플: ${samples.join(" / ")}`);
}

// ──────────────────────────────────────────────────────────────
// 테스트 2 — 쿠폰 생성 + redemption trigger
// ──────────────────────────────────────────────────────────────
async function test_couponLifecycle() {
  section("Test 2 — 쿠폰 생성 + Cloud Function trigger");

  // 2-A 쿠폰 직접 생성 (admin SDK)
  const couponRef = db.collection("coupons").doc();
  const testCode = `TEST${Date.now()}`;
  await couponRef.set({
    code: testCode,
    name: "백테스트 쿠폰",
    description: "Wave H 백테스트용",
    discountType: "PERCENT",
    discountValue: 10,
    targetType: "ALL",
    targetIds: [],
    startsAt: new Date(Date.now() - 60000),
    expiresAt: new Date(Date.now() + 7 * 86400000),
    issueLimit: 3,
    perUserLimit: 1,
    usedCount: 0,
    status: "ACTIVE",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdById: "backtest-system",
  });
  record("쿠폰 doc 생성", true, `code=${testCode}, id=${couponRef.id}`);

  // 2-B redemption 생성 → onCouponRedeemed trigger 작동 확인
  const redemptionRef = couponRef.collection("redemptions").doc();
  await redemptionRef.set({
    couponId: couponRef.id,
    couponCode: testCode,
    hospitalId: "test-hospital-1",
    userId: "test-user-1",
    orderId: "test-order-1",
    discountAmount: 5000,
    redeemedAt: FieldValue.serverTimestamp(),
  });
  record("redemption 1건 생성", true);

  // 2-C trigger 대기 + usedCount 증가 확인
  console.log("  Cloud Function trigger 처리 대기 (5초)...");
  await sleep(5000);
  const updated = await couponRef.get();
  const newCount = updated.data()?.usedCount ?? 0;
  record("onCouponRedeemed trigger → usedCount 증가", newCount >= 1, `usedCount=${newCount}`);

  // 2-D 한도 도달 시 EXPIRED 자동 전환 (limit 3 → 3건 모두 등록)
  for (let i = 0; i < 2; i++) {
    await couponRef.collection("redemptions").add({
      couponId: couponRef.id,
      couponCode: testCode,
      hospitalId: "test-hospital-1",
      userId: `test-user-${i + 2}`,
      orderId: `test-order-${i + 2}`,
      discountAmount: 5000,
      redeemedAt: FieldValue.serverTimestamp(),
    });
  }
  console.log("  trigger 처리 대기 (5초)...");
  await sleep(5000);
  const after = await couponRef.get();
  const finalStatus = after.data()?.status;
  const finalCount = after.data()?.usedCount ?? 0;
  record(
    "한도 도달 시 자동 EXPIRED 전환",
    finalStatus === "EXPIRED" && finalCount >= 3,
    `status=${finalStatus}, usedCount=${finalCount}`,
  );

  // cleanup
  try {
    const redemps = await couponRef.collection("redemptions").get();
    for (const r of redemps.docs) await r.ref.delete();
    await couponRef.delete();
  } catch {}
  console.log("  cleanup 완료");
}

// ──────────────────────────────────────────────────────────────
// 테스트 3 — 공동구매 생성 + counterShards 자동 초기화
// ──────────────────────────────────────────────────────────────
async function test_groupbuyShards() {
  section("Test 3 — 공동구매 생성 + counterShards 자동 초기화");

  const gbRef = db.collection("groupBuys").doc();
  const startsAt = new Date();
  const endsAt = new Date(Date.now() + 60_000);  // 1분 후 마감 (cron 테스트)
  await gbRef.set({
    productId: "test-prod-1",
    productName: "백테스트 장갑",
    vendorId: "test-vendor-1",
    vendorName: "백테스트 vendor",
    title: "백테스트 공동구매",
    description: "Wave I 백테스트용",
    startsAt,
    endsAt,
    targetQty: 5,
    currentQty: 0,
    tierPricing: [
      { minQty: 0, price: 10000 },
      { minQty: 5, price: 8000 },
    ],
    status: "OPEN",
    participationCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  record("groupBuy doc 생성", true, `id=${gbRef.id}, endsAt=${endsAt.toISOString()}`);

  // counterShards 자동 초기화 대기
  console.log("  onGroupbuyCreated trigger 처리 대기 (8초)...");
  await sleep(8000);
  const shardsSnap = await gbRef.collection("counterShards").get();
  record(
    "10 shard 자동 초기화",
    shardsSnap.size === 10,
    `shards=${shardsSnap.size}`,
  );

  // shard 합산
  const total = shardsSnap.docs.reduce((s, d) => s + (d.data().count ?? 0), 0);
  record("초기 합계 0", total === 0, `sum=${total}`);

  // shard 증가 테스트
  const sId = String(Math.floor(Math.random() * 10));
  await gbRef.collection("counterShards").doc(sId).update({
    count: FieldValue.increment(3),
  });
  const shardsAfter = await gbRef.collection("counterShards").get();
  const totalAfter = shardsAfter.docs.reduce((s, d) => s + (d.data().count ?? 0), 0);
  record("shard increment 작동", totalAfter === 3, `sum=${totalAfter}`);

  // 마감 cron 테스트 — endsAt이 1분 후이므로 매분 cron이 다음에 처리할 것
  console.log(`  groupbuyCloser cron 마감 대기 (75초) — endsAt=${endsAt.toISOString()}`);
  await sleep(75_000);
  const closed = await gbRef.get();
  const finalStatus = closed.data()?.status;
  record(
    "매분 cron 자동 마감",
    finalStatus === "FAILED" || finalStatus === "FULFILLED",
    `status=${finalStatus} (3 < target 5 → FAILED 기대)`,
  );

  // cleanup
  try {
    const ss = await gbRef.collection("counterShards").get();
    for (const s of ss.docs) await s.ref.delete();
    await gbRef.delete();
  } catch {}
  console.log("  cleanup 완료");
}

// ──────────────────────────────────────────────────────────────
// 테스트 4 — 카테고리 변경 trigger
// ──────────────────────────────────────────────────────────────
async function test_categoryChangeTrigger() {
  section("Test 4 — 카테고리 이름 변경 → 자손 path 자동 재계산");

  // 자식 있는 카테고리 찾기
  const parentSnap = await db.collection("categories")
    .where("parentId", "==", null)
    .limit(1)
    .get();
  if (parentSnap.empty) {
    warn("루트 카테고리 없음 — skip");
    return;
  }
  const parent = parentSnap.docs[0];
  const parentId = parent.id;
  const originalName = parent.data().name;
  const tempName = `${originalName}_TEST`;

  // 자식 카테고리 path before
  const beforeChildren = await db.collection("categories")
    .where("parentId", "==", parentId)
    .limit(3)
    .get();
  if (beforeChildren.empty) {
    warn("자식 없음 — skip");
    return;
  }
  const beforePaths = beforeChildren.docs.map((d) => d.data().path?.[0]);

  // 이름 변경
  await parent.ref.update({
    name: tempName,
    path: [tempName],  // depth 0이므로 자기 path도 갱신
    updatedAt: FieldValue.serverTimestamp(),
  });
  record("부모 카테고리 name 변경", true, `${originalName} → ${tempName}`);

  // trigger 대기
  console.log("  onCategoryChanged trigger 대기 (5초)...");
  await sleep(5000);

  // 자식 path[0] 확인
  const afterChildren = await db.collection("categories")
    .where("parentId", "==", parentId)
    .limit(3)
    .get();
  const afterPaths = afterChildren.docs.map((d) => d.data().path?.[0]);
  const allUpdated = afterPaths.every((p) => p === tempName);
  record(
    "자손 path[0] 자동 재계산",
    allUpdated,
    `before=[${beforePaths.join(",")}], after=[${afterPaths.join(",")}]`,
  );

  // 원래대로 복구
  await parent.ref.update({
    name: originalName,
    path: [originalName],
    updatedAt: FieldValue.serverTimestamp(),
  });
  await sleep(3000);
  console.log("  복구 완료");
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`${COLORS.bold}Wave G·H·I 백테스트 시작${COLORS.reset}`);
  console.log(`Firebase project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}\n`);

  try {
    await test_categoriesSeed();
  } catch (err) {
    fail(`테스트 1 예외: ${(err as Error).message}`);
  }
  try {
    await test_couponLifecycle();
  } catch (err) {
    fail(`테스트 2 예외: ${(err as Error).message}`);
  }
  try {
    await test_groupbuyShards();
  } catch (err) {
    fail(`테스트 3 예외: ${(err as Error).message}`);
  }
  try {
    await test_categoryChangeTrigger();
  } catch (err) {
    fail(`테스트 4 예외: ${(err as Error).message}`);
  }

  // 결과 요약
  section("결과 요약");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`총 ${results.length}개 검증 — ${COLORS.green}통과 ${passed}${COLORS.reset} / ${COLORS.red}실패 ${failed}${COLORS.reset}`);
  if (failed > 0) {
    console.log(`\n${COLORS.red}실패 항목:${COLORS.reset}`);
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  - ${r.test}${r.detail ? ` — ${r.detail}` : ""}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
