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

import { hospitalStaffRouter } from "./hospital/staff";
import { hospitalSettingsRouter } from "./hospital/settings";
import { hospitalApprovalRouter } from "./hospital/approval";
import { hospitalSpendingProcedure } from "./hospital/spending";
import { hospitalAddressesRouter } from "./hospital/addresses";

export const hospitalRouter = createTRPCRouter({
  /** Phase ν-3 — 본인 병원 멤버 관리. list/invite/cancelInvite/updateRole/remove/setApprover/acceptInvite. */
  staff: hospitalStaffRouter,

  /** Phase Φ-C — 본인 병원 지출 분석 (월별·카테고리·공급사·top상품). */
  spending: hospitalSpendingProcedure,

  /** Phase ν-3 — 결재 워크플로우 설정. getSettings/updateSettings. */
  settings: hospitalSettingsRouter,

  /** Phase ν-3 — 결재 큐. listPending/listMyHistory/getDetail/approve/reject. */
  approval: hospitalApprovalRouter,

  /** 배송지 관리 — list/create/update/setDefault/remove. */
  addresses: hospitalAddressesRouter,

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

      // 1) 이미 연결됨? (트랜잭션 진입 전 빠른 체크)
      const userRef = db.collection(COLLECTIONS.users).doc(uid);
      const userSnapPre = await userRef.get();
      const userDataPre = userSnapPre.data() ?? {};
      if (userDataPre.hospitalId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 병원에 연결된 계정입니다.",
        });
      }

      // 2) OCR mock (1.7+ 실제 활성화 시 입력값과 매칭 검증)
      //    외부 API 호출이므로 트랜잭션 밖에서 처리.
      await extractBusinessRegNo({ imageUrl: input.bizRegImageUrl });
      // TODO 1.7+: if (ocr.bizRegNo !== input.bizRegNo) throw BAD_REQUEST

      // 3) NTS 진위확인 (외부 API → 트랜잭션 밖)
      const nts = await verifyBusinessStatus(input.bizRegNo);
      if (!nts.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `국세청 조회 결과 ${nts.status} 상태입니다. 활성 사업자만 가입 가능합니다.`,
        });
      }

      // 4) Firestore 트랜잭션 — 중복검사 + hospital create + members + users update
      //    Phase β-2: 8단계 순차 처리를 트랜잭션 1 + 백그라운드(customClaims) 1 로 분해.
      //    트랜잭션 안에서는 read → write 순서 엄수 (Firestore 규칙).
      const hospitalId = nanoid(12);
      const now = FieldValue.serverTimestamp();

      try {
        await db.runTransaction(async (tx) => {
          // 4-1) 중복 사업자번호 검사 (트랜잭션 내부 read)
          const dup = await tx.get(
            db
              .collection(COLLECTIONS.hospitals)
              .where("bizRegNo", "==", input.bizRegNo)
              .limit(1),
          );
          if (!dup.empty) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "이미 등록된 사업자등록번호입니다.",
            });
          }

          // 4-2) users doc 재검증 (race condition 대비)
          const userSnap = await tx.get(userRef);
          const userData = userSnap.data() ?? {};
          if (userData.hospitalId) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "이미 병원에 연결된 계정입니다.",
            });
          }

          // 4-3) /hospitals/{id} 생성
          const hospitalRef = db
            .collection(COLLECTIONS.hospitals)
            .doc(hospitalId);
          tx.set(hospitalRef, {
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

          // 4-4) /hospitals/{id}/members/{uid}
          const memberRef = db
            .collection(SUB_COLLECTIONS.hospitalMembers(hospitalId))
            .doc(uid);
          tx.set(memberRef, {
            userId: uid,
            email: userData.email ?? "",
            name: userData.name ?? input.ceoName,
            role: "BUYER_OWNER",
            joinedAt: now,
          });

          // 4-5) /users/{uid} 갱신
          tx.update(userRef, {
            hospitalId,
            hospitalName: input.name,
            updatedAt: now,
          });
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "병원 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          cause: err,
        });
      }

      // 5) Custom Claims merge — best-effort + _retryQueue fallback.
      //    트랜잭션 밖 (Auth 는 Firestore 트랜잭션에 참여 불가).
      try {
        const userRecord = await auth.getUser(uid);
        const existingClaims =
          (userRecord.customClaims ?? {}) as Record<string, unknown>;
        await auth.setCustomUserClaims(uid, {
          ...existingClaims,
          hospitalId,
        });
      } catch (err) {
        // claims 실패 시 _retryQueue 에 적재 → 후속 retry 처리.
        // (Firestore 본문은 이미 commit 되어 데이터 일관성은 유지됨)
        console.error("[hospital.onboard] setCustomUserClaims failed", err);
        try {
          await db.collection(COLLECTIONS.retryQueue).add({
            type: "SET_CUSTOM_CLAIMS",
            payload: { uid, claims: { hospitalId } },
            reason: err instanceof Error ? err.message : String(err),
            attemptCount: 0,
            status: "PENDING",
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch {
          // best-effort
        }
      }

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
