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

export const vendorRouter = createTRPCRouter({
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

      // 1) 이미 연결됨?
      const userRef = db.collection(COLLECTIONS.users).doc(uid);
      const userSnap = await userRef.get();
      const userData = userSnap.data() ?? {};
      if (userData.vendorId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 공급업체에 연결된 계정입니다.",
        });
      }

      // 2) 사업자번호 중복
      const dup = await db
        .collection(COLLECTIONS.vendors)
        .where("bizRegNo", "==", input.bizRegNo)
        .limit(1)
        .get();
      if (!dup.empty) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 등록된 사업자등록번호입니다.",
        });
      }

      // 3) OCR mock
      await extractBusinessRegNo({ imageUrl: input.bizRegImageUrl });
      // TODO 1.8+: 실제 OCR 활성화 시 입력값과 매칭 검증

      // 4) NTS 진위확인
      const nts = await verifyBusinessStatus(input.bizRegNo);
      if (!nts.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `국세청 조회 결과 ${nts.status} 상태입니다. 활성 사업자만 가입 가능합니다.`,
        });
      }

      // 5) /vendors/{id} 생성 — status: PENDING_REVIEW
      const vendorId = nanoid(12);
      const now = FieldValue.serverTimestamp();
      await db.collection(COLLECTIONS.vendors).doc(vendorId).set({
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

      // 6) /vendors/{id}/members/{uid}
      await db
        .collection(SUB_COLLECTIONS.vendorMembers(vendorId))
        .doc(uid)
        .set({
          userId: uid,
          email: userData.email ?? input.email,
          name: userData.name ?? input.ceoName,
          role: "VENDOR_OWNER",
          joinedAt: now,
        });

      // 7) /users/{uid} 갱신
      await userRef.update({
        vendorId,
        vendorName: input.companyName,
        updatedAt: now,
      });

      // 8) Custom Claims merge — 기존 role(VENDOR_OWNER) 보존 + vendorId 추가
      const userRecord = await auth.getUser(uid);
      const existingClaims = (userRecord.customClaims ?? {}) as Record<string, unknown>;
      await auth.setCustomUserClaims(uid, {
        ...existingClaims,
        vendorId,
      });

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

