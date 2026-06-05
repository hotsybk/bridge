// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error(
    "functions/callable/reindex-products must be used only on the server side.",
  );
}

// Wave Z — 운영자 수동 전체 재색인 (HTTPS Callable).
//
// /admin/debug/callable 의 reindexProducts 버튼이 이 함수를 호출.
// ADMIN / SUPER_ADMIN role 만 허용.
//
// 동작:
//   1) configureIndex() — searchable attrs, ranking 등
//   2) ACTIVE / APPROVED 상품을 배치 100개씩 색인
//   3) env 미설정 시 mock 모드 — 갯수만 반환

// eslint-disable-next-line import/first
import {onCall, HttpsError} from "firebase-functions/v2/https";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {
  batchIndex,
  configureIndex,
  isAlgoliaConfigured,
} from "../lib/algolia";

export const reindexProducts = onCall(
  {
    region: "asia-northeast3",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const role = (request.auth.token?.role as string | undefined) ?? "";
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }

    logger.info("[reindex-products] requested", {uid: request.auth.uid});

    // mock 분기: env 미설정 — 색인 대상 갯수만 카운트
    if (!isAlgoliaConfigured()) {
      const snap = await db
        .collection(COLLECTIONS.products)
        .where("status", "in", ["ACTIVE", "APPROVED"])
        .count()
        .get();
      const count = snap.data().count;
      logger.info("[reindex-products] mock run", {count});
      return {
        ok: true,
        mock: true,
        count,
        message: "Algolia 환경변수 미설정 — mock 모드 (실제 색인 안 함).",
      };
    }

    await configureIndex();

    let total = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    const batchSize = 100;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let q: FirebaseFirestore.Query = db
        .collection(COLLECTIONS.products)
        .where("status", "in", ["ACTIVE", "APPROVED"])
        .orderBy("createdAt", "desc")
        .limit(batchSize);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      const products = snap.docs.map((d) => ({id: d.id, ...d.data()}));
      try {
        await batchIndex(products);
        total += products.length;
      } catch (err) {
        logger.error("[reindex-products] batch failed", {
          err: err instanceof Error ? err.message : String(err),
          batchStart: products[0]?.id,
        });
        throw new HttpsError(
          "internal",
          `색인 실패: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < batchSize) break;
    }

    logger.info("[reindex-products] complete", {total});
    return {ok: true, count: total};
  },
);
