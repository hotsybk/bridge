// Phase ν-5 작업1 — buyer/public facing vendor profile router.
//
// 비로그인 buyer 가 vendor 상세 페이지(/vendors/[vendorId])에 진입할 때 사용.
// 민감 정보(은행 계좌·내부 메모·이메일 등)는 절대 노출하지 않는다.
//
// Firestore Rules `match /vendors/{vendorId}` 는 read true 이므로 클라이언트도 read 가능하지만,
// 노출 가능 필드를 명시적으로 whitelist 하여 향후 vendor 모델이 확장돼도 실수로 새 필드가
// 노출되는 일이 없도록 한다.

import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { Vendor } from "@/lib/types";

/** Buyer 에게 노출 가능한 vendor 필드 whitelist. */
export interface PublicVendorProfile {
  id: string;
  companyName: string;
  vendorType: Vendor["vendorType"];
  status: Vendor["status"];
  grade?: Vendor["grade"];
  categories: string[];
  address?: string;
  hasSalesLicense: boolean;
  hasManufactureLicense: boolean;
  productCount: number;
  totalGmv: number;
  rating?: number;
  reviewCount: number;
  createdAtSeconds: number | null;
}

export const vendorPublicProfileRouter = createTRPCRouter({
  /**
   * Public — vendor 공개 프로필 (민감 정보 제외).
   * Vendor.status === APPROVED 가 아닌 경우에도 buyer 가 직접 URL 진입할 수 있으므로
   * status 는 노출하되 "심사 중" 등으로 UI 가 처리.
   */
  getById: publicProcedure
    .input(z.object({ vendorId: z.string().min(1) }))
    .query(async ({ input }): Promise<PublicVendorProfile> => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.vendors)
        .doc(input.vendorId)
        .get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "공급사를 찾을 수 없습니다.",
        });
      }
      const data = snap.data() as Partial<Vendor>;

      const createdAt = (data as { createdAt?: { seconds?: number } }).createdAt;
      const createdAtSeconds =
        typeof createdAt?.seconds === "number" ? createdAt.seconds : null;

      return {
        id: snap.id,
        companyName: data.companyName ?? "공급사",
        vendorType: (data.vendorType ?? "DISTRIBUTOR") as Vendor["vendorType"],
        status: (data.status ?? "PENDING_REVIEW") as Vendor["status"],
        grade: data.grade,
        categories: Array.isArray(data.categories) ? data.categories : [],
        address: data.address ?? undefined,
        hasSalesLicense: Boolean(data.salesLicenseNo),
        hasManufactureLicense: Boolean(data.manufactureLicenseUrl),
        productCount: typeof data.productCount === "number" ? data.productCount : 0,
        totalGmv: typeof data.totalGmv === "number" ? data.totalGmv : 0,
        rating: typeof data.rating === "number" ? data.rating : undefined,
        reviewCount: typeof data.reviewCount === "number" ? data.reviewCount : 0,
        createdAtSeconds,
      };
    }),
});
