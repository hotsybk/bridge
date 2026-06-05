// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error(
    "functions/scheduled/scheduled-notification-sender must be used only on the server side.",
  );
}

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {sendAlimtalk} from "../lib/solapi";

type TargetType = "VENDOR" | "HOSPITAL" | "USER";

type ScheduledNotificationDoc = {
  targetType?: TargetType;
  targetId?: string;
  type?: string;
  title?: string;
  body?: string;
  variables?: Record<string, string>;
  channels?: string[];
};

/**
 * targetType + targetId 로 수신자 phone 조회.
 */
async function resolveRecipientPhone(
  targetType: TargetType | undefined,
  targetId: string | undefined,
): Promise<string | null> {
  if (!targetType || !targetId) return null;

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
    return null;
  }

  const snap = await db.collection(collectionPath).doc(targetId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return typeof data.phone === "string" ? data.phone : null;
}

/**
 * 매분 — scheduledAt 도달한 미발송 notifications 처리.
 *
 * 쿼리: notifications where kakaoSent=false AND scheduledAt<=now LIMIT 50
 *
 * 동작:
 *  1) 대상 doc 50개 fetch
 *  2) 각 doc 마다 phone 조회 → sendAlimtalk 호출
 *  3) 성공 시 kakaoSent=true, kakaoMessageId, kakaoSentAt 갱신 + scheduledAt=null
 *  4) 실패 시 errorReason 기록 + scheduledAt=null (재시도는 admin retry 흐름)
 *
 * IN_APP 단독 채널은 onNotificationCreated 트리거에서 이미 처리됨 → 이 cron 은 KAKAO 채널 전용.
 */
export const scheduledNotificationSender = onSchedule(
  {
    schedule: "* * * * *", // 매분
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    const now = Timestamp.now();
    logger.info("[scheduled-notification-sender] start", {
      nowMs: now.toMillis(),
    });

    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await db
        .collection(COLLECTIONS.notifications)
        .where("kakaoSent", "==", false)
        .where("scheduledAt", "<=", now)
        .limit(50)
        .get();
    } catch (err) {
      logger.error("[scheduled-notification-sender] query failed", {
        err: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (snap.empty) {
      logger.info("[scheduled-notification-sender] no pending — done");
      return;
    }

    let sent = 0;
    let failed = 0;

    for (const doc of snap.docs) {
      const data = doc.data() as ScheduledNotificationDoc;

      // KAKAO 채널이 없으면 scheduledAt 만 클리어 (스킵 마킹)
      const channels = Array.isArray(data.channels) ? data.channels : [];
      if (!channels.includes("KAKAO")) {
        try {
          await doc.ref.update({
            scheduledAt: null,
            scheduleProcessedAt: FieldValue.serverTimestamp(),
            kakaoSent: true, // KAKAO 미사용 → 처리 완료 마킹
          });
        } catch (err) {
          logger.warn("[scheduled-notification-sender] non-kakaa clear failed", {
            id: doc.id,
            err: err instanceof Error ? err.message : String(err),
          });
        }
        continue;
      }

      if (!data.type) {
        await doc.ref.update({
          scheduledAt: null,
          errorReason: "missing template type",
          scheduleProcessedAt: FieldValue.serverTimestamp(),
        });
        failed++;
        continue;
      }

      const phone = await resolveRecipientPhone(data.targetType, data.targetId);
      if (!phone) {
        await doc.ref.update({
          scheduledAt: null,
          errorReason: "recipient phone missing",
          scheduleProcessedAt: FieldValue.serverTimestamp(),
        });
        failed++;
        continue;
      }

      try {
        const result = await sendAlimtalk({
          template: data.type,
          to: phone,
          variables: data.variables ?? {},
        });
        await doc.ref.update({
          kakaoSent: true,
          kakaoSentAt: FieldValue.serverTimestamp(),
          kakaoMessageId: result.messageId,
          kakaoSource: result.source,
          scheduledAt: null,
          scheduleProcessedAt: FieldValue.serverTimestamp(),
          errorReason: null,
        });
        sent++;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logger.error("[scheduled-notification-sender] send failed", {
          id: doc.id,
          reason,
        });
        await doc.ref.update({
          errorReason: reason,
          scheduledAt: null,
          scheduleProcessedAt: FieldValue.serverTimestamp(),
        });
        failed++;
      }
    }

    // audit summary
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "SCHEDULED_NOTIFICATION_RUN",
        targetType: "Notification",
        targetId: "batch",
        after: {
          scanned: snap.size,
          sent,
          failed,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[scheduled-notification-sender] audit log failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[scheduled-notification-sender] done", {
      scanned: snap.size,
      sent,
      failed,
    });
  },
);
