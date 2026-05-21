/**
 * Firebase 데이터 상태 진단.
 *
 *   npx tsx scripts/diagnose-db.ts
 *
 * 출력:
 *   - 각 핵심 컬렉션의 도큐먼트 수
 *   - Firebase Auth 에 등록된 user 수 + role 분포
 *   - 시드 user 3명 (buyer1 / vendor1 / admin) 존재 여부 + Custom Claims
 *
 * 평문 비밀번호는 절대 출력하지 않음. 이메일·UID 만 표시.
 */

import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

// .env.local 우선 로드 (Next.js 패턴 모방)
loadDotenv({ path: resolve(process.cwd(), ".env.local") });

import { adminAuth, adminDb } from "../src/server/firebase/admin";

const SEED_EMAILS = ["buyer@example.com", "vendor@example.com", "admin@example.com"];

const COLLECTIONS = [
  "categories",
  "users",
  "hospitals",
  "vendors",
  "products",
  "orders",
  "subOrders",
  "notifications",
  "auditLogs",
];

async function countCollection(name: string): Promise<number> {
  const snap = await adminDb().collection(name).count().get();
  return snap.data().count;
}

async function main() {
  console.log("=".repeat(60));
  console.log(" MedPlace — Firebase 데이터 진단");
  console.log("=".repeat(60));

  console.log(`\n[ENV] project=${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  // 1. Firestore 컬렉션 도큐먼트 수
  console.log("\n[Firestore 컬렉션 도큐먼트 수]");
  for (const name of COLLECTIONS) {
    try {
      const count = await countCollection(name);
      const mark = count > 0 ? "✓" : "·";
      console.log(`  ${mark} /${name.padEnd(15)} → ${count} docs`);
    } catch (e) {
      const err = e as { message?: string };
      console.log(`  ✗ /${name.padEnd(15)} → ERROR: ${err.message ?? e}`);
    }
  }

  // 2. Firebase Auth 등록 user 수
  console.log("\n[Firebase Auth 등록 user]");
  try {
    let total = 0;
    const roleCount: Record<string, number> = {};
    let pageToken: string | undefined = undefined;
    do {
      const result = await adminAuth().listUsers(1000, pageToken);
      total += result.users.length;
      for (const u of result.users) {
        const role = (u.customClaims?.role as string | undefined) ?? "(no role)";
        roleCount[role] = (roleCount[role] ?? 0) + 1;
      }
      pageToken = result.pageToken;
    } while (pageToken);

    console.log(`  총 user 수: ${total}`);
    for (const [role, n] of Object.entries(roleCount).sort()) {
      console.log(`    - ${role.padEnd(20)} → ${n}`);
    }
  } catch (e) {
    const err = e as { message?: string };
    console.log(`  ✗ Auth listUsers 실패: ${err.message ?? e}`);
  }

  // 3. 시드 user 3명 상세 점검
  console.log("\n[시드 user 상세 점검]");
  for (const email of SEED_EMAILS) {
    try {
      const user = await adminAuth().getUserByEmail(email);
      const claims = (user.customClaims ?? {}) as {
        role?: string;
        hospitalId?: string;
        vendorId?: string;
      };
      const claimsStr = JSON.stringify(claims);

      // Firestore /users/{uid} 도큐먼트 존재 여부
      const userDoc = await adminDb().collection("users").doc(user.uid).get();
      const docExists = userDoc.exists;

      console.log(`  ✓ ${email}`);
      console.log(`      uid: ${user.uid}`);
      console.log(`      Auth claims: ${claimsStr === "{}" ? "(empty)" : claimsStr}`);
      console.log(`      /users/${user.uid} doc: ${docExists ? "exists" : "MISSING"}`);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/user-not-found") {
        console.log(`  ✗ ${email} → Firebase Auth 에 없음 (seed:auth-users 미실행?)`);
      } else {
        console.log(`  ✗ ${email} → ERROR: ${err.message ?? e}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(" 진단 완료");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n[FATAL]", e);
    process.exit(1);
  });
