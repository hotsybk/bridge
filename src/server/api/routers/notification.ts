import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { protectedProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

/**
 * 알림 조회·읽음 처리 — Phase δ-10 + ν-2 확장.
 *
 * 사용처: vendor / buyer notification popover, /notifications, /seller/notifications 페이지.
 * targetType + targetId 로 자신에게 발송된 알림만 조회한다.
 * admin 발송 alimtalk·email 은 `notifications` 컬렉션에 기록되며,
 * 같은 컬렉션에서 readAt 만 갱신해 읽음 처리한다.
 *
 * ν-2 추가:
 *  - listMine: filter(주문/분쟁/정산/정기구독/공동구매) + cursor pagination
 *  - counts: 전체 · 읽지 않음 · 오늘
 *  - markRead: 단건 읽음
 */

export type NotificationView = {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  channels?: string[];
  createdAt?: unknown;
  readAt?: unknown | null;
  isUnread: boolean;
  /** order/dispute/settlement 등 deep-link 용 식별자. */
  orderId?: string;
  disputeId?: string;
  settlementId?: string;
};

/** ν-2 — 필터 카테고리. type 필드 prefix 매칭. */
const CATEGORY_PREFIXES: Record<string, string[]> = {
  ORDER: ["ORDER_"],
  DISPUTE: ["DISPUTE_"],
  SETTLEMENT: ["SETTLEMENT_", "PAYOUT_"],
  SUBSCRIPTION: ["SUBSCRIPTION_"],
  GROUPBUY: ["GROUPBUY_"],
};

function matchesCategory(type: string | undefined, category: string): boolean {
  if (!type) return false;
  const prefixes = CATEGORY_PREFIXES[category];
  if (!prefixes) return true;
  return prefixes.some((p) => type.startsWith(p));
}

export const notificationRouter = createTRPCRouter({
  listMine: protectedProcedure
    .input(
      z.object({
        pageSize: z.number().int().min(1).max(50).default(20),
        category: z
          .enum(["ALL", "ORDER", "DISPUTE", "SETTLEMENT", "SUBSCRIPTION", "GROUPBUY"])
          .default("ALL"),
        /** cursor: 이전 페이지 마지막 항목의 createdAt epoch ms. */
        cursorMs: z.number().int().positive().nullable().optional(),
      }),
    )
    .query(async ({ ctx, input }): Promise<{
      notifications: NotificationView[];
      unreadCount: number;
      nextCursorMs: number | null;
    }> => {
      const targetType: "VENDOR" | "HOSPITAL" | null = ctx.vendorId
        ? "VENDOR"
        : ctx.hospitalId
          ? "HOSPITAL"
          : null;
      const targetId = ctx.vendorId ?? ctx.hospitalId;
      if (!targetType || !targetId) {
        return { notifications: [], unreadCount: 0, nextCursorMs: null };
      }

      const db = adminDb();
      // 카테고리 필터링은 클라이언트(서버 측) post-filter — type 별 인덱스 폭증 방지.
      // 한 페이지에서 부족하면 다음 페이지 요청 (cursor pagination).
      // 여기서는 pageSize × 2 까지 fetch 후 post-filter.
      let q = db
        .collection(COLLECTIONS.notifications)
        .where("targetType", "==", targetType)
        .where("targetId", "==", targetId)
        .orderBy("createdAt", "desc");

      if (input.cursorMs) {
        q = q.startAfter(new Date(input.cursorMs));
      }

      const fetchSize = input.category === "ALL" ? input.pageSize : input.pageSize * 3;
      const snap = await q.limit(fetchSize + 1).get();

      const docs = snap.docs;
      const all: NotificationView[] = docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const readAt = data.readAt ?? null;
        return {
          id: d.id,
          type: data.type as string | undefined,
          title: data.title as string | undefined,
          body: data.body as string | undefined,
          channels: data.channels as string[] | undefined,
          createdAt: data.createdAt,
          readAt,
          isUnread: !readAt,
          orderId: data.orderId as string | undefined,
          disputeId: data.disputeId as string | undefined,
          settlementId: data.settlementId as string | undefined,
        };
      });

      const filtered =
        input.category === "ALL"
          ? all
          : all.filter((n) => matchesCategory(n.type, input.category));

      const page = filtered.slice(0, input.pageSize);
      const last = page[page.length - 1];
      let nextCursorMs: number | null = null;
      // 다음 페이지가 있을 가능성 — fetch 가 limit 에 도달했으면 마지막 createdAt 을 cursor 로.
      if (snap.size > fetchSize && last) {
        const createdAt = last.createdAt as { toMillis?: () => number } | undefined;
        if (createdAt?.toMillis) nextCursorMs = createdAt.toMillis();
      }

      const unreadCount = page.filter((n) => n.isUnread).length;

      return { notifications: page, unreadCount, nextCursorMs };
    }),

  /** ν-2 — 전체 · 읽지 않음 · 오늘 카운트. KPI 표시용. */
  counts: protectedProcedure.query(async ({ ctx }): Promise<{
    total: number;
    unread: number;
    today: number;
  }> => {
    const targetType: "VENDOR" | "HOSPITAL" | null = ctx.vendorId
      ? "VENDOR"
      : ctx.hospitalId
        ? "HOSPITAL"
        : null;
    const targetId = ctx.vendorId ?? ctx.hospitalId;
    if (!targetType || !targetId) {
      return { total: 0, unread: 0, today: 0 };
    }

    const db = adminDb();
    const base = db
      .collection(COLLECTIONS.notifications)
      .where("targetType", "==", targetType)
      .where("targetId", "==", targetId);

    // 오늘 자정 (KST = UTC+9). 단순화 위해 서버 로컬 자정 사용.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalAgg, unreadAgg, todayAgg] = await Promise.all([
      base.count().get(),
      base.where("readAt", "==", null).count().get(),
      base.where("createdAt", ">=", todayStart).count().get(),
    ]);

    return {
      total: totalAgg.data().count,
      unread: unreadAgg.data().count,
      today: todayAgg.data().count,
    };
  }),

  /** ν-2 — 단건 읽음 처리. notificationId 가 본인 소유인지 확인. */
  markRead: protectedProcedure
    .input(z.object({ notificationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const targetType: "VENDOR" | "HOSPITAL" | null = ctx.vendorId
        ? "VENDOR"
        : ctx.hospitalId
          ? "HOSPITAL"
          : null;
      const targetId = ctx.vendorId ?? ctx.hospitalId;
      if (!targetType || !targetId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다." });
      }

      const db = adminDb();
      const ref = db.collection(COLLECTIONS.notifications).doc(input.notificationId);
      const doc = await ref.get();
      if (!doc.exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "알림을 찾을 수 없습니다." });
      }
      const data = doc.data() as Record<string, unknown>;
      if (data.targetType !== targetType || data.targetId !== targetId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인 알림만 읽음 처리할 수 있습니다." });
      }
      if (!data.readAt) {
        await ref.update({ readAt: new Date() });
      }
      return { ok: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const targetType: "VENDOR" | "HOSPITAL" | null = ctx.vendorId
      ? "VENDOR"
      : ctx.hospitalId
        ? "HOSPITAL"
        : null;
    const targetId = ctx.vendorId ?? ctx.hospitalId;
    if (!targetType || !targetId) return { updated: 0 };

    const db = adminDb();
    const snap = await db
      .collection(COLLECTIONS.notifications)
      .where("targetType", "==", targetType)
      .where("targetId", "==", targetId)
      .where("readAt", "==", null)
      .limit(500)
      .get();

    if (snap.empty) return { updated: 0 };

    const batch = db.batch();
    const now = new Date();
    snap.docs.forEach((doc) => {
      batch.update(doc.ref, { readAt: now });
    });
    await batch.commit();

    return { updated: snap.size };
  }),
});
