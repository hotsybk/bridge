// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-coupon-redeemed must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentCreated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {appendAuditLog} from "../lib/audit";

type CouponDoc = {
  usedCount?: number;
  issueLimit?: number | null;
  status?: string;
};

/**
 * coupons/{couponId}/redemptions/{redemptionId} onCreate.
 *
 * - 트랜잭션으로 usedCount + 1
 * - issueLimit 도달 시 status: EXPIRED 자동 전환
 * - auditLog COUPON_REDEEMED
 */
export const onCouponRedeemed = onDocumentCreated(
  {
    document: "coupons/{couponId}/redemptions/{redemptionId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const couponId = event.params.couponId;
    const redemptionId = event.params.redemptionId;
    logger.info("[on-coupon-redeemed] processing", {couponId, redemptionId});

    const couponRef = db.collection(COLLECTIONS.coupons).doc(couponId);

    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(couponRef);
        if (!snap.exists) return;
        const c = snap.data() as CouponDoc | undefined;
        if (!c) return;

        const newUsedCount = (c.usedCount ?? 0) + 1;
        const updates: Record<string, unknown> = {
          usedCount: newUsedCount,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (c.issueLimit && newUsedCount >= c.issueLimit) {
          updates.status = "EXPIRED";
        }
        tx.update(couponRef, updates);
      });
    } catch (err) {
      logger.error("[on-coupon-redeemed] usedCount increment failed", {
        couponId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      await appendAuditLog({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "COUPON_REDEEMED",
        targetType: "Coupon",
        targetId: couponId,
        after: {redemptionId},
      });
    } catch (err) {
      logger.warn("[on-coupon-redeemed] audit log failed", {
        couponId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[on-coupon-redeemed] completed", {couponId});
  },
);
