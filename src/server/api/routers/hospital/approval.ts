// Phase ν-3 작업4 — 병원 결재 큐 (/account/approvals).
//
// 본인이 결재해야 할 주문 list + 처리 이력 + approve/reject.
//
// 데이터 모델 (orders/{orderId}):
//   approvalStatus: NOT_REQUIRED | PENDING | APPROVED | REJECTED
//   approvalChain: Array<{ level: number; userId: string }>  (생성 시 hospital.approvalChain 스냅샷)
//   approvalCurrentLevel: number   (다음 결재가 필요한 레벨)
//   approvalLog: Array<{ userId; action: APPROVED|REJECTED; at; reason? }>
//
// 권한:
//   - listPending: 본인 hospital 소속이면서 approvalChain 에 본인이 포함된 주문 + 현재 level == 본인 level
//   - approve/reject: chain 의 현재 결재자만 가능

import { TRPCError } from "@trpc/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { buyerProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

function ensureCtx(ctx: { hospitalId?: string; uid?: string }): {
  hospitalId: string;
  uid: string;
} {
  if (!ctx.hospitalId || !ctx.uid) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "병원 계정이 필요합니다.",
    });
  }
  return { hospitalId: ctx.hospitalId, uid: ctx.uid };
}

type ApprovalChainNode = { level: number; userId: string };
type ApprovalLogEntry = {
  userId: string;
  action: "APPROVED" | "REJECTED";
  at: Timestamp;
  reason?: string;
};

type ApprovalOrderDoc = {
  orderNo?: string;
  hospitalId?: string;
  hospitalName?: string;
  userId?: string;
  userName?: string;
  totalAmount?: number;
  finalAmount?: number;
  status?: string;
  approvalStatus?: string;
  approvalChain?: ApprovalChainNode[];
  approvalCurrentLevel?: number;
  approvalLog?: ApprovalLogEntry[];
  subOrderCount?: number;
  vendorIds?: string[];
  createdAt?: Timestamp;
};

function chainCurrentApprover(
  doc: ApprovalOrderDoc,
): { userId: string; level: number } | null {
  if (!Array.isArray(doc.approvalChain) || doc.approvalChain.length === 0)
    return null;
  const cur = doc.approvalCurrentLevel ?? doc.approvalChain[0].level;
  const node = doc.approvalChain.find((n) => n.level === cur);
  if (!node) return null;
  return { userId: node.userId, level: node.level };
}

export const hospitalApprovalRouter = createTRPCRouter({
  /**
   * 본인이 현재 결재해야 할 주문 list.
   * approvalStatus=PENDING + approvalChain 에 본인 + 현재 레벨이 본인.
   */
  listPending: buyerProcedure.query(async ({ ctx }) => {
    const { hospitalId, uid } = ensureCtx(ctx);
    const db = adminDb();

    const snap = await db
      .collection(COLLECTIONS.orders)
      .where("hospitalId", "==", hospitalId)
      .where("approvalStatus", "==", "PENDING")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const orders = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as ApprovalOrderDoc) }))
      .filter((o) => {
        const cur = chainCurrentApprover(o);
        return cur?.userId === uid;
      })
      .map((o) => ({
        id: o.id,
        orderNo: o.orderNo ?? "",
        applicantName: o.userName ?? "",
        applicantId: o.userId ?? "",
        finalAmount: o.finalAmount ?? o.totalAmount ?? 0,
        currentLevel: o.approvalCurrentLevel ?? 1,
        chainLength: (o.approvalChain ?? []).length,
        vendorCount: (o.vendorIds ?? []).length,
        createdAt: o.createdAt ?? null,
      }));

    return orders;
  }),

  /** 본인이 처리한 이력 (approvalLog 에 본인 uid). */
  listMyHistory: buyerProcedure
    .input(z.object({ pageSize: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const { hospitalId, uid } = ensureCtx(ctx);
      const db = adminDb();

      // approvalStatus IN [APPROVED, REJECTED] 로 필터하고 본인 처리 여부는 in-memory 검사
      const [approvedSnap, rejectedSnap] = await Promise.all([
        db
          .collection(COLLECTIONS.orders)
          .where("hospitalId", "==", hospitalId)
          .where("approvalStatus", "==", "APPROVED")
          .orderBy("createdAt", "desc")
          .limit(input.pageSize * 2)
          .get(),
        db
          .collection(COLLECTIONS.orders)
          .where("hospitalId", "==", hospitalId)
          .where("approvalStatus", "==", "REJECTED")
          .orderBy("createdAt", "desc")
          .limit(input.pageSize * 2)
          .get(),
      ]);

      const all = [...approvedSnap.docs, ...rejectedSnap.docs]
        .map((d) => ({ id: d.id, ...(d.data() as ApprovalOrderDoc) }))
        .filter((o) =>
          (o.approvalLog ?? []).some((entry) => entry.userId === uid),
        )
        .map((o) => ({
          id: o.id,
          orderNo: o.orderNo ?? "",
          applicantName: o.userName ?? "",
          finalAmount: o.finalAmount ?? o.totalAmount ?? 0,
          approvalStatus: o.approvalStatus ?? "PENDING",
          myAction:
            (o.approvalLog ?? []).find((e) => e.userId === uid)?.action ??
            "APPROVED",
          actedAt:
            (o.approvalLog ?? []).find((e) => e.userId === uid)?.at ?? null,
          createdAt: o.createdAt ?? null,
        }));

      const seen = new Set<string>();
      const unique = all.filter((o) => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      });
      unique.sort((a, b) => {
        const ax = (a.actedAt as Timestamp | null)?.toMillis?.() ?? 0;
        const bx = (b.actedAt as Timestamp | null)?.toMillis?.() ?? 0;
        return bx - ax;
      });
      return unique.slice(0, input.pageSize);
    }),

  /** 주문 상세 (결재자 view 용 — 본인이 결재해야 하거나 본인 hospital). */
  getDetail: buyerProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { hospitalId } = ensureCtx(ctx);
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as ApprovalOrderDoc;
      if (data.hospitalId !== hospitalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "다른 병원의 주문은 조회할 수 없습니다.",
        });
      }
      const subSnap = await snap.ref.collection("subOrders").get();
      const subOrders = subSnap.docs.map((s) => ({
        id: s.id,
        ...(s.data() as Record<string, unknown>),
      }));
      return { id: snap.id, ...data, subOrders };
    }),

  approve: buyerProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
        comment: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { hospitalId, uid } = ensureCtx(ctx);
      const db = adminDb();

      const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "주문을 찾을 수 없습니다.",
          });
        }
        const data = snap.data() as ApprovalOrderDoc;
        if (data.hospitalId !== hospitalId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "다른 병원의 주문은 처리할 수 없습니다.",
          });
        }
        if (data.approvalStatus !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이미 처리된 결재입니다.",
          });
        }
        const cur = chainCurrentApprover(data);
        if (!cur || cur.userId !== uid) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "현재 결재 단계의 결재자가 아닙니다.",
          });
        }

        const chain = data.approvalChain ?? [];
        const isLast = chain[chain.length - 1]?.level === cur.level;

        const now = Timestamp.now();
        const entry: ApprovalLogEntry = {
          userId: uid,
          action: "APPROVED",
          at: now,
          ...(input.comment ? { reason: input.comment } : {}),
        };

        if (isLast) {
          // 결재 완료 → approvalStatus APPROVED + status PENDING_APPROVAL → PENDING_PAYMENT
          //   (실 결제는 신청자가 다시 진입해서 처리)
          tx.update(orderRef, {
            approvalStatus: "APPROVED",
            status: "PENDING_PAYMENT",
            approvedAt: now,
            approvedById: uid,
            approvalLog: FieldValue.arrayUnion(entry),
            approvalCompletedAt: now,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return {
            applicantId: data.userId ?? null,
            isLast: true,
            orderNo: data.orderNo ?? "",
            nextApproverUserId: null as string | null,
          };
        } else {
          // 다음 결재자로 진행
          const sorted = [...chain].sort((a, b) => a.level - b.level);
          const idx = sorted.findIndex((n) => n.level === cur.level);
          const nextNode = sorted[idx + 1];
          tx.update(orderRef, {
            approvalCurrentLevel: nextNode.level,
            approvalLog: FieldValue.arrayUnion(entry),
            updatedAt: FieldValue.serverTimestamp(),
          });
          return {
            applicantId: data.userId ?? null,
            isLast: false,
            orderNo: data.orderNo ?? "",
            nextApproverUserId: nextNode.userId,
          };
        }
      });

      // 알림: 다음 결재자 또는 신청자
      const notifTime = FieldValue.serverTimestamp();
      try {
        if (result.isLast) {
          if (result.applicantId) {
            await db.collection(COLLECTIONS.notifications).add({
              targetType: "USER",
              targetId: result.applicantId,
              type: "ORDER_APPROVAL_COMPLETED",
              title: "결재가 완료되었습니다",
              body: `주문 ${result.orderNo} 의 결재가 완료되었습니다. 결제를 진행하세요.`,
              data: { orderId: input.orderId, orderNo: result.orderNo },
              channels: ["IN_APP", "KAKAO"],
              kakaoSent: false,
              emailSent: false,
              createdAt: notifTime,
            });
          }
        } else if (result.nextApproverUserId) {
          await db.collection(COLLECTIONS.notifications).add({
            targetType: "USER",
            targetId: result.nextApproverUserId,
            type: "ORDER_APPROVAL_PENDING",
            title: "결재 요청이 도착했습니다",
            body: `주문 ${result.orderNo} 의 결재가 필요합니다.`,
            data: { orderId: input.orderId, orderNo: result.orderNo },
            channels: ["IN_APP", "KAKAO"],
            kakaoSent: false,
            emailSent: false,
            createdAt: notifTime,
          });
        }
      } catch {
        // best-effort
      }

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "ORDER_APPROVED",
          targetType: "Order",
          targetId: input.orderId,
          after: {
            orderNo: result.orderNo,
            isLast: result.isLast,
            comment: input.comment ?? null,
          },
          createdAt: notifTime,
        });
      } catch {
        // best-effort
      }

      return { ok: true, isLast: result.isLast };
    }),

  reject: buyerProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { hospitalId, uid } = ensureCtx(ctx);
      const db = adminDb();

      const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "주문을 찾을 수 없습니다.",
          });
        const data = snap.data() as ApprovalOrderDoc;
        if (data.hospitalId !== hospitalId)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "다른 병원의 주문은 처리할 수 없습니다.",
          });
        if (data.approvalStatus !== "PENDING")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이미 처리된 결재입니다.",
          });
        const cur = chainCurrentApprover(data);
        if (!cur || cur.userId !== uid) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "현재 결재 단계의 결재자가 아닙니다.",
          });
        }

        const now = Timestamp.now();
        const entry: ApprovalLogEntry = {
          userId: uid,
          action: "REJECTED",
          at: now,
          reason: input.reason,
        };
        tx.update(orderRef, {
          approvalStatus: "REJECTED",
          status: "CANCELLED",
          cancelReason: `결재 반려: ${input.reason}`,
          cancelledAt: now,
          approvalLog: FieldValue.arrayUnion(entry),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return {
          applicantId: data.userId ?? null,
          orderNo: data.orderNo ?? "",
        };
      });

      const notifTime = FieldValue.serverTimestamp();
      try {
        if (result.applicantId) {
          await db.collection(COLLECTIONS.notifications).add({
            targetType: "USER",
            targetId: result.applicantId,
            type: "ORDER_APPROVAL_REJECTED",
            title: "결재가 반려되었습니다",
            body: `주문 ${result.orderNo} 의 결재가 반려되었습니다.\n사유: ${input.reason}`,
            data: {
              orderId: input.orderId,
              orderNo: result.orderNo,
              reason: input.reason,
            },
            channels: ["IN_APP", "KAKAO"],
            kakaoSent: false,
            emailSent: false,
            createdAt: notifTime,
          });
        }
      } catch {
        // best-effort
      }

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "ORDER_REJECTED",
          targetType: "Order",
          targetId: input.orderId,
          after: { orderNo: result.orderNo, reason: input.reason },
          createdAt: notifTime,
        });
      } catch {
        // best-effort
      }
      return { ok: true };
    }),
});
