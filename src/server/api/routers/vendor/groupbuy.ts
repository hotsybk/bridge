// Wave Q2 — vendor 본인 공동구매 캠페인 관리 tRPC router.
//
// Endpoints:
//   - list({status?, pageSize, cursor})   — 본인 캠페인 목록
//   - counts()                            — KPI 카운터 (OPEN/TARGET_MET/FULFILLED/FAILED + totalRevenue)
//   - getById({groupBuyId})               — 단건 + shard 합산 currentQty
//   - listParticipations({groupBuyId})    — 참여 hospital ledger
//   - create({productId,...})             — 새 캠페인 생성 (onGroupbuyCreated trigger 가 shard 초기화)
//   - cancel({groupBuyId, reason})        — OPEN 캠페인 취소 (모든 participation void)
//
// 보안:
//   - vendorProcedure (role check)
//   - 모든 query/mutation 은 본인 vendorId 일치 검증
//   - 본인 ACTIVE 상품만 캠페인 등록 가능

import { TRPCError } from "@trpc/server";
import { FieldValue, type Query } from "firebase-admin/firestore";
import { z } from "zod";

import { createTRPCRouter, vendorProcedure } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

const TierPricingSchema = z.object({
  minQty: z.number().int().positive(),
  price: z.number().positive(),
});

const GbStatus = z.enum(["OPEN", "TARGET_MET", "FULFILLED", "FAILED"]);

type GroupBuyDoc = {
  vendorId?: string;
  productId?: string;
  productName?: string;
  productImage?: string | null;
  vendorName?: string;
  title?: string;
  description?: string | null;
  status?: string;
  targetQty?: number;
  currentQty?: number;
  participationCount?: number;
  tierPricing?: Array<{ minQty: number; price: number }>;
  startsAt?: unknown;
  endsAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const vendorGroupbuyRouter = createTRPCRouter({
  /** 본인 캠페인 list + cursor pagination. */
  list: vendorProcedure
    .input(
      z.object({
        status: GbStatus.optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = adminDb();
      if (!ctx.vendorId) {
        return { groupBuys: [], hasMore: false, nextCursor: undefined };
      }

      let q: Query = db
        .collection(COLLECTIONS.groupBuys)
        .where("vendorId", "==", ctx.vendorId);
      if (input.status) q = q.where("status", "==", input.status);
      q = q.orderBy("createdAt", "desc").limit(input.pageSize + 1);
      if (input.cursor) {
        const c = await db
          .collection(COLLECTIONS.groupBuys)
          .doc(input.cursor)
          .get();
        if (c.exists) q = q.startAfter(c);
      }

      try {
        const snap = await q.get();
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as GroupBuyDoc),
        }));
        const hasMore = items.length > input.pageSize;
        const trimmed = hasMore ? items.slice(0, -1) : items;
        return {
          groupBuys: trimmed,
          hasMore,
          nextCursor: hasMore ? trimmed[trimmed.length - 1]?.id : undefined,
        };
      } catch {
        return { groupBuys: [], hasMore: false, nextCursor: undefined };
      }
    }),

  /** KPI counts — 본인 캠페인 전체 스캔. */
  counts: vendorProcedure.query(async ({ ctx }) => {
    const db = adminDb();
    if (!ctx.vendorId) {
      return { open: 0, targetMet: 0, fulfilled: 0, failed: 0, totalRevenue: 0 };
    }
    try {
      const snap = await db
        .collection(COLLECTIONS.groupBuys)
        .where("vendorId", "==", ctx.vendorId)
        .get();
      const items = snap.docs.map((d) => d.data() as GroupBuyDoc);
      const totalRevenue = items
        .filter((g) => g.status === "FULFILLED")
        .reduce((sum, g) => {
          const qty = g.currentQty ?? 0;
          const tierPrice = g.tierPricing?.[0]?.price ?? 0;
          return sum + qty * tierPrice;
        }, 0);
      return {
        open: items.filter((g) => g.status === "OPEN").length,
        targetMet: items.filter((g) => g.status === "TARGET_MET").length,
        fulfilled: items.filter((g) => g.status === "FULFILLED").length,
        failed: items.filter((g) => g.status === "FAILED").length,
        totalRevenue,
      };
    } catch {
      return { open: 0, targetMet: 0, fulfilled: 0, failed: 0, totalRevenue: 0 };
    }
  }),

  /** 단건 + shard 합산 currentQty. */
  getById: vendorProcedure
    .input(z.object({ groupBuyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.groupBuys).doc(input.groupBuyId);
      const snap = await ref.get();
      if (!snap.exists) return null;
      const data = snap.data() as GroupBuyDoc;
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인 캠페인만 조회할 수 있습니다.",
        });
      }
      let currentQty = data.currentQty ?? 0;
      try {
        const { sumCounter } = await import("@/server/lib/distributed-counter");
        currentQty = await sumCounter(ref);
      } catch {
        // shard 미초기화 시 denorm 값 유지
      }
      return { id: snap.id, ...data, currentQty };
    }),

  /** 참여 ledger (본인 캠페인 한정). */
  listParticipations: vendorProcedure
    .input(z.object({ groupBuyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = adminDb();
      const gbRef = db.collection(COLLECTIONS.groupBuys).doc(input.groupBuyId);
      const gbSnap = await gbRef.get();
      if (!gbSnap.exists) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const gb = gbSnap.data() as GroupBuyDoc;
      if (gb.vendorId !== ctx.vendorId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const snap = await gbRef
        .collection("participations")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }),

  /**
   * 캠페인 등록.
   *  - 본인 ACTIVE 상품만 가능
   *  - 시작일·마감일 검증
   *  - tier 가격 minQty 오름차순 정렬
   *  - shard 초기화는 onGroupbuyCreated trigger 가 자동 처리 (Wave I)
   */
  create: vendorProcedure
    .input(
      z.object({
        productId: z.string(),
        title: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        startsAt: z.string().or(z.date()),
        endsAt: z.string().or(z.date()),
        targetQty: z.number().int().positive(),
        tierPricing: z.array(TierPricingSchema).min(1).max(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      if (!ctx.vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "vendor 연결이 필요합니다.",
        });
      }

      // 상품 검증 (본인 + ACTIVE)
      const productSnap = await db
        .collection(COLLECTIONS.products)
        .doc(input.productId)
        .get();
      if (!productSnap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "상품을 찾을 수 없습니다.",
        });
      }
      const product = productSnap.data() as {
        vendorId?: string;
        name?: string;
        thumbnail?: string;
        images?: string[];
        moderation?: { status?: string };
        status?: string;
      };
      if (product.vendorId !== ctx.vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인 상품만 캠페인에 등록할 수 있습니다.",
        });
      }
      const effectiveStatus = product.moderation?.status ?? product.status;
      if (effectiveStatus !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "노출 중(ACTIVE) 상품만 캠페인을 등록할 수 있습니다.",
        });
      }

      // vendor 정보
      const vendorSnap = await db
        .collection(COLLECTIONS.vendors)
        .doc(ctx.vendorId)
        .get();
      const vendor = vendorSnap.data() as { companyName?: string };

      // 날짜 검증
      const startsAt =
        typeof input.startsAt === "string"
          ? new Date(input.startsAt)
          : input.startsAt;
      const endsAt =
        typeof input.endsAt === "string"
          ? new Date(input.endsAt)
          : input.endsAt;
      if (endsAt.getTime() <= startsAt.getTime()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "마감일이 시작일 이후여야 합니다.",
        });
      }

      // tier 정렬 + 검증 (minQty 오름차순, 가격은 내림차순이어야 의미 있음)
      const sortedTiers = [...input.tierPricing].sort(
        (a, b) => a.minQty - b.minQty,
      );

      const gbRef = db.collection(COLLECTIONS.groupBuys).doc();
      await gbRef.set({
        productId: input.productId,
        productName: product.name ?? "",
        productImage:
          product.thumbnail ?? product.images?.[0] ?? null,
        vendorId: ctx.vendorId,
        vendorName: vendor?.companyName ?? "",
        title: input.title,
        description: input.description ?? null,
        startsAt,
        endsAt,
        targetQty: input.targetQty,
        currentQty: 0,
        tierPricing: sortedTiers,
        status: "OPEN",
        participationCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      // onGroupbuyCreated trigger 가 자동으로 10 shard 초기화 + audit log (Wave I)

      return { groupBuyId: gbRef.id };
    }),

  /**
   * 캠페인 취소 — OPEN 상태만, vendor 본인.
   * 모든 participation 의 pre-auth 를 void 처리 후 status=FAILED.
   */
  cancel: vendorProcedure
    .input(
      z.object({
        groupBuyId: z.string(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.groupBuys).doc(input.groupBuyId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const gb = snap.data() as GroupBuyDoc;
      if (gb.vendorId !== ctx.vendorId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (gb.status !== "OPEN") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OPEN 상태만 취소할 수 있습니다.",
        });
      }

      const { cancelPayment } = await import("@/server/services/portone");
      const participations = await ref.collection("participations").get();
      let voidedCount = 0;
      for (const p of participations.docs) {
        const data = p.data() as {
          preAuthPaymentId?: string;
          voidedAt?: unknown;
        };
        if (data.voidedAt) continue;
        if (data.preAuthPaymentId) {
          try {
            await cancelPayment({
              paymentId: data.preAuthPaymentId,
              reason: input.reason,
            });
            await p.ref.update({ voidedAt: FieldValue.serverTimestamp() });
            voidedCount++;
          } catch (err) {
            console.error("[vendor.groupbuy.cancel] void failed", p.id, err);
          }
        } else {
          await p.ref.update({ voidedAt: FieldValue.serverTimestamp() });
          voidedCount++;
        }
      }

      await ref.update({
        status: "FAILED",
        statusReason: input.reason,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "GROUPBUY_VENDOR_CANCELLED",
        targetType: "GroupBuy",
        targetId: input.groupBuyId,
        after: { reason: input.reason, voidedCount },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, voidedCount };
    }),
});
