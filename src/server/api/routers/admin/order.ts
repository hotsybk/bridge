import { TRPCError } from "@trpc/server";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS, SUB_COLLECTIONS } from "@/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────────────────────

export type OrderMemo = {
  id: string;
  actorId: string;
  body: string;
  createdAt: Timestamp | null;
};

/**
 * UI 표시용 통합 status — orders.status 와 payment.status 를
 * 한 줄로 표시하기 위한 상태 enum.
 */
const OrderListStatusEnum = z.enum([
  "ALL",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "FAILED",
  "DISPUTED",
  "REFUNDING",
  "REFUNDED",
  "CANCELLED",
]);

type OrderListStatus = z.infer<typeof OrderListStatusEnum>;

type OrderDoc = {
  id: string;
  orderNo?: string;
  hospitalId?: string;
  hospitalName?: string;
  vendorIds?: string[];
  subOrderCount?: number;
  totalAmount?: number;
  status?: string;
  payment?: {
    status?: string;
    method?: string;
    paymentId?: string;
    paidAt?: Timestamp;
    events?: Array<{ type: string; at: unknown; raw?: unknown }>;
  };
  paymentMethod?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  shippingZipcode?: string;
  shippingAddress?: string;
  shippingAddressDetail?: string;
  shippingRecipient?: string;
  shippingPhone?: string;
  invoiceRequested?: boolean;
  invoiceEmail?: string;
  // dispute / 분쟁 카운트 — Wave E 에서 정식 보강
  disputed?: boolean;
};

type SubOrderDoc = {
  id: string;
  vendorId?: string;
  vendorName?: string;
  status?: string;
  trackingNo?: string;
  trackingCarrier?: string;
  subtotal?: number;
  total?: number;
};

// ─────────────────────────────────────────────────────────────
// helper — list filter 와 segment tab 매칭 로직
// ─────────────────────────────────────────────────────────────

function matchesStatus(doc: OrderDoc, status: OrderListStatus): boolean {
  if (status === "ALL") return true;
  const orderStatus = doc.status ?? "";
  const payStatus = doc.payment?.status ?? "";

  switch (status) {
    case "PAID":
      return orderStatus === "PAID";
    case "PREPARING":
      return ["PAID", "PENDING_APPROVAL"].includes(orderStatus);
    case "SHIPPED":
      return ["SHIPPED", "PARTIALLY_SHIPPED"].includes(orderStatus);
    case "DELIVERED":
      return orderStatus === "COMPLETED";
    case "FAILED":
      return payStatus === "FAILED" || orderStatus === "PENDING_PAYMENT";
    case "DISPUTED":
      return !!doc.disputed;
    case "REFUNDING":
      return orderStatus === "REFUND_REQUESTED";
    case "REFUNDED":
      return orderStatus === "REFUNDED";
    case "CANCELLED":
      return orderStatus === "CANCELLED";
    default:
      return true;
  }
}

// ─────────────────────────────────────────────────────────────
// router
// ─────────────────────────────────────────────────────────────

export const adminOrderRouter = createTRPCRouter({
  /**
   * 주문 list — segment tab + 검색 + cursor.
   *
   * Phase 2 단순화: 최대 200건 in-memory filter.
   * Phase 3+: composite index + Firestore where 로 전환.
   */
  list: adminProcedure
    .input(
      z.object({
        status: OrderListStatusEnum.optional().default("ALL"),
        vendorId: z.string().optional(),
        hospitalId: z.string().optional(),
        search: z.string().optional(),
        pageSize: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{ orders: OrderDoc[]; hasMore: boolean; nextCursor?: string }> => {
        const db = adminDb();
        const snap = await db
          .collection(COLLECTIONS.orders)
          .orderBy("createdAt", "desc")
          .limit(200)
          .get();
        let items = snap.docs.map((d) => {
          const data = d.data() as Omit<OrderDoc, "id">;
          return { id: d.id, ...data } as OrderDoc;
        });

        // status filter
        items = items.filter((o) => matchesStatus(o, input.status));

        if (input.vendorId) {
          items = items.filter((o) => o.vendorIds?.includes(input.vendorId!));
        }
        if (input.hospitalId) {
          items = items.filter((o) => o.hospitalId === input.hospitalId);
        }
        if (input.search) {
          const q = input.search.toLowerCase();
          items = items.filter((o) =>
            [o.id, o.orderNo, o.hospitalName]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q),
          );
        }

        // cursor 페이지네이션 (단순 — id 기준 next)
        let start = 0;
        if (input.cursor) {
          const idx = items.findIndex((o) => o.id === input.cursor);
          if (idx >= 0) start = idx + 1;
        }
        const page = items.slice(start, start + input.pageSize + 1);
        const hasMore = page.length > input.pageSize;
        const orders = hasMore ? page.slice(0, -1) : page;
        const nextCursor = hasMore ? orders[orders.length - 1]?.id : undefined;
        return { orders, hasMore, nextCursor };
      },
    ),

  /**
   * KPI 4개 — 오늘 주문 / 결제 성공률 / 미배송 / 분쟁률.
   * Phase 2 단순화: 200건 sample 기반.
   */
  counts: adminProcedure.query(async () => {
    const db = adminDb();
    const snap = await db
      .collection(COLLECTIONS.orders)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    const items = snap.docs.map((d) => d.data() as OrderDoc);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime() / 1000;

    const todayOrders = items.filter(
      (o) => ((o.createdAt as unknown as { seconds?: number })?.seconds ?? 0) >= todayTs,
    );
    const paidToday = todayOrders.filter((o) => o.payment?.status === "PAID").length;
    const failedToday = todayOrders.filter((o) => o.payment?.status === "FAILED").length;
    const successDenom = paidToday + failedToday;
    const paymentSuccessRate =
      successDenom > 0 ? Math.round((paidToday / successDenom) * 1000) / 10 : 100;

    const undeliveredCount = items.filter((o) =>
      ["PAID", "PARTIALLY_SHIPPED", "PENDING_APPROVAL"].includes(o.status ?? ""),
    ).length;

    const last7Cutoff = Date.now() / 1000 - 7 * 86400;
    const last7 = items.filter(
      (o) => ((o.createdAt as unknown as { seconds?: number })?.seconds ?? 0) >= last7Cutoff,
    );
    const disputedLast7 = last7.filter((o) => o.disputed).length;
    const disputeRate =
      last7.length > 0
        ? Math.round((disputedLast7 / last7.length) * 1000) / 10
        : 0;

    return {
      todayCount: todayOrders.length,
      paymentSuccessRate,
      undeliveredCount,
      disputeRate,
    };
  }),

  /**
   * Tab counts — segment tab(ALL/FAILED/PREPARING/DISPUTED/REFUNDING) 별 카운트.
   * Phase γ-1 추가. 단일 호출로 모든 tab 카운트 → 페이지 N+1 호출 제거.
   * Firestore aggregation count() 사용.
   */
  tabCounts: adminProcedure.query(async () => {
    const db = adminDb();
    const col = db.collection(COLLECTIONS.orders);

    // FAILED: payment.status == "FAILED" OR status == "PENDING_PAYMENT"
    // PREPARING: status in ("PAID","PENDING_APPROVAL")
    // DISPUTED: disputed == true
    // REFUNDING: status == "REFUND_REQUESTED"
    const [
      allSnap,
      failedPay,
      pendPayStatus,
      paidStatus,
      pendApp,
      disputedSnap,
      refundReqSnap,
    ] = await Promise.all([
      col.count().get(),
      col.where("payment.status", "==", "FAILED").count().get(),
      col.where("status", "==", "PENDING_PAYMENT").count().get(),
      col.where("status", "==", "PAID").count().get(),
      col.where("status", "==", "PENDING_APPROVAL").count().get(),
      col.where("disputed", "==", true).count().get(),
      col.where("status", "==", "REFUND_REQUESTED").count().get(),
    ]);

    // FAILED 와 PENDING_PAYMENT 는 중첩 가능성 — 단순 합산 후 deduplicate 어렵기에 합산.
    // 운영자가 실제 list 클릭 시 정확한 결과 받으므로 카운트는 근사값으로 충분.
    return {
      ALL: allSnap.data().count,
      FAILED: failedPay.data().count + pendPayStatus.data().count,
      PREPARING: paidStatus.data().count + pendApp.data().count,
      DISPUTED: disputedSnap.data().count,
      REFUNDING: refundReqSnap.data().count,
    };
  }),

  /**
   * 단건 + 서브 SubOrders 동시 반환.
   */
  getById: adminProcedure
    .input(z.object({ orderId: z.string() }))
    .query(
      async ({
        input,
      }): Promise<{ order: OrderDoc | null; subOrders: SubOrderDoc[] }> => {
        const db = adminDb();
        const ref = db.collection(COLLECTIONS.orders).doc(input.orderId);
        const snap = await ref.get();
        if (!snap.exists) return { order: null, subOrders: [] };
        const data = snap.data() as Omit<OrderDoc, "id">;
        const order: OrderDoc = { id: snap.id, ...data };

        const subSnap = await ref.collection("subOrders").get();
        const subOrders: SubOrderDoc[] = subSnap.docs.map((d) => {
          const sd = d.data() as Omit<SubOrderDoc, "id">;
          return { id: d.id, ...sd };
        });
        return { order, subOrders };
      },
    ),

  /**
   * 강제 환불 — PortOne cancel 호출 + Firestore 상태 전환 + 알림 + audit.
   * adjustPayout 가 true 면 vendor 정산 보류 entry 도 추가 (Wave E 에서 풀 구현).
   */
  forceRefund: adminProcedure
    .input(
      z.object({
        orderId: z.string(),
        amount: z.number().positive().optional(),
        reason: z.string().min(1, "환불 사유를 입력해주세요").max(500),
        adjustPayout: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.orders).doc(input.orderId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "주문을 찾을 수 없습니다.",
        });
      }
      const order = snap.data() as OrderDoc;
      const paymentId =
        order.payment?.paymentId ??
        (order as unknown as { paymentKey?: string }).paymentKey;
      if (!paymentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "결제 정보가 없는 주문입니다.",
        });
      }

      // PortOne 호출 (env 미설정 시 mock)
      const { cancelPayment } = await import("@/server/services/portone");
      const result = await cancelPayment({
        paymentId,
        reason: input.reason,
        amount: input.amount,
      });

      const now = FieldValue.serverTimestamp();

      // Firestore: order 상태 전환 + event arrayUnion
      await ref.update({
        "payment.status": "CANCELLED",
        "payment.events": FieldValue.arrayUnion({
          type: "Admin.ForceRefund",
          at: new Date(),
          actorId: ctx.uid,
          amount: input.amount ?? null,
          reason: input.reason,
          result,
        }),
        status: "REFUNDED",
        updatedAt: now,
      });

      // 정산 보류 entry (옵션) — settlements 컬렉션에 hold entry 추가
      if (input.adjustPayout && order.vendorIds?.length) {
        for (const vendorId of order.vendorIds) {
          try {
            await db.collection(COLLECTIONS.settlements).add({
              vendorId,
              orderId: input.orderId,
              status: "HOLD",
              reason: "ADMIN_FORCE_REFUND",
              amount: 0,
              createdAt: now,
            });
          } catch (err) {
            console.warn("[forceRefund] settlement hold failed", { vendorId, err });
          }
        }
      }

      // auditLogs
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "ORDER_FORCE_REFUND",
        targetType: "Order",
        targetId: input.orderId,
        after: {
          amount: input.amount ?? null,
          reason: input.reason,
          portoneResult: result,
        },
        createdAt: now,
      });

      // 알림 — hospital + vendor 양측 (notifications 컬렉션에 enqueue)
      if (order.hospitalId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "HOSPITAL",
          targetId: order.hospitalId,
          type: "ORDER_REFUNDED",
          title: "주문이 환불되었습니다",
          body: input.reason,
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: now,
        });
      }
      if (order.vendorIds?.length) {
        for (const vendorId of order.vendorIds) {
          await db.collection(COLLECTIONS.notifications).add({
            targetType: "VENDOR",
            targetId: vendorId,
            type: "ORDER_REFUNDED",
            title: "주문이 환불되었습니다",
            body: input.reason,
            channels: ["KAKAO", "IN_APP"],
            kakaoSent: false,
            emailSent: false,
            createdAt: now,
          });
        }
      }

      return { ok: true, refundResult: result };
    }),

  /**
   * 결제 재시도 트리거 — Phase 3+ 구현 예정. 현재는 stub 으로 audit 만.
   */
  retryPayment: adminProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const now = FieldValue.serverTimestamp();
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "ORDER_RETRY_PAYMENT_REQUESTED",
        targetType: "Order",
        targetId: input.orderId,
        createdAt: now,
      });
      return {
        ok: true,
        message: "결제 재시도 요청이 기록되었습니다 (Phase 3+ 정식 트리거 예정).",
      };
    }),

  /**
   * SubOrder 상태 변경 (운영자 강제) — 잘못된 상태 복구용.
   */
  updateSubOrderStatus: adminProcedure
    .input(
      z.object({
        orderId: z.string(),
        subOrderId: z.string(),
        newStatus: z.enum([
          "ACCEPTED",
          "PACKING",
          "SHIPPED",
          "DELIVERED",
          "CANCELLED",
          "RETURN_REQUESTED",
          "RETURNED",
        ]),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(SUB_COLLECTIONS.subOrders(input.orderId))
        .doc(input.subOrderId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "SubOrder 를 찾을 수 없습니다.",
        });
      }
      const before = snap.data() as SubOrderDoc;
      const now = FieldValue.serverTimestamp();
      await ref.update({
        status: input.newStatus,
        updatedAt: now,
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "SUBORDER_STATUS_OVERRIDE",
        targetType: "SubOrder",
        targetId: input.subOrderId,
        before: { status: before.status ?? null },
        after: { status: input.newStatus, note: input.note ?? null },
        createdAt: now,
      });
      return { ok: true };
    }),

  /** 운영자 메모 목록 — orders/{id}/memos 서브컬렉션. */
  listMemos: adminProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ input }): Promise<OrderMemo[]> => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .collection("memos")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      return snap.docs.map((d) => {
        const data = d.data() as Omit<OrderMemo, "id">;
        return { id: d.id, ...data };
      });
    }),

  /** 운영자 메모 추가. */
  addMemo: adminProcedure
    .input(
      z.object({
        orderId: z.string(),
        body: z.string().min(1, "메모 내용을 입력해주세요").max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const now = FieldValue.serverTimestamp();
      const ref = db.collection(COLLECTIONS.orders).doc(input.orderId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "주문을 찾을 수 없습니다.",
        });
      }
      await ref.collection("memos").add({
        actorId: ctx.uid,
        body: input.body,
        createdAt: now,
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "ORDER_MEMO_ADDED",
        targetType: "Order",
        targetId: input.orderId,
        createdAt: now,
      });
      return { ok: true };
    }),
});

// ─────────────────────────────────────────────────────────────
// re-export for UI typing
// ─────────────────────────────────────────────────────────────

export type AdminOrderListItem = OrderDoc;
export type AdminSubOrderItem = SubOrderDoc;
