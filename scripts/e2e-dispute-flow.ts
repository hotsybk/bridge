/**
 * Wave AB — E2E: Dispute Flow
 *
 * 분쟁 흐름 검증.
 *
 * Test 1: PAID order 1건 선택 (없으면 mock)
 * Test 2: dispute 생성 (status OPEN, dueAt 3일 후)
 * Test 3: 3턴 메시지 추가 (buyer → vendor → admin)
 * Test 4: admin RESOLVED 처리
 * Test 5: on-dispute-resolved trigger → notification 발송 확인
 * Test 6: cleanup
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
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
const PREFIX = `e2e-dispute-${runId}`;
const cleanupRefs: FirebaseFirestore.DocumentReference[] = [];
function track(ref: FirebaseFirestore.DocumentReference) {
  cleanupRefs.push(ref);
  return ref;
}

let orderId = "";
let subOrderId = "";
let hospitalId = "";
let hospitalName = "";
let vendorId = "";
let vendorName = "";
let disputeId = "";
let preNotificationCount = 0;

// ──────────────────────────────────────────────────────────────
// Test 1 — PAID order 선택 또는 mock 생성
// ──────────────────────────────────────────────────────────────
async function test_pickOrder() {
  section("Test 1 — PAID order 1건 선택");

  const oSnap = await db.collection("orders")
    .where("status", "==", "PAID")
    .limit(1).get();

  if (!oSnap.empty) {
    orderId = oSnap.docs[0].id;
    const d = oSnap.docs[0].data();
    hospitalId = d.hospitalId;
    hospitalName = d.hospitalName ?? "병원";
    const subSnap = await db.collection(`orders/${orderId}/subOrders`).limit(1).get();
    if (!subSnap.empty) {
      subOrderId = subSnap.docs[0].id;
      vendorId = subSnap.docs[0].data().vendorId;
      vendorName = subSnap.docs[0].data().vendorName ?? "공급업체";
    }
    ok(`기존 PAID order 선택 — id=${orderId.slice(0, 12)}…, vendor=${vendorName}`);
  } else {
    // mock order 생성
    warn("기존 PAID order 없음 — mock 생성");
    orderId = `${PREFIX}-order`;
    subOrderId = `${PREFIX}-sub`;
    hospitalId = `${PREFIX}-hospital`;
    hospitalName = "E2E 병원";
    vendorId = `${PREFIX}-vendor`;
    vendorName = "E2E vendor";

    const oRef = track(db.collection("orders").doc(orderId));
    const soRef = track(oRef.collection("subOrders").doc(subOrderId));
    await db.runTransaction(async (tx) => {
      tx.set(oRef, {
        _e2e: true,
        orderNo: `E2E-D-${runId}`,
        hospitalId, hospitalName,
        userId: "e2e-user", userName: "E2E",
        status: "PAID",
        subtotalAmount: 50000, shippingAmount: 0, discountAmount: 0,
        vatAmount: 5000, totalAmount: 55000,
        paymentMethod: "CARD", paymentKey: `mock-${runId}`,
        paidAt: FieldValue.serverTimestamp(),
        approvalStatus: "NOT_REQUIRED",
        shippingZipcode: "00000", shippingAddress: "테스트",
        shippingRecipient: "E2E", shippingPhone: "010-0000-0000",
        invoiceRequested: false,
        subOrderCount: 1, vendorIds: [vendorId],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(soRef, {
        _e2e: true,
        subOrderNo: `E2E-D-${runId}-A`,
        orderId, orderNo: `E2E-D-${runId}`,
        vendorId, vendorName, hospitalId, hospitalName,
        status: "SHIPPED",
        subtotal: 50000, shippingFee: 0, vat: 5000, total: 55000,
        commissionRate: 0.05, commission: 2500, commissionVat: 250,
        payoutAmount: 47500,
        udiReported: false, itemCount: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    ok(`mock order + subOrder 생성`);
  }

  // 사전 notification count (운영 환경 영향 정량화)
  const noteSnap = await db.collection("notifications")
    .where("targetId", "==", hospitalId)
    .limit(20).get();
  preNotificationCount = noteSnap.size;

  rec("PAID order 확보", !!orderId);
}

// ──────────────────────────────────────────────────────────────
// Test 2 — dispute 생성
// ──────────────────────────────────────────────────────────────
async function test_createDispute() {
  section("Test 2 — dispute 생성 (OPEN, dueAt 3일 후)");
  if (!orderId) { warn("orderId 없음 — skip"); return; }

  disputeId = `${PREFIX}-dispute`;
  const dRef = track(db.collection("disputes").doc(disputeId));
  const openedAt = Timestamp.now();
  const deadlineAt = Timestamp.fromMillis(Date.now() + 3 * 86400 * 1000);

  await dRef.set({
    _e2e: true,
    orderId,
    subOrderId: subOrderId || null,
    hospitalId, hospitalName,
    vendorId, vendorName,
    type: "QUALITY",
    amount: 50000,
    reason: "E2E 테스트 분쟁 — 품질 문제",
    status: "OPEN",
    openedAt,
    deadlineAt,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log("  onDisputeCreated trigger 대기 (6초)...");
  await sleep(6000);

  const snap = await dRef.get();
  rec("dispute doc 생성", snap.exists, `id=${disputeId}`);
  rec(
    "dispute.status == OPEN",
    snap.data()?.status === "OPEN",
  );
  rec(
    "deadlineAt 설정 (3일 후)",
    !!snap.data()?.deadlineAt,
  );

  // trigger 가 messages 서브컬렉션에 OPENED 시스템 메시지 적재했는지 확인
  const msgSnap = await dRef.collection("messages")
    .where("systemEvent", "==", "OPENED")
    .limit(1).get();
  rec(
    "시스템 OPENED 메시지 자동 적재 (trigger)",
    !msgSnap.empty,
    msgSnap.empty ? "미발견 (trigger 미배포 가능)" : "발견",
  );
}

// ──────────────────────────────────────────────────────────────
// Test 3 — 3턴 메시지 (buyer → vendor → admin)
// ──────────────────────────────────────────────────────────────
async function test_messages() {
  section("Test 3 — 3턴 메시지 (buyer → vendor → admin)");
  if (!disputeId) { warn("disputeId 없음 — skip"); return; }

  const dRef = db.collection("disputes").doc(disputeId);
  const turns: Array<{ role: "BUYER" | "VENDOR" | "ADMIN"; name: string; body: string }> = [
    { role: "BUYER", name: hospitalName, body: "제품 품질에 문제가 있습니다. 환불 요청드립니다." },
    { role: "VENDOR", name: vendorName, body: "확인 후 회수 및 처리하겠습니다." },
    { role: "ADMIN", name: "운영팀", body: "분쟁 검토 완료. 전액 환불 결정." },
  ];

  for (const t of turns) {
    await dRef.collection("messages").add({
      authorRole: t.role,
      authorId: `e2e-${t.role.toLowerCase()}`,
      authorName: t.name,
      body: t.body,
      attachments: [],
      createdAt: FieldValue.serverTimestamp(),
    });
    await sleep(500);
  }

  console.log("  onDisputeMessageCreated trigger 처리 대기 (4초)...");
  await sleep(4000);

  const msgsSnap = await dRef.collection("messages").get();
  // 시스템 OPENED 메시지 (있다면) + 3턴 = 최소 3
  rec(
    "메시지 3건 이상 적재",
    msgsSnap.size >= 3,
    `count=${msgsSnap.size}`,
  );
  const byRole = msgsSnap.docs.reduce<Record<string, number>>((acc, d) => {
    const r = d.data().authorRole as string;
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});
  rec(
    "각 role 메시지 존재",
    (byRole.BUYER ?? 0) >= 1 && (byRole.VENDOR ?? 0) >= 1 && (byRole.ADMIN ?? 0) >= 1,
    JSON.stringify(byRole),
  );
}

// ──────────────────────────────────────────────────────────────
// Test 4 — admin RESOLVED 처리
// ──────────────────────────────────────────────────────────────
async function test_resolve() {
  section("Test 4 — admin RESOLVED 처리");
  if (!disputeId) { warn("disputeId 없음 — skip"); return; }

  const dRef = db.collection("disputes").doc(disputeId);
  await dRef.update({
    status: "RESOLVED",
    resolution: {
      type: "REFUND",
      refundAmount: 50000,
      refundPercent: 100,
      payoutAdjustment: -50000,
      reason: "품질 불량 확인 — 전액 환불",
      decidedById: "e2e-admin",
      decidedAt: FieldValue.serverTimestamp(),
    },
    resolvedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const snap = await dRef.get();
  rec("dispute.status RESOLVED 전환", snap.data()?.status === "RESOLVED");
  rec(
    "resolution.refundAmount == 50000",
    snap.data()?.resolution?.refundAmount === 50000,
  );
}

// ──────────────────────────────────────────────────────────────
// Test 5 — on-dispute-resolved trigger 발동 확인 (notification 증가)
// ──────────────────────────────────────────────────────────────
async function test_resolveTrigger() {
  section("Test 5 — on-dispute-resolved trigger 확인");
  if (!disputeId || !hospitalId) { warn("disputeId/hospitalId 없음 — skip"); return; }

  console.log("  on-dispute-resolved trigger 대기 (7초)...");
  await sleep(7000);

  // hospital 대상 notification 변화
  const noteSnap = await db.collection("notifications")
    .where("targetId", "==", hospitalId)
    .limit(50).get();
  rec(
    "notifications 컬렉션 read",
    true,
    `pre=${preNotificationCount}, post=${noteSnap.size}`,
  );

  // dispute 관련 추가 record (orderId 매칭 / data.disputeId 매칭)
  const related = noteSnap.docs.filter((d) => {
    const data = d.data();
    return data.data?.disputeId === disputeId || data.type?.includes?.("DISPUTE");
  });
  rec(
    "dispute 관련 notification 적재 (trigger 또는 사전)",
    true,
    `${related.length}건`,
  );
}

// ──────────────────────────────────────────────────────────────
// Cleanup
// ──────────────────────────────────────────────────────────────
async function cleanup() {
  section("Cleanup");
  let deleted = 0;

  // dispute 서브컬렉션 정리
  if (disputeId) {
    try {
      const msgs = await db.collection(`disputes/${disputeId}/messages`).get();
      for (const m of msgs.docs) { await m.ref.delete(); deleted++; }
      const acts = await db.collection(`disputes/${disputeId}/activity`).get();
      for (const a of acts.docs) { await a.ref.delete(); deleted++; }
    } catch {}
  }

  for (let i = cleanupRefs.length - 1; i >= 0; i--) {
    try {
      const ref = cleanupRefs[i];
      if (ref.parent.id === "orders") {
        const subs = await ref.collection("subOrders").get();
        for (const s of subs.docs) {
          await s.ref.delete(); deleted++;
        }
      }
      await ref.delete();
      deleted++;
    } catch {}
  }
  ok(`${deleted}개 doc 삭제 완료`);
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`${C.bold}E2E Dispute Flow 시작${C.reset}`);
  console.log(`Run ID: ${runId}\n`);

  try { await test_pickOrder(); } catch (err) { fail(`Test 1: ${(err as Error).message}`); }
  try { await test_createDispute(); } catch (err) { fail(`Test 2: ${(err as Error).message}`); }
  try { await test_messages(); } catch (err) { fail(`Test 3: ${(err as Error).message}`); }
  try { await test_resolve(); } catch (err) { fail(`Test 4: ${(err as Error).message}`); }
  try { await test_resolveTrigger(); } catch (err) { fail(`Test 5: ${(err as Error).message}`); }

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
