// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error(
    "functions/scheduled/retry-queue-processor must be used only on the server side.",
  );
}

// Phase β-3 작업 5 — _retryQueue 처리 cron.
//
// 15분마다 status=PENDING + nextAttemptAt<=now 인 항목을 최대 50건 fetch 후
// type 별로 재시도. 5회 실패 시 status=FAILED 마킹.

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {getAuth} from "firebase-admin/auth";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {sendAlimtalk} from "../lib/solapi";

type RetryItem = {
  type?: string;
  payload?: Record<string, unknown>;
  attempts?: number;
  attemptCount?: number; // legacy 필드 호환
  reason?: string;
  status?: string;
  nextAttemptAt?: FirebaseFirestore.Timestamp | null;
};

const MAX_ATTEMPTS = 5;
const MAX_BATCH = 50;

/**
 * type 별 처리 — 성공하면 throw 하지 않음.
 * @param {string} type 처리 타입.
 * @param {Record<string, unknown>} payload payload.
 * @return {Promise<void>}
 */
async function processItem(
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (type) {
  case "SET_CUSTOM_CLAIMS": {
    const uid = String(payload.uid ?? "");
    if (!uid) throw new Error("SET_CUSTOM_CLAIMS missing uid");
    const existing = (await getAuth().getUser(uid)).customClaims ?? {};
    const next: Record<string, unknown> = {...existing};
    if (typeof payload.role === "string") next.role = payload.role;
    if (typeof payload.hospitalId === "string") {
      next.hospitalId = payload.hospitalId;
    }
    if (typeof payload.vendorId === "string") {
      next.vendorId = payload.vendorId;
    }
    await getAuth().setCustomUserClaims(uid, next);
    return;
  }
  case "ALIMTALK":
  case "SEND_ALIMTALK": {
    const template = String(payload.template ?? "");
    const to = String(payload.to ?? "");
    if (!template || !to) {
      throw new Error("ALIMTALK missing template/to");
    }
    const variables =
      typeof payload.variables === "object" && payload.variables !== null ?
        (payload.variables as Record<string, string>) :
        undefined;
    await sendAlimtalk({template, to, variables});
    return;
  }
  default:
    throw new Error(`unknown retry type: ${type}`);
  }
}

/**
 * 15분마다 _retryQueue 처리.
 *
 * 정책:
 *  - status=PENDING, nextAttemptAt<=now 인 항목 최대 50건
 *  - 각 항목마다 type 별 핸들러 실행
 *  - 성공: status=SUCCEEDED + succeededAt
 *  - 실패: attempts 증가, 5회 도달 시 status=FAILED, 아니면 backoff 후 재시도
 *  - backoff: min(60min, 2^attempts) 분
 */
export const retryQueueProcessor = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    logger.info("[retry-queue-processor] start");

    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await db
        .collection(COLLECTIONS.retryQueue)
        .where("status", "==", "PENDING")
        .where("nextAttemptAt", "<=", Timestamp.now())
        .limit(MAX_BATCH)
        .get();
    } catch (err) {
      logger.error("[retry-queue-processor] query failed", {
        err: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (snap.empty) {
      logger.info("[retry-queue-processor] no pending — done");
      return;
    }

    let succeeded = 0;
    let failed = 0;
    let retried = 0;

    for (const doc of snap.docs) {
      const item = doc.data() as RetryItem;
      const type = item.type ?? "";
      const payload =
        typeof item.payload === "object" && item.payload !== null ?
          item.payload :
          {};

      try {
        if (!type) throw new Error("missing type");
        await processItem(type, payload as Record<string, unknown>);
        await doc.ref.update({
          status: "SUCCEEDED",
          succeededAt: FieldValue.serverTimestamp(),
          lastError: null,
        });
        succeeded++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const attempts = (item.attempts ?? item.attemptCount ?? 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await doc.ref.update({
            status: "FAILED",
            attempts,
            failedAt: FieldValue.serverTimestamp(),
            lastError: errMsg,
          });
          failed++;
        } else {
          // 2,4,8,16,32 minutes (cap at 60)
          const backoffMin = Math.min(60, Math.pow(2, attempts));
          await doc.ref.update({
            attempts,
            nextAttemptAt: Timestamp.fromMillis(
              Date.now() + backoffMin * 60 * 1000,
            ),
            lastError: errMsg,
          });
          retried++;
        }
        logger.warn("[retry-queue-processor] attempt failed", {
          id: doc.id,
          type,
          attempts,
          err: errMsg,
        });
      }
    }

    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "RETRY_QUEUE_RUN",
        targetType: "RetryQueue",
        targetId: "batch",
        after: {
          scanned: snap.size,
          succeeded,
          retried,
          failed,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[retry-queue-processor] audit log failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[retry-queue-processor] done", {
      scanned: snap.size,
      succeeded,
      retried,
      failed,
    });
  },
);
