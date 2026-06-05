// Wave M — 정산·이체 tRPC router (admin only).
//
// Endpoints:
//   - list({status?,vendorId?,isFastSettlement?,pageSize,cursor})
//   - counts()                                        KPI: 이번주 예정·빠른정산 대기·보류·이번달 수수료
//   - getById({settlementId})
//   - approveFast({settlementId,note?})               REQUESTED → APPROVED
//   - rejectFast({settlementId,reason})               REQUESTED → PENDING (D+7 회귀)
//   - hold({settlementId,reason})                     * → HOLD
//   - release({settlementId})                         HOLD → PENDING
//   - markPaid({settlementId,payoutRef,method})       APPROVED/PENDING → PAID + payout doc 생성
//   - listByVendor({vendorId,...})                    vendor 단건 페이지용
//   - payoutsListByVendor({vendorId,pageSize})        vendor 단건 페이지 이체 이력
//   - vendorPayoutCounts({vendorId})                  vendor 단건 KPI
//   - payoutSummaryByVendor()                         /admin/payouts index — vendor별 집계
//   - payoutGlobalCounts()                            /admin/payouts index — KPI 4개

import {TRPCError} from "@trpc/server";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {z} from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  superAdminProcedure,
} from "@/server/api/trpc";
import {formatKRW} from "@/lib/format";
import {adminDb} from "@/server/firebase/admin";
import {COLLECTIONS} from "@/server/firebase/collections";
import type {Settlement, Payout} from "@/lib/types";

const StatusEnum = z.enum([
  "PENDING",
  "REQUESTED",
  "APPROVED",
  "HOLD",
  "PAID",
  "FAILED",
]);

const PayoutMethodEnum = z.enum([
  "PORTONE",
  "MANUAL_BANK",
  "VIRTUAL_ACCOUNT",
]);

type AnySettlement = Settlement & {
  toMillis?: never;
};

/**
 * Phase α-7 — 계좌번호 마스킹.
 * 4자 이하면 그대로, 그 외엔 마지막 4자리만 노출 (앞부분은 • 로 치환).
 * 예: "1234567890" → "••••••7890"
 */
function maskBankAccount(account: string | undefined | null): string {
  if (!account) return "";
  const s = String(account);
  if (s.length <= 4) return s;
  return s.slice(0, -4).replace(/[0-9]/g, "•") + s.slice(-4);
}

function tsToMs(ts: unknown): number {
  if (!ts || typeof ts !== "object") return 0;
  const w1 = ts as {toMillis?: () => number; toDate?: () => Date};
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
  const w2 = ts as {seconds?: number; _seconds?: number};
  const sec = w2.seconds ?? w2._seconds;
  if (typeof sec === "number") return sec * 1000;
  return 0;
}

export const adminSettlementRouter = createTRPCRouter({
  /** Settlement 목록. status·vendorId·isFastSettlement 필터 + cursor pagination. */
  list: adminProcedure
    .input(
      z.object({
        status: StatusEnum.optional(),
        vendorId: z.string().optional(),
        isFastSettlement: z.boolean().optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{
        settlements: Settlement[];
        hasMore: boolean;
        nextCursor?: string;
      }> => {
        const db = adminDb();
        let q: FirebaseFirestore.Query = db
          .collection(COLLECTIONS.settlements)
          .orderBy("createdAt", "desc")
          .limit(input.pageSize + 1);
        if (input.status) q = q.where("status", "==", input.status);
        if (input.vendorId) q = q.where("vendorId", "==", input.vendorId);
        if (input.isFastSettlement !== undefined) {
          q = q.where("isFastSettlement", "==", input.isFastSettlement);
        }
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
            const data = d.data() as Omit<AnySettlement, "id">;
            return {id: d.id, ...data} as Settlement;
          });
          const hasMore = items.length > input.pageSize;
          const settlements = hasMore ? items.slice(0, -1) : items;
          const nextCursor = hasMore
            ? settlements[settlements.length - 1]?.id
            : undefined;
          return {settlements, hasMore, nextCursor};
        } catch {
          return {settlements: [], hasMore: false};
        }
      },
    ),

  /** KPI counts. 컬렉션 전체 스캔 (~수천건 가정). */
  counts: adminProcedure.query(async () => {
    const db = adminDb();
    try {
      const snap = await db.collection(COLLECTIONS.settlements).get();
      const items = snap.docs.map((d) => d.data() as Settlement);

      const now = Date.now();
      const weekEnd = now + 7 * 86400 * 1000;
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartMs = monthStart.getTime();

      const thisWeekScheduled = items
        .filter((s) => {
          const sched = tsToMs(s.scheduledPayoutAt);
          return (
            sched >= now &&
            sched <= weekEnd &&
            (s.status === "PENDING" ||
              s.status === "REQUESTED" ||
              s.status === "APPROVED")
          );
        })
        .reduce((sum, s) => sum + (s.finalPayout ?? 0), 0);

      const fastPending = items.filter(
        (s) => s.status === "REQUESTED" && s.isFastSettlement,
      ).length;

      const held = items
        .filter((s) => s.status === "HOLD")
        .reduce((sum, s) => sum + (s.finalPayout ?? 0), 0);

      const monthlyCommission = items
        .filter((s) => tsToMs(s.createdAt) >= monthStartMs)
        .reduce((sum, s) => sum + (s.commissionAmount ?? 0), 0);

      return {thisWeekScheduled, fastPending, held, monthlyCommission};
    } catch {
      return {
        thisWeekScheduled: 0,
        fastPending: 0,
        held: 0,
        monthlyCommission: 0,
      };
    }
  }),

  /** 단건 조회. */
  getById: adminProcedure
    .input(z.object({settlementId: z.string()}))
    .query(async ({input}): Promise<Settlement | null> => {
      const snap = await adminDb()
        .collection(COLLECTIONS.settlements)
        .doc(input.settlementId)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<Settlement, "id">;
      return {id: snap.id, ...data};
    }),

  /**
   * 빠른정산 승인. REQUESTED → APPROVED + 알림 + audit.
   * Phase α-5 — SUPER_ADMIN only.
   */
  approveFast: superAdminProcedure
    .input(
      z.object({
        settlementId: z.string(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.settlements)
        .doc(input.settlementId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({code: "NOT_FOUND", message: "정산을 찾을 수 없습니다."});
      }
      const s = snap.data() as Settlement;
      if (s.status !== "REQUESTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "REQUESTED 상태가 아닙니다.",
        });
      }

      await ref.update({
        status: "APPROVED",
        approvedById: ctx.uid,
        approvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.notifications).add({
        targetType: "VENDOR",
        targetId: s.vendorId,
        type: "SETTLEMENT_APPROVED",
        title: "빠른정산이 승인되었습니다",
        body: `${formatKRW(s.finalPayout ?? 0)}이 영업일 내 입금됩니다.${
          input.note ? `\n${input.note}` : ""
        }`,
        channels: ["KAKAO", "IN_APP"],
        kakaoSent: false,
        emailSent: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "SETTLEMENT_FAST_APPROVED",
        targetType: "Settlement",
        targetId: input.settlementId,
        after: {
          vendorId: s.vendorId,
          amount: s.finalPayout,
          note: input.note,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
      return {ok: true};
    }),

  /**
   * 빠른정산 반려. REQUESTED → PENDING (D+7 회귀) + 알림 + audit.
   * Phase α-5 — SUPER_ADMIN only.
   */
  rejectFast: superAdminProcedure
    .input(
      z.object({
        settlementId: z.string(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.settlements)
        .doc(input.settlementId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({code: "NOT_FOUND", message: "정산을 찾을 수 없습니다."});
      }
      const s = snap.data() as Settlement;

      await ref.update({
        status: "PENDING",
        isFastSettlement: false,
        fastSettlementFee: 0,
        finalPayout: s.netPayout ?? s.finalPayout,
        statusReason: input.reason,
        scheduledPayoutAt: Timestamp.fromDate(
          new Date(Date.now() + 7 * 86400 * 1000),
        ),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.notifications).add({
        targetType: "VENDOR",
        targetId: s.vendorId,
        type: "SETTLEMENT_FAST_REJECTED",
        title: "빠른정산이 거부되었습니다",
        body: `${input.reason}\nD+7 정산으로 회귀됩니다.`,
        channels: ["KAKAO", "IN_APP"],
        kakaoSent: false,
        emailSent: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "SETTLEMENT_FAST_REJECTED",
        targetType: "Settlement",
        targetId: input.settlementId,
        after: {reason: input.reason},
        createdAt: FieldValue.serverTimestamp(),
      });
      return {ok: true};
    }),

  /**
   * 보류. status → HOLD + audit.
   * Phase α-5 — SUPER_ADMIN only.
   */
  hold: superAdminProcedure
    .input(
      z.object({
        settlementId: z.string(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.settlements)
        .doc(input.settlementId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({code: "NOT_FOUND", message: "정산을 찾을 수 없습니다."});
      }
      await ref.update({
        status: "HOLD",
        statusReason: input.reason,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "SETTLEMENT_HOLD",
        targetType: "Settlement",
        targetId: input.settlementId,
        after: {reason: input.reason},
        createdAt: FieldValue.serverTimestamp(),
      });
      return {ok: true};
    }),

  /**
   * 보류 해제. HOLD → PENDING.
   * Phase α-5 — SUPER_ADMIN only.
   */
  release: superAdminProcedure
    .input(z.object({settlementId: z.string()}))
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.settlements)
        .doc(input.settlementId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({code: "NOT_FOUND", message: "정산을 찾을 수 없습니다."});
      }
      await ref.update({
        status: "PENDING",
        statusReason: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "SETTLEMENT_RELEASED",
        targetType: "Settlement",
        targetId: input.settlementId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return {ok: true};
    }),

  /**
   * 이체 완료 처리. APPROVED/PENDING → PAID + /payouts 신규 + 알림 + audit.
   * 실제 PortOne API 연동은 Phase 2+. 현재는 수동 입력 ref 만 기록.
   * Phase α-5 — SUPER_ADMIN only.
   */
  markPaid: superAdminProcedure
    .input(
      z.object({
        settlementId: z.string(),
        payoutRef: z.string().max(100),
        method: PayoutMethodEnum.default("MANUAL_BANK"),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.settlements)
        .doc(input.settlementId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({code: "NOT_FOUND", message: "정산을 찾을 수 없습니다."});
      }
      const s = snap.data() as Settlement;
      if (s.status === "PAID") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 입금 처리된 정산입니다.",
        });
      }

      // payout doc 생성
      const vendorSnap = await db
        .collection(COLLECTIONS.vendors)
        .doc(s.vendorId)
        .get();
      const v = vendorSnap.data() as
        | {
            payoutBankCode?: string;
            payoutBankAccount?: string;
            payoutAccountHolder?: string;
          }
        | undefined;
      const payoutRef = db.collection(COLLECTIONS.payouts).doc();
      await payoutRef.set({
        vendorId: s.vendorId,
        vendorName: s.vendorName,
        settlementIds: [input.settlementId],
        totalAmount: s.finalPayout ?? 0,
        bankCode: v?.payoutBankCode ?? "",
        bankAccount: v?.payoutBankAccount ?? "",
        accountHolder: v?.payoutAccountHolder ?? "",
        method: input.method,
        externalRef: input.payoutRef,
        status: "PAID",
        requestedAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });

      await ref.update({
        status: "PAID",
        paidAt: FieldValue.serverTimestamp(),
        payoutId: payoutRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.notifications).add({
        targetType: "VENDOR",
        targetId: s.vendorId,
        type: "SETTLEMENT_PAID",
        title: "정산이 입금되었습니다",
        body: `${(s.finalPayout ?? 0).toLocaleString()}원이 ${
          v?.payoutBankAccount ?? "등록 계좌"
        }로 입금 완료.`,
        channels: ["KAKAO", "IN_APP"],
        kakaoSent: false,
        emailSent: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "SETTLEMENT_PAID",
        targetType: "Settlement",
        targetId: input.settlementId,
        after: {
          payoutId: payoutRef.id,
          amount: s.finalPayout,
          ref: input.payoutRef,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
      return {ok: true, payoutId: payoutRef.id};
    }),

  /** vendor 단건 정산 목록. */
  listByVendor: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        status: StatusEnum.optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{
        settlements: Settlement[];
        hasMore: boolean;
        nextCursor?: string;
      }> => {
        const db = adminDb();
        let q: FirebaseFirestore.Query = db
          .collection(COLLECTIONS.settlements)
          .where("vendorId", "==", input.vendorId)
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
            return {id: d.id, ...data} as Settlement;
          });
          const hasMore = items.length > input.pageSize;
          const settlements = hasMore ? items.slice(0, -1) : items;
          const nextCursor = hasMore
            ? settlements[settlements.length - 1]?.id
            : undefined;
          return {settlements, hasMore, nextCursor};
        } catch {
          return {settlements: [], hasMore: false};
        }
      },
    ),

  /**
   * vendor 단건 이체 이력. Phase α-7 — bankAccount 마스킹 (마지막 4자리만 노출).
   * 전체 계좌가 필요하면 revealBankAccount (SUPER_ADMIN, audit log) 호출.
   */
  payoutsListByVendor: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({input}): Promise<Payout[]> => {
      try {
        const snap = await adminDb()
          .collection(COLLECTIONS.payouts)
          .where("vendorId", "==", input.vendorId)
          .orderBy("createdAt", "desc")
          .limit(input.pageSize)
          .get();
        return snap.docs.map((d) => {
          const data = d.data() as Omit<Payout, "id">;
          const masked = maskBankAccount(data.bankAccount);
          return {id: d.id, ...data, bankAccount: masked} as Payout;
        });
      } catch {
        return [];
      }
    }),

  /**
   * vendor 정산 계좌 — 마스킹된 형태로 반환 (Phase α-7).
   * 전체 계좌는 revealBankAccount (SUPER_ADMIN) 로만 노출.
   */
  vendorBankInfo: adminProcedure
    .input(z.object({vendorId: z.string()}))
    .query(async ({input}) => {
      try {
        const snap = await adminDb()
          .collection(COLLECTIONS.vendors)
          .doc(input.vendorId)
          .get();
        if (!snap.exists) return null;
        const v = snap.data() as {
          payoutBankCode?: string;
          payoutBankAccount?: string;
          payoutAccountHolder?: string;
        };
        return {
          bankCode: v.payoutBankCode ?? "",
          bankAccountMasked: maskBankAccount(v.payoutBankAccount),
          accountHolder: v.payoutAccountHolder ?? "",
        };
      } catch {
        return null;
      }
    }),

  /**
   * Phase α-7 — vendor 정산 계좌 평문 노출.
   * SUPER_ADMIN 전용. 호출 시 auditLogs 적재.
   */
  revealBankAccount: superAdminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.vendors)
        .doc(input.vendorId)
        .get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "공급업체를 찾을 수 없습니다.",
        });
      }
      const v = snap.data() as {
        payoutBankCode?: string;
        payoutBankAccount?: string;
        payoutAccountHolder?: string;
      };

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "VENDOR_BANK_ACCOUNT_REVEALED",
        targetType: "Vendor",
        targetId: input.vendorId,
        after: {reason: input.reason},
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        bankCode: v.payoutBankCode ?? "",
        bankAccount: v.payoutBankAccount ?? "",
        accountHolder: v.payoutAccountHolder ?? "",
      };
    }),

  /** vendor 단건 KPI: 누적·이번달·보류·평균 D+. */
  vendorPayoutCounts: adminProcedure
    .input(z.object({vendorId: z.string()}))
    .query(async ({input}) => {
      const db = adminDb();
      try {
        const snap = await db
          .collection(COLLECTIONS.settlements)
          .where("vendorId", "==", input.vendorId)
          .get();
        const items = snap.docs.map((d) => d.data() as Settlement);

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
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

        const held = items
          .filter((s) => s.status === "HOLD")
          .reduce((sum, s) => sum + (s.finalPayout ?? 0), 0);

        // 평균 D+ — createdAt → paidAt 평균 일수
        const paidItems = items.filter(
          (s) => s.status === "PAID" && s.paidAt && s.createdAt,
        );
        const avgDelay =
          paidItems.length > 0
            ? paidItems.reduce((sum, s) => {
                const days =
                  (tsToMs(s.paidAt) - tsToMs(s.createdAt)) / 86400000;
                return sum + days;
              }, 0) / paidItems.length
            : 0;

        return {totalPaid, thisMonth, held, avgDelay};
      } catch {
        return {totalPaid: 0, thisMonth: 0, held: 0, avgDelay: 0};
      }
    }),

  /**
   * Phase ν-1 — /admin/payouts index 용 vendor별 집계.
   * settlements 전체를 vendorId 별로 group → 누적·이번달·미지급·최근 지급일·상태 산출.
   * 운영 데이터가 수천 건이면 별도 집계 컬렉션이 필요하지만, MVP 는 전체 스캔.
   */
  payoutSummaryByVendor: adminProcedure.query(async () => {
    const db = adminDb();
    try {
      const snap = await db.collection(COLLECTIONS.settlements).get();
      const items = snap.docs.map((d) => d.data() as Settlement);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartMs = monthStart.getTime();

      type Bucket = {
        vendorId: string;
        vendorName: string;
        totalPaid: number;
        thisMonth: number;
        unpaid: number;
        held: number;
        lastPaidAtMs: number;
        hasHold: boolean;
        hasFastPending: boolean;
        countPaid: number;
        countPending: number;
      };
      const buckets = new Map<string, Bucket>();

      for (const s of items) {
        if (!s.vendorId) continue;
        let b = buckets.get(s.vendorId);
        if (!b) {
          b = {
            vendorId: s.vendorId,
            vendorName: s.vendorName ?? s.vendorId,
            totalPaid: 0,
            thisMonth: 0,
            unpaid: 0,
            held: 0,
            lastPaidAtMs: 0,
            hasHold: false,
            hasFastPending: false,
            countPaid: 0,
            countPending: 0,
          };
          buckets.set(s.vendorId, b);
        }
        const amount = s.finalPayout ?? 0;
        if (s.status === "PAID") {
          b.totalPaid += amount;
          b.countPaid += 1;
          const paid = tsToMs(s.paidAt);
          if (paid > b.lastPaidAtMs) b.lastPaidAtMs = paid;
          if (paid >= monthStartMs) b.thisMonth += amount;
        } else if (s.status === "HOLD") {
          b.held += amount;
          b.hasHold = true;
          b.countPending += 1;
        } else {
          // PENDING / REQUESTED / APPROVED → 미지급
          b.unpaid += amount;
          b.countPending += 1;
          if (s.status === "REQUESTED" && s.isFastSettlement) {
            b.hasFastPending = true;
          }
        }
      }

      const rows = Array.from(buckets.values())
        .map((b) => ({
          ...b,
          lastPaidAt: b.lastPaidAtMs > 0 ? b.lastPaidAtMs : null,
        }))
        .sort((a, b) => (b.lastPaidAt ?? 0) - (a.lastPaidAt ?? 0));

      return rows;
    } catch {
      return [];
    }
  }),

  /**
   * Phase ν-1 — /admin/payouts index KPI.
   * 이번 달 지급 합계 · 미지급 잔액 · 지급 완료 건수 · 보류 건수.
   */
  payoutGlobalCounts: adminProcedure.query(async () => {
    const db = adminDb();
    try {
      const snap = await db.collection(COLLECTIONS.settlements).get();
      const items = snap.docs.map((d) => d.data() as Settlement);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartMs = monthStart.getTime();

      const thisMonthPaid = items
        .filter((s) => {
          if (s.status !== "PAID") return false;
          return tsToMs(s.paidAt) >= monthStartMs;
        })
        .reduce((sum, s) => sum + (s.finalPayout ?? 0), 0);

      const unpaid = items
        .filter(
          (s) =>
            s.status === "PENDING" ||
            s.status === "REQUESTED" ||
            s.status === "APPROVED",
        )
        .reduce((sum, s) => sum + (s.finalPayout ?? 0), 0);

      const paidCount = items.filter((s) => s.status === "PAID").length;
      const holdCount = items.filter((s) => s.status === "HOLD").length;

      return {thisMonthPaid, unpaid, paidCount, holdCount};
    } catch {
      return {thisMonthPaid: 0, unpaid: 0, paidCount: 0, holdCount: 0};
    }
  }),
});
