import { TRPCError } from "@trpc/server";
import { FieldValue, Timestamp, type Timestamp as TimestampType } from "firebase-admin/firestore";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// buyer/vendor 공용 분쟁 router
// 권한 가드는 procedure 내부에서 role 별로 분기.
// ─────────────────────────────────────────────────────────────

const BUYER_ROLES = ["BUYER_OWNER", "BUYER_STAFF", "BUYER_VIEWER"];
const VENDOR_ROLES = ["VENDOR_OWNER", "VENDOR_STAFF"];

const DisputeTypeEnum = z.enum([
  "REFUND",
  "RETURN",
  "NOT_DELIVERED",
  "QUALITY",
  "OTHER",
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
  openedAt?: TimestampType;
  deadlineAt?: TimestampType;
  resolvedAt?: TimestampType;
  createdAt?: TimestampType;
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

function isBuyer(ctx: { role?: string }) {
  return BUYER_ROLES.includes(ctx.role ?? "");
}
function isVendor(ctx: { role?: string }) {
  return VENDOR_ROLES.includes(ctx.role ?? "");
}

export const disputeRouter = createTRPCRouter({
  /**
   * 분쟁 신청 — buyer 만.
   */
  open: protectedProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
        subOrderId: z.string().optional(),
        type: DisputeTypeEnum,
        reason: z.string().min(1, "신청 사유를 입력해주세요").max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isBuyer(ctx)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "분쟁 신청은 구매 권한이 필요합니다.",
        });
      }
      const db = adminDb();
      const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
      const orderSnap = await orderRef.get();
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
        totalAmount?: number;
      };
      // Phase α-8 — hospitalId 격리 강화.
      // hospitalId 가 없는 buyer 는 분쟁 신청 불가. hospitalId 가 일치하지 않으면 거부.
      if (!ctx.hospitalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "병원 소속이 없습니다.",
        });
      }
      if (order.hospitalId !== ctx.hospitalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인 병원의 주문이 아닙니다.",
        });
      }

      // vendor 결정 — subOrderId 가 있으면 거기서, 없으면 첫 번째 vendorId
      let vendorId = "";
      let vendorName = "";
      let amount = order.totalAmount ?? 0;
      if (input.subOrderId) {
        const subRef = orderRef.collection("subOrders").doc(input.subOrderId);
        const subSnap = await subRef.get();
        if (subSnap.exists) {
          const sub = subSnap.data() as {
            vendorId?: string;
            vendorName?: string;
            total?: number;
          };
          vendorId = sub.vendorId ?? "";
          vendorName = sub.vendorName ?? "";
          amount = sub.total ?? amount;
        }
      } else {
        vendorId = order.vendorIds?.[0] ?? "";
        if (vendorId) {
          const vSnap = await db
            .collection(COLLECTIONS.vendors)
            .doc(vendorId)
            .get();
          vendorName = vSnap.exists
            ? ((vSnap.data() as { companyName?: string }).companyName ?? "")
            : "";
        }
      }

      const now = FieldValue.serverTimestamp();
      const openedAt = Timestamp.now();
      const deadlineAt = Timestamp.fromMillis(
        openedAt.toMillis() + 48 * 60 * 60 * 1000,
      );

      const disputeRef = db.collection(COLLECTIONS.disputes).doc();
      await disputeRef.set({
        orderId: input.orderId,
        subOrderId: input.subOrderId ?? null,
        hospitalId: order.hospitalId ?? "",
        hospitalName: order.hospitalName ?? "",
        vendorId,
        vendorName,
        type: input.type,
        amount,
        reason: input.reason,
        status: "OPEN",
        openedAt,
        deadlineAt,
        createdAt: now,
        updatedAt: now,
      });

      // 신청자 message (BUYER) + 시스템 OPENED message
      await disputeRef.collection("messages").add({
        authorRole: "BUYER",
        authorId: ctx.uid,
        authorName: order.hospitalName ?? "병원",
        body: input.reason,
        attachments: [],
        createdAt: now,
      });

      // order 에 disputed 플래그 + 갱신
      try {
        await orderRef.update({
          disputed: true,
          updatedAt: now,
        });
      } catch (err) {
        console.warn("[dispute.open] order disputed flag failed", err);
      }

      return { ok: true, disputeId: disputeRef.id };
    }),

  /**
   * 메시지 전송 — buyer/vendor 본인 분쟁에만.
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        disputeId: z.string(),
        body: z.string().min(1, "메시지를 입력해주세요").max(2000),
        attachments: z
          .array(
            z.object({
              name: z.string(),
              size: z.number(),
              url: z.string(),
              mime: z.string(),
            }),
          )
          .optional()
          .default([]),
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
      let authorRole: "BUYER" | "VENDOR";
      let authorName: string;
      // Phase α-8 — hospitalId/vendorId 격리 강화.
      // 소속 ID 가 없는 경우 거부. 소속 ID 가 일치하지 않는 경우 거부.
      if (isBuyer(ctx)) {
        if (!ctx.hospitalId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "병원 소속이 없습니다.",
          });
        }
        if (dispute.hospitalId !== ctx.hospitalId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "본인 병원의 분쟁이 아닙니다.",
          });
        }
        authorRole = "BUYER";
        authorName = dispute.hospitalName ?? "병원";
      } else if (isVendor(ctx)) {
        if (!ctx.vendorId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "공급업체 소속이 없습니다.",
          });
        }
        if (dispute.vendorId !== ctx.vendorId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "본인 공급업체의 분쟁이 아닙니다.",
          });
        }
        authorRole = "VENDOR";
        authorName = dispute.vendorName ?? "공급업체";
      } else {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "분쟁 메시지는 당사자만 작성할 수 있습니다.",
        });
      }

      if (dispute.status === "RESOLVED" || dispute.status === "REJECTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 종결된 분쟁입니다.",
        });
      }

      const now = FieldValue.serverTimestamp();
      await ref.collection("messages").add({
        authorRole,
        authorId: ctx.uid,
        authorName,
        body: input.body,
        attachments: input.attachments ?? [],
        createdAt: now,
      });

      // 상태 갱신 — buyer/vendor 메시지는 NEEDS_ADMIN_RESPONSE 로
      await ref.update({
        status: "NEEDS_ADMIN_RESPONSE",
        updatedAt: now,
      });

      await ref.collection("activity").add({
        at: now,
        actorId: ctx.uid,
        actorRole: authorRole,
        action: "MESSAGE_SENT",
        meta: { length: input.body.length },
      });

      return { ok: true };
    }),

  /**
   * 본인 분쟁 list — buyer 는 hospitalId, vendor 는 vendorId 기준.
   *
   * Phase α-8 — 소속 ID 없으면 빈 list 반환 (격리 강화 — 다른 조직 분쟁 절대 노출 금지).
   */
  listMine: protectedProcedure.query(async ({ ctx }): Promise<DisputeDoc[]> => {
    const db = adminDb();
    let query = db.collection(COLLECTIONS.disputes).orderBy("openedAt", "desc");
    if (isBuyer(ctx)) {
      if (!ctx.hospitalId) return [];
      query = query.where("hospitalId", "==", ctx.hospitalId) as typeof query;
    } else if (isVendor(ctx)) {
      if (!ctx.vendorId) return [];
      query = query.where("vendorId", "==", ctx.vendorId) as typeof query;
    } else {
      return [];
    }
    const snap = await query.limit(50).get();
    return snap.docs.map((d) => {
      const data = d.data() as Omit<DisputeDoc, "id">;
      return { id: d.id, ...data };
    });
  }),

  /**
   * 단건 fetch — 본인 분쟁만.
   */
  getById: protectedProcedure
    .input(z.object({ disputeId: z.string() }))
    .query(
      async ({
        ctx,
        input,
      }): Promise<{
        dispute: DisputeDoc | null;
        messages: DisputeMessageDoc[];
      }> => {
        const db = adminDb();
        const ref = db.collection(COLLECTIONS.disputes).doc(input.disputeId);
        const snap = await ref.get();
        if (!snap.exists) return { dispute: null, messages: [] };
        const data = snap.data() as Omit<DisputeDoc, "id">;
        const dispute: DisputeDoc = { id: snap.id, ...data };

        // Phase α-8 — hospitalId/vendorId 격리 강화.
        if (isBuyer(ctx)) {
          if (!ctx.hospitalId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "병원 소속이 없습니다.",
            });
          }
          if (dispute.hospitalId !== ctx.hospitalId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "본인 분쟁이 아닙니다.",
            });
          }
        } else if (isVendor(ctx)) {
          if (!ctx.vendorId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "공급업체 소속이 없습니다.",
            });
          }
          if (dispute.vendorId !== ctx.vendorId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "본인 분쟁이 아닙니다.",
            });
          }
        } else {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "분쟁 조회는 당사자만 가능합니다.",
          });
        }

        const msgSnap = await ref
          .collection("messages")
          .orderBy("createdAt", "asc")
          .limit(200)
          .get();
        const messages: DisputeMessageDoc[] = msgSnap.docs.map((d) => {
          const md = d.data() as Omit<DisputeMessageDoc, "id">;
          return { id: d.id, ...md };
        });

        return { dispute, messages };
      },
    ),
});
