// Wave I — 공동구매 운영 tRPC router (admin only).
//
// Endpoints:
//   - list({status, vendorId, pageSize, cursor})
//   - counts()
//   - getById({groupBuyId})            — shard 합산 currentQty 포함
//   - listParticipations({groupBuyId})
//   - forceClose({groupBuyId, reason}) — endsAt 즉시 조정 → 다음 cron 자동 마감
//   - forceCancel({groupBuyId, reason}) — 즉시 모든 participation void + FAILED

import { TRPCError } from "@trpc/server";
import { FieldValue, type Query } from "firebase-admin/firestore";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import { sumCounter } from "@/server/lib/distributed-counter";
import type { GroupBuy } from "@/lib/types";

const GbStatus = z.enum(["OPEN", "TARGET_MET", "FULFILLED", "FAILED"]);

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

export const adminGroupbuyRouter = createTRPCRouter({
  /** 공동구매 list + cursor pagination. */
  list: adminProcedure
    .input(
      z.object({
        status: GbStatus.optional(),
        vendorId: z.string().optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = adminDb();
      let q: Query = db.collection(COLLECTIONS.groupBuys);
      if (input.status) q = q.where("status", "==", input.status);
      if (input.vendorId) q = q.where("vendorId", "==", input.vendorId);
      q = q.orderBy("endsAt", "asc").limit(input.pageSize + 1);
      if (input.cursor) {
        const c = await db
          .collection(COLLECTIONS.groupBuys)
          .doc(input.cursor)
          .get();
        if (c.exists) q = q.startAfter(c);
      }
      const snap = await q.get();
      const items = snap.docs.map((d) => {
        const data = d.data() as Omit<GroupBuy, "id">;
        return { id: d.id, ...data } satisfies GroupBuy;
      });
      const hasMore = items.length > input.pageSize;
      const groupBuys = hasMore ? items.slice(0, -1) : items;
      return {
        groupBuys,
        hasMore,
        nextCursor: hasMore ? groupBuys[groupBuys.length - 1]?.id : undefined,
      };
    }),

  /** KPI counts — 컬렉션 전체 스캔 (운영 초기 ~수백건 가정). */
  counts: adminProcedure.query(async () => {
    const db = adminDb();
    const snap = await db.collection(COLLECTIONS.groupBuys).get();
    const items = snap.docs.map((d) => d.data() as GroupBuy);
    const now = Date.now();
    return {
      open: items.filter((g) => g.status === "OPEN").length,
      targetMet: items.filter((g) => g.status === "TARGET_MET").length,
      fulfilled: items.filter((g) => g.status === "FULFILLED").length,
      failed: items.filter((g) => g.status === "FAILED").length,
      closingSoon: items.filter((g) => {
        if (g.status !== "OPEN" && g.status !== "TARGET_MET") return false;
        const endsAt = tsToMillis(g.endsAt);
        return endsAt > now && endsAt - now < 24 * 3600 * 1000;
      }).length,
    };
  }),

  /** 단건 + shard 합산 currentQty. */
  getById: adminProcedure
    .input(z.object({ groupBuyId: z.string() }))
    .query(async ({ input }): Promise<GroupBuy | null> => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.groupBuys).doc(input.groupBuyId);
      const snap = await ref.get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<GroupBuy, "id">;
      const gb: GroupBuy = { id: snap.id, ...data };
      try {
        gb.currentQty = await sumCounter(ref);
      } catch {
        // shard 미초기화 또는 read 실패 시 denorm 값 유지
      }
      return gb;
    }),

  /** 참여 ledger. */
  listParticipations: adminProcedure
    .input(
      z.object({
        groupBuyId: z.string(),
        pageSize: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ input }) => {
      const snap = await adminDb()
        .collection(COLLECTIONS.groupBuys)
        .doc(input.groupBuyId)
        .collection("participations")
        .orderBy("createdAt", "desc")
        .limit(input.pageSize)
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }),

  /**
   * 강제 마감 — endsAt 을 즉시 past 로 조정.
   * 다음 cron tick (1분 이내) 에서 groupbuyCloser 가 자동 처리.
   */
  forceClose: adminProcedure
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
      const gb = snap.data() as GroupBuy;
      if (gb.status !== "OPEN" && gb.status !== "TARGET_MET") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OPEN 또는 TARGET_MET 상태만 마감 가능합니다.",
        });
      }

      // endsAt 즉시 past 로 → groupbuyCloser cron 이 다음 분에 자동 마감
      await ref.update({
        endsAt: new Date(Date.now() - 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "GROUPBUY_FORCE_CLOSE",
        targetType: "GroupBuy",
        targetId: input.groupBuyId,
        after: { reason: input.reason },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 강제 취소 — 즉시 모든 participation void + status FAILED.
   * cron 을 기다리지 않고 운영자 의지로 즉시 종료.
   */
  forceCancel: adminProcedure
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
      const gb = snap.data() as GroupBuy;
      if (gb.status === "FULFILLED" || gb.status === "FAILED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 종료된 공동구매입니다.",
        });
      }

      // 모든 active participation void
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
            console.error("forceCancel void failed", p.id, err);
          }
        } else {
          await p.ref.update({ voidedAt: FieldValue.serverTimestamp() });
          voidedCount++;
        }
      }

      await ref.update({
        status: "FAILED",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // vendor 알림
      await db.collection(COLLECTIONS.notifications).add({
        targetType: "VENDOR",
        targetId: gb.vendorId,
        type: "GROUPBUY_CANCELLED",
        title: "공동구매가 취소되었습니다",
        body: input.reason,
        channels: ["KAKAO", "IN_APP"],
        kakaoSent: false,
        emailSent: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "GROUPBUY_FORCE_CANCEL",
        targetType: "GroupBuy",
        targetId: input.groupBuyId,
        after: { reason: input.reason, voidedCount },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, voidedCount };
    }),
});
