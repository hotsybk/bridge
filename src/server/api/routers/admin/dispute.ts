import { TRPCError } from "@trpc/server";
import { FieldValue, Timestamp, type Timestamp as TimestampType } from "firebase-admin/firestore";
import { z } from "zod";

import { formatKRW } from "@/lib/format";
import {
  adminProcedure,
  createTRPCRouter,
  superAdminProcedure,
} from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS, SUB_COLLECTIONS } from "@/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────────────────────

const DisputeStatusEnum = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "NEEDS_ADMIN_RESPONSE",
  "RESOLVED",
  "REJECTED",
]);

const DisputeTypeEnum = z.enum([
  "REFUND",
  "RETURN",
  "NOT_DELIVERED",
  "QUALITY",
  "OTHER",
]);

const ListStatusEnum = z.enum([
  "ALL",
  "OPEN",
  "IN_PROGRESS",
  "NEEDS_ADMIN_RESPONSE",
  "CLOSED",
]);

type DisputeDoc = {
  id: string;
  orderId?: string;
  subOrderId?: string;
  hospitalId?: string;
  hospitalName?: string;
  vendorId?: string;
  vendorName?: string;
  type?: string;
  amount?: number;
  reason?: string;
  status?: string;
  resolution?: {
    type?: string;
    refundAmount?: number;
    refundPercent?: number;
    payoutAdjustment?: number;
    reason?: string;
    decidedById?: string;
    decidedAt?: TimestampType;
  };
  openedAt?: TimestampType;
  deadlineAt?: TimestampType;
  resolvedAt?: TimestampType;
  createdAt?: TimestampType;
  updatedAt?: TimestampType;
};

type DisputeMessageDoc = {
  id: string;
  authorRole?: string;
  authorId?: string;
  authorName?: string;
  body?: string;
  attachments?: Array<{ name: string; size: number; url: string; mime: string }>;
  systemEvent?: string;
  createdAt?: TimestampType;
};

type DisputeActivityDoc = {
  id: string;
  at?: TimestampType;
  actorId?: string;
  actorRole?: string;
  action?: string;
  meta?: Record<string, unknown>;
};

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

function matchesListStatus(d: DisputeDoc, s: z.infer<typeof ListStatusEnum>): boolean {
  if (s === "ALL") return true;
  const status = d.status ?? "";
  if (s === "CLOSED") return ["RESOLVED", "REJECTED"].includes(status);
  return status === s;
}

function deadlineHoursLeft(d: DisputeDoc): number | null {
  const dl = d.deadlineAt;
  if (!dl) return null;
  const seconds = (dl as unknown as { seconds?: number }).seconds;
  if (!seconds) return null;
  const diffMs = seconds * 1000 - Date.now();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

// ─────────────────────────────────────────────────────────────
// router
// ─────────────────────────────────────────────────────────────

export const adminDisputeRouter = createTRPCRouter({
  /**
   * 분쟁 list — segment tab + 필터 + 검색.
   *
   * Phase 2 단순화: 최대 200건 in-memory filter.
   */
  list: adminProcedure
    .input(
      z.object({
        status: ListStatusEnum.optional().default("ALL"),
        type: DisputeTypeEnum.optional(),
        amountMin: z.number().optional(),
        amountMax: z.number().optional(),
        search: z.string().optional(),
        pageSize: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{ disputes: DisputeDoc[]; hasMore: boolean; nextCursor?: string }> => {
        const db = adminDb();
        const snap = await db
          .collection(COLLECTIONS.disputes)
          .orderBy("openedAt", "desc")
          .limit(200)
          .get();
        let items = snap.docs.map((d) => {
          const data = d.data() as Omit<DisputeDoc, "id">;
          return { id: d.id, ...data } as DisputeDoc;
        });

        items = items.filter((d) => matchesListStatus(d, input.status));

        if (input.type) {
          items = items.filter((d) => d.type === input.type);
        }
        if (input.amountMin !== undefined) {
          items = items.filter((d) => (d.amount ?? 0) >= (input.amountMin ?? 0));
        }
        if (input.amountMax !== undefined) {
          items = items.filter((d) => (d.amount ?? 0) <= (input.amountMax ?? Infinity));
        }
        if (input.search) {
          const q = input.search.toLowerCase();
          items = items.filter((d) =>
            [d.id, d.orderId, d.hospitalName, d.vendorName, d.reason]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q),
          );
        }

        let start = 0;
        if (input.cursor) {
          const idx = items.findIndex((d) => d.id === input.cursor);
          if (idx >= 0) start = idx + 1;
        }
        const page = items.slice(start, start + input.pageSize + 1);
        const hasMore = page.length > input.pageSize;
        const disputes = hasMore ? page.slice(0, -1) : page;
        const nextCursor = hasMore ? disputes[disputes.length - 1]?.id : undefined;
        return { disputes, hasMore, nextCursor };
      },
    ),

  /**
   * KPI 4 — 진행 중 / 운영자 응답 필요 / 마감 임박 (≤24h) / 평균 처리 시간(일).
   * Phase 2 단순화: 최근 500건 샘플.
   */
  counts: adminProcedure.query(async () => {
    const db = adminDb();
    const snap = await db
      .collection(COLLECTIONS.disputes)
      .orderBy("openedAt", "desc")
      .limit(500)
      .get();
    const items = snap.docs.map((d) => {
      const data = d.data() as Omit<DisputeDoc, "id">;
      return { id: d.id, ...data } as DisputeDoc;
    });

    const inProgress = items.filter(
      (d) => d.status === "IN_PROGRESS" || d.status === "OPEN",
    ).length;
    const needsAdmin = items.filter(
      (d) => d.status === "NEEDS_ADMIN_RESPONSE",
    ).length;

    const slaCloseCount = items.filter((d) => {
      if (d.status === "RESOLVED" || d.status === "REJECTED") return false;
      const left = deadlineHoursLeft(d);
      return left !== null && left <= 24;
    }).length;

    // 평균 처리 시간 (RESOLVED 만, openedAt → resolvedAt) 단위: 일
    const resolved = items.filter(
      (d) => d.status === "RESOLVED" && d.resolvedAt && d.openedAt,
    );
    let avgDays = 0;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((acc, d) => {
        const op = (d.openedAt as unknown as { seconds?: number })?.seconds ?? 0;
        const rs = (d.resolvedAt as unknown as { seconds?: number })?.seconds ?? 0;
        return acc + (rs - op) * 1000;
      }, 0);
      avgDays =
        Math.round((totalMs / resolved.length / (1000 * 60 * 60 * 24)) * 10) / 10;
    }

    return {
      inProgress,
      needsAdmin,
      slaCloseCount,
      avgDays,
    };
  }),

  /**
   * 단건 + messages + activity 동시 fetch.
   */
  getById: adminProcedure
    .input(z.object({ disputeId: z.string() }))
    .query(
      async ({
        input,
      }): Promise<{
        dispute: DisputeDoc | null;
        messages: DisputeMessageDoc[];
        activity: DisputeActivityDoc[];
      }> => {
        const db = adminDb();
        const ref = db.collection(COLLECTIONS.disputes).doc(input.disputeId);
        const [snap, msgSnap, actSnap] = await Promise.all([
          ref.get(),
          ref.collection("messages").orderBy("createdAt", "asc").limit(200).get(),
          ref.collection("activity").orderBy("at", "asc").limit(200).get(),
        ]);
        if (!snap.exists) {
          return { dispute: null, messages: [], activity: [] };
        }
        const data = snap.data() as Omit<DisputeDoc, "id">;
        const dispute: DisputeDoc = { id: snap.id, ...data };
        const messages: DisputeMessageDoc[] = msgSnap.docs.map((d) => {
          const md = d.data() as Omit<DisputeMessageDoc, "id">;
          return { id: d.id, ...md };
        });
        const activity: DisputeActivityDoc[] = actSnap.docs.map((d) => {
          const ad = d.data() as Omit<DisputeActivityDoc, "id">;
          return { id: d.id, ...ad };
        });
        return { dispute, messages, activity };
      },
    ),

  /**
   * 운영자 발언 추가 — 양측에 공개.
   */
  adminMessage: adminProcedure
    .input(
      z.object({
        disputeId: z.string(),
        body: z.string().min(1, "메시지 내용을 입력해주세요").max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.disputes).doc(input.disputeId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분쟁을 찾을 수 없습니다.",
        });
      }
      const now = FieldValue.serverTimestamp();

      await ref.collection("messages").add({
        authorRole: "ADMIN",
        authorId: ctx.uid,
        authorName: "운영자",
        body: input.body,
        attachments: [],
        createdAt: now,
      });

      // 운영자 응답 후에는 IN_PROGRESS 로 전환
      await ref.update({
        status: "IN_PROGRESS",
        updatedAt: now,
      });

      await ref.collection("activity").add({
        at: now,
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "MESSAGE_SENT",
        meta: { length: input.body.length },
      });

      return { ok: true };
    }),

  /**
   * 환불 결정 — PortOne cancel 호출 + 분쟁 종결.
   *
   * Phase α-5 — SUPER_ADMIN only. 환불·이체·정산 status 강제 변경은 ADMIN 권한으로 불가.
   */
  resolve: superAdminProcedure
    .input(
      z.object({
        disputeId: z.string(),
        refundPercent: z.number().min(0).max(100),
        refundAmount: z.number().min(0),
        payoutAdjustment: z.number().min(0).default(0),
        reason: z.string().min(1, "결정 사유를 입력해주세요").max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.disputes).doc(input.disputeId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분쟁을 찾을 수 없습니다.",
        });
      }
      const dispute = snap.data() as DisputeDoc;
      const now = FieldValue.serverTimestamp();

      // PortOne 환불 (refundAmount > 0 일 때만)
      let refundResult: unknown = null;
      let cancellationId: string | null = null;
      if (input.refundAmount > 0 && dispute.orderId) {
        const orderRef = db.collection(COLLECTIONS.orders).doc(dispute.orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "분쟁에 연결된 주문을 찾을 수 없습니다.",
          });
        }
        const order = orderSnap.data() as {
          payment?: { paymentId?: string };
          paymentKey?: string;
          finalAmount?: number;
          totalAmount?: number;
        };
        const paidAmount = order.finalAmount ?? order.totalAmount ?? 0;

        // Phase β-3 작업 2 — 환불 상한 검증
        if (paidAmount > 0 && input.refundAmount > paidAmount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `환불 금액(${formatKRW(input.refundAmount)})이 결제 금액(${formatKRW(paidAmount)})을 초과합니다.`,
          });
        }

        // 부분 환불 누적 합계 검증
        const existingRefundsSnap = await orderRef.collection("refunds").get();
        const totalRefunded = existingRefundsSnap.docs.reduce(
          (sum, d) => sum + ((d.data() as { amount?: number }).amount ?? 0),
          0,
        );
        if (paidAmount > 0 && totalRefunded + input.refundAmount > paidAmount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `누적 환불 합계(${formatKRW(totalRefunded + input.refundAmount)})가 결제 금액(${formatKRW(paidAmount)})을 초과합니다.`,
          });
        }

        const paymentId = order.payment?.paymentId ?? order.paymentKey;
        if (paymentId) {
          try {
            const { cancelPayment } = await import("@/server/services/portone");
            const result = await cancelPayment({
              paymentId,
              amount: input.refundAmount,
              reason: `Dispute ${input.disputeId} resolved: ${input.reason}`,
            });
            refundResult = result;
            cancellationId = result?.cancellation?.id ?? null;

            // refund doc 적재 (성공 시에만)
            await orderRef.collection("refunds").add({
              disputeId: input.disputeId,
              amount: input.refundAmount,
              reason: input.reason,
              cancellationId,
              decidedById: ctx.uid,
              createdAt: now,
            });
          } catch (err) {
            console.warn("[admin.dispute.resolve] PortOne cancel failed", err);
            refundResult = {
              source: "error",
              error: err instanceof Error ? err.message : String(err),
            };
          }
        } else {
          refundResult = { source: "skipped", reason: "no paymentId" };
        }
      }

      const resolutionType =
        input.refundPercent >= 100
          ? "REFUND"
          : input.refundPercent === 0
            ? "REJECTED"
            : "PARTIAL_REFUND";

      // dispute 갱신
      await ref.update({
        status: "RESOLVED",
        resolution: {
          type: resolutionType,
          refundAmount: input.refundAmount,
          refundPercent: input.refundPercent,
          payoutAdjustment: input.payoutAdjustment,
          reason: input.reason,
          decidedById: ctx.uid,
          decidedAt: Timestamp.now(),
        },
        resolvedAt: now,
        updatedAt: now,
      });

      // 시스템 메시지 추가
      await ref.collection("messages").add({
        authorRole: "SYSTEM",
        authorId: "system",
        authorName: "운영자 결정",
        body: input.reason,
        attachments: [],
        systemEvent: "RESOLVED",
        createdAt: now,
      });

      // 활동 기록
      await ref.collection("activity").add({
        at: now,
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "RESOLVED",
        meta: {
          refundAmount: input.refundAmount,
          refundPercent: input.refundPercent,
          payoutAdjustment: input.payoutAdjustment,
          portoneResult: refundResult,
        },
      });

      // 정산 hold entry (payoutAdjustment > 0 일 때)
      if (input.payoutAdjustment > 0 && dispute.vendorId) {
        try {
          await db.collection(COLLECTIONS.settlements).add({
            vendorId: dispute.vendorId,
            orderId: dispute.orderId,
            status: "HOLD",
            reason: "DISPUTE_RESOLVED_ADJUSTMENT",
            amount: -input.payoutAdjustment,
            disputeId: input.disputeId,
            createdAt: now,
          });
        } catch (err) {
          console.warn("[admin.dispute.resolve] settlement hold failed", err);
        }
      }

      // 양측 알림
      const notifications = [
        {
          targetType: "HOSPITAL" as const,
          targetId: dispute.hospitalId,
        },
        {
          targetType: "VENDOR" as const,
          targetId: dispute.vendorId,
        },
      ];
      for (const target of notifications) {
        if (!target.targetId) continue;
        try {
          await db.collection(COLLECTIONS.notifications).add({
            targetType: target.targetType,
            targetId: target.targetId,
            type: "DISPUTE_RESOLVED",
            title: "분쟁이 해결되었습니다",
            body: input.reason,
            data: {
              disputeId: input.disputeId,
              refundAmount: input.refundAmount,
            },
            channels: ["KAKAO", "IN_APP"],
            kakaoSent: false,
            emailSent: false,
            createdAt: now,
          });
        } catch (err) {
          console.warn("[admin.dispute.resolve] notification failed", err);
        }
      }

      // auditLog
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "DISPUTE_RESOLVED",
        targetType: "Dispute",
        targetId: input.disputeId,
        after: {
          refundAmount: input.refundAmount,
          refundPercent: input.refundPercent,
          payoutAdjustment: input.payoutAdjustment,
          reason: input.reason,
        },
        createdAt: now,
      });

      return { ok: true, refundResult };
    }),

  /**
   * 분쟁 거부 — vendor 손 들어줌.
   */
  reject: adminProcedure
    .input(
      z.object({
        disputeId: z.string(),
        reason: z.string().min(1, "거부 사유를 입력해주세요").max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.disputes).doc(input.disputeId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분쟁을 찾을 수 없습니다.",
        });
      }
      const dispute = snap.data() as DisputeDoc;
      const now = FieldValue.serverTimestamp();

      await ref.update({
        status: "REJECTED",
        resolution: {
          type: "REJECTED",
          refundAmount: 0,
          refundPercent: 0,
          payoutAdjustment: 0,
          reason: input.reason,
          decidedById: ctx.uid,
          decidedAt: Timestamp.now(),
        },
        resolvedAt: now,
        updatedAt: now,
      });

      await ref.collection("messages").add({
        authorRole: "SYSTEM",
        authorId: "system",
        authorName: "운영자 결정",
        body: input.reason,
        attachments: [],
        systemEvent: "REJECTED",
        createdAt: now,
      });

      await ref.collection("activity").add({
        at: now,
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "REJECTED",
        meta: { reason: input.reason },
      });

      // 알림 — 신청자(병원) 만 우선
      if (dispute.hospitalId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "HOSPITAL",
          targetId: dispute.hospitalId,
          type: "DISPUTE_REJECTED",
          title: "분쟁이 거부되었습니다",
          body: input.reason,
          data: { disputeId: input.disputeId },
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: now,
        });
      }
      if (dispute.vendorId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "VENDOR",
          targetId: dispute.vendorId,
          type: "DISPUTE_REJECTED",
          title: "분쟁이 종결되었습니다",
          body: input.reason,
          data: { disputeId: input.disputeId },
          channels: ["IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: now,
        });
      }

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "DISPUTE_REJECTED",
        targetType: "Dispute",
        targetId: input.disputeId,
        after: { reason: input.reason },
        createdAt: now,
      });

      return { ok: true };
    }),

  /**
   * 정보 요청 — 지정한 당사자에게만 알림. 상태는 NEEDS_ADMIN_RESPONSE 유지 또는 전환.
   */
  requestEvidence: adminProcedure
    .input(
      z.object({
        disputeId: z.string(),
        from: z.enum(["BUYER", "VENDOR"]),
        message: z.string().min(1, "요청 내용을 입력해주세요").max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.disputes).doc(input.disputeId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분쟁을 찾을 수 없습니다.",
        });
      }
      const dispute = snap.data() as DisputeDoc;
      const now = FieldValue.serverTimestamp();

      // 시스템 메시지 추가
      await ref.collection("messages").add({
        authorRole: "SYSTEM",
        authorId: "system",
        authorName:
          input.from === "BUYER"
            ? "운영자 → 병원 정보 요청"
            : "운영자 → 공급업체 정보 요청",
        body: input.message,
        attachments: [],
        systemEvent: "EVIDENCE_REQUESTED",
        createdAt: now,
      });

      await ref.collection("activity").add({
        at: now,
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "EVIDENCE_REQUESTED",
        meta: { from: input.from, message: input.message },
      });

      // 상태: 운영자 응답 필요는 해제됨 (정보 요청 = 대기 중)
      await ref.update({
        status: "IN_PROGRESS",
        updatedAt: now,
      });

      // 대상 알림
      if (input.from === "BUYER" && dispute.hospitalId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "HOSPITAL",
          targetId: dispute.hospitalId,
          type: "DISPUTE_EVIDENCE_REQUESTED",
          title: "운영자가 추가 정보를 요청했습니다",
          body: input.message,
          data: { disputeId: input.disputeId },
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: now,
        });
      } else if (input.from === "VENDOR" && dispute.vendorId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "VENDOR",
          targetId: dispute.vendorId,
          type: "DISPUTE_EVIDENCE_REQUESTED",
          title: "운영자가 추가 정보를 요청했습니다",
          body: input.message,
          data: { disputeId: input.disputeId },
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: now,
        });
      }

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "DISPUTE_EVIDENCE_REQUESTED",
        targetType: "Dispute",
        targetId: input.disputeId,
        after: { from: input.from, message: input.message },
        createdAt: now,
      });

      return { ok: true };
    }),

  /**
   * Counts — segment tab 별 분쟁 건수. Phase γ-1 추가.
   * 단일 호출로 모든 tab 카운트 반환 → 페이지 N+1 호출 제거.
   * Firestore aggregation count() 활용.
   */
  tabCounts: adminProcedure.query(async () => {
    const db = adminDb();
    const col = db.collection(COLLECTIONS.disputes);
    const [allSnap, openSnap, inSnap, needsSnap, resSnap, rejSnap] = await Promise.all([
      col.count().get(),
      col.where("status", "==", "OPEN").count().get(),
      col.where("status", "==", "IN_PROGRESS").count().get(),
      col.where("status", "==", "NEEDS_ADMIN_RESPONSE").count().get(),
      col.where("status", "==", "RESOLVED").count().get(),
      col.where("status", "==", "REJECTED").count().get(),
    ]);
    return {
      ALL: allSnap.data().count,
      OPEN: openSnap.data().count,
      IN_PROGRESS: inSnap.data().count,
      NEEDS_ADMIN_RESPONSE: needsSnap.data().count,
      CLOSED: resSnap.data().count + rejSnap.data().count,
    };
  }),

  /**
   * 운영자 측 분쟁 생성 (on-behalf-of) — Phase γ-1.
   *
   * 주문 상세에서 운영자가 직접 분쟁을 개설할 수 있게 한다.
   * SLA 48 시간으로 deadlineAt 설정. audit + 알림 enqueue.
   */
  openOnBehalf: adminProcedure
    .input(
      z.object({
        orderId: z.string(),
        subOrderId: z.string().optional(),
        type: DisputeTypeEnum,
        reason: z.string().min(10, "분쟁 사유를 10자 이상 입력해주세요").max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const orderSnap = await db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .get();
      if (!orderSnap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "주문을 찾을 수 없습니다.",
        });
      }
      const order = orderSnap.data() as {
        hospitalId?: string;
        hospitalName?: string;
        vendorIds?: string[];
        finalAmount?: number;
        totalAmount?: number;
        orderNo?: string;
      };

      // sub-order 정보 — 옵션
      let vendorId: string | undefined;
      let vendorName: string | undefined;
      let amount = order.finalAmount ?? order.totalAmount ?? 0;
      if (input.subOrderId) {
        const subSnap = await db
          .collection(SUB_COLLECTIONS.subOrders(input.orderId))
          .doc(input.subOrderId)
          .get();
        if (subSnap.exists) {
          const sd = subSnap.data() as {
            vendorId?: string;
            vendorName?: string;
            total?: number;
            subtotal?: number;
          };
          vendorId = sd.vendorId;
          vendorName = sd.vendorName;
          amount = sd.total ?? sd.subtotal ?? amount;
        }
      } else if (order.vendorIds?.[0]) {
        vendorId = order.vendorIds[0];
      }

      const disputeRef = db.collection(COLLECTIONS.disputes).doc();
      const slaHours = 48;
      const now = FieldValue.serverTimestamp();
      const deadlineAt = Timestamp.fromMillis(
        Date.now() + slaHours * 60 * 60 * 1000,
      );

      await disputeRef.set({
        orderId: input.orderId,
        orderNo: order.orderNo ?? input.orderId,
        subOrderId: input.subOrderId ?? null,
        hospitalId: order.hospitalId ?? null,
        hospitalName: order.hospitalName ?? null,
        vendorId: vendorId ?? null,
        vendorName: vendorName ?? null,
        type: input.type,
        amount,
        reason: input.reason,
        status: "OPEN",
        openedBy: { actorId: ctx.uid, role: "ADMIN" },
        openedAt: now,
        deadlineAt,
        createdAt: now,
        updatedAt: now,
      });

      // 시스템 메시지로 분쟁 개설 사유 기록
      await disputeRef.collection("messages").add({
        authorRole: "SYSTEM",
        authorId: "system",
        authorName: "운영자 직접 개설",
        body: input.reason,
        attachments: [],
        systemEvent: "OPENED_BY_ADMIN",
        createdAt: now,
      });

      await disputeRef.collection("activity").add({
        at: now,
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "OPENED_ON_BEHALF",
        meta: { orderId: input.orderId, type: input.type },
      });

      // 양측 알림
      if (order.hospitalId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "HOSPITAL",
          targetId: order.hospitalId,
          type: "DISPUTE_OPENED",
          title: "분쟁이 개설되었습니다",
          body: input.reason,
          data: { disputeId: disputeRef.id, orderId: input.orderId },
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: now,
        });
      }
      if (vendorId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "VENDOR",
          targetId: vendorId,
          type: "DISPUTE_OPENED",
          title: "분쟁이 개설되었습니다",
          body: input.reason,
          data: { disputeId: disputeRef.id, orderId: input.orderId },
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: now,
        });
      }

      // audit
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "DISPUTE_OPENED_ON_BEHALF",
        targetType: "Order",
        targetId: input.orderId,
        after: { disputeId: disputeRef.id, type: input.type },
        createdAt: now,
      });

      // 주문 doc 에 disputed 플래그 세팅
      try {
        await db
          .collection(COLLECTIONS.orders)
          .doc(input.orderId)
          .update({ disputed: true, updatedAt: now });
      } catch (err) {
        console.warn("[dispute.openOnBehalf] mark order.disputed failed", err);
      }

      return { ok: true, disputeId: disputeRef.id };
    }),

  /** 활동 history 단독 fetch (실시간 polling 용). */
  listActivity: adminProcedure
    .input(z.object({ disputeId: z.string() }))
    .query(async ({ input }): Promise<DisputeActivityDoc[]> => {
      const db = adminDb();
      const snap = await db
        .collection(SUB_COLLECTIONS.disputeActivity(input.disputeId))
        .orderBy("at", "asc")
        .limit(200)
        .get();
      return snap.docs.map((d) => {
        const data = d.data() as Omit<DisputeActivityDoc, "id">;
        return { id: d.id, ...data };
      });
    }),
});

export { DisputeStatusEnum, DisputeTypeEnum, ListStatusEnum };
export type { DisputeDoc, DisputeMessageDoc, DisputeActivityDoc };
