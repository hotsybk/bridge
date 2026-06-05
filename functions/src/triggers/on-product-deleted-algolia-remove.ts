// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error(
    "functions/triggers/on-product-deleted-algolia-remove must be used only on the server side.",
  );
}

// Wave Z — products/{productId} onDelete → Algolia 색인 제거.
// env 미설정 시 mock 통과.

// eslint-disable-next-line import/first
import {onDocumentDeleted} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {deleteProduct} from "../lib/algolia";

export const onProductDeletedAlgoliaRemove = onDocumentDeleted(
  {
    document: "products/{productId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const productId = event.params.productId;
    logger.info("[algolia] product deleted, removing", {productId});
    try {
      await deleteProduct(productId);
    } catch (err) {
      logger.error("[algolia] remove failed", {
        productId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  },
);
