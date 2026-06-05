// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-notification-created must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentCreated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {sendAlimtalk} from "../lib/solapi";
// eslint-disable-next-line import/first
import {sendEmail} from "../lib/email";
// eslint-disable-next-line import/first
import {enqueueRetry} from "../lib/retry-queue";

type Channel = "KAKAO" | "EMAIL" | "IN_APP";

type NotificationDoc = {
  targetType?: "VENDOR" | "HOSPITAL" | "USER";
  targetId?: string;
  type?: string;
  title?: string;
  body?: string;
  channels?: Channel[];
  kakaoSent?: boolean;
  emailSent?: boolean;
  variables?: Record<string, string>;
};

type Recipient = {
  phone?: string;
  email?: string;
};

/**
 * targetType + targetId 로 수신자 정보 조회.
 * @param {NotificationDoc["targetType"]} targetType 대상 타입.
 * @param {string} targetId 대상 문서 ID.
 * @return {Promise<Recipient>} 수신자 전화/이메일.
 */
async function resolveRecipient(
  targetType: NotificationDoc["targetType"],
  targetId: string,
): Promise<Recipient> {
  if (!targetType || !targetId) return {};

  let collectionPath: string;
  switch (targetType) {
    case "VENDOR":
      collectionPath = COLLECTIONS.vendors;
      break;
    case "HOSPITAL":
      collectionPath = COLLECTIONS.hospitals;
      break;
    case "USER":
      collectionPath = COLLECTIONS.users;
      break;
    default:
      return {};
  }

  const snap = await db.collection(collectionPath).doc(targetId).get();
  if (!snap.exists) return {};
  const data = snap.data() ?? {};
  return {
    phone: typeof data.phone === "string" ? data.phone : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
  };
}

/**
 * notifications/{notificationId} 문서 생성 시 KAKAO / EMAIL 채널로 발송.
 * IN_APP 채널은 클라이언트 onSnapshot 으로 처리되므로 별도 작업 없음.
 *
 * 성공 시 doc 에 kakaoSent / emailSent / *Id / *At 필드 업데이트.
 * 실패 시 retryQueue 등록 + errorReason 기록.
 */
export const onNotificationCreated = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as NotificationDoc | undefined;
    if (!data) return;

    const channels = data.channels ?? [];
    if (channels.length === 0) {
      logger.info("[on-notification-created] no channels — skip", {
        id: event.params.notificationId,
      });
      return;
    }

    if (!data.targetType || !data.targetId || !data.type) {
      logger.warn("[on-notification-created] missing required fields — skip", {
        id: event.params.notificationId,
      });
      return;
    }

    const recipient = await resolveRecipient(data.targetType, data.targetId);

    const update: Record<string, unknown> = {};

    // ── KAKAO 채널 ──────────────────────────────────────────────
    if (channels.includes("KAKAO") && !data.kakaoSent) {
      if (!recipient.phone) {
        logger.warn("[on-notification-created] no phone for KAKAO", {
          targetType: data.targetType,
          targetId: data.targetId,
        });
        update.kakaoSent = false;
        update.errorReason = "recipient phone missing";
      } else {
        try {
          const result = await sendAlimtalk({
            template: data.type,
            to: recipient.phone,
            variables: data.variables ?? {},
          });
          update.kakaoSent = true;
          update.kakaoSentAt = FieldValue.serverTimestamp();
          update.kakaoMessageId = result.messageId;
          update.kakaoSource = result.source;
          logger.info("[on-notification-created] KAKAO sent", {
            id: event.params.notificationId,
            messageId: result.messageId,
            source: result.source,
          });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          logger.error("[on-notification-created] KAKAO failed", {
            id: event.params.notificationId,
            reason,
          });
          update.errorReason = reason;
          await enqueueRetry({
            type: "ALIMTALK",
            payload: {
              notificationId: event.params.notificationId,
              template: data.type,
              to: recipient.phone,
              variables: data.variables ?? {},
            },
            reason,
          });
        }
      }
    }

    // ── EMAIL 채널 ──────────────────────────────────────────────
    if (channels.includes("EMAIL") && !data.emailSent) {
      if (!recipient.email) {
        logger.warn("[on-notification-created] no email for EMAIL", {
          targetType: data.targetType,
          targetId: data.targetId,
        });
        update.emailSent = false;
        if (!update.errorReason) {
          update.errorReason = "recipient email missing";
        }
      } else {
        try {
          const result = await sendEmail({
            to: recipient.email,
            subject: data.title ?? "[MedPlace] 알림",
            html:
              `<div style="font-family: Pretendard, system-ui, sans-serif;` +
              ` line-height: 1.6; color: #111;">` +
              `<h2 style="margin: 0 0 16px;">${data.title ?? "알림"}</h2>` +
              `<p style="margin: 0;">${(data.body ?? "").replace(/\n/g, "<br>")}</p>` +
              `</div>`,
          });
          update.emailSent = true;
          update.emailSentAt = FieldValue.serverTimestamp();
          update.emailMessageId = result.messageId;
          update.emailSource = result.source;
          logger.info("[on-notification-created] EMAIL sent", {
            id: event.params.notificationId,
            messageId: result.messageId,
            source: result.source,
          });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          logger.error("[on-notification-created] EMAIL failed", {
            id: event.params.notificationId,
            reason,
          });
          if (!update.errorReason) update.errorReason = reason;
          await enqueueRetry({
            type: "EMAIL",
            payload: {
              notificationId: event.params.notificationId,
              to: recipient.email,
              subject: data.title ?? "[MedPlace] 알림",
              body: data.body ?? "",
            },
            reason,
          });
        }
      }
    }

    if (Object.keys(update).length > 0) {
      await snap.ref.update(update);
    }
  },
);
