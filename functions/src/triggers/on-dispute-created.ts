// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-dispute-created must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentCreated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {appendAuditLog} from "../lib/audit";

type DisputeDoc = {
  orderId?: string;
  hospitalId?: string;
  hospitalName?: string;
  vendorId?: string;
  vendorName?: string;
  type?: string;
  amount?: number;
  reason?: string;
  openedAt?: { seconds?: number };
  deadlineAt?: { seconds?: number };
};

const SLA_HOURS = 48;

/**
 * disputes/{disputeId} onCreate.
 *
 * - deadlineAt 누락 시 openedAt + 48h 로 설정
 * - 시스템 OPENED 메시지 (이미 있으면 skip — buyer message + system OPENED 분리)
 * - 활동 history "OPENED" 추가
 * - hospital / vendor / 운영자 알림 enqueue
 * - auditLog DISPUTE_OPENED
 */
export const onDisputeCreated = onDocumentCreated(
  {
    document: "disputes/{disputeId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const disputeId = event.params.disputeId;
    const data = event.data?.data() as DisputeDoc | undefined;
    if (!data) return;
    const ref = event.data?.ref;
    if (!ref) return;

    logger.info("[on-dispute-created] processing", {disputeId});

    // 1) deadlineAt 누락 시 보강
    if (!data.deadlineAt) {
      try {
        const openedSec = data.openedAt?.seconds ?? Math.floor(Date.now() / 1000);
        const deadlineMs = openedSec * 1000 + SLA_HOURS * 60 * 60 * 1000;
        await ref.update({
          deadlineAt: Timestamp.fromMillis(deadlineMs),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.warn("[on-dispute-created] deadlineAt patch failed", {
          disputeId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2) 시스템 OPENED 메시지 — activity 와 별개로 thread 표시용
    try {
      await ref.collection("messages").add({
        authorRole: "SYSTEM",
        authorId: "system",
        authorName: "분쟁 접수",
        body: "분쟁이 신청되었습니다. 48시간 내 처리 목표.",
        attachments: [],
        systemEvent: "OPENED",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[on-dispute-created] system message failed", {
        disputeId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 3) 활동 history
    try {
      await ref.collection("activity").add({
        at: FieldValue.serverTimestamp(),
        actorId: data.hospitalId ?? "system",
        actorRole: "BUYER",
        action: "OPENED",
        meta: {
          type: data.type ?? null,
          amount: data.amount ?? null,
        },
      });
    } catch (err) {
      logger.warn("[on-dispute-created] activity log failed", {
        disputeId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 4) hospital 알림
    if (data.hospitalId) {
      try {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "HOSPITAL",
          targetId: data.hospitalId,
          type: "DISPUTE_OPENED",
          title: "분쟁이 접수되었습니다",
          body: `분쟁 ${disputeId} 접수 완료. 48시간 내 처리됩니다.`,
          data: {disputeId, orderId: data.orderId ?? null},
          channels: ["IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.warn("[on-dispute-created] hospital notification failed", {
          disputeId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 5) vendor 알림
    if (data.vendorId) {
      try {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "VENDOR",
          targetId: data.vendorId,
          type: "DISPUTE_OPENED",
          title: "신규 분쟁이 접수되었습니다",
          body: `${data.hospitalName ?? "병원"}에서 분쟁을 신청했습니다. 빠른 응답 부탁드립니다.`,
          data: {disputeId, orderId: data.orderId ?? null},
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.warn("[on-dispute-created] vendor notification failed", {
          disputeId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 6) 운영자 모니터링 alert
    try {
      await db.collection("_systemAlerts").add({
        type: "DISPUTE_OPENED",
        severity: "INFO",
        title: "신규 분쟁이 접수되었습니다",
        message: `${data.hospitalName ?? "병원"} ↔ ${data.vendorName ?? "공급업체"} — ${
          data.amount ?? 0
        }원`,
        disputeId,
        orderId: data.orderId ?? null,
        acknowledged: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[on-dispute-created] systemAlerts push failed", {
        disputeId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 7) auditLog
    try {
      await appendAuditLog({
        actorId: data.hospitalId ?? "system",
        actorRole: "BUYER",
        action: "DISPUTE_OPENED",
        targetType: "Dispute",
        targetId: disputeId,
        after: {
          orderId: data.orderId ?? null,
          vendorId: data.vendorId ?? null,
          type: data.type ?? null,
          amount: data.amount ?? null,
        },
      });
    } catch (err) {
      logger.warn("[on-dispute-created] audit log failed", {
        disputeId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[on-dispute-created] completed", {disputeId});
  },
);
