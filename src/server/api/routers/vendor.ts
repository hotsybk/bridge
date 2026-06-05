import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { createTRPCRouter, vendorProcedure } from "@/server/api/trpc";
import { adminAuth, adminDb } from "@/server/firebase/admin";
import { COLLECTIONS, SUB_COLLECTIONS } from "@/server/firebase/collections";
import { extractBusinessRegNo } from "@/server/services/clova-ocr";
import { verifyBusinessStatus } from "@/server/services/nts-verify";
import { vendorOnboardSchema } from "@/lib/validators/vendor";
import type { Vendor } from "@/lib/types";

import { vendorProductRouter } from "./vendor/product";
import { vendorOrderRouter } from "./vendor/order";
import { vendorSettlementRouter } from "./vendor/settlement";
import { vendorGroupbuyRouter } from "./vendor/groupbuy";
import { vendorSubscriptionRouter } from "./vendor/subscription";
import { vendorRfqRouter } from "./vendor/rfq";
import { vendorProfileRouter } from "./vendor/profile";
import { vendorStaffRouter } from "./vendor/staff";
import { vendorPublicProfileRouter } from "./vendor/public-profile";

export const vendorRouter = createTRPCRouter({
  /** 본인 상품 관리 (Wave P1). list/counts/getById/create/update/submit/pause/resume/archive. */
  product: vendorProductRouter,

  /** 본인 주문(SubOrder) 처리 (Wave P2). list/counts/getById/accept/ship/markDelivered/cancel. */
  order: vendorOrderRouter,

  /** 본인 정산 조회·빠른정산 신청 (Wave P2). list/counts/payouts/requestFastSettlement. */
  settlement: vendorSettlementRouter,

  /** Wave Q2 — 본인 공동구매 캠페인 등록·관리. list/counts/getById/listParticipations/create/cancel. */
  groupbuy: vendorGroupbuyRouter,

  /** Wave Q2 — 본인 vendor 가 받는 정기구독 조회 (read-only). list/counts. */
  subscription: vendorSubscriptionRouter,

  /** Wave Q2 — 받은 RFQ 조회·견적 제출. list/getById/submitQuote. */
  rfq: vendorRfqRouter,

  /** Phase ν-3 — 본인 vendor 프로필 조회·수정. getMine/updateBasic/updateLogo/requestRecertification. */
  profile: vendorProfileRouter,

  /** Phase ν-3 — 본인 vendor 멤버 관리. list/invite/cancelInvite/updateRole/remove/acceptInvite. */
  staff: vendorStaffRouter,

  /** Phase ν-5 — buyer/public facing 공급사 프로필. getById. 민감 정보 제외 whitelist. */
  publicProfile: vendorPublicProfileRouter,

  /**
   * 공급업체 온보딩 — Phase 1.7 vendor flow 의 핵심 mutation.
   *
   * hospital.onboard 와 동일 8단계 + vendorType 별 서류 검증 + status=PENDING_REVIEW 추가.
   *
   * 1) 이미 vendor 에 연결된 계정인지 확인 (idempotent guard)
   * 2) 사업자번호 중복 검사
   * 3) Clova OCR mock
   * 4) NTS 진위확인 mock — 휴/폐업 거부
   * 5) /vendors/{nanoid} 생성 (status: PENDING_REVIEW — 관리자 심사 대기)
   * 6) /vendors/{id}/members/{uid} sub-doc 생성
   * 7) /users/{uid} 갱신 (vendorId + denormalized vendorName)
   * 8) Custom Claims merge — 기존 role 보존 + vendorId 추가
   *
   * 반환: { vendorId, status, needsTokenRefresh: true, statusMessage }
   */
  onboard: vendorProcedure
    .input(vendorOnboardSchema)
    .mutation(async ({ ctx, input }) => {
      const { uid } = ctx;
      const db = adminDb();
      const auth = adminAuth();

      // 1) 이미 연결됨? (트랜잭션 진입 전 빠른 체크)
      const userRef = db.collection(COLLECTIONS.users).doc(uid);
      const userSnapPre = await userRef.get();
      const userDataPre = userSnapPre.data() ?? {};
      if (userDataPre.vendorId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 공급업체에 연결된 계정입니다.",
        });
      }

      // 2) OCR mock (외부 API → 트랜잭션 밖)
      await extractBusinessRegNo({ imageUrl: input.bizRegImageUrl });
      // TODO 1.8+: 실제 OCR 활성화 시 입력값과 매칭 검증

      // 3) NTS 진위확인 (외부 API → 트랜잭션 밖)
      const nts = await verifyBusinessStatus(input.bizRegNo);
      if (!nts.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `국세청 조회 결과 ${nts.status} 상태입니다. 활성 사업자만 가입 가능합니다.`,
        });
      }

      // 4) Firestore 트랜잭션 — 중복검사 + vendor create + members + users update
      //    Phase β-2: 8단계 순차 처리를 트랜잭션 1 + 백그라운드(customClaims) 1 로 분해.
      const vendorId = nanoid(12);
      const now = FieldValue.serverTimestamp();

      try {
        await db.runTransaction(async (tx) => {
          // 4-1) 중복 사업자번호 검사 (트랜잭션 내부 read)
          const dup = await tx.get(
            db
              .collection(COLLECTIONS.vendors)
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
          if (userData.vendorId) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "이미 공급업체에 연결된 계정입니다.",
            });
          }

          // 4-3) /vendors/{id} 생성 — status: PENDING_REVIEW
          const vendorRef = db.collection(COLLECTIONS.vendors).doc(vendorId);
          tx.set(vendorRef, {
            id: vendorId,
            bizRegNo: input.bizRegNo,
            bizRegImageUrl: input.bizRegImageUrl,
            bizVerifiedAt: now,
            companyName: input.companyName,
            ceoName: input.ceoName,
            phone: input.phone,
            email: input.email,
            zipcode: input.zipcode,
            address: input.address,
            ...(input.addressDetail ? { addressDetail: input.addressDetail } : {}),
            vendorType: input.vendorType,
            ...(input.salesLicenseNo ? { salesLicenseNo: input.salesLicenseNo } : {}),
            ...(input.salesLicenseImageUrl ? { salesLicenseImageUrl: input.salesLicenseImageUrl } : {}),
            ...(input.manufactureLicenseUrl ? { manufactureLicenseUrl: input.manufactureLicenseUrl } : {}),
            status: "PENDING_REVIEW",
            defaultCommissionRate: 0.05,
            fastSettlementEnabled: false,
            categories: input.categories,
            payoutBankCode: input.payoutBankCode,
            payoutBankAccount: input.payoutBankAccount,
            payoutAccountHolder: input.payoutAccountHolder,
            productCount: 0,
            totalGmv: 0,
            reviewCount: 0,
            createdAt: now,
            updatedAt: now,
          });

          // 4-4) /vendors/{id}/members/{uid}
          const memberRef = db
            .collection(SUB_COLLECTIONS.vendorMembers(vendorId))
            .doc(uid);
          tx.set(memberRef, {
            userId: uid,
            email: userData.email ?? input.email,
            name: userData.name ?? input.ceoName,
            role: "VENDOR_OWNER",
            joinedAt: now,
          });

          // 4-5) /users/{uid} 갱신
          tx.update(userRef, {
            vendorId,
            vendorName: input.companyName,
            updatedAt: now,
          });
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "공급업체 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          cause: err,
        });
      }

      // 5) Custom Claims merge — best-effort + _retryQueue fallback.
      try {
        const userRecord = await auth.getUser(uid);
        const existingClaims =
          (userRecord.customClaims ?? {}) as Record<string, unknown>;
        await auth.setCustomUserClaims(uid, {
          ...existingClaims,
          vendorId,
        });
      } catch (err) {
        console.error("[vendor.onboard] setCustomUserClaims failed", err);
        try {
          await db.collection(COLLECTIONS.retryQueue).add({
            type: "SET_CUSTOM_CLAIMS",
            payload: { uid, claims: { vendorId } },
            reason: err instanceof Error ? err.message : String(err),
            attemptCount: 0,
            status: "PENDING",
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch {
          // best-effort
        }
      }

      return {
        ok: true,
        vendorId,
        status: "PENDING_REVIEW" as const,
        statusMessage: "관리자 심사 대기 중입니다 (24~72시간 내 안내). 승인 후 이메일·알림톡으로 알려드립니다.",
        needsTokenRefresh: true,
      };
    }),

  /**
   * 현재 사용자가 소속된 vendor 조회.
   * onboarding 미완료 (vendorId 없음) 면 null 반환.
   */
  getCurrent: vendorProcedure.query(async ({ ctx }): Promise<Vendor | null> => {
    const { vendorId } = ctx;
    if (!vendorId) return null;
    const snap = await adminDb()
      .collection(COLLECTIONS.vendors)
      .doc(vendorId)
      .get();
    if (!snap.exists) return null;
    const data = snap.data() as Omit<Vendor, "id">;
    return { id: snap.id, ...data };
  }),
});

