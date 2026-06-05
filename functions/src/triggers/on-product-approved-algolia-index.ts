// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error(
    "functions/triggers/on-product-approved-algolia-index must be used only on the server side.",
  );
}

// Wave Z — products/{productId} onUpdate → Algolia 색인 자동 동기.
//
// 케이스:
//   1) 비-ACTIVE → ACTIVE/APPROVED: indexProduct
//   2) ACTIVE/APPROVED → 그 외: deleteProduct
//   3) ACTIVE 유지 + name/basePrice/shortDesc 변경: reindex (upsert)
//
// on-product-approved (vendor 통계용) 와 별도 함수로 둠.
// env 미설정 시 mock pass-through.

// eslint-disable-next-line import/first
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {indexProduct, deleteProduct} from "../lib/algolia";

type ProductDoc = {
  name?: string;
  basePrice?: number;
  shortDesc?: string;
  status?: string;
  moderation?: {status?: string};
  [k: string]: unknown;
};

function effectiveStatus(p: ProductDoc | undefined): string | null {
  if (!p) return null;
  return p.moderation?.status ?? p.status ?? null;
}

function isActive(status: string | null): boolean {
  return status === "ACTIVE" || status === "APPROVED";
}

export const onProductApprovedAlgoliaIndex = onDocumentUpdated(
  {
    document: "products/{productId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const productId = event.params.productId;
    const before = event.data?.before.data() as ProductDoc | undefined;
    const after = event.data?.after.data() as ProductDoc | undefined;
    if (!after) return;

    const beforeStatus = effectiveStatus(before);
    const afterStatus = effectiveStatus(after);
    const wasActive = isActive(beforeStatus);
    const isActiveNow = isActive(afterStatus);

    // 1) 비활성 → 활성: index
    if (isActiveNow && !wasActive) {
      logger.info("[algolia] indexing (activated)", {productId});
      try {
        await indexProduct({id: productId, ...after});
      } catch (err) {
        logger.error("[algolia] index failed", {
          productId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    // 2) 활성 → 비활성: delete
    if (wasActive && !isActiveNow) {
      logger.info("[algolia] deleting (deactivated)", {productId});
      try {
        await deleteProduct(productId);
      } catch (err) {
        logger.error("[algolia] delete failed", {
          productId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    // 3) 활성 유지 — 색인 관련 필드 변경 시 reindex
    if (isActiveNow && wasActive) {
      const dataChanged =
        before?.name !== after.name ||
        before?.basePrice !== after.basePrice ||
        before?.shortDesc !== after.shortDesc;
      if (dataChanged) {
        logger.info("[algolia] reindexing (data changed)", {productId});
        try {
          await indexProduct({id: productId, ...after});
        } catch (err) {
          logger.error("[algolia] reindex failed", {
            productId,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  },
);
