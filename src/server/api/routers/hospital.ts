import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { buyerProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminAuth, adminDb } from "@/server/firebase/admin";
import { COLLECTIONS, SUB_COLLECTIONS } from "@/server/firebase/collections";
import { extractBusinessRegNo } from "@/server/services/clova-ocr";
import { verifyBusinessStatus } from "@/server/services/nts-verify";
import { hospitalOnboardSchema } from "@/lib/validators/hospital";
import type { Hospital } from "@/lib/types";

export const hospitalRouter = createTRPCRouter({
  /**
   * 병원 온보딩 — Phase 1.6 buyer flow 의 핵심 mutation.
   *
   * 1) 이미 hospital 에 연결된 계정인지 확인 (idempotent guard)
   * 2) 사업자번호 중복 검사
   * 3) Clova OCR mock 호출 (1.7+ 활성화 시 입력값과 매칭 검증)
   * 4) NTS 진위확인 mock — 휴/폐업 거부
   * 5) /hospitals/{nanoid} 생성
   * 6) /hospitals/{id}/members/{uid} sub-doc 생성
   * 7) /users/{uid} 갱신 (hospitalId + denormalized name)
   * 8) Custom Claims merge — 기존 role 보존 + hospitalId 추가
   *
   * 반환: { hospitalId, needsTokenRefresh: true } — 클라이언트가 forceRefreshToken() 호출 필요.
   */
  onboard: buyerProcedure
    .input(hospitalOnboardSchema)
    .mutation(async ({ ctx, input }) => {
      const { uid } = ctx;
      const db = adminDb();
      const auth = adminAuth();

      // 1) 이미 연결됨?
      const userRef = db.collection(COLLECTIONS.users).doc(uid);
      const userSnap = await userRef.get();
      const userData = userSnap.data() ?? {};
      if (userData.hospitalId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 병원에 연결된 계정입니다.",
        });
      }

      // 2) 사업자번호 중복
      const dup = await db
        .collection(COLLECTIONS.hospitals)
        .where("bizRegNo", "==", input.bizRegNo)
        .limit(1)
        .get();
      if (!dup.empty) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 등록된 사업자등록번호입니다.",
        });
      }

      // 3) OCR mock (1.7+ 실제 활성화 시 입력값과 매칭 검증)
      await extractBusinessRegNo({ imageUrl: input.bizRegImageUrl });
      // TODO 1.7+: if (ocr.bizRegNo !== input.bizRegNo) throw BAD_REQUEST

      // 4) NTS 진위확인
      const nts = await verifyBusinessStatus(input.bizRegNo);
      if (!nts.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `국세청 조회 결과 ${nts.status} 상태입니다. 활성 사업자만 가입 가능합니다.`,
        });
      }

      // 5) /hospitals/{id} 생성
      const hospitalId = nanoid(12);
      const now = FieldValue.serverTimestamp();
      await db.collection(COLLECTIONS.hospitals).doc(hospitalId).set({
        id: hospitalId,
        bizRegNo: input.bizRegNo,
        bizRegImageUrl: input.bizRegImageUrl,
        bizVerifiedAt: now,
        name: input.name,
        ...(input.ykiho ? { ykiho: input.ykiho } : {}),
        type: input.type,
        ceoName: input.ceoName,
        phone: input.phone,
        email: input.email,
        zipcode: input.zipcode,
        address: input.address,
        ...(input.addressDetail ? { addressDetail: input.addressDetail } : {}),
        approvalEnabled: false,
        memberCount: 1,
        createdAt: now,
        updatedAt: now,
      });

      // 6) /hospitals/{id}/members/{uid}
      await db
        .collection(SUB_COLLECTIONS.hospitalMembers(hospitalId))
        .doc(uid)
        .set({
          userId: uid,
          email: userData.email ?? "",
          name: userData.name ?? input.ceoName,
          role: "BUYER_OWNER",
          joinedAt: now,
        });

      // 7) /users/{uid} 갱신
      await userRef.update({
        hospitalId,
        hospitalName: input.name,
        updatedAt: now,
      });

      // 8) Custom Claims merge — 기존 role 등 보존, hospitalId 만 추가
      const userRecord = await auth.getUser(uid);
      const existingClaims = (userRecord.customClaims ?? {}) as Record<string, unknown>;
      await auth.setCustomUserClaims(uid, {
        ...existingClaims,
        hospitalId,
      });

      return { ok: true, hospitalId, needsTokenRefresh: true };
    }),

  /**
   * 현재 사용자가 소속된 병원 조회.
   * onboarding 미완료 (hospitalId 없음) 면 null 반환.
   */
  getCurrent: buyerProcedure.query(async ({ ctx }): Promise<Hospital | null> => {
    const { hospitalId } = ctx;
    if (!hospitalId) return null;
    const snap = await adminDb()
      .collection(COLLECTIONS.hospitals)
      .doc(hospitalId)
      .get();
    if (!snap.exists) return null;
    const data = snap.data() as Omit<Hospital, "id">;
    return { id: snap.id, ...data };
  }),
});
