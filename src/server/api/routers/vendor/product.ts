// Wave P1 — vendor 본인 상품 관리 tRPC router.
//
// admin/product.ts (운영자 모더레이션) 과 분리. vendor 가 본인이 등록한 상품의
// CRUD + 상태 전이 (DRAFT → PENDING_REVIEW, ACTIVE → PAUSED 등) 를 담당.
//
// Endpoints:
//   - list({status?, search?, pageSize, cursor}) — 본인 상품 목록 (in-memory filter)
//   - counts()                                   — KPI 카운터 (전체/DRAFT/PENDING/ACTIVE/PAUSED…)
//   - getById({productId})                       — 단건 (본인 확인)
//   - create(payload)                            — DRAFT 로 생성 (vendorId/categoryPath 자동)
//   - update({productId, patch})                 — DRAFT 또는 REVISION_REQUESTED 만 수정 가능
//   - submitForReview({productId})               — DRAFT → PENDING_REVIEW
//   - pause({productId})                         — ACTIVE → PAUSED
//   - resume({productId})                        — PAUSED → ACTIVE
//   - archive({productId})                       — 어느 상태든 ARCHIVED (soft delete)
//
// 보안:
//   - vendorProcedure (role check + ctx.vendorId 필요)
//   - 모든 mutation 은 본인 vendorId 일치 검증
//   - 일부 mutation 은 vendor.status === APPROVED 까지 추가 검증 (create)

import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { vendorProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { Product } from "@/lib/types";

const ProductStatusEnum = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "REVISION_REQUESTED",
  "ACTIVE",
  "REJECTED",
  "PAUSED",
  "ARCHIVED",
]);

const DeviceClassEnum = z.enum([
  "CLASS_1",
  "CLASS_2",
  "CLASS_3",
  "CLASS_4",
  "NON_DEVICE",
]);

const UnitEnum = z.enum(["EA", "BOX", "CASE", "SET", "KG", "L", "ML", "PACK", "ROLL"]);
const ShippingMethodEnum = z.enum(["SELF", "COURIER", "DIRECT"]);

const PriceTierSchema = z.object({
  minQty: z.number().int().positive(),
  price: z.number().positive(),
});

type ProductWithStatus = Product & {
  status?: string;
  moderation?: { status?: string };
};

function effectiveStatus(p: ProductWithStatus): string {
  return p.moderation?.status ?? p.status ?? "DRAFT";
}

export const vendorProductRouter = createTRPCRouter({
  /**
   * 본인 상품 list.
   *
   * Phase 2 단순화 — vendorId 로 200 건 까지 가져온 뒤 in-memory filter.
   * 200 건 초과 vendor 가 생기면 composite index + Firestore where 로 전환.
   */
  list: vendorProcedure
    .input(
      z.object({
        status: ProductStatusEnum.optional(),
        search: z.string().optional(),
        pageSize: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        ctx,
        input,
      }): Promise<{
        products: Product[];
        hasMore: boolean;
        nextCursor?: string;
      }> => {
        const db = adminDb();
        const vendorId = ctx.vendorId;
        if (!vendorId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "vendor 연결이 필요합니다.",
          });
        }

        const snap = await db
          .collection(COLLECTIONS.products)
          .where("vendorId", "==", vendorId)
          .orderBy("createdAt", "desc")
          .limit(200)
          .get();

        let items = snap.docs.map((d) => {
          const data = d.data() as Omit<Product, "id">;
          return { id: d.id, ...data } as ProductWithStatus;
        });

        if (input.status) {
          items = items.filter((p) => effectiveStatus(p) === input.status);
        }
        if (input.search) {
          const q = input.search.toLowerCase();
          items = items.filter((p) =>
            [p.name, p.brand, p.udiCode, p.id]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q),
          );
        }

        let start = 0;
        if (input.cursor) {
          const idx = items.findIndex((p) => p.id === input.cursor);
          if (idx >= 0) start = idx + 1;
        }
        const page = items.slice(start, start + input.pageSize + 1);
        const hasMore = page.length > input.pageSize;
        const products = (hasMore ? page.slice(0, -1) : page) as Product[];
        const nextCursor = hasMore
          ? products[products.length - 1]?.id
          : undefined;
        return { products, hasMore, nextCursor };
      },
    ),

  /** KPI 카운트 — 상품 페이지 상단 그리드용. */
  counts: vendorProcedure.query(async ({ ctx }) => {
    const db = adminDb();
    const vendorId = ctx.vendorId;
    if (!vendorId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "vendor 연결이 필요합니다.",
      });
    }
    const snap = await db
      .collection(COLLECTIONS.products)
      .where("vendorId", "==", vendorId)
      .get();
    const items = snap.docs.map(
      (d) =>
        d.data() as {
          moderation?: { status?: string };
          status?: string;
        },
    );
    const get = (status: string) =>
      items.filter((p) => (p.moderation?.status ?? p.status) === status).length;
    return {
      total: items.length,
      DRAFT: get("DRAFT"),
      PENDING_REVIEW: get("PENDING_REVIEW"),
      REVISION_REQUESTED: get("REVISION_REQUESTED"),
      ACTIVE: get("ACTIVE"),
      PAUSED: get("PAUSED"),
      REJECTED: get("REJECTED"),
      ARCHIVED: get("ARCHIVED"),
    };
  }),

  /** 단건 (본인 vendorId 검증). */
  getById: vendorProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }): Promise<Product | null> => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.products)
        .doc(input.productId)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<Product, "id"> & { vendorId?: string };
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인 상품만 조회할 수 있습니다.",
        });
      }
      return { id: snap.id, ...data } as Product;
    }),

  /**
   * 상품 등록 — 새 상품을 DRAFT 로 생성.
   * vendor.status === APPROVED 만 가능.
   */
  create: vendorProcedure
    .input(
      z.object({
        // 기본
        name: z.string().min(1).max(200),
        nameEn: z.string().max(200).optional(),
        categoryId: z.string().min(1),
        brand: z.string().max(60).optional(),
        manufacturer: z.string().max(60).optional(),
        origin: z.string().max(40).optional(),

        // 인증
        udiCode: z.string().min(8).max(60).optional(),
        mfdsLicenseNo: z.string().max(60).optional(),
        deviceClass: DeviceClassEnum,
        certificateUrl: z.string().url().optional(),

        // 이미지
        images: z.array(z.string().url()).max(10).default([]),
        thumbnail: z.string().url().optional(),

        // 가격
        basePrice: z.number().positive(),
        priceTiers: z.array(PriceTierSchema).max(5).default([]),
        moq: z.number().int().positive().default(1),
        unit: UnitEnum.default("EA"),

        // 재고·배송
        stock: z.number().int().min(0).optional(),
        shippingMethod: ShippingMethodEnum.default("COURIER"),
        shippingFee: z.number().min(0).default(0),

        // 설명
        description: z.string().max(5000).optional(),
        usage: z.string().max(2000).optional(),
        precaution: z.string().max(2000).optional(),
        expiryPolicy: z.string().max(500).optional(),

        // 옵션
        subscribable: z.boolean().default(false),
        groupBuyable: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const vendorId = ctx.vendorId;
      if (!vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "vendor 연결이 필요합니다.",
        });
      }

      // 1) vendor 정보 (status APPROVED 확인 + denormalize 용)
      const vendorSnap = await db
        .collection(COLLECTIONS.vendors)
        .doc(vendorId)
        .get();
      if (!vendorSnap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "공급업체 정보를 찾을 수 없습니다.",
        });
      }
      const vendor = vendorSnap.data() as {
        companyName?: string;
        status?: string;
        rating?: number;
      };
      if (vendor.status !== "APPROVED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "승인된 공급업체만 상품을 등록할 수 있습니다.",
        });
      }

      // 2) category 정보
      const catSnap = await db
        .collection(COLLECTIONS.categories)
        .doc(input.categoryId)
        .get();
      if (!catSnap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "카테고리를 찾을 수 없습니다.",
        });
      }
      const cat = catSnap.data() as { path?: string[] };

      // 3) 상품 doc 생성
      const ref = db.collection(COLLECTIONS.products).doc();
      const now = FieldValue.serverTimestamp();
      const thumbnail =
        input.thumbnail ?? (input.images.length > 0 ? input.images[0] : null);

      await ref.set({
        // 소속
        vendorId,
        vendorName: vendor.companyName ?? "",
        vendorRating: vendor.rating ?? null,

        // 카테고리
        categoryId: input.categoryId,
        categoryPath: cat.path ?? [],

        // 기본
        name: input.name,
        nameEn: input.nameEn ?? null,
        brand: input.brand ?? null,
        manufacturer: input.manufacturer ?? null,
        origin: input.origin ?? null,

        // 인증
        udiCode: input.udiCode ?? null,
        mfdsLicenseNo: input.mfdsLicenseNo ?? null,
        deviceClass: input.deviceClass,
        certificateUrl: input.certificateUrl ?? null,

        // 이미지
        images: input.images,
        thumbnail,

        // 가격
        basePrice: input.basePrice,
        priceTiers: input.priceTiers,
        moq: input.moq,
        unit: input.unit,

        // 재고·배송
        stock: input.stock ?? null,
        shippingMethod: input.shippingMethod,
        shippingFee: input.shippingFee,

        // 설명
        description: input.description ?? "",
        usage: input.usage ?? null,
        precaution: input.precaution ?? null,
        expiryPolicy: input.expiryPolicy ?? null,

        // 옵션
        subscribable: input.subscribable,
        groupBuyable: input.groupBuyable,

        // 상태 (DRAFT — submitForReview 후에 PENDING_REVIEW)
        status: "DRAFT",
        moderation: {
          status: "DRAFT",
        },

        // 통계
        viewCount: 0,
        orderCount: 0,
        reviewCount: 0,

        createdAt: now,
        updatedAt: now,
      });

      // 4) audit
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "PRODUCT_CREATED",
        targetType: "Product",
        targetId: ref.id,
        after: {
          name: input.name,
          categoryId: input.categoryId,
          basePrice: input.basePrice,
        },
        createdAt: now,
      });

      return { productId: ref.id };
    }),

  /**
   * 상품 수정 — DRAFT 또는 REVISION_REQUESTED 상태에서만.
   * categoryId 변경 시 path 자동 갱신.
   */
  update: vendorProcedure
    .input(
      z.object({
        productId: z.string(),
        patch: z.object({
          name: z.string().min(1).max(200).optional(),
          nameEn: z.string().max(200).nullable().optional(),
          categoryId: z.string().optional(),
          brand: z.string().max(60).nullable().optional(),
          manufacturer: z.string().max(60).nullable().optional(),
          origin: z.string().max(40).nullable().optional(),

          udiCode: z.string().min(8).max(60).nullable().optional(),
          mfdsLicenseNo: z.string().max(60).nullable().optional(),
          deviceClass: DeviceClassEnum.optional(),
          certificateUrl: z.string().url().nullable().optional(),

          images: z.array(z.string().url()).max(10).optional(),
          thumbnail: z.string().url().optional(),

          basePrice: z.number().positive().optional(),
          priceTiers: z.array(PriceTierSchema).max(5).optional(),
          moq: z.number().int().positive().optional(),
          unit: UnitEnum.optional(),

          stock: z.number().int().min(0).nullable().optional(),
          shippingMethod: ShippingMethodEnum.optional(),
          shippingFee: z.number().min(0).optional(),

          description: z.string().max(5000).optional(),
          usage: z.string().max(2000).nullable().optional(),
          precaution: z.string().max(2000).nullable().optional(),
          expiryPolicy: z.string().max(500).nullable().optional(),

          subscribable: z.boolean().optional(),
          groupBuyable: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.products).doc(input.productId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "상품을 찾을 수 없습니다.",
        });
      }
      const data = snap.data() as ProductWithStatus & { vendorId?: string };
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인 상품만 수정할 수 있습니다.",
        });
      }

      const status = effectiveStatus(data);
      if (status !== "DRAFT" && status !== "REVISION_REQUESTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "DRAFT 또는 수정 요청 상태에서만 수정할 수 있습니다.",
        });
      }

      const updates: Record<string, unknown> = {
        ...input.patch,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // categoryId 변경 시 path 갱신
      if (
        input.patch.categoryId &&
        input.patch.categoryId !== data.categoryId
      ) {
        const catSnap = await db
          .collection(COLLECTIONS.categories)
          .doc(input.patch.categoryId)
          .get();
        if (!catSnap.exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "카테고리를 찾을 수 없습니다.",
          });
        }
        const cat = catSnap.data() as { path?: string[] };
        updates.categoryPath = cat.path ?? [];
      }

      await ref.update(updates);

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "PRODUCT_UPDATED",
        targetType: "Product",
        targetId: input.productId,
        after: { fields: Object.keys(input.patch) },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true };
    }),

  /** 심사 제출 — DRAFT/REVISION_REQUESTED → PENDING_REVIEW. */
  submitForReview: vendorProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.products).doc(input.productId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "상품을 찾을 수 없습니다.",
        });
      }
      const data = snap.data() as ProductWithStatus & { vendorId?: string };
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인 상품만 제출할 수 있습니다.",
        });
      }
      const status = effectiveStatus(data);
      if (status !== "DRAFT" && status !== "REVISION_REQUESTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "DRAFT 또는 수정 요청 상태만 심사 제출이 가능합니다.",
        });
      }

      const now = FieldValue.serverTimestamp();
      await ref.update({
        "moderation.status": "PENDING_REVIEW",
        "moderation.submittedAt": now,
        updatedAt: now,
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "PRODUCT_SUBMITTED",
        targetType: "Product",
        targetId: input.productId,
        createdAt: now,
      });

      return { ok: true };
    }),

  /** 일시 중단 — ACTIVE → PAUSED. */
  pause: vendorProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.products).doc(input.productId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "상품을 찾을 수 없습니다.",
        });
      }
      const data = snap.data() as ProductWithStatus & { vendorId?: string };
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const status = effectiveStatus(data);
      if (status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "노출 중인 상품만 일시 중단할 수 있습니다.",
        });
      }
      const now = FieldValue.serverTimestamp();
      await ref.update({
        status: "PAUSED",
        "moderation.status": "PAUSED",
        updatedAt: now,
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "PRODUCT_PAUSED",
        targetType: "Product",
        targetId: input.productId,
        createdAt: now,
      });
      return { ok: true };
    }),

  /** 재개 — PAUSED → ACTIVE. */
  resume: vendorProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.products).doc(input.productId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "상품을 찾을 수 없습니다.",
        });
      }
      const data = snap.data() as ProductWithStatus & { vendorId?: string };
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const status = effectiveStatus(data);
      if (status !== "PAUSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "일시 중단된 상품만 재개할 수 있습니다.",
        });
      }
      const now = FieldValue.serverTimestamp();
      await ref.update({
        status: "ACTIVE",
        "moderation.status": "ACTIVE",
        updatedAt: now,
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "PRODUCT_RESUMED",
        targetType: "Product",
        targetId: input.productId,
        createdAt: now,
      });
      return { ok: true };
    }),

  /** 아카이브 (soft delete). 어느 상태에서든 가능. */
  archive: vendorProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.products).doc(input.productId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "상품을 찾을 수 없습니다.",
        });
      }
      const data = snap.data() as ProductWithStatus & { vendorId?: string };
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const now = FieldValue.serverTimestamp();
      await ref.update({
        status: "ARCHIVED",
        "moderation.status": "ARCHIVED",
        updatedAt: now,
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "PRODUCT_ARCHIVED",
        targetType: "Product",
        targetId: input.productId,
        createdAt: now,
      });
      return { ok: true };
    }),
});
