// Wave G — categories/{categoryId} onUpdate.
//
// 카테고리의 name 또는 path 가 변경되면:
//   1) 모든 자손 카테고리의 path[] 와 depth 재계산 (재귀 DFS)
//   2) 이 카테고리에 속한 활성 상품들의 categoryPath denormalize 갱신
//   3) auditLog CATEGORY_PATH_PROPAGATED

// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-category-changed must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {appendAuditLog} from "../lib/audit";

type CategoryDoc = {
  name?: string;
  path?: string[];
  depth?: number;
  parentId?: string | null;
};

/**
 * categories/{categoryId} onUpdate.
 *
 * 트리거 조건: name 또는 path[] 가 변경된 경우.
 */
export const onCategoryChanged = onDocumentUpdated(
  {
    document: "categories/{categoryId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const categoryId = event.params.categoryId;
    const before = event.data?.before?.data() as CategoryDoc | undefined;
    const after = event.data?.after?.data() as CategoryDoc | undefined;
    if (!before || !after) return;

    const beforePathStr = JSON.stringify(before.path ?? []);
    const afterPathStr = JSON.stringify(after.path ?? []);
    const pathChanged = beforePathStr !== afterPathStr;
    const nameChanged = (before.name ?? null) !== (after.name ?? null);
    const depthChanged = (before.depth ?? null) !== (after.depth ?? null);

    if (!pathChanged && !nameChanged && !depthChanged) return;

    logger.info("[on-category-changed] processing", {
      categoryId,
      pathChanged,
      nameChanged,
      depthChanged,
    });

    // 1) 자손 카테고리 path/depth 재계산
    const afterPath = after.path ?? (after.name ? [after.name] : []);
    const afterDepth = after.depth ?? 1;
    let descendantCount = 0;
    try {
      descendantCount = await recalcChildPaths(categoryId, afterPath, afterDepth);
    } catch (err) {
      logger.warn("[on-category-changed] child recalc failed", {
        categoryId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 2) 이 카테고리에 속한 활성 상품들의 categoryPath 동기화
    let productCount = 0;
    try {
      productCount = await propagateToProducts(categoryId, afterPath);
    } catch (err) {
      logger.warn("[on-category-changed] product propagate failed", {
        categoryId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 3) audit
    try {
      await appendAuditLog({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "CATEGORY_PATH_PROPAGATED",
        targetType: "Category",
        targetId: categoryId,
        after: {
          descendantCount,
          productCount,
          path: afterPath,
        },
      });
    } catch (err) {
      logger.warn("[on-category-changed] audit failed", {
        categoryId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[on-category-changed] completed", {
      categoryId,
      descendantCount,
      productCount,
    });
  },
);

/**
 * 재귀 DFS — 직접 자식들의 path/depth 를 갱신.
 * Firestore onUpdate 가 chain 되어 손자들은 후속 호출에서 처리됨.
 * 한 번의 함수 실행에서는 자식만 직접 갱신, 손자는 트리거 chain 으로.
 */
async function recalcChildPaths(
  parentId: string,
  parentPath: string[],
  parentDepth: number,
): Promise<number> {
  const children = await db
    .collection(COLLECTIONS.categories)
    .where("parentId", "==", parentId)
    .get();

  if (children.empty) return 0;

  const writes: Array<Promise<unknown>> = [];
  for (const child of children.docs) {
    const data = child.data() as CategoryDoc;
    const newPath = [...parentPath, data.name ?? ""];
    const newDepth = parentDepth + 1;
    const samePath =
      JSON.stringify(data.path ?? []) === JSON.stringify(newPath) &&
      (data.depth ?? null) === newDepth;
    if (samePath) continue;
    writes.push(
      child.ref.update({
        path: newPath,
        depth: newDepth,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
  }
  await Promise.all(writes);
  return writes.length;
}

/**
 * 이 카테고리에 직접 속한 상품들의 categoryPath denormalize 갱신.
 * 한 트리거에서 최대 500 개까지 처리 (batch 한계).
 */
async function propagateToProducts(
  categoryId: string,
  newPath: string[],
): Promise<number> {
  const snap = await db
    .collection(COLLECTIONS.products)
    .where("categoryId", "==", categoryId)
    .limit(500)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  let count = 0;
  for (const p of snap.docs) {
    const data = p.data() as { categoryPath?: string[] };
    if (JSON.stringify(data.categoryPath ?? []) === JSON.stringify(newPath)) continue;
    batch.update(p.ref, {
      categoryPath: newPath,
      updatedAt: FieldValue.serverTimestamp(),
    });
    count++;
  }
  if (count > 0) await batch.commit();
  return count;
}
