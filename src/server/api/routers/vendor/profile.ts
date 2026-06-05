// Phase ν-3 작업1 — vendor 본인 프로필 조회·수정 (셀러센터 /seller/profile).
//
// 주요 procedures:
//   - getMine: 현재 vendor doc + members count
//   - updateBasic: 회사명·연락처·로고·소재지·영업시간 (VENDOR_OWNER 만)
//   - updateLogo: Storage 업로드된 logoUrl 반영
//   - requestRecertification: 의료기기 판매업 신고증 변경 요청 → admin 재심사 큐
//
// 보안:
//   - vendorProcedure (VENDOR_OWNER / VENDOR_STAFF) + ctx.vendorId 필수
//   - 변경 mutation 은 OWNER 역할만 (sub-doc /vendors/{vendorId}/members/{uid}.role 검증)
//   - status·defaultCommissionRate·bizRegNo 등 critical 필드는 절대 갱신 금지 (admin only)

import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { vendorProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS, SUB_COLLECTIONS } from "@/server/firebase/collections";

/**
 * 본인 vendor 의 member 역할을 조회. OWNER 여부 가드 용도.
 * 멤버 doc 없거나 role 미지정 시 STAFF 로 간주 (보수적).
 */
async function getMemberRole(
  db: FirebaseFirestore.Firestore,
  vendorId: string,
  uid: string,
): Promise<"VENDOR_OWNER" | "VENDOR_ADMIN" | "VENDOR_STAFF" | "VENDOR_VIEWER"> {
  const snap = await db
    .collection(SUB_COLLECTIONS.vendorMembers(vendorId))
    .doc(uid)
    .get();
  if (!snap.exists) return "VENDOR_STAFF";
  const data = snap.data() as { role?: string };
  const r = data.role;
  if (
    r === "VENDOR_OWNER" ||
    r === "VENDOR_ADMIN" ||
    r === "VENDOR_STAFF" ||
    r === "VENDOR_VIEWER"
  ) {
    return r;
  }
  return "VENDOR_STAFF";
}

function ensureVendorCtx(ctx: { vendorId?: string; uid?: string }): {
  vendorId: string;
  uid: string;
} {
  if (!ctx.vendorId || !ctx.uid) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "공급업체 계정이 필요합니다.",
    });
  }
  return { vendorId: ctx.vendorId, uid: ctx.uid };
}

export const vendorProfileRouter = createTRPCRouter({
  /** 본인 vendor 의 풀 프로필 + members count. */
  getMine: vendorProcedure.query(async ({ ctx }) => {
    const { vendorId, uid } = ensureVendorCtx(ctx);
    const db = adminDb();

    const [vendorSnap, memberSnap, myRole] = await Promise.all([
      db.collection(COLLECTIONS.vendors).doc(vendorId).get(),
      db.collection(SUB_COLLECTIONS.vendorMembers(vendorId)).get(),
      getMemberRole(db, vendorId, uid),
    ]);

    if (!vendorSnap.exists) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "공급업체 정보를 찾을 수 없습니다.",
      });
    }
    return {
      vendor: { id: vendorSnap.id, ...vendorSnap.data() } as Record<string, unknown>,
      memberCount: memberSnap.size,
      myRole,
    };
  }),

  /** 회사명·연락처·소재지·영업시간 등 기본 정보 수정 (OWNER only). */
  updateBasic: vendorProcedure
    .input(
      z.object({
        companyName: z.string().min(1).max(80).optional(),
        ceoName: z.string().min(1).max(40).optional(),
        phone: z.string().min(1).max(40).optional(),
        email: z.string().email().optional(),
        zipcode: z.string().min(1).max(10).optional(),
        address: z.string().min(1).max(200).optional(),
        addressDetail: z.string().max(200).optional(),
        businessHours: z.string().max(200).optional(),
        holidays: z.string().max(200).optional(),
        introduction: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { vendorId, uid } = ensureVendorCtx(ctx);
      const db = adminDb();

      const role = await getMemberRole(db, vendorId, uid);
      if (role !== "VENDOR_OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "공급업체 OWNER 만 프로필을 수정할 수 있습니다.",
        });
      }

      const patch: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) patch[k] = v;
      }

      const vendorRef = db.collection(COLLECTIONS.vendors).doc(vendorId);
      const before = (await vendorRef.get()).data() ?? {};
      await vendorRef.update(patch);

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "VENDOR_OWNER",
          action: "VENDOR_PROFILE_UPDATED",
          targetType: "Vendor",
          targetId: vendorId,
          before: Object.fromEntries(
            Object.keys(input).map((k) => [
              k,
              (before as Record<string, unknown>)[k] ?? null,
            ]),
          ),
          after: input,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // best-effort
      }
      return { ok: true };
    }),

  /** Storage 업로드 후 logoUrl 반영. */
  updateLogo: vendorProcedure
    .input(z.object({ logoUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const { vendorId, uid } = ensureVendorCtx(ctx);
      const db = adminDb();
      const role = await getMemberRole(db, vendorId, uid);
      if (role !== "VENDOR_OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "공급업체 OWNER 만 로고를 변경할 수 있습니다.",
        });
      }
      await db.collection(COLLECTIONS.vendors).doc(vendorId).update({
        logoUrl: input.logoUrl,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 의료기기 판매업 신고증 변경 요청 → admin 재심사 큐.
   * vendor 본인은 직접 salesLicenseNo / Image 를 갱신하지 않고 변경 요청만 적재.
   * admin 이 검토 후 승인 시 별도 admin mutation 으로 실제 필드 갱신.
   */
  requestRecertification: vendorProcedure
    .input(
      z.object({
        newSalesLicenseNo: z.string().min(1).max(40).optional(),
        newSalesLicenseImageUrl: z.string().url().optional(),
        newManufactureLicenseUrl: z.string().url().optional(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { vendorId, uid } = ensureVendorCtx(ctx);
      const db = adminDb();
      const role = await getMemberRole(db, vendorId, uid);
      if (role !== "VENDOR_OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "공급업체 OWNER 만 재심사를 요청할 수 있습니다.",
        });
      }

      // 운영자 알림 큐 적재 (NotificationType: VENDOR_RECERT_REQUESTED).
      const now = FieldValue.serverTimestamp();
      await db.collection(COLLECTIONS.notifications).add({
        targetType: "USER",
        targetId: "admin", // admin broadcast (실제 운영자 dispatcher 가 fan-out)
        type: "VENDOR_RECERT_REQUESTED",
        title: "공급업체 재심사 요청",
        body: `공급업체 ${vendorId} 가 의료기기 판매업 신고증 변경을 요청했습니다.\n사유: ${input.reason}`,
        data: {
          vendorId,
          newSalesLicenseNo: input.newSalesLicenseNo ?? null,
          newSalesLicenseImageUrl: input.newSalesLicenseImageUrl ?? null,
          newManufactureLicenseUrl: input.newManufactureLicenseUrl ?? null,
          requestedBy: uid,
        },
        channels: ["IN_APP", "EMAIL"],
        kakaoSent: false,
        emailSent: false,
        createdAt: now,
      });

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "VENDOR_OWNER",
          action: "VENDOR_RECERT_REQUESTED",
          targetType: "Vendor",
          targetId: vendorId,
          after: { reason: input.reason },
          createdAt: now,
        });
      } catch {
        // best-effort
      }
      return { ok: true };
    }),
});
