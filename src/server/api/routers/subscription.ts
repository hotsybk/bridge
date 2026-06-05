// Wave Y — Phase 3 정기구독 buyer 라우터.
//
// Endpoints:
//   - listMine({status, pageSize, cursor})
//   - getMine({subscriptionId})                       runs 서브컬렉션 포함
//   - create({productId, cadence, qty, startsAt?, shippingAddress})
//   - pause / resume / cancel({subscriptionId})
//   - updateQty({subscriptionId, qty})                가격 자동 재계산 (티어)
//   - skipNext({subscriptionId})                      1회 스킵 — nextRunAt 한 주기 이동
//
// 모든 mutation 은 본인 hospital 소속만 가능. auditLog 적재.

import {TRPCError} from "@trpc/server";
import {FieldValue, Timestamp, type Query} from "firebase-admin/firestore";
import {z} from "zod";

import {buyerProcedure, createTRPCRouter} from "@/server/api/trpc";
import {adminDb} from "@/server/firebase/admin";
import {COLLECTIONS} from "@/server/firebase/collections";

const CadenceEnum = z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"]);
const StatusFilterEnum = z.enum(["ACTIVE", "PAUSED", "CANCELLED"]);

const ShippingAddressSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  zipcode: z.string().min(1),
  address: z.string().min(1),
  addressDetail: z.string().optional(),
});

type ProductDoc = {
  vendorId?: string;
  vendorName?: string;
  name?: string;
  thumbnail?: string;
  images?: string[];
  unit?: string;
  basePrice?: number;
  priceTiers?: Array<{minQty: number; price: number}>;
  status?: string;
  subscribable?: boolean;
  moderation?: {status?: string};
};

type SubscriptionDoc = {
  hospitalId?: string;
  vendorId?: string;
  productId?: string;
  cadence?: string;
  status?: string;
  qty?: number;
  unitPrice?: number;
  nextRunAt?: Timestamp;
};

/**
 * cadence 기반 다음 발주 시각 계산.
 * CUSTOM 은 일단 MONTHLY 와 동일 (Phase 4+ cronExpression 지원 예정).
 */
function calculateNextRun(cadence: string, base: Date = new Date()): Date {
  const next = new Date(base);
  switch (cadence) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/**
 * 수량에 따른 적용 단가 산출 (priceTiers 최대 hit).
 * priceTiers 가 없으면 basePrice 반환.
 */
function resolveUnitPrice(product: ProductDoc, qty: number): number {
  const base = Number(product.basePrice ?? 0);
  if (!product.priceTiers || product.priceTiers.length === 0) return base;
  const sorted = [...product.priceTiers].sort((a, b) => b.minQty - a.minQty);
  const tier = sorted.find((t) => qty >= t.minQty);
  return tier ? tier.price : base;
}

export const subscriptionRouter = createTRPCRouter({
  // ─────────────────────────────────────────────────────────
  // listMine — 본인 hospital 구독 list (nextRunAt asc)
  // ─────────────────────────────────────────────────────────
  listMine: buyerProcedure
    .input(
      z.object({
        status: StatusFilterEnum.optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ctx, input}) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      if (!hospitalId) {
        return {subscriptions: [], hasMore: false, nextCursor: undefined};
      }

      try {
        let q: Query = db
          .collection(COLLECTIONS.subscriptions)
          .where("hospitalId", "==", hospitalId);
        if (input.status) {
          q = q.where("status", "==", input.status);
        }
        q = q.orderBy("nextRunAt", "asc").limit(input.pageSize + 1);

        if (input.cursor) {
          const c = await db
            .collection(COLLECTIONS.subscriptions)
            .doc(input.cursor)
            .get();
          if (c.exists) q = q.startAfter(c);
        }
        const snap = await q.get();
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }));
        const hasMore = items.length > input.pageSize;
        const trimmed = hasMore ? items.slice(0, -1) : items;
        return {
          subscriptions: trimmed,
          hasMore,
          nextCursor: hasMore
            ? (trimmed[trimmed.length - 1] as {id: string}).id
            : undefined,
        };
      } catch {
        // 인덱스/컬렉션 미존재 — graceful fallback
        return {subscriptions: [], hasMore: false, nextCursor: undefined};
      }
    }),

  // ─────────────────────────────────────────────────────────
  // counts — KPI (활성 / 일시정지 / 다음 7일 발주)
  // ─────────────────────────────────────────────────────────
  counts: buyerProcedure.query(async ({ctx}) => {
    const db = adminDb();
    const hospitalId = ctx.hospitalId;
    if (!hospitalId) {
      return {active: 0, paused: 0, next7Days: 0};
    }
    try {
      const snap = await db
        .collection(COLLECTIONS.subscriptions)
        .where("hospitalId", "==", hospitalId)
        .get();
      const items = snap.docs.map((d) => d.data() as SubscriptionDoc);
      const now = Date.now();
      const sevenDays = now + 7 * 86400 * 1000;
      return {
        active: items.filter((s) => s.status === "ACTIVE").length,
        paused: items.filter((s) => s.status === "PAUSED").length,
        next7Days: items.filter((s) => {
          if (s.status !== "ACTIVE") return false;
          const next = s.nextRunAt?.toMillis?.() ?? 0;
          return next >= now && next <= sevenDays;
        }).length,
      };
    } catch {
      return {active: 0, paused: 0, next7Days: 0};
    }
  }),

  // ─────────────────────────────────────────────────────────
  // getMine — 단건 상세 + runs 서브컬렉션 (최근 20개)
  // ─────────────────────────────────────────────────────────
  getMine: buyerProcedure
    .input(z.object({subscriptionId: z.string()}))
    .query(async ({ctx, input}) => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.subscriptions)
        .doc(input.subscriptionId)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as SubscriptionDoc;
      if (data.hospitalId !== ctx.hospitalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "다른 병원의 구독은 조회할 수 없습니다.",
        });
      }

      // runs 서브컬렉션
      let runs: Array<{id: string; [k: string]: unknown}> = [];
      try {
        const runsSnap = await snap.ref
          .collection("runs")
          .orderBy("scheduledAt", "desc")
          .limit(20)
          .get();
        runs = runsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }));
      } catch {
        // 인덱스 없으면 정렬 없이 fallback
        try {
          const fb = await snap.ref.collection("runs").limit(20).get();
          runs = fb.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Record<string, unknown>),
          }));
        } catch {
          runs = [];
        }
      }
      return {id: snap.id, ...data, runs};
    }),

  // ─────────────────────────────────────────────────────────
  // create — 신규 구독 생성
  // ─────────────────────────────────────────────────────────
  create: buyerProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        cadence: CadenceEnum,
        qty: z.number().int().positive(),
        startsAt: z.union([z.string(), z.date()]).optional(),
        shippingAddress: ShippingAddressSchema,
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      const uid = ctx.uid;
      if (!hospitalId || !uid) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "병원 계정이 필요합니다.",
        });
      }

      // 1) 상품 조회
      const productSnap = await db
        .collection(COLLECTIONS.products)
        .doc(input.productId)
        .get();
      if (!productSnap.exists) {
        throw new TRPCError({code: "NOT_FOUND", message: "상품을 찾을 수 없습니다."});
      }
      const product = productSnap.data() as ProductDoc;

      // 상태 검증 — moderation.status 또는 status 어느쪽이든 ACTIVE 여야 함
      const productStatus = product.moderation?.status ?? product.status;
      if (productStatus !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "판매 중인 상품이 아닙니다.",
        });
      }
      if (product.subscribable === false) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "정기구독이 지원되지 않는 상품입니다.",
        });
      }

      // 2) 가격 산출 (티어 적용)
      const unitPrice = resolveUnitPrice(product, input.qty);

      // 3) hospital 정보
      const hospitalSnap = await db
        .collection(COLLECTIONS.hospitals)
        .doc(hospitalId)
        .get();
      const hospital = (hospitalSnap.data() ?? {}) as {name?: string};

      // 4) 시작일 / 다음 발주 시각
      const startsAt = input.startsAt
        ? typeof input.startsAt === "string"
          ? new Date(input.startsAt)
          : input.startsAt
        : new Date();
      const nextRunAt = calculateNextRun(input.cadence, startsAt);

      // 5) 생성
      const subRef = db.collection(COLLECTIONS.subscriptions).doc();
      const serverNow = FieldValue.serverTimestamp();

      await subRef.set({
        hospitalId,
        hospitalName: hospital.name ?? "병원",
        userId: uid,
        vendorId: product.vendorId ?? null,
        vendorName: product.vendorName ?? "공급사",
        productId: input.productId,
        productName: product.name ?? "상품",
        productImage: product.thumbnail ?? product.images?.[0] ?? null,

        cadence: input.cadence,
        qty: input.qty,
        unitPrice,
        unit: product.unit ?? "EA",

        status: "ACTIVE",
        startsAt: Timestamp.fromDate(startsAt),
        nextRunAt: Timestamp.fromDate(nextRunAt),

        shippingAddress: input.shippingAddress,

        autoApprove: true,
        paymentMethod: "CARD",
        maxPriceChangePercent: 5.0,

        totalRuns: 0,
        totalAmount: 0,

        createdAt: serverNow,
        updatedAt: serverNow,
      });

      // 6) audit
      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "SUBSCRIPTION_CREATED",
          targetType: "Subscription",
          targetId: subRef.id,
          after: {
            productId: input.productId,
            cadence: input.cadence,
            qty: input.qty,
            unitPrice,
          },
          createdAt: serverNow,
        });
      } catch {
        // best-effort
      }

      return {
        subscriptionId: subRef.id,
        nextRunAt: nextRunAt.toISOString(),
      };
    }),

  // ─────────────────────────────────────────────────────────
  // pause / resume / cancel
  // ─────────────────────────────────────────────────────────
  pause: buyerProcedure
    .input(z.object({subscriptionId: z.string()}))
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.subscriptions).doc(input.subscriptionId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({code: "NOT_FOUND"});
      }
      const data = snap.data() as SubscriptionDoc;
      if (data.hospitalId !== ctx.hospitalId) {
        throw new TRPCError({code: "FORBIDDEN"});
      }
      if (data.status === "PAUSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 일시 정지된 구독입니다.",
        });
      }
      if (data.status === "CANCELLED" || data.status === "EXPIRED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 종료된 구독은 정지할 수 없습니다.",
        });
      }

      const serverNow = FieldValue.serverTimestamp();
      await ref.update({
        status: "PAUSED",
        pausedAt: serverNow,
        pausedById: ctx.uid,
        updatedAt: serverNow,
      });
      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: ctx.uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "SUBSCRIPTION_PAUSED",
          targetType: "Subscription",
          targetId: input.subscriptionId,
          createdAt: serverNow,
        });
      } catch {
        // best-effort
      }
      return {ok: true};
    }),

  resume: buyerProcedure
    .input(z.object({subscriptionId: z.string()}))
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.subscriptions).doc(input.subscriptionId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({code: "NOT_FOUND"});
      }
      const data = snap.data() as SubscriptionDoc;
      if (data.hospitalId !== ctx.hospitalId) {
        throw new TRPCError({code: "FORBIDDEN"});
      }
      if (data.status !== "PAUSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "일시 정지된 구독만 재개할 수 있습니다.",
        });
      }

      const cadence = data.cadence ?? "MONTHLY";
      const nextRunAt = calculateNextRun(cadence, new Date());
      const serverNow = FieldValue.serverTimestamp();
      await ref.update({
        status: "ACTIVE",
        pausedAt: FieldValue.delete(),
        pauseReason: FieldValue.delete(),
        nextRunAt: Timestamp.fromDate(nextRunAt),
        updatedAt: serverNow,
      });
      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: ctx.uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "SUBSCRIPTION_RESUMED",
          targetType: "Subscription",
          targetId: input.subscriptionId,
          after: {nextRunAt: nextRunAt.toISOString()},
          createdAt: serverNow,
        });
      } catch {
        // best-effort
      }
      return {ok: true, nextRunAt: nextRunAt.toISOString()};
    }),

  cancel: buyerProcedure
    .input(z.object({subscriptionId: z.string()}))
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.subscriptions).doc(input.subscriptionId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({code: "NOT_FOUND"});
      }
      const data = snap.data() as SubscriptionDoc;
      if (data.hospitalId !== ctx.hospitalId) {
        throw new TRPCError({code: "FORBIDDEN"});
      }
      if (data.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 해지된 구독입니다.",
        });
      }

      const serverNow = FieldValue.serverTimestamp();
      await ref.update({
        status: "CANCELLED",
        cancelledAt: serverNow,
        updatedAt: serverNow,
      });
      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: ctx.uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "SUBSCRIPTION_CANCELLED",
          targetType: "Subscription",
          targetId: input.subscriptionId,
          createdAt: serverNow,
        });
      } catch {
        // best-effort
      }
      return {ok: true};
    }),

  // ─────────────────────────────────────────────────────────
  // updateQty — 수량 변경 + 가격 자동 재계산
  // ─────────────────────────────────────────────────────────
  updateQty: buyerProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        qty: z.number().int().positive(),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.subscriptions).doc(input.subscriptionId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({code: "NOT_FOUND"});
      }
      const data = snap.data() as SubscriptionDoc;
      if (data.hospitalId !== ctx.hospitalId) {
        throw new TRPCError({code: "FORBIDDEN"});
      }
      if (!data.productId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "상품 정보가 없는 구독입니다.",
        });
      }

      // 가격 재계산
      let unitPrice = data.unitPrice ?? 0;
      try {
        const productSnap = await db
          .collection(COLLECTIONS.products)
          .doc(data.productId)
          .get();
        if (productSnap.exists) {
          unitPrice = resolveUnitPrice(productSnap.data() as ProductDoc, input.qty);
        }
      } catch {
        // 상품 조회 실패 — 기존 가격 유지
      }

      const serverNow = FieldValue.serverTimestamp();
      await ref.update({
        qty: input.qty,
        unitPrice,
        updatedAt: serverNow,
      });
      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: ctx.uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "SUBSCRIPTION_QTY_UPDATED",
          targetType: "Subscription",
          targetId: input.subscriptionId,
          after: {qty: input.qty, unitPrice},
          createdAt: serverNow,
        });
      } catch {
        // best-effort
      }
      return {ok: true, unitPrice};
    }),

  // ─────────────────────────────────────────────────────────
  // skipNext — 1회 스킵 (nextRunAt 을 한 주기 이동)
  // ─────────────────────────────────────────────────────────
  skipNext: buyerProcedure
    .input(z.object({subscriptionId: z.string()}))
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.subscriptions).doc(input.subscriptionId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({code: "NOT_FOUND"});
      }
      const data = snap.data() as SubscriptionDoc;
      if (data.hospitalId !== ctx.hospitalId) {
        throw new TRPCError({code: "FORBIDDEN"});
      }
      if (data.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "활성 상태의 구독만 스킵할 수 있습니다.",
        });
      }

      const cadence = data.cadence ?? "MONTHLY";
      const currentNext = data.nextRunAt?.toDate?.() ?? new Date();
      const newNext = calculateNextRun(cadence, currentNext);
      const serverNow = FieldValue.serverTimestamp();

      await ref.update({
        nextRunAt: Timestamp.fromDate(newNext),
        updatedAt: serverNow,
      });

      // SKIPPED run 적재 (정보용)
      try {
        await ref.collection("runs").add({
          subscriptionId: input.subscriptionId,
          scheduledAt: data.nextRunAt ?? Timestamp.now(),
          status: "SKIPPED",
          skippedByUser: ctx.uid,
          createdAt: serverNow,
        });
      } catch {
        // best-effort
      }
      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: ctx.uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "SUBSCRIPTION_SKIPPED",
          targetType: "Subscription",
          targetId: input.subscriptionId,
          after: {newNextRunAt: newNext.toISOString()},
          createdAt: serverNow,
        });
      } catch {
        // best-effort
      }
      return {ok: true, newNextRunAt: newNext.toISOString()};
    }),
});
