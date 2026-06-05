// Wave Q3 — 운영자 정기구독 모니터링 tRPC router.
//
// Endpoints:
//   - list({status, hospitalId, vendorId, search, pageSize, cursor})
//   - counts()                              KPI 4 카드
//   - getById({subscriptionId})
//   - forcePause({subscriptionId, reason})  운영자 일시 정지 + hospital 알림 + audit
//   - forceResume({subscriptionId})         정지 해제
//   - topByVendor({limit})                  상위 vendor ACTIVE 구독 수
//
// 컬렉션/인덱스 미존재 시 graceful fallback (빈 결과).

import { TRPCError } from "@trpc/server";
import { FieldValue, type Query } from "firebase-admin/firestore";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

const StatusEnum = z.enum(["ACTIVE", "PAUSED", "CANCELLED", "EXPIRED"]);

type SubscriptionDoc = {
  id: string;
  hospitalId?: string;
  hospitalName?: string;
  vendorId?: string;
  vendorName?: string;
  productId?: string;
  productName?: string;
  status?: string;
  cadence?: string;
  nextRunAt?: { toMillis?: () => number; seconds?: number };
  qty?: number;
  runCount?: number;
  totalRuns?: number;
  unitPrice?: number;
  totalAmount?: number;
  priceChangePercent?: number;
  pauseReason?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function tsToMillis(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "object" && v !== null) {
    const obj = v as { toMillis?: () => number; seconds?: number };
    if (typeof obj.toMillis === "function") return obj.toMillis();
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
  }
  const t = new Date(v as string | number | Date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export const adminSubscriptionRouter = createTRPCRouter({
  /** 정기구독 list + cursor pagination + client-side search. */
  list: adminProcedure
    .input(
      z.object({
        status: StatusEnum.optional(),
        hospitalId: z.string().optional(),
        vendorId: z.string().optional(),
        search: z.string().optional(),
        pageSize: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = adminDb();
      try {
        let q: Query = db.collection(COLLECTIONS.subscriptions);
        if (input.status) q = q.where("status", "==", input.status);
        if (input.hospitalId) q = q.where("hospitalId", "==", input.hospitalId);
        if (input.vendorId) q = q.where("vendorId", "==", input.vendorId);
        q = q.orderBy("nextRunAt", "asc").limit(input.pageSize + 1);

        if (input.cursor) {
          const c = await db
            .collection(COLLECTIONS.subscriptions)
            .doc(input.cursor)
            .get();
          if (c.exists) q = q.startAfter(c);
        }
        const snap = await q.get();
        let items: SubscriptionDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SubscriptionDoc, "id">),
        }));

        if (input.search) {
          const k = input.search.toLowerCase();
          items = items.filter(
            (s) =>
              s.productName?.toLowerCase().includes(k) ||
              s.hospitalName?.toLowerCase().includes(k) ||
              s.vendorName?.toLowerCase().includes(k),
          );
        }

        const hasMore = items.length > input.pageSize;
        const trimmed = hasMore ? items.slice(0, -1) : items;
        return {
          subscriptions: trimmed,
          hasMore,
          nextCursor: hasMore ? trimmed[trimmed.length - 1]?.id : undefined,
        };
      } catch {
        // 인덱스/컬렉션 부재 — graceful fallback
        return { subscriptions: [], hasMore: false, nextCursor: undefined };
      }
    }),

  /** KPI counts — 활성/정지/7일 발주/가격 변동 영향(±5%+). */
  counts: adminProcedure.query(async () => {
    const db = adminDb();
    try {
      const snap = await db.collection(COLLECTIONS.subscriptions).get();
      const items = snap.docs.map((d) => d.data() as SubscriptionDoc);
      const now = Date.now();
      const sevenDays = now + 7 * 86400 * 1000;

      return {
        active: items.filter((s) => s.status === "ACTIVE").length,
        paused: items.filter((s) => s.status === "PAUSED").length,
        next7Days: items.filter((s) => {
          if (s.status !== "ACTIVE") return false;
          const next = tsToMillis(s.nextRunAt);
          return next >= now && next <= sevenDays;
        }).length,
        priceChangeAffected: items.filter(
          (s) =>
            typeof s.priceChangePercent === "number" &&
            Math.abs(s.priceChangePercent) >= 5,
        ).length,
      };
    } catch {
      return { active: 0, paused: 0, next7Days: 0, priceChangeAffected: 0 };
    }
  }),

  /** 단건. */
  getById: adminProcedure
    .input(z.object({ subscriptionId: z.string() }))
    .query(async ({ input }) => {
      const snap = await adminDb()
        .collection(COLLECTIONS.subscriptions)
        .doc(input.subscriptionId)
        .get();
      if (!snap.exists) return null;
      return { id: snap.id, ...(snap.data() as Omit<SubscriptionDoc, "id">) };
    }),

  /**
   * 운영자가 구독 일시 정지 — 이상 거래/CS 상황.
   * Hospital 에 KAKAO + IN_APP 알림 발송 + auditLog.
   */
  forcePause: adminProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.subscriptions).doc(input.subscriptionId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const s = snap.data() as SubscriptionDoc;
      if (s.status === "PAUSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 일시 정지된 구독입니다.",
        });
      }
      if (s.status === "CANCELLED" || s.status === "EXPIRED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 종료된 구독은 정지할 수 없습니다.",
        });
      }

      await ref.update({
        status: "PAUSED",
        pauseReason: input.reason,
        pausedById: ctx.uid,
        pausedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // hospital 알림 — hospitalId 없으면 skip
      if (s.hospitalId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "HOSPITAL",
          targetId: s.hospitalId,
          type: "SUBSCRIPTION_PAUSED",
          title: "정기 구독이 일시 정지되었습니다",
          body: input.reason,
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "SUBSCRIPTION_FORCE_PAUSED",
        targetType: "Subscription",
        targetId: input.subscriptionId,
        after: { reason: input.reason },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /** 정지 해제 — pauseReason 클리어. */
  forceResume: adminProcedure
    .input(z.object({ subscriptionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.subscriptions).doc(input.subscriptionId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const s = snap.data() as SubscriptionDoc;
      if (s.status !== "PAUSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "PAUSED 상태의 구독만 재개할 수 있습니다.",
        });
      }

      await ref.update({
        status: "ACTIVE",
        pauseReason: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "SUBSCRIPTION_FORCE_RESUMED",
        targetType: "Subscription",
        targetId: input.subscriptionId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /** ACTIVE 구독 기준 상위 vendor 집계 (운영 보드용). */
  topByVendor: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const db = adminDb();
      try {
        const snap = await db
          .collection(COLLECTIONS.subscriptions)
          .where("status", "==", "ACTIVE")
          .get();
        const items = snap.docs.map((d) => d.data() as SubscriptionDoc);
        const byVendor = new Map<string, { name: string; count: number }>();
        for (const s of items) {
          if (!s.vendorId) continue;
          const entry = byVendor.get(s.vendorId) ?? {
            name: s.vendorName ?? s.vendorId,
            count: 0,
          };
          entry.count += 1;
          byVendor.set(s.vendorId, entry);
        }
        return [...byVendor.entries()]
          .map(([id, { name, count }]) => ({
            vendorId: id,
            vendorName: name,
            count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, input.limit);
      } catch {
        return [];
      }
    }),
});
