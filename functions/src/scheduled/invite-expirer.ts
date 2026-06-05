// Phase ν-3 작업6 — 만료 invite 정리 (매일 04:00 KST).
//
// vendors/*/invites + hospitals/*/invites collectionGroup 스캔.
// status=PENDING + expiresAt <= now → status: EXPIRED.

// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/scheduled/invite-expirer must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp, COLLECTIONS} from "../lib/firestore";

export const inviteExpirer = onSchedule(
  {
    schedule: "0 4 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    const now = Timestamp.now();
    logger.info("[invite-expirer] start", {nowMs: now.toMillis()});

    let expiredCount = 0;

    try {
      const snap = await db
        .collectionGroup("invites")
        .where("status", "==", "PENDING")
        .where("expiresAt", "<=", now)
        .limit(500)
        .get();

      if (!snap.empty) {
        const batch = db.batch();
        for (const doc of snap.docs) {
          batch.update(doc.ref, {
            status: "EXPIRED",
            expiredAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
        expiredCount = snap.size;
      }
    } catch (err) {
      logger.error("[invite-expirer] scan/expire failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 감사 로그
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "INVITE_EXPIRED_BATCH",
        targetType: "Invite",
        targetId: "batch",
        after: {expired: expiredCount},
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[invite-expirer] audit log failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[invite-expirer] done", {expired: expiredCount});
  },
);
