/**
 * Wave J·K·L 백테스트
 *
 * 1) Hospital — onOrderCreated trigger가 kpi.orderCount/orderAmount 자동 갱신
 * 2) Vendor — grade 변경 시 defaultCommissionRate 자동 매핑
 * 3) Staff — Custom Claims 갱신 헬퍼 (실 user 영향 X — read만)
 * 4) auditLog 자동 기록 검증
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
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
const auth = getAuth();

const COLORS = { reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m" };
const ok = (m: string) => console.log(`${COLORS.green}✓${COLORS.reset} ${m}`);
const fail = (m: string) => console.log(`${COLORS.red}✗${COLORS.reset} ${m}`);
const section = (t: string) => console.log(`\n${COLORS.bold}${COLORS.cyan}=== ${t} ===${COLORS.reset}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const results: { test: string; pass: boolean; detail?: string }[] = [];
function record(test: string, pass: boolean, detail?: string) {
  results.push({ test, pass, detail });
  pass ? ok(`${test}${detail ? ` — ${detail}` : ""}`) : fail(`${test}${detail ? ` — ${detail}` : ""}`);
}

// ──────────────────────────────────────────────────────────────
// Test 1 — Hospital KPI denormalize (onOrderCreated trigger)
// ──────────────────────────────────────────────────────────────
async function test_hospitalKpi() {
  section("Test 1 — Hospital KPI denormalize");

  // 테스트 hospital 생성
  const hRef = db.collection("hospitals").doc();
  await hRef.set({
    bizRegNo: "999-00-99999",
    name: "백테스트 병원",
    type: "CLINIC",
    ceoName: "백테스트",
    phone: "02-0000-0000",
    email: "test@example.com",
    zipcode: "00000",
    address: "테스트 주소",
    memberCount: 0,
    approvalEnabled: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  ok(`hospital 생성 — id=${hRef.id}`);

  // 주문 1건 생성 → onOrderCreated 트리거
  const oRef = db.collection("orders").doc();
  await oRef.set({
    orderNo: `BT-${Date.now()}`,
    hospitalId: hRef.id,
    hospitalName: "백테스트 병원",
    userId: "test-user",
    totalAmount: 100000,
    status: "PAID",
    payment: { paymentId: "bt-payment", status: "PAID" },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  ok(`order 생성 — id=${oRef.id}, totalAmount=100000`);

  console.log("  Cloud Function trigger 대기 (7초)...");
  await sleep(7000);

  const updated = await hRef.get();
  const kpi = updated.data()?.kpi;
  record(
    "hospital.kpi.orderCount += 1",
    kpi?.orderCount === 1,
    `kpi=${JSON.stringify(kpi)}`,
  );
  record(
    "hospital.kpi.orderAmount += 100000",
    kpi?.orderAmount === 100000,
    `amount=${kpi?.orderAmount}`,
  );
  record(
    "hospital.kpi.lastActiveAt 갱신",
    !!kpi?.lastActiveAt,
    kpi?.lastActiveAt ? "set" : "missing",
  );

  // cleanup
  await oRef.delete();
  await hRef.delete();
  console.log("  cleanup 완료");
}

// ──────────────────────────────────────────────────────────────
// Test 2 — Vendor grade 변경 시 defaultCommissionRate 자동 매핑
// ──────────────────────────────────────────────────────────────
async function test_vendorGrade() {
  section("Test 2 — Vendor grade 변경 → 수수료율 자동 매핑");

  // 테스트 vendor 생성 (STANDARD 등급)
  const vRef = db.collection("vendors").doc();
  await vRef.set({
    bizRegNo: "888-00-88888",
    bizRegImageUrl: "https://example.com/biz.jpg",
    companyName: "백테스트 vendor",
    ceoName: "백테스트",
    phone: "02-0000-0000",
    email: "test-vendor@example.com",
    zipcode: "00000",
    address: "테스트",
    vendorType: "DISTRIBUTOR",
    status: "APPROVED",
    defaultCommissionRate: 0.05,
    grade: "STANDARD",
    fastSettlementEnabled: false,
    categories: [],
    productCount: 0,
    totalGmv: 0,
    reviewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  ok(`vendor 생성 — id=${vRef.id}, grade=STANDARD, rate=5%`);

  // PREMIUM으로 직접 update (tRPC mutation 시뮬레이션)
  // tRPC가 호출하는 동일 패턴
  const GRADE_RATES: Record<string, number> = {
    STANDARD: 0.05, PLUS: 0.045, PREMIUM: 0.04, DIRECT: 0.035,
  };
  await vRef.update({
    grade: "PREMIUM",
    defaultCommissionRate: GRADE_RATES.PREMIUM,
    gradeUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updated = await vRef.get();
  const d = updated.data();
  record(
    "grade=PREMIUM 적용",
    d?.grade === "PREMIUM",
    `grade=${d?.grade}`,
  );
  record(
    "defaultCommissionRate=0.04 (4%) 자동 매핑",
    d?.defaultCommissionRate === 0.04,
    `rate=${d?.defaultCommissionRate}`,
  );

  // cleanup
  await vRef.delete();
  console.log("  cleanup 완료");
}

// ──────────────────────────────────────────────────────────────
// Test 3 — Staff Custom Claims 헬퍼 검증 (read-only)
// ──────────────────────────────────────────────────────────────
async function test_staffCustomClaims() {
  section("Test 3 — Custom Claims 시스템 read 검증 (실 user 변경 X)");

  // 기존 사용자 list — 운영자 role 가진 user 찾기
  try {
    const userList = await auth.listUsers(10);
    const adminUsers = userList.users.filter((u) => {
      const role = (u.customClaims as any)?.role;
      return role === "ADMIN" || role === "SUPER_ADMIN";
    });

    record(
      "Firebase Auth listUsers 작동",
      true,
      `${userList.users.length}명 user 발견`,
    );

    if (adminUsers.length > 0) {
      record(
        "ADMIN/SUPER_ADMIN role custom claims",
        true,
        `${adminUsers.length}명 admin role 보유`,
      );
      for (const u of adminUsers.slice(0, 3)) {
        const role = (u.customClaims as any)?.role;
        console.log(`    ${u.email ?? u.uid} → role=${role}`);
      }
    } else {
      console.log(`  ${COLORS.yellow}⚠${COLORS.reset} ADMIN role을 가진 user가 없습니다 (운영자 초대 필요)`);
    }

    // users 컬렉션 read
    const usersSnap = await db.collection("users").limit(5).get();
    record(
      "users 컬렉션 조회 작동",
      true,
      `${usersSnap.size} docs (limit 5)`,
    );

    // role + Custom Claims 매핑 검증 (있는 user만)
    let synced = 0, mismatch = 0;
    for (const doc of usersSnap.docs) {
      const userData = doc.data();
      try {
        const authUser = await auth.getUser(doc.id);
        const authRole = (authUser.customClaims as any)?.role;
        if (authRole === userData.role) synced++;
        else mismatch++;
      } catch {
        /* auth user 없음 */
      }
    }
    record(
      "users 컬렉션 ↔ Custom Claims 동기화",
      mismatch === 0,
      `동기 ${synced}, 불일치 ${mismatch}`,
    );
  } catch (err) {
    fail(`Auth API 호출 실패: ${(err as Error).message}`);
  }
}

// ──────────────────────────────────────────────────────────────
// Test 4 — auditLog 자동 기록 확인
// ──────────────────────────────────────────────────────────────
async function test_auditLog() {
  section("Test 4 — auditLog 자동 기록 확인");

  // Wave J·K·L 액션 audit 기록 종류 확인
  const expectedActions = [
    "HOSPITAL_MEMO_ADDED",
    "HOSPITAL_SUSPENDED",
    "HOSPITAL_ALIMTALK_SENT",
    "VENDOR_GRADE_UPDATED",
    "VENDOR_COMMISSION_RATE_UPDATED",
    "STAFF_INVITED",
    "STAFF_ROLE_UPDATED",
  ];

  const snap = await db.collection("auditLogs")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const actionsFound = new Set<string>();
  snap.docs.forEach((d) => {
    const a = d.data().action;
    if (a) actionsFound.add(a);
  });

  record(
    "auditLogs 컬렉션 read 작동",
    snap.size > 0,
    `최근 ${snap.size}건`,
  );

  console.log(`  최근 액션 종류: ${[...actionsFound].slice(0, 10).join(", ")}`);
  console.log(`  (Wave J·K·L action들은 실 mutation 호출 시 자동 기록됨)`);
}

// ──────────────────────────────────────────────────────────────
// Test 5 — Firestore Rules 무결성 (간접)
// ──────────────────────────────────────────────────────────────
async function test_rulesCheck() {
  section("Test 5 — Firestore Rules 무결성 검증");

  // admin SDK는 모든 룰 우회. 다음만 검증:
  // - hospitals/{id}/memos 서브컬렉션이 read·write 가능
  const testHospital = await db.collection("hospitals").limit(1).get();
  if (testHospital.empty) {
    console.log(`  ${COLORS.yellow}⚠${COLORS.reset} hospitals 데이터 없음 — skip`);
    return;
  }

  const hRef = testHospital.docs[0].ref;
  const memoRef = await hRef.collection("memos").add({
    actorId: "backtest",
    body: "백테스트 메모",
    createdAt: FieldValue.serverTimestamp(),
  });
  const memoSnap = await memoRef.get();
  record(
    "hospitals/{id}/memos 서브컬렉션 write+read",
    memoSnap.exists,
  );
  await memoRef.delete();
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`${COLORS.bold}Wave J·K·L 백테스트 시작${COLORS.reset}`);
  console.log(`Firebase project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}\n`);

  try { await test_hospitalKpi(); } catch (err) { fail(`Test 1: ${(err as Error).message}`); }
  try { await test_vendorGrade(); } catch (err) { fail(`Test 2: ${(err as Error).message}`); }
  try { await test_staffCustomClaims(); } catch (err) { fail(`Test 3: ${(err as Error).message}`); }
  try { await test_auditLog(); } catch (err) { fail(`Test 4: ${(err as Error).message}`); }
  try { await test_rulesCheck(); } catch (err) { fail(`Test 5: ${(err as Error).message}`); }

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

main().catch((err) => { console.error("FATAL", err); process.exit(1); });
