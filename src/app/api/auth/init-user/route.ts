import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { UserRole } from "@/lib/types";

type InitBody = {
  role: UserRole;
  displayName?: string;
};

const ALLOWED_INIT_ROLES = new Set<UserRole>(["BUYER_OWNER", "VENDOR_OWNER"]);

/**
 * POST /api/auth/init-user
 *
 * 가입 직후 1회 호출. 다음을 처리:
 *   1) `/users/{uid}` 도큐먼트 생성 (idempotent — 이미 있으면 스킵)
 *   2) Firebase Auth Custom Claims에 `role` 설정
 *
 * hospitalId / vendorId 는 온보딩 완료 시점(1.6~)에 별도 라우트가 채운다.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }
  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) {
    return NextResponse.json({ error: "empty idToken" }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "invalid idToken" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<InitBody>;
  if (!body.role || !ALLOWED_INIT_ROLES.has(body.role)) {
    return NextResponse.json(
      { error: `invalid role (allowed: ${[...ALLOWED_INIT_ROLES].join(", ")})` },
      { status: 400 },
    );
  }

  const uid = decoded.uid;
  const email = decoded.email ?? "";

  const userRef = adminDb().collection(COLLECTIONS.users).doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set({
      uid,
      email,
      emailVerified: Boolean(decoded.email_verified),
      name: body.displayName?.trim() || email.split("@")[0],
      role: body.role,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // Custom Claims — proxy.ts 의 role-based 분기와 Firestore Security Rules 의
  // role() 헬퍼가 이 값을 읽는다.
  await adminAuth().setCustomUserClaims(uid, { role: body.role });

  return NextResponse.json({ ok: true, uid, role: body.role, created: !snap.exists });
}
