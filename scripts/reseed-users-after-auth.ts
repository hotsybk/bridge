// Phase 1.5-F — 시드 user 2명을 실제 Firebase Auth 사용자로 재시드.
//
// 1.4에서 시드된 임시 nanoid-uid user doc 2개를 삭제하고,
// admin.auth().createUser 로 실제 Auth user 를 생성한 뒤 Custom Claims 와
// /users/{uid} doc 를 새 uid 로 재생성한다.
//
// 비밀번호는 .env.local 의 SEED_BUYER_PASSWORD / SEED_VENDOR_PASSWORD 사용.
// 누락 시 자동 생성 후 .env.local 에 patch.
//
// 실행: pnpm seed:auth-users

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

import * as fs from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { adminAuth, adminDb } from "../src/server/firebase/admin";
import { COLLECTIONS } from "../src/server/firebase/collections";

type SeedUser = {
  email: string;
  envKey: "SEED_BUYER_PASSWORD" | "SEED_VENDOR_PASSWORD" | "SEED_ADMIN_PASSWORD";
  role: "BUYER_OWNER" | "VENDOR_OWNER" | "ADMIN";
  displayName: string;
  phone: string;
  // 도메인 연결 정보 (1.4 시드와 동일)
  hospitalId?: string;
  hospitalName?: string;
  vendorId?: string;
  vendorName?: string;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "buyer@example.com",
    envKey: "SEED_BUYER_PASSWORD",
    role: "BUYER_OWNER",
    displayName: "김원장",
    phone: "010-1234-5678",
    hospitalId: "hospital-seed-001",
    hospitalName: "강남 김원장의원",
  },
  {
    email: "vendor@example.com",
    envKey: "SEED_VENDOR_PASSWORD",
    role: "VENDOR_OWNER",
    displayName: "최대표",
    phone: "010-9876-5432",
    vendorId: "vendor-seed-001",
    vendorName: "더미 의료기기 유한회사",
  },
  {
    // Phase 1.8 — admin 입점 심사 검증용
    email: "admin@example.com",
    envKey: "SEED_ADMIN_PASSWORD",
    role: "ADMIN",
    displayName: "운영자",
    phone: "010-0000-0000",
  },
];

function maskShort(v: string, keep = 6) {
  if (v.length <= keep) return "***[len=" + v.length + "]";
  return v.substring(0, keep) + "****[len=" + v.length + "]";
}

function ensurePassword(envKey: string): { value: string; generated: boolean } {
  const existing = process.env[envKey];
  if (existing) return { value: existing, generated: false };

  const generated = nanoid(20);
  const envPath = ".env.local";
  const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
  const line = `${envKey}="${generated}"`;
  let next: string;
  if (new RegExp(`^${envKey}=.*$`, "m").test(content)) {
    next = content.replace(new RegExp(`^${envKey}=.*$`, "m"), line);
  } else {
    next = content.replace(/[\r\n]*$/, "") + `\n${line}\n`;
  }
  fs.writeFileSync(envPath, next, { encoding: "utf-8" });
  process.env[envKey] = generated;
  return { value: generated, generated: true };
}

async function upsertAuthUser(seed: SeedUser, password: string) {
  try {
    const u = await adminAuth().createUser({
      email: seed.email,
      password,
      displayName: seed.displayName,
      emailVerified: true,
    });
    return { uid: u.uid, created: true };
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "auth/email-already-exists") {
      const u = await adminAuth().getUserByEmail(seed.email);
      await adminAuth().updateUser(u.uid, {
        password,
        displayName: seed.displayName,
        emailVerified: true,
      });
      return { uid: u.uid, created: false };
    }
    throw err;
  }
}

async function reseed() {
  console.log("=== reseeding Firebase Auth users (Phase 1.5-F) ===");
  console.log(`  project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  for (const seed of SEED_USERS) {
    console.log("");
    console.log(`▶ ${seed.role} — ${seed.email}`);

    // 1) 비밀번호 확보 (.env.local patch 가능)
    const pwInfo = ensurePassword(seed.envKey);
    console.log(
      `  password: ${maskShort(pwInfo.value)}` +
        (pwInfo.generated ? "  (auto-generated → .env.local patched)" : "  (from .env.local)"),
    );

    // 2) Firebase Auth user 생성 또는 갱신
    const { uid, created } = await upsertAuthUser(seed, pwInfo.value);
    console.log(`  auth user: ${created ? "CREATED" : "UPDATED"} (uid=${uid})`);

    // 3) Custom Claims — role + hospitalId/vendorId (1.4 시드 데이터와 연결)
    const claims: Record<string, string | undefined> = { role: seed.role };
    if (seed.hospitalId) claims.hospitalId = seed.hospitalId;
    if (seed.vendorId) claims.vendorId = seed.vendorId;
    await adminAuth().setCustomUserClaims(uid, claims);
    console.log(
      `  custom claims set: role=${seed.role}` +
        (seed.hospitalId ? `, hospitalId=${seed.hospitalId}` : "") +
        (seed.vendorId ? `, vendorId=${seed.vendorId}` : ""),
    );

    // 4) 같은 email 의 임시 nanoid user doc 삭제 (1.4 시드분)
    const old = await adminDb()
      .collection(COLLECTIONS.users)
      .where("email", "==", seed.email)
      .get();
    let deleted = 0;
    for (const d of old.docs) {
      if (d.id !== uid) {
        await d.ref.delete();
        deleted++;
      }
    }
    if (deleted > 0) console.log(`  removed ${deleted} stale user doc(s)`);

    // 5) 실제 uid 로 /users/{uid} 재생성 (idempotent — set with merge)
    const now = Timestamp.now();
    await adminDb()
      .collection(COLLECTIONS.users)
      .doc(uid)
      .set({
        uid,
        email: seed.email,
        emailVerified: true,
        name: seed.displayName,
        phone: seed.phone,
        role: seed.role,
        ...(seed.hospitalId ? { hospitalId: seed.hospitalId, hospitalName: seed.hospitalName } : {}),
        ...(seed.vendorId ? { vendorId: seed.vendorId, vendorName: seed.vendorName } : {}),
        createdAt: now,
        updatedAt: now,
      });
    console.log(`  /users/${uid} re-written`);
  }

  console.log("");
  console.log("=== reseed complete ===");
  console.log("  Firebase Console:");
  console.log(`    https://console.firebase.google.com/project/${process.env.FIREBASE_ADMIN_PROJECT_ID}/authentication/users`);
}

reseed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("=== reseed FAILED ===");
    console.error(err);
    process.exit(1);
  });
