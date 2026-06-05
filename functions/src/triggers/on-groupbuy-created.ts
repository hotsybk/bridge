// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-groupbuy-created must be used only on the server side.");
}

// Wave I — 공동구매 생성 시 후속 처리.
//   1. 10개 counter shard 초기화 (distributed counter 패턴)
//   2. vendor 알림 발송
//   3. audit log 적재

// eslint-disable-next-line import/first
import {onDocumentCreated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {initCounterShards} from "../lib/distributed-counter";

export const onGroupbuyCreated = onDocumentCreated(
  {
    document: "groupBuys/{groupBuyId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const ref = event.data?.ref;
    if (!ref) return;
    const data = event.data?.data();
    const groupBuyId = event.params.groupBuyId;

    logger.info("[on-groupbuy-created] start", {groupBuyId});

    // 1) 10 shard 초기화
    try {
      await initCounterShards(ref);
    } catch (err) {
      logger.error("[on-groupbuy-created] initCounterShards failed", {
        groupBuyId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 2) vendor 알림
    if (data?.vendorId) {
      try {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "VENDOR",
          targetId: data.vendorId,
          type: "GROUPBUY_OPENED",
          title: "공동구매가 시작되었습니다",
          body: `${data.productName ?? "공동구매"} — 목표 ${data.targetQty ?? 0}개`,
          channels: ["IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.warn("[on-groupbuy-created] vendor notification failed", {
          groupBuyId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 3) audit
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "GROUPBUY_CREATED",
        targetType: "GroupBuy",
        targetId: groupBuyId,
        after: {
          vendorId: data?.vendorId,
          productName: data?.productName,
          targetQty: data?.targetQty,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[on-groupbuy-created] audit failed", {
        groupBuyId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[on-groupbuy-created] done", {groupBuyId});
  },
);
