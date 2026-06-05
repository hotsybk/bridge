// Wave P2 — vendor 본인 정산 tRPC router (조회 + 빠른정산 신청).
//
// admin/settlement.ts (운영자 승인·이체) 와 분리. vendor 가 본인 정산만 read +
// PENDING → REQUESTED 신청. 실제 승인·이체는 admin.settlement.approveFast / markPaid.
//
// Endpoints:
//   - list({status?, pageSize, cursor})    — 본인 정산 목록
//   - counts()                              — KPI: 누적 PAID / 이번달 / 대기 / 보류
//   - payouts({pageSize})                   — 이체 이력
//   - requestFastSettlement({settlementId}) — PENDING → REQUESTED + 수수료 자동 계산
//
// 보안:
//   - vendorProcedure (role check + ctx.vendorId 필요)
//   - 모든 mutation 은 Settlement.vendorId === ctx.vendorId 검증

import { TRPCError } from "@trpc/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { vendorProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import { calculateFastFee } from "@/server/lib/settlement-calc";
import type { Settlement, Payout } from "@/lib/types";

/** Phase γ-2 — 계좌 마스킹 (앞자리 • 처리, 끝 4자리만 노출). */
function maskBankAccount(account: string): string {
  const s = String(account ?? "");
  if (s.length <= 4) return s;
  return s.slice(0, -4).replace(/[0-9]/g, "•") + s.slice(-4);
}

const StatusEnum = z.enum([
  "PENDING",
  "REQUESTED",
  "APPROVED",
  "HOLD",
  "PAID",
  "FAILED",
]);

function tsToMs(ts: unknown): number {
  if (!ts || typeof ts !== "object") return 0;
  const w1 = ts as { toMillis?: () => number; toDate?: () => Date };
  if (typeof w1.toMillis === "function") {
    try {
      return w1.toMillis();
    } catch {
      /* fallthrough */
    }
  }
  if (typeof w1.toDate === "function") {
    try {
      return w1.toDate().getTime();
    } catch {
      /* fallthrough */
    }
  }
  const w2 = ts as { seconds?: number; _seconds?: number };
  const sec = w2.seconds ?? w2._seconds;
  if (typeof sec === "number") return sec * 1000;
  return 0;
}

export const vendorSettlementRouter = createTRPCRouter({
  /** 본인 정산 목록. status 필터 + cursor pagination. */
  list: vendorProcedure
    .input(
      z.object({
        status: StatusEnum.optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        ctx,
        input,
      }): Promise<{
        settlements: Settlement[];
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

        let q: FirebaseFirestore.Query = db
          .collection(COLLECTIONS.settlements)
          .where("vendorId", "==", vendorId)
          .orderBy("createdAt", "desc")
          .limit(input.pageSize + 1);
        if (input.status) q = q.where("status", "==", input.status);
        if (input.cursor) {
          const c = await db
            .collection(COLLECTIONS.settlements)
            .doc(input.cursor)
            .get();
          if (c.exists) q = q.startAfter(c);
        }
        try {
          const snap = await q.get();
          const items = snap.docs.map((d) => {
            const data = d.data() as Omit<Settlement, "id">;
            return { id: d.id, ...data } as Settlement;
          });
          const hasMore = items.length > input.pageSize;
          const settlements = hasMore ? items.slice(0, -1) : items;
          const nextCursor = hasMore
            ? settlements[settlements.length - 1]?.id
            : undefined;
          return { settlements, hasMore, nextCursor };
        } catch {
          return { settlements: [], hasMore: false };
        }
      },
    ),

  /** KPI counts: 누적 PAID · 이번달 PAID · 대기(PENDING/REQUESTED/APPROVED) · 보류(HOLD). */
  counts: vendorProcedure.query(async ({ ctx }) => {
    const db = adminDb();
    const vendorId = ctx.vendorId;
    if (!vendorId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "vendor 연결이 필요합니다.",
      });
    }
    try {
      const snap = await db
        .collection(COLLECTIONS.settlements)
        .where("vendorId", "==", vendorId)
        .get();
      const items = snap.docs.map((d) => d.data() as Settlement);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartMs = monthStart.getTime();

      const totalPaid = items
        .filter((s) => s.status === "PAID")
        .reduce((sum, s) => sum + (s.finalPayout ?? 0), 0);

      const thisMonth = items
        .filter((s) => {
          if (s.status !== "PAID") return false;
          const paid = tsToMs(s.paidAt);
          return paid >= monthStartMs;
        })
        .reduce((sum, s) => sum + (s.finalPayout ?? 0), 0);

      const pending = items
        .filter(
          (s) =>
            s.status === "PENDING" ||
            s.status === "REQUESTED" ||
            s.status === "APPROVED",
        )
        .reduce((sum, s) => sum + (s.finalPayout ?? 0), 0);

      const held = items
        .filter((s) => s.status === "HOLD")
        .reduce((sum, s) => sum + (s.finalPayout ?? 0), 0);

      return { totalPaid, thisMonth, pending, held };
    } catch {
      return { totalPaid: 0, thisMonth: 0, pending: 0, held: 0 };
    }
  }),

  /** 본인 이체 이력. */
  payouts: vendorProcedure
    .input(
      z.object({
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }): Promise<Payout[]> => {
      const vendorId = ctx.vendorId;
      if (!vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "vendor 연결이 필요합니다.",
        });
      }
      try {
        const snap = await adminDb()
          .collection(COLLECTIONS.payouts)
          .where("vendorId", "==", vendorId)
          .orderBy("createdAt", "desc")
          .limit(input.pageSize)
          .get();
        return snap.docs.map((d) => {
          const data = d.data() as Omit<Payout, "id">;
          return { id: d.id, ...data } as Payout;
        });
      } catch {
        return [];
      }
    }),

  /**
   * 빠른정산 신청. PENDING → REQUESTED.
   *
   * - 본인 정산 검증
   * - 빠른정산 수수료 자동 계산 (4일 단축 가정, D+7 → D+3)
   * - finalPayout 갱신 (netPayout - fastFee)
   * - 운영자가 admin.settlement.approveFast 로 승인 시 PAID
   */
  requestFastSettlement: vendorProcedure
    .input(z.object({ settlementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.settlements)
        .doc(input.settlementId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "정산을 찾을 수 없습니다.",
        });
      }
      const s = snap.data() as Settlement;
      if (s.vendorId !== ctx.vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인 정산만 신청할 수 있습니다.",
        });
      }
      if (s.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "정산 대기(PENDING) 상태에서만 신청할 수 있습니다.",
        });
      }

      const days = 4; // D+7 → D+3
      const baseAmount = s.netPayout ?? s.finalPayout ?? 0;
      const fastFee = calculateFastFee(baseAmount, days);

      const now = FieldValue.serverTimestamp();
      await ref.update({
        status: "REQUESTED",
        isFastSettlement: true,
        fastSettlementDays: 3,
        fastSettlementFee: fastFee,
        finalPayout: Math.max(0, baseAmount - fastFee),
        updatedAt: now,
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "SETTLEMENT_FAST_REQUESTED",
        targetType: "Settlement",
        targetId: input.settlementId,
        after: {
          baseAmount,
          fastFee,
          finalPayout: Math.max(0, baseAmount - fastFee),
        },
        createdAt: now,
      });

      return { ok: true, fastFee, finalPayout: Math.max(0, baseAmount - fastFee) };
    }),

  /**
   * Phase γ-2 — 정산 계좌 변경 요청.
   *
   * 즉시 vendor doc 반영하지 않고, 별도 컬렉션
   * (/vendors/{vendorId}/payoutChangeRequests) 에 적재 → 운영자 검토 후 수동 반영.
   *
   * UX:
   *   - bankCode + bankAccount(숫자 + -) + accountHolder 필수
   *   - bankbookCopyUrl (통장 사본 Storage URL) 선택
   *   - admin 알림 doc 생성 + audit
   */
  requestPayoutChange: vendorProcedure
    .input(
      z.object({
        bankCode: z.string().min(2).max(20),
        bankAccount: z
          .string()
          .min(6)
          .max(40)
          .regex(/^[0-9-]+$/, "숫자와 - 만 입력 가능합니다."),
        accountHolder: z.string().min(1).max(60),
        bankbookCopyUrl: z.string().url().optional(),
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

      const now = FieldValue.serverTimestamp();

      // 1) 변경 요청 doc 적재 (PENDING)
      const requestRef = await db
        .collection(COLLECTIONS.vendors)
        .doc(vendorId)
        .collection("payoutChangeRequests")
        .add({
          vendorId,
          requestedBy: ctx.uid,
          bankCode: input.bankCode,
          bankAccount: input.bankAccount,
          accountHolder: input.accountHolder,
          bankbookCopyUrl: input.bankbookCopyUrl ?? null,
          status: "PENDING",
          createdAt: now,
        });

      // 2) admin 알림 (queue 형태)
      try {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "ADMIN_QUEUE",
          targetId: "payout-change",
          type: "VENDOR_PAYOUT_CHANGE_REQUESTED",
          title: "vendor 계좌 변경 요청",
          body: `${vendorId} 계좌 변경 검토 필요 (${input.bankCode} · ${maskBankAccount(input.bankAccount)})`,
          channels: ["IN_APP"],
          createdAt: now,
        });
      } catch {
        // best-effort
      }

      // 3) audit
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "PAYOUT_CHANGE_REQUESTED",
        targetType: "Vendor",
        targetId: vendorId,
        after: {
          requestId: requestRef.id,
          bankCode: input.bankCode,
          bankAccount: maskBankAccount(input.bankAccount),
          accountHolder: input.accountHolder,
          hasBankbookCopy: !!input.bankbookCopyUrl,
        },
        createdAt: now,
      });

      return { ok: true, requestId: requestRef.id };
    }),

  /**
   * Phase γ-2 — 최근 6개월 월별 GMV (총 매출) 집계.
   *
   * 차트(BarChart) 용. settlements 의 grossAmount 합산 (PAID 만이 아니라 전체).
   * periodStart 의 YYYY-MM 기준 group by.
   */
  monthlyGmv: vendorProcedure.query(async ({ ctx }) => {
    const db = adminDb();
    const vendorId = ctx.vendorId;
    if (!vendorId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "vendor 연결이 필요합니다.",
      });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    try {
      const snap = await db
        .collection(COLLECTIONS.settlements)
        .where("vendorId", "==", vendorId)
        .where("createdAt", ">=", Timestamp.fromDate(sixMonthsAgo))
        .get();

      const byMonth: Record<string, number> = {};
      for (const d of snap.docs) {
        const s = d.data() as Settlement;
        const start = s.periodStart as unknown;
        let monthKey = "unknown";
        if (start && typeof start === "object") {
          const w = start as { toDate?: () => Date; seconds?: number };
          let date: Date | null = null;
          if (typeof w.toDate === "function") {
            try {
              date = w.toDate();
            } catch {
              date = null;
            }
          }
          if (!date && typeof w.seconds === "number") {
            date = new Date(w.seconds * 1000);
          }
          if (date) {
            monthKey =
              `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          }
        }
        byMonth[monthKey] =
          (byMonth[monthKey] ?? 0) + (s.grossAmount ?? 0);
      }

      // 최근 6개월 키 생성 (빈 달도 0 으로 채움)
      const now = new Date();
      const months: Array<{ month: string; label: string; value: number }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key =
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.push({
          month: key,
          label: `${d.getMonth() + 1}월`,
          value: byMonth[key] ?? 0,
        });
      }
      return months;
    } catch {
      // composite index 없음 등 — 빈 배열
      return [];
    }
  }),
});
