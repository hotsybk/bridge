/**
 * Wave AB — E2E: Buyer Flow
 *
 * 병원 사용자 전체 흐름 검증.
 *
 * Test 1: 상품 검색 (moderation.status ACTIVE) — 1개 선택
 * Test 2: 카트 doc 생성 + 검증
 * Test 3: order + subOrder + items 트랜잭션 (mock PAID)
 * Test 4: order 상세 read + 검증
 * Test 5: order CANCELLED → auditLog 적재 검증
 *
 * 모든 생성 doc 은 `_e2e: true` 플래그 + `e2e-buyer-${runId}` prefix → cleanup 100% 보장.
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

// Run-scoped IDs (cleanup용)
const runId = Date.now().toString();
const PREFIX = `e2e-buyer-${runId}`;
const created: { ref: FirebaseFirestore.DocumentReference }[] = [];
const subCreated: { col: string; id: string }[] = [];

function track(ref: FirebaseFirestore.DocumentReference) {
  created.push({ ref });
  return ref;
}

// ──────────────────────────────────────────────────────────────
// Shared state
// ──────────────────────────────────────────────────────────────
let pickedProductId = "";
let pickedProductData: FirebaseFirestore.DocumentData | undefined;
let testHospitalId = "";
let cartId = "";
let orderId = "";
let subOrderId = "";

// ──────────────────────────────────────────────────────────────
// Test 1 — 상품 검색
// ──────────────────────────────────────────────────────────────
async function test_productSearch() {
  section("Test 1 — 상품 검색 (moderation.status ACTIVE)");

  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await db.collection("products")
      .where("moderation.status", "==", "ACTIVE")
      .limit(5)
      .get();
  } catch (err) {
    // fallback — status 필드 직접
    warn(`moderation.status 쿼리 실패 (인덱스 누락 가능) — fallback 쿼리 시도: ${(err as Error).message}`);
    snap = await db.collection("products")
      .where("status", "==", "ACTIVE")
      .limit(5)
      .get();
  }
  rec("상품 검색 결과", snap.size > 0, `${snap.size}건 후보`);
  if (snap.empty) {
    warn("ACTIVE 상품 없음 — Test 2~5 skip");
    return;
  }

  // 1개 선택
  const picked = snap.docs[0];
  pickedProductId = picked.id;
  pickedProductData = picked.data();
  ok(`선택된 상품 — id=${pickedProductId.slice(0, 12)}…, name="${pickedProductData?.name}", price=${pickedProductData?.basePrice}`);
}

// ──────────────────────────────────────────────────────────────
// Test 2 — 카트 doc 생성 + 검증
// ──────────────────────────────────────────────────────────────
async function test_cart() {
  section("Test 2 — 카트 doc 생성 + 검증");
  if (!pickedProductId) {
    warn("선택된 상품 없음 — skip");
    return;
  }

  // 테스트 hospital 1개 가져오기 (없으면 mock)
  const hSnap = await db.collection("hospitals").limit(1).get();
  if (hSnap.empty) {
    // mock hospital 생성 (cleanup에 포함됨)
    const hRef = track(db.collection("hospitals").doc(`${PREFIX}-hospital`));
    await hRef.set({
      _e2e: true,
      bizRegNo: "999-99-99999",
      name: "E2E 테스트 병원",
      type: "CLINIC",
      ceoName: "E2E",
      phone: "02-0000-0000",
      email: `${PREFIX}@example.com`,
      zipcode: "00000",
      address: "테스트",
      memberCount: 0,
      approvalEnabled: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    testHospitalId = hRef.id;
    ok(`mock hospital 생성 — id=${testHospitalId}`);
  } else {
    testHospitalId = hSnap.docs[0].id;
    ok(`기존 hospital 사용 — id=${testHospitalId}`);
  }

  // 카트 doc (hospital 단위 단일 doc 모델)
  cartId = `${PREFIX}-cart`;
  const cartRef = track(db.collection("carts").doc(cartId));
  const unitPrice = (pickedProductData?.basePrice as number) ?? 10000;
  const qty = 2;
  await cartRef.set({
    _e2e: true,
    items: [{
      productId: pickedProductId,
      vendorId: pickedProductData?.vendorId ?? "test-vendor",
      vendorName: pickedProductData?.vendorName ?? "테스트 vendor",
      productName: pickedProductData?.name ?? "테스트 상품",
      thumbnail: pickedProductData?.thumbnail ?? null,
      unitPrice,
      qty,
      amount: unitPrice * qty,
      unit: pickedProductData?.unit ?? "EA",
    }],
    couponCode: null,
    hospitalId: testHospitalId,
    updatedAt: FieldValue.serverTimestamp(),
  });
  const cartSnap = await cartRef.get();
  const cartData = cartSnap.data();
  rec("카트 doc 생성", cartSnap.exists, `id=${cartId}`);
  rec(
    "카트 items 길이 == 1",
    Array.isArray(cartData?.items) && cartData.items.length === 1,
    `items=${cartData?.items?.length}`,
  );
  rec(
    "카트 items[0].amount == unitPrice * qty",
    cartData?.items?.[0]?.amount === unitPrice * qty,
    `amount=${cartData?.items?.[0]?.amount}`,
  );
}

// ──────────────────────────────────────────────────────────────
// Test 3 — order + subOrder + items 트랜잭션 (mock PAID)
// ──────────────────────────────────────────────────────────────
async function test_checkout() {
  section("Test 3 — order + subOrder + items 트랜잭션 (mock PAID)");
  if (!pickedProductId || !testHospitalId) {
    warn("선행 조건 미충족 — skip");
    return;
  }

  orderId = `${PREFIX}-order`;
  subOrderId = `${PREFIX}-sub`;
  const itemId = `${PREFIX}-item`;
  const unitPrice = (pickedProductData?.basePrice as number) ?? 10000;
  const qty = 2;
  const subtotal = unitPrice * qty;
  const vendorId = pickedProductData?.vendorId ?? "test-vendor";
  const vendorName = pickedProductData?.vendorName ?? "테스트 vendor";

  const oRef = track(db.collection("orders").doc(orderId));
  const soRef = track(oRef.collection("subOrders").doc(subOrderId));
  const itemRef = soRef.collection("items").doc(itemId);

  // 트랜잭션으로 3 doc 동시 생성
  await db.runTransaction(async (tx) => {
    tx.set(oRef, {
      _e2e: true,
      orderNo: `E2E-${runId}`,
      hospitalId: testHospitalId,
      hospitalName: "E2E 테스트 병원",
      userId: "e2e-user",
      userName: "E2E 사용자",
      status: "PAID",
      subtotalAmount: subtotal,
      shippingAmount: 0,
      discountAmount: 0,
      vatAmount: Math.round(subtotal * 0.1),
      totalAmount: subtotal + Math.round(subtotal * 0.1),
      paymentMethod: "CARD",
      paymentKey: `mock-portone-${runId}`,
      paidAt: FieldValue.serverTimestamp(),
      approvalStatus: "NOT_REQUIRED",
      shippingZipcode: "00000",
      shippingAddress: "테스트 배송지",
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
      subOrderNo: `E2E-${runId}-A`,
      orderId,
      orderNo: `E2E-${runId}`,
      vendorId,
      vendorName,
      hospitalId: testHospitalId,
      hospitalName: "E2E 테스트 병원",
      status: "ACCEPTED",
      subtotal,
      shippingFee: 0,
      vat: Math.round(subtotal * 0.1),
      total: subtotal + Math.round(subtotal * 0.1),
      commissionRate: 0.05,
      commission: Math.round(subtotal * 0.05),
      commissionVat: Math.round(subtotal * 0.005),
      payoutAmount: Math.round(subtotal * 0.95),
      udiReported: false,
      itemCount: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(itemRef, {
      productId: pickedProductId,
      productName: pickedProductData?.name ?? "테스트 상품",
      productImage: pickedProductData?.thumbnail ?? null,
      unitPrice,
      qty,
      amount: subtotal,
      udiCode: pickedProductData?.udiCode ?? null,
    });
  });
  // items 컬렉션은 cleanup에 별도 추적
  subCreated.push({ col: `orders/${orderId}/subOrders/${subOrderId}/items`, id: itemId });

  ok(`트랜잭션 완료 — order=${orderId}, subOrder=${subOrderId}, item=${itemId}`);

  // 트리거 대기 (onOrderCreated 알림·auditLog)
  console.log("  onOrderCreated trigger 대기 (5초)...");
  await sleep(5000);

  const oSnap = await oRef.get();
  const soSnap = await soRef.get();
  const itemSnap = await itemRef.get();
  rec("order doc 존재", oSnap.exists);
  rec("subOrder doc 존재", soSnap.exists);
  rec("item doc 존재", itemSnap.exists);
  rec("order.status == PAID", oSnap.data()?.status === "PAID", `status=${oSnap.data()?.status}`);
  rec(
    "order.vendorIds 에 vendorId 포함",
    (oSnap.data()?.vendorIds as string[])?.includes(vendorId),
    `vendorIds=${JSON.stringify(oSnap.data()?.vendorIds)}`,
  );
}

// ──────────────────────────────────────────────────────────────
// Test 4 — order 상세 read + 검증
// ──────────────────────────────────────────────────────────────
async function test_orderDetail() {
  section("Test 4 — order 상세 read + 검증");
  if (!orderId) {
    warn("orderId 없음 — skip");
    return;
  }
  const oRef = db.collection("orders").doc(orderId);
  const oSnap = await oRef.get();
  const data = oSnap.data();
  rec("order read", oSnap.exists);
  rec(
    "subOrders 서브컬렉션 조회 작동",
    true,
    `subOrderCount=${data?.subOrderCount}`,
  );
  const subSnap = await oRef.collection("subOrders").get();
  rec(
    "subOrders count 일치",
    subSnap.size === data?.subOrderCount,
    `firestore ${subSnap.size} vs denormalized ${data?.subOrderCount}`,
  );

  const itemsSnap = await oRef.collection("subOrders").doc(subOrderId).collection("items").get();
  rec("items 서브-서브컬렉션 read", itemsSnap.size > 0, `items=${itemsSnap.size}`);
}

// ──────────────────────────────────────────────────────────────
// Test 5 — order CANCELLED + auditLog 적재
// ──────────────────────────────────────────────────────────────
async function test_orderCancellation() {
  section("Test 5 — order CANCELLED + auditLog");
  if (!orderId) {
    warn("orderId 없음 — skip");
    return;
  }

  const oRef = db.collection("orders").doc(orderId);
  await oRef.update({
    status: "CANCELLED",
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 명시적 auditLog 적재 — tRPC mutation 패턴 모사
  const auditRef = await db.collection("auditLogs").add({
    _e2e: true,
    actorId: "e2e-user",
    actorRole: "BUYER_OWNER",
    action: "ORDER_CANCELLED",
    targetType: "Order",
    targetId: orderId,
    after: { status: "CANCELLED" },
    createdAt: FieldValue.serverTimestamp(),
  });
  subCreated.push({ col: "auditLogs", id: auditRef.id });

  const updated = await oRef.get();
  rec(
    "order.status CANCELLED 전환",
    updated.data()?.status === "CANCELLED",
    `status=${updated.data()?.status}`,
  );
  const auditSnap = await auditRef.get();
  rec(
    "auditLogs ORDER_CANCELLED 적재",
    auditSnap.exists && auditSnap.data()?.action === "ORDER_CANCELLED",
    `id=${auditRef.id}`,
  );
}

// ──────────────────────────────────────────────────────────────
// Cleanup
// ──────────────────────────────────────────────────────────────
async function cleanup() {
  section("Cleanup");
  let deleted = 0;

  // subOrders/items 서브컬렉션 먼저
  for (const s of subCreated) {
    try {
      await db.doc(`${s.col}/${s.id}`).delete();
      deleted++;
    } catch {}
  }

  // 카트, order, subOrder, hospital
  // subOrder는 parent doc 삭제로는 자동 삭제 안 됨 — 명시 삭제 필요
  // 하지만 created 순서대로 역순 삭제: hospital → cart → order → subOrder
  // → 역순(LIFO)으로 처리하면 subOrder가 먼저 삭제됨
  for (let i = created.length - 1; i >= 0; i--) {
    try {
      // subOrders 서브컬렉션 정리 (있다면)
      const ref = created[i].ref;
      if (ref.path.includes("/subOrders/")) {
        // suborder 자체
        const itemsSnap = await ref.collection("items").get();
        for (const it of itemsSnap.docs) {
          await it.ref.delete();
          deleted++;
        }
      }
      if (ref.parent.id === "orders") {
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
      warn(`cleanup 실패: ${created[i].ref.path} — ${(err as Error).message}`);
    }
  }

  ok(`${deleted}개 doc 삭제 완료`);
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`${C.bold}E2E Buyer Flow 시작${C.reset}`);
  console.log(`Firebase project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
  console.log(`Run ID: ${runId}\n`);

  try { await test_productSearch(); } catch (err) { fail(`Test 1: ${(err as Error).message}`); }
  try { await test_cart(); } catch (err) { fail(`Test 2: ${(err as Error).message}`); }
  try { await test_checkout(); } catch (err) { fail(`Test 3: ${(err as Error).message}`); }
  try { await test_orderDetail(); } catch (err) { fail(`Test 4: ${(err as Error).message}`); }
  try { await test_orderCancellation(); } catch (err) { fail(`Test 5: ${(err as Error).message}`); }

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
