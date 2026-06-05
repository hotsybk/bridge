// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/scheduled/coupon-expirer must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp, COLLECTIONS} from "../lib/firestore";

/**
 * 매일 KST 00:00 — 쿠폰 상태 자동 전환.
 *
 * 1) ACTIVE 이지만 expiresAt <= now → status: EXPIRED
 * 2) SCHEDULED 이지만 startsAt <= now → status: ACTIVE
 * 3) 각 batch 최대 500 docs (Firestore 한계)
 */
export const couponExpirer = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    const now = Timestamp.now();
    logger.info("[coupon-expirer] start", {nowMs: now.toMillis()});

    let expiredCount = 0;
    let activatedCount = 0;

    // 1) ACTIVE → EXPIRED
    try {
      const expiredSnap = await db
        .collection(COLLECTIONS.coupons)
        .where("status", "==", "ACTIVE")
        .where("expiresAt", "<=", now)
        .limit(500)
        .get();
      if (!expiredSnap.empty) {
        const batch = db.batch();
        for (const doc of expiredSnap.docs) {
          batch.update(doc.ref, {
            status: "EXPIRED",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
        expiredCount = expiredSnap.size;
      }
    } catch (err) {
      logger.error("[coupon-expirer] ACTIVE→EXPIRED failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 2) SCHEDULED → ACTIVE
    try {
      const activeSnap = await db
        .collection(COLLECTIONS.coupons)
        .where("status", "==", "SCHEDULED")
        .where("startsAt", "<=", now)
        .limit(500)
        .get();
      if (!activeSnap.empty) {
        const batch = db.batch();
        for (const doc of activeSnap.docs) {
          batch.update(doc.ref, {
            status: "ACTIVE",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
        activatedCount = activeSnap.size;
      }
    } catch (err) {
      logger.error("[coupon-expirer] SCHEDULED→ACTIVE failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 3) audit summary
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "COUPON_STATUS_AUTO_TRANSITION",
        targetType: "Coupon",
        targetId: "batch",
        after: {
          expired: expiredCount,
          activated: activatedCount,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[coupon-expirer] audit log failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[coupon-expirer] done", {expired: expiredCount, activated: activatedCount});
  },
);
