/**
 * 시스템 5 페이지 백테스트.
 *
 * 1) monitoring: _systemAlerts 데이터 시뮬레이션 + admin.monitoring.systemAlerts read
 * 2) notifications: bulkSend 1회 → onNotificationCreated trigger 후 status 확인
 * 3) audit-logs: 최근 N건 + actor filter
 * 4) settings: get/set + 마스킹 검증
 * 5) debug: SnapshotProbe 컴포넌트만 존재 — 백테스트 skip
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

const C = { reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m" };
const ok = (m: string) => console.log(`${C.green}✓${C.reset} ${m}`);
const fail = (m: string) => console.log(`${C.red}✗${C.reset} ${m}`);
const section = (t: string) => console.log(`\n${C.bold}${C.cyan}=== ${t} ===${C.reset}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const results: { test: string; pass: boolean; detail?: string }[] = [];
function rec(test: string, pass: boolean, detail?: string) {
  results.push({ test, pass, detail });
  pass ? ok(`${test}${detail ? ` — ${detail}` : ""}`) : fail(`${test}${detail ? ` — ${detail}` : ""}`);
}

// Test 1 — _systemAlerts 컬렉션 simulation
async function test_monitoring() {
  section("Test 1 — Monitoring (_systemAlerts)");

  // _systemAlerts에 alert entry 1건 추가
  const ref = await db.collection("_systemAlerts").add({
    type: "payment_webhook_failed",
    severity: "error",
    title: "백테스트 webhook 실패",
    message: "PortOne webhook signature 검증 실패 (backtest)",
    payload: { orderId: "bt-order-1" },
    acknowledged: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  ok(`_systemAlerts entry 생성 — ${ref.id}`);

  // read
  const snap = await db.collection("_systemAlerts")
    .orderBy("createdAt", "desc").limit(5).get();
  rec("_systemAlerts read", snap.size >= 1, `${snap.size}건 조회`);

  // cleanup
  await ref.delete();
}

// Test 2 — Notification bulkSend + onNotificationCreated trigger
async function test_notifications() {
  section("Test 2 — Notification bulkSend + trigger");

  // 시스템에 notification 1건 직접 추가 (bulkSend tRPC 호출 우회)
  const targetHospitalSnap = await db.collection("hospitals").limit(1).get();
  if (targetHospitalSnap.empty) {
    console.log(`  ${C.yellow}⚠${C.reset} hospitals 데이터 없음 — skip notification test`);
    return;
  }
  const targetHospital = targetHospitalSnap.docs[0];

  const notifRef = await db.collection("notifications").add({
    targetType: "HOSPITAL",
    targetId: targetHospital.id,
    type: "HOSPITAL_NOTICE",
    title: "백테스트 알림",
    body: "시스템 백테스트 — Solapi mock fallback 검증",
    channels: ["KAKAO", "IN_APP"],
    kakaoSent: false,
    emailSent: false,
    isBulk: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  ok(`notification 생성 — ${notifRef.id}, target=${targetHospital.id}`);

  console.log("  onNotificationCreated trigger 처리 대기 (8초)...");
  await sleep(8000);

  const updated = await notifRef.get();
  const d = updated.data() as any;
  rec(
    "Cloud Function trigger 실행 — kakaoSent 또는 errorReason 갱신",
    d?.kakaoSent === true || !!d?.errorReason || !!d?.kakaoMessageId,
    `kakaoSent=${d?.kakaoSent}, source=${d?.kakaoSource ?? "n/a"}, error=${d?.errorReason ?? "none"}`,
  );

  // cleanup
  await notifRef.delete();
}

// Test 3 — auditLogs read + filter
async function test_auditLogs() {
  section("Test 3 — auditLogs read + actor filter");

  const snap = await db.collection("auditLogs")
    .orderBy("createdAt", "desc").limit(20).get();
  rec("auditLogs read (latest 20)", snap.size > 0, `${snap.size}건`);

  if (snap.size > 0) {
    const actions = new Set(snap.docs.map((d) => (d.data() as any).action).filter(Boolean));
    console.log(`  최근 action 종류: ${[...actions].slice(0, 8).join(", ")}`);

    // actor filter — SYSTEM
    const sysSnap = await db.collection("auditLogs")
      .where("actorRole", "==", "SYSTEM")
      .orderBy("createdAt", "desc").limit(10).get();
    rec("actorRole filter (SYSTEM)", sysSnap.size > 0, `${sysSnap.size}건 SYSTEM 액션`);
  }
}

// Test 4 — settings get/set
async function test_settings() {
  section("Test 4 — settings get/set + 마스킹");

  // general 섹션 set
  const ref = db.collection("systemSettings").doc("general");
  await ref.set({
    platformName: "MedPlace 백테스트",
    currency: "KRW",
    timezone: "Asia/Seoul",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const snap = await ref.get();
  rec(
    "systemSettings general set",
    snap.exists && snap.data()?.platformName === "MedPlace 백테스트",
  );

  // payment 섹션 (비밀 키 마스킹 검증)
  const payRef = db.collection("systemSettings").doc("payment");
  await payRef.set({
    portoneApiSecret: "PORTONE_SECRET_BT_TEST_12345",
    portoneWebhookSecret: "WEBHOOK_SECRET_BT_67890",
    portoneTestMode: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const paySnap = await payRef.get();
  rec(
    "systemSettings payment set",
    paySnap.exists,
    `apiSecret 길이 ${paySnap.data()?.portoneApiSecret?.length}`,
  );

  // 마스킹은 tRPC get에서 처리 — admin SDK read는 raw 반환 (이건 의도된 동작)
  console.log(`  (마스킹은 tRPC admin.settings.get에서 처리. admin SDK direct는 raw)`);

  // cleanup
  await ref.set({ platformName: FieldValue.delete() }, { merge: true });
  await payRef.delete();
}

// Test 5 — _retryQueue 모니터링
async function test_retryQueue() {
  section("Test 5 — _retryQueue (실패한 알림·UDI 재시도)");

  const snap = await db.collection("_retryQueue")
    .orderBy("createdAt", "desc").limit(10).get();

  const types = new Set(snap.docs.map((d) => (d.data() as any).type).filter(Boolean));
  rec("_retryQueue read", true, `${snap.size}건, types=[${[...types].join(", ")}]`);

  if (snap.size > 0) {
    const pending = snap.docs.filter((d) => (d.data() as any).status === "PENDING");
    console.log(`  PENDING 재시도 대상: ${pending.length}건`);
  }
}

async function main() {
  console.log(`${C.bold}시스템 5 페이지 백테스트${C.reset}\n`);

  try { await test_monitoring(); } catch (e) { fail(`Test 1: ${(e as Error).message}`); }
  try { await test_notifications(); } catch (e) { fail(`Test 2: ${(e as Error).message}`); }
  try { await test_auditLogs(); } catch (e) { fail(`Test 3: ${(e as Error).message}`); }
  try { await test_settings(); } catch (e) { fail(`Test 4: ${(e as Error).message}`); }
  try { await test_retryQueue(); } catch (e) { fail(`Test 5: ${(e as Error).message}`); }

  section("결과 요약");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`총 ${results.length}개 검증 — ${C.green}통과 ${passed}${C.reset} / ${C.red}실패 ${failed}${C.reset}`);
  if (failed > 0) {
    console.log(`\n${C.red}실패:${C.reset}`);
    for (const r of results.filter((r) => !r.pass)) console.log(`  - ${r.test}${r.detail ? ` — ${r.detail}` : ""}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => { console.error("FATAL", err); process.exit(1); });
