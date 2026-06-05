// Wave I — Buyer 공동구매 tRPC router.
//
// Endpoints:
//   - list({status}) — OPEN/TARGET_MET 캠페인 list (인증 사용자)
//   - getById({groupBuyId}) — shard 합산 currentQty 포함
//   - participate({groupBuyId, qty}) — PortOne pre-auth + participation 적재 + counter++
//   - cancelParticipation({groupBuyId, participationId}) — 자가 취소 + void + counter--

import { TRPCError } from "@trpc/server";
import { FieldValue, type Query } from "firebase-admin/firestore";
import { z } from "zod";

import {
  buyerProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import { sumCounter } from "@/server/lib/distributed-counter";
import type { GroupBuy } from "@/lib/types";

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

export const groupbuyRouter = createTRPCRouter({
  /** 공동구매 list (인증 사용자) — 기본 OPEN+TARGET_MET. */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["OPEN", "TARGET_MET"]).optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = adminDb();
      let q: Query = db.collection(COLLECTIONS.groupBuys);
      if (input.status) {
        q = q.where("status", "==", input.status);
      } else {
        q = q.where("status", "in", ["OPEN", "TARGET_MET"]);
      }
      q = q.orderBy("endsAt", "asc").limit(50);
      const snap = await q.get();
      return snap.docs.map((d) => {
        const data = d.data() as Omit<GroupBuy, "id">;
        return { id: d.id, ...data } satisfies GroupBuy;
      });
    }),

  /** 단건 + shard 합산 currentQty. */
  getById: protectedProcedure
    .input(z.object({ groupBuyId: z.string() }))
    .query(async ({ input }): Promise<GroupBuy | null> => {
      const ref = adminDb()
        .collection(COLLECTIONS.groupBuys)
        .doc(input.groupBuyId);
      const snap = await ref.get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<GroupBuy, "id">;
      const gb: GroupBuy = { id: snap.id, ...data };
      try {
        gb.currentQty = await sumCounter(ref);
      } catch {
        // shard 미초기화 시 denorm 값 유지
      }
      return gb;
    }),

  /**
   * 참여 — pre-auth + participation 적재 + counter++.
   * 목표 도달 시 status → TARGET_MET.
   *
   * Phase α-6 — buyerProcedure + race-safe 검증 + 최종 commit 트랜잭션화.
   *   1) 사전 검증 — status / endsAt / hospitalId / 한계량 (pre-auth 호출 전)
   *   2) PortOne pre-auth (외부 API — transaction 외부)
   *   3) 트랜잭션으로 status·endsAt 재검증 + participation set + counter shard increment
   */
  participate: buyerProcedure
    .input(
      z.object({
        groupBuyId: z.string(),
        qty: z.number().int().positive().max(10000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.hospitalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "병원 소속이 없습니다.",
        });
      }

      const db = adminDb();
      const gbRef = db.collection(COLLECTIONS.groupBuys).doc(input.groupBuyId);
      const gbSnap = await gbRef.get();
      if (!gbSnap.exists) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const gb = gbSnap.data() as GroupBuy;
      const now = Date.now();
      const endsAtMs = tsToMillis(gb.endsAt);
      if (endsAtMs > 0 && endsAtMs < now) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 마감된 공동구매입니다.",
        });
      }
      if (gb.status !== "OPEN" && gb.status !== "TARGET_MET") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "참여할 수 없는 상태입니다.",
        });
      }

      // 현재 누적 qty + tier 가격 계산
      let currentQty = 0;
      try {
        currentQty = await sumCounter(gbRef);
      } catch {
        currentQty = gb.currentQty ?? 0;
      }
      const expectedTotal = currentQty + input.qty;

      // 한계량 — 목표량 × 1.5 초과 차단 (race 보호 안전 마진)
      const maxAllowed = Math.ceil((gb.targetQty ?? 0) * 1.5);
      if (maxAllowed > 0 && expectedTotal > maxAllowed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "목표량을 초과합니다.",
        });
      }

      const sortedTiers = [...(gb.tierPricing ?? [])].sort(
        (a, b) => b.minQty - a.minQty,
      );
      const tier =
        sortedTiers.find((t) => expectedTotal >= t.minQty) ??
        sortedTiers[sortedTiers.length - 1];
      if (!tier) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "가격 tier 가 설정되지 않았습니다.",
        });
      }
      const unitPrice = tier.price;
      const totalAmount = unitPrice * input.qty;

      // hospital 조회 (스냅샷) — transaction 외부 read
      const hospitalId = ctx.hospitalId;
      let hospitalName = "병원";
      try {
        const hSnap = await db
          .collection(COLLECTIONS.hospitals)
          .doc(hospitalId)
          .get();
        if (hSnap.exists) {
          hospitalName = (hSnap.data()?.name as string) ?? hospitalName;
        }
      } catch {
        // skip — denorm 못 잡아도 진행
      }

      // PortOne pre-auth — transaction 외부 (외부 API)
      const { preAuthorize } = await import("@/server/services/portone");
      const auth = await preAuthorize({
        amount: totalAmount,
        orderName: `${gb.productName} × ${input.qty}`,
        customerId: ctx.uid,
      });
      if (auth.status !== "PRE_AUTHORIZED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "카드 hold 에 실패했습니다.",
        });
      }

      // 최종 commit — 트랜잭션으로 status·endsAt 재검증 + participation set + counter increment
      const result = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(gbRef);
        if (!fresh.exists) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const cur = fresh.data() as GroupBuy;
        const curEndsAtMs = tsToMillis(cur.endsAt);
        if (curEndsAtMs > 0 && curEndsAtMs < Date.now()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이미 마감된 공동구매입니다.",
          });
        }
        if (cur.status !== "OPEN" && cur.status !== "TARGET_MET") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "참여할 수 없는 상태입니다.",
          });
        }

        const participationRef = gbRef.collection("participations").doc();
        tx.set(participationRef, {
          groupBuyId: input.groupBuyId,
          hospitalId,
          hospitalName,
          userId: ctx.uid,
          qty: input.qty,
          unitPrice,
          totalAmount,
          preAuthPaymentId: auth.paymentId,
          status: "PRE_AUTHORIZED",
          createdAt: FieldValue.serverTimestamp(),
        });

        // counter shard increment — random shard (10개)
        const shardId = `shard-${Math.floor(Math.random() * 10)}`;
        const shardRef = gbRef.collection("counterShards").doc(shardId);
        tx.set(
          shardRef,
          { count: FieldValue.increment(input.qty) },
          { merge: true },
        );

        // groupBuy denorm 갱신
        const newQty = (cur.currentQty ?? 0) + input.qty;
        const patch: Record<string, unknown> = {
          currentQty: newQty,
          participationCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (newQty >= (cur.targetQty ?? 0) && cur.status === "OPEN") {
          patch.status = "TARGET_MET";
        }
        tx.update(gbRef, patch);

        return { participationId: participationRef.id };
      });

      return {
        participationId: result.participationId,
        unitPrice,
        totalAmount,
        preAuthPaymentId: auth.paymentId,
      };
    }),

  /**
   * 자가 참여 취소 — pre-auth void + counter--.
   *
   * Phase α-6 — buyerProcedure + 트랜잭션화 (void 외부 호출은 그대로 외부).
   */
  cancelParticipation: buyerProcedure
    .input(
      z.object({
        groupBuyId: z.string(),
        participationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.hospitalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "병원 소속이 없습니다.",
        });
      }
      const db = adminDb();
      const gbRef = db.collection(COLLECTIONS.groupBuys).doc(input.groupBuyId);
      const pRef = gbRef.collection("participations").doc(input.participationId);
      const pSnap = await pRef.get();
      if (!pSnap.exists) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const p = pSnap.data() as {
        userId: string;
        qty: number;
        preAuthPaymentId?: string;
        voidedAt?: unknown;
      };
      if (p.userId !== ctx.uid) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (p.voidedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 취소된 참여입니다.",
        });
      }

      // 마감 임박 + TARGET_MET 인 경우 취소 차단 (정책)
      const gbSnap = await gbRef.get();
      const gb = gbSnap.data() as GroupBuy | undefined;
      if (gb?.status === "FULFILLED" || gb?.status === "FAILED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 종료된 공동구매입니다.",
        });
      }

      // PortOne void — 트랜잭션 외부 (외부 API)
      if (p.preAuthPaymentId) {
        const { cancelPayment } = await import("@/server/services/portone");
        await cancelPayment({
          paymentId: p.preAuthPaymentId,
          reason: "사용자 참여 취소",
        });
      }

      // 트랜잭션으로 voidedAt 재검증 + shard decrement + groupBuy denorm 갱신
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(pRef);
        if (!fresh.exists) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const cur = fresh.data() as { voidedAt?: unknown };
        if (cur.voidedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이미 취소된 참여입니다.",
          });
        }
        tx.update(pRef, { voidedAt: FieldValue.serverTimestamp() });

        const shardId = `shard-${Math.floor(Math.random() * 10)}`;
        const shardRef = gbRef.collection("counterShards").doc(shardId);
        tx.set(
          shardRef,
          { count: FieldValue.increment(-p.qty) },
          { merge: true },
        );

        tx.update(gbRef, {
          currentQty: FieldValue.increment(-p.qty),
          participationCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return { ok: true };
    }),
});
