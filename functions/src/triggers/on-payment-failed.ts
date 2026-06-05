// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-payment-failed must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue} from "../lib/firestore";
// eslint-disable-next-line import/first
import {appendAuditLog} from "../lib/audit";

type OrderDoc = {
  hospitalId?: string;
  orderNo?: string;
  totalAmount?: number;
  payment?: {
    status?: string;
    paymentId?: string;
    method?: string;
  };
};

/**
 * orders/{orderId} onUpdate.
 *
 * 조건: payment.status before != "FAILED" && after == "FAILED"
 *
 * - _systemAlerts 컬렉션에 alert push (운영자 모니터링 페이지 표시)
 * - auditLog PAYMENT_FAILED
 */
export const onPaymentFailed = onDocumentUpdated(
  {
    document: "orders/{orderId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const orderId = event.params.orderId;
    const before = event.data?.before?.data() as OrderDoc | undefined;
    const after = event.data?.after?.data() as OrderDoc | undefined;
    if (!after) return;

    const beforeStatus = before?.payment?.status ?? null;
    const afterStatus = after?.payment?.status ?? null;

    if (afterStatus !== "FAILED") return;
    if (beforeStatus === "FAILED") return;

    logger.info("[on-payment-failed] processing", {orderId});

    // 1) _systemAlerts push
    try {
      await db.collection("_systemAlerts").add({
        type: "PAYMENT_FAILED",
        severity: "WARNING",
        title: "결제 실패가 발생했습니다",
        message: `주문 ${after.orderNo ?? orderId} 결제 실패 — ${
          after.totalAmount ?? 0
        }원`,
        orderId,
        hospitalId: after.hospitalId ?? null,
        paymentId: after.payment?.paymentId ?? null,
        acknowledged: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[on-payment-failed] systemAlerts push failed", {
        orderId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 2) auditLog
    try {
      await appendAuditLog({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "PAYMENT_FAILED",
        targetType: "Order",
        targetId: orderId,
        before: {paymentStatus: beforeStatus},
        after: {
          paymentStatus: afterStatus,
          method: after.payment?.method ?? null,
        },
      });
    } catch (err) {
      logger.warn("[on-payment-failed] audit log failed", {
        orderId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[on-payment-failed] completed", {orderId});
  },
);
