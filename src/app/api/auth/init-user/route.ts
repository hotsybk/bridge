import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { UserRole } from "@/lib/types";

type ConsentBody = {
  agreedToTerms?: boolean;
  agreedToPrivacy?: boolean;
  agreedToMarketing?: boolean;
};

type InitBody = {
  role: UserRole;
  displayName?: string;
  consent?: ConsentBody;
};

const ALLOWED_INIT_ROLES = new Set<UserRole>(["BUYER_OWNER", "VENDOR_OWNER"]);
const PROTECTED_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

/**
 * POST /api/auth/init-user
 *
 * 가입 직후 1회 호출. 다음을 처리:
 *   1) `/users/{uid}` 도큐먼트 생성 (idempotent — 이미 있으면 role 변경 금지)
 *   2) Firebase Auth Custom Claims에 `role` 설정 (기존 claims merge — ADMIN/SUPER_ADMIN 보호)
 *   3) 가입 동의 정보(Phase α-1) 적재 — 이용약관·개인정보·마케팅
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

  // 필수 동의 검증 (Phase α-1)
  const consent = body.consent ?? {};
  if (!consent.agreedToTerms || !consent.agreedToPrivacy) {
    return NextResponse.json(
      { error: "이용약관과 개인정보 수집·이용 동의는 필수입니다." },
      { status: 400 },
    );
  }

  const uid = decoded.uid;
  const email = decoded.email ?? "";

  // ─── 1) ADMIN/SUPER_ADMIN 보호 (Phase α-3)
  // 이미 ADMIN/SUPER_ADMIN claims 가 설정된 계정은 일반 가입 흐름으로 role 변경 금지.
  const currentUser = await adminAuth().getUser(uid);
  const existingClaims = (currentUser.customClaims ?? {}) as Record<string, unknown>;
  const existingClaimRole = existingClaims.role as string | undefined;
  if (existingClaimRole && PROTECTED_ROLES.has(existingClaimRole)) {
    return NextResponse.json(
      {
        error:
          "관리자 계정은 일반 가입으로 역할을 변경할 수 없습니다.",
      },
      { status: 403 },
    );
  }

  // ─── 2) 기존 user doc 검증 (Phase α-3)
  // 이미 가입된 계정이 다른 role 로 재가입 시도하면 거부.
  const userRef = adminDb().collection(COLLECTIONS.users).doc(uid);
  const snap = await userRef.get();
  const wasExisting = snap.exists;
  if (snap.exists) {
    const existing = snap.data() as { role?: UserRole } | undefined;
    if (existing?.role && existing.role !== body.role) {
      return NextResponse.json(
        {
          error:
            "이미 가입된 계정입니다. 다른 역할로 가입할 수 없습니다.",
        },
        { status: 409 },
      );
    }
  }

  const consentDoc = {
    agreedToTerms: Boolean(consent.agreedToTerms),
    agreedToPrivacy: Boolean(consent.agreedToPrivacy),
    agreedToMarketing: Boolean(consent.agreedToMarketing),
    agreedAt: FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    await userRef.set({
      uid,
      email,
      emailVerified: Boolean(decoded.email_verified),
      name: body.displayName?.trim() || email.split("@")[0],
      role: body.role,
      consent: consentDoc,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    // idempotent — 같은 role 재호출 시 동의 정보만 갱신 (가장 최근값으로)
    await userRef.update({
      consent: consentDoc,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // ─── 3) Custom Claims merge (Phase α-3)
  // 기존 claims (hospitalId, vendorId 등) 를 보존하고 role 만 갱신.
  await adminAuth().setCustomUserClaims(uid, {
    ...existingClaims,
    role: body.role,
  });

  return NextResponse.json({
    ok: true,
    uid,
    role: body.role,
    created: !wasExisting,
  });
}
