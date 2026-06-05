// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-dispute-message-created must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentCreated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";

type MessageDoc = {
  authorRole?: string;
  authorId?: string;
  authorName?: string;
  body?: string;
  systemEvent?: string;
};

type DisputeDoc = {
  hospitalId?: string;
  vendorId?: string;
  hospitalName?: string;
  vendorName?: string;
};

/**
 * disputes/{disputeId}/messages/{messageId} onCreate.
 *
 * - BUYER/VENDOR 메시지 → 운영자 모니터링 alert (NEEDS_ADMIN_RESPONSE 인지)
 * - ADMIN 메시지 → 양측에 알림
 * - SYSTEM 메시지 → 추가 알림 없음 (트리거 발생자가 이미 처리)
 */
export const onDisputeMessageCreated = onDocumentCreated(
  {
    document: "disputes/{disputeId}/messages/{messageId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const {disputeId, messageId} = event.params;
    const msg = event.data?.data() as MessageDoc | undefined;
    if (!msg) return;

    const role = msg.authorRole ?? "";
    if (role === "SYSTEM") return; // 시스템 메시지는 router 에서 알림 직접 처리

    // 분쟁 doc fetch
    const disputeRef = db.collection(COLLECTIONS.disputes).doc(disputeId);
    const disputeSnap = await disputeRef.get();
    if (!disputeSnap.exists) return;
    const dispute = disputeSnap.data() as DisputeDoc;

    logger.info("[on-dispute-message-created] processing", {disputeId, messageId, role});

    if (role === "BUYER" || role === "VENDOR") {
      // 운영자 모니터링 alert
      try {
        await db.collection("_systemAlerts").add({
          type: "DISPUTE_NEEDS_ADMIN",
          severity: "INFO",
          title: "분쟁에 새 메시지가 도착했습니다",
          message: `${msg.authorName ?? role} — ${
            (msg.body ?? "").slice(0, 80)
          }`,
          disputeId,
          acknowledged: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.warn("[on-dispute-message-created] systemAlerts push failed", {
          disputeId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (role === "ADMIN") {
      // 양측 in-app 알림
      const targets = [
        {type: "HOSPITAL" as const, id: dispute.hospitalId},
        {type: "VENDOR" as const, id: dispute.vendorId},
      ];
      for (const t of targets) {
        if (!t.id) continue;
        try {
          await db.collection(COLLECTIONS.notifications).add({
            targetType: t.type,
            targetId: t.id,
            type: "DISPUTE_MESSAGE",
            title: "분쟁에 운영자 메시지가 도착했습니다",
            body: (msg.body ?? "").slice(0, 200),
            data: {disputeId},
            channels: ["IN_APP"],
            kakaoSent: false,
            emailSent: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (err) {
          logger.warn("[on-dispute-message-created] notification failed", {
            disputeId,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    logger.info("[on-dispute-message-created] completed", {disputeId, messageId});
  },
);
