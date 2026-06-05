// Wave Q2 — vendor 본인 정기구독 조회 tRPC router (read-only).
//
// 실제 구독 시스템은 Phase 3 에 출시 — 현재는 read-only.
// 컬렉션/인덱스 누락 시 graceful fallback (빈 결과 반환).

import { z } from "zod";

import { createTRPCRouter, vendorProcedure } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

type SubscriptionDoc = {
  vendorId?: string;
  hospitalId?: string;
  hospitalName?: string;
  productId?: string;
  productName?: string;
  status?: string;
  cadence?: string;
  nextRunAt?: { toMillis?: () => number; seconds?: number };
  runCount?: number;
  qty?: number;
  unitPrice?: number;
  totalAmount?: number;
  createdAt?: unknown;
};

export const vendorSubscriptionRouter = createTRPCRouter({
  /** 본인 vendor 가 받는 구독 list. nextRunAt 오름차순. */
  list: vendorProcedure
    .input(
      z.object({
        status: z.enum(["ACTIVE", "PAUSED", "CANCELLED", "EXPIRED"]).optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = adminDb();
      if (!ctx.vendorId) {
        return { subscriptions: [], hasMore: false, nextCursor: undefined };
      }

      try {
        let q = db
          .collection(COLLECTIONS.subscriptions)
          .where("vendorId", "==", ctx.vendorId)
          .orderBy("nextRunAt", "asc")
          .limit(input.pageSize + 1);
        if (input.status) {
          q = db
            .collection(COLLECTIONS.subscriptions)
            .where("vendorId", "==", ctx.vendorId)
            .where("status", "==", input.status)
            .orderBy("nextRunAt", "asc")
            .limit(input.pageSize + 1);
        }
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
          ...(d.data() as SubscriptionDoc),
        }));
        const hasMore = items.length > input.pageSize;
        const trimmed = hasMore ? items.slice(0, -1) : items;
        return {
          subscriptions: trimmed,
          hasMore,
          nextCursor: hasMore ? trimmed[trimmed.length - 1]?.id : undefined,
        };
      } catch {
        // 인덱스 없음 / 컬렉션 없음 — graceful fallback
        return { subscriptions: [], hasMore: false, nextCursor: undefined };
      }
    }),

  /** KPI counts — ACTIVE / PAUSED / 다음 7일 발주 예정. */
  counts: vendorProcedure.query(async ({ ctx }) => {
    const db = adminDb();
    if (!ctx.vendorId) {
      return { active: 0, paused: 0, next7Days: 0 };
    }
    try {
      const snap = await db
        .collection(COLLECTIONS.subscriptions)
        .where("vendorId", "==", ctx.vendorId)
        .get();
      const items = snap.docs.map((d) => d.data() as SubscriptionDoc);
      const now = Date.now();
      const sevenDays = now + 7 * 86400 * 1000;
      return {
        active: items.filter((s) => s.status === "ACTIVE").length,
        paused: items.filter((s) => s.status === "PAUSED").length,
        next7Days: items.filter((s) => {
          if (s.status !== "ACTIVE") return false;
          const next =
            s.nextRunAt?.toMillis?.() ??
            (typeof s.nextRunAt?.seconds === "number"
              ? s.nextRunAt.seconds * 1000
              : 0);
          return next >= now && next <= sevenDays;
        }).length,
      };
    } catch {
      return { active: 0, paused: 0, next7Days: 0 };
    }
  }),
});
