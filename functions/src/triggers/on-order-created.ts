// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-order-created must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentCreated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {appendAuditLog} from "../lib/audit";

type OrderDoc = {
  hospitalId?: string;
  hospitalName?: string;
  orderNo?: string;
  totalAmount?: number;
  vendorIds?: string[];
};

/**
 * orders/{orderId} onCreate.
 *
 * - hospital 에 주문 접수 알림 enqueue
 * - subOrders 컬렉션의 각 vendor 에게 신규 주문 알림 enqueue
 * - auditLog ORDER_CREATED
 */
export const onOrderCreated = onDocumentCreated(
  {
    document: "orders/{orderId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const orderId = event.params.orderId;
    const order = event.data?.data() as OrderDoc | undefined;
    if (!order) return;

    logger.info("[on-order-created] processing", {orderId});

    // 1) hospital 알림
    if (order.hospitalId) {
      try {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "HOSPITAL",
          targetId: order.hospitalId,
          type: "ORDER_CREATED",
          title: "주문이 접수되었습니다",
          body: `주문 ${order.orderNo ?? orderId} 접수 — ${order.totalAmount ?? 0}원`,
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.warn("[on-order-created] hospital notification failed", {
          orderId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2) vendor 별 알림 — subOrders 서브컬렉션 조회
    try {
      const subSnap = await db
        .collection(`orders/${orderId}/subOrders`)
        .get();
      for (const subDoc of subSnap.docs) {
        const sub = subDoc.data() as {vendorId?: string; total?: number};
        if (!sub.vendorId) continue;
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "VENDOR",
          targetId: sub.vendorId,
          type: "ORDER_NEW",
          title: "신규 주문이 도착했습니다",
          body: `주문 ${order.orderNo ?? orderId} — ${sub.total ?? 0}원`,
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      logger.warn("[on-order-created] vendor notifications failed", {
        orderId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 3) hospital KPI denormalize (Wave J)
    //    /hospitals/{hospitalId}.kpi.{orderCount,orderAmount,lastOrderAt,lastActiveAt}
    if (order.hospitalId) {
      try {
        await db.collection("hospitals").doc(order.hospitalId).update({
          "kpi.orderCount": FieldValue.increment(1),
          "kpi.orderAmount": FieldValue.increment(order.totalAmount ?? 0),
          "kpi.lastOrderAt": FieldValue.serverTimestamp(),
          "kpi.lastActiveAt": FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.warn("[on-order-created] hospital KPI update failed", {
          orderId,
          hospitalId: order.hospitalId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 4) auditLog
    try {
      await appendAuditLog({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "ORDER_CREATED",
        targetType: "Order",
        targetId: orderId,
        after: {
          hospitalId: order.hospitalId ?? null,
          totalAmount: order.totalAmount ?? null,
          vendorCount: order.vendorIds?.length ?? 0,
        },
      });
    } catch (err) {
      logger.warn("[on-order-created] audit log failed", {
        orderId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[on-order-created] completed", {orderId});
  },
);
