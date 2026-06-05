// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-dispute-resolved must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";

type DisputeDoc = {
  orderId?: string;
  hospitalId?: string;
  vendorId?: string;
  status?: string;
  resolution?: {
    refundAmount?: number;
    type?: string;
  };
};

/**
 * disputes/{disputeId} onUpdate.
 *
 * before.status != RESOLVED && after.status == RESOLVED 인 경우 트리거.
 *
 * 후속 cleanup:
 * - order.disputed 플래그 해제 (다른 활성 분쟁이 없는 경우)
 * - 시스템 alert 종결 표시 (acknowledged: true)
 *
 * 환불 처리 자체는 router 의 resolve mutation 에서 PortOne 호출 완료.
 * 본 trigger 는 정합성 정리만 담당.
 */
export const onDisputeResolved = onDocumentUpdated(
  {
    document: "disputes/{disputeId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const disputeId = event.params.disputeId;
    const before = event.data?.before?.data() as DisputeDoc | undefined;
    const after = event.data?.after?.data() as DisputeDoc | undefined;
    if (!after) return;

    const beforeStatus = before?.status ?? null;
    const afterStatus = after?.status ?? null;

    // RESOLVED 또는 REJECTED 진입 이벤트만 처리
    const isResolution =
      (afterStatus === "RESOLVED" || afterStatus === "REJECTED") &&
      beforeStatus !== "RESOLVED" &&
      beforeStatus !== "REJECTED";
    if (!isResolution) return;

    logger.info("[on-dispute-resolved] processing", {disputeId, afterStatus});

    // 1) order.disputed 플래그 정리 — 같은 order 의 다른 활성 분쟁 확인
    if (after.orderId) {
      try {
        const activeSnap = await db
          .collection(COLLECTIONS.disputes)
          .where("orderId", "==", after.orderId)
          .where("status", "in", [
            "OPEN",
            "IN_PROGRESS",
            "NEEDS_ADMIN_RESPONSE",
          ])
          .limit(2)
          .get();
        // 자기 자신을 제외하고 0건이면 disputed 해제
        const others = activeSnap.docs.filter((d) => d.id !== disputeId);
        if (others.length === 0) {
          await db
            .collection(COLLECTIONS.orders)
            .doc(after.orderId)
            .update({
              disputed: false,
              updatedAt: FieldValue.serverTimestamp(),
            });
        }
      } catch (err) {
        logger.warn("[on-dispute-resolved] order.disputed cleanup failed", {
          disputeId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2) 관련 _systemAlerts ack
    try {
      const alertSnap = await db
        .collection("_systemAlerts")
        .where("disputeId", "==", disputeId)
        .where("acknowledged", "==", false)
        .limit(20)
        .get();
      for (const ad of alertSnap.docs) {
        await ad.ref.update({
          acknowledged: true,
          acknowledgedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      logger.warn("[on-dispute-resolved] alerts ack failed", {
        disputeId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[on-dispute-resolved] completed", {disputeId});
  },
);
