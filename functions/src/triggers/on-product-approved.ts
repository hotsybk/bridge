// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-product-approved must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {appendAuditLog} from "../lib/audit";

type ProductDoc = {
  vendorId?: string;
  moderation?: { status?: string };
};

/**
 * products/{productId} onUpdate.
 *
 * 조건: moderation.status before != "ACTIVE" && after == "ACTIVE"
 *
 * - vendors/{vendorId}.productCount += 1
 * - auditLog PRODUCT_ACTIVATED 기록
 * - TODO(Phase 2.5): Algolia 인덱싱
 */
export const onProductApproved = onDocumentUpdated(
  {
    document: "products/{productId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const productId = event.params.productId;
    const before = event.data?.before?.data() as ProductDoc | undefined;
    const after = event.data?.after?.data() as ProductDoc | undefined;
    if (!after) return;

    const beforeStatus = before?.moderation?.status ?? null;
    const afterStatus = after?.moderation?.status ?? null;

    if (afterStatus !== "ACTIVE") return;
    if (beforeStatus === "ACTIVE") return;

    logger.info("[on-product-approved] processing", {productId});

    // 1) vendor 통계 갱신
    if (after.vendorId) {
      try {
        await db
          .collection(COLLECTIONS.vendors)
          .doc(after.vendorId)
          .update({
            productCount: FieldValue.increment(1),
          });
      } catch (err) {
        logger.warn("[on-product-approved] vendor count update failed", {
          productId,
          vendorId: after.vendorId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2) auditLog
    try {
      await appendAuditLog({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "PRODUCT_ACTIVATED",
        targetType: "Product",
        targetId: productId,
        after: {vendorId: after.vendorId ?? null},
      });
    } catch (err) {
      logger.warn("[on-product-approved] audit log failed", {
        productId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // TODO(Phase 2.5): Algolia 인덱싱 큐에 enqueue

    logger.info("[on-product-approved] completed", {productId});
  },
);
