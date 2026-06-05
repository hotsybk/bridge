// Server-only enforcement.
// `server-only` 패키지는 import 시점에 throw하므로 tsx/Node 스크립트(시드/Cloud Function 로컬 실행)
// 와 충돌. 동등한 runtime 가드로 대체.
if (typeof window !== "undefined") {
  throw new Error("firebase-admin must be used only on the server side.");
}

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth as fbGetAuth, type Auth } from "firebase-admin/auth";
import {
  getFirestore as fbGetFirestore,
  FieldValue,
  type Firestore,
} from "firebase-admin/firestore";
import { getStorage as fbGetStorage, type Storage } from "firebase-admin/storage";

import type { UserRole } from "@/lib/types";

let _app: App | undefined;

function getAdminApp(): App {
  if (_app) return _app;

  const existing = getApps();
  if (existing.length > 0) {
    _app = existing[0];
    return _app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local.",
    );
  }

  _app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  return _app;
}

export const adminAuth = (): Auth => fbGetAuth(getAdminApp());
export const adminDb = (): Firestore => fbGetFirestore(getAdminApp());
export const adminStorage = (): Storage => fbGetStorage(getAdminApp());

/**
 * Firebase Storage downloadURL 또는 gs:// URL 에서 object path 추출.
 *
 *   gs://bucket/foo/bar.png                                  → "foo/bar.png"
 *   https://firebasestorage.googleapis.com/v0/b/bucket/o/foo%2Fbar.png?...  → "foo/bar.png"
 */
export function extractStoragePath(url: string): string | null {
  if (!url) return null;
  try {
    if (url.startsWith("gs://")) {
      const idx = url.indexOf("/", 5);
      return idx === -1 ? null : url.substring(idx + 1);
    }
    const m = url.match(/\/o\/([^?]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Admin SDK 로 Storage object 의 짧은 만료 signed URL 발급.
 *
 * Phase 1.8 admin 심사 화면에서 다른 vendor 의 서류를 안전하게 보여주기 위해 사용.
 * storage.rules 의 isAdmin() 분기를 우회하지 않고, 별도 단기 토큰 형태로 발급.
 *
 * @param path "vendor-docs/{vendorId}/biz-reg-xxx.pdf" 같은 object path
 * @param expiresInSec 만료 시각까지의 초 (기본 300초 = 5분)
 */
export async function getStorageSignedUrl(
  path: string,
  expiresInSec: number = 300,
): Promise<string> {
  const bucket = adminStorage().bucket();
  const file = bucket.file(path);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInSec * 1000,
  });
  return url;
}

// ─────────────────────────────────────────────────────────────
// Wave L — Custom Claims & user lifecycle helpers
// ─────────────────────────────────────────────────────────────

/**
 * Firebase Auth Custom Claims 에 role 을 설정하고 users 문서를 동기화한다.
 * 호출자(tRPC procedure) 에서 SUPER_ADMIN 가드를 보장해야 한다 — 이 함수는 권한 검증을 하지 않는다.
 *
 * 변경된 사용자는 다음 ID 토큰 갱신(최대 1시간) 또는 강제 갱신 후에 새 role 이 반영된다.
 */
export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  const auth = adminAuth();
  const user = await auth.getUser(uid);
  const claims = { ...(user.customClaims ?? {}), role };
  await auth.setCustomUserClaims(uid, claims);
  await adminDb()
    .collection("users")
    .doc(uid)
    .set(
      { role, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
}

/**
 * 사용자를 비활성화한다 — Firebase Auth disable + users.status = "DISABLED".
 * 비활성화된 사용자는 즉시 로그인 차단되며 기존 세션 쿠키 검증 시도 시 거부된다.
 */
export async function deactivateUser(
  uid: string,
  reason?: string,
): Promise<void> {
  await adminAuth().updateUser(uid, { disabled: true });
  await adminDb()
    .collection("users")
    .doc(uid)
    .set(
      {
        status: "DISABLED",
        statusReason: reason ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

/**
 * 비활성화된 사용자를 다시 활성화한다.
 */
export async function reactivateUser(uid: string): Promise<void> {
  await adminAuth().updateUser(uid, { disabled: false });
  await adminDb()
    .collection("users")
    .doc(uid)
    .set(
      {
        status: "ACTIVE",
        statusReason: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}
