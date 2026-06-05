// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error(
    "functions/scheduled/audit-archive must be used only on the server side.",
  );
}

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {getStorage} from "firebase-admin/storage";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp} from "../lib/firestore";

/**
 * Audit log retention — 매월 1일 03:00 KST.
 *
 * 1년 이상된 auditLogs 를 Cloud Storage 의 `archives/audit-logs/YYYY-MM.jsonl`
 * 로 적재 + Firestore 에서 삭제.
 *
 * 한 회 실행 시 최대 5,000건 (timeout 540s · memory 1GiB 안에서 안전 범위).
 * 5,000건을 넘으면 다음달 cron 에서 점진 처리.
 */
export const auditArchive = onSchedule(
  {
    schedule: "0 3 1 * *", // 매월 1일 03:00
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async () => {
    logger.info("[audit-archive] start");

    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);

    const snap = await db
      .collection("auditLogs")
      .where("createdAt", "<=", Timestamp.fromDate(cutoff))
      .orderBy("createdAt", "asc")
      .limit(5000)
      .get();

    if (snap.empty) {
      logger.info("[audit-archive] no archives to process");
      return;
    }

    // GCS 에 JSON Lines 적재
    const items = snap.docs.map((d) => ({id: d.id, ...d.data()}));
    const jsonl = items.map((i) => JSON.stringify(i)).join("\n");

    const bucket = getStorage().bucket();
    const filename = `archives/audit-logs/${new Date()
      .toISOString()
      .slice(0, 7)}.jsonl`;

    try {
      await bucket.file(filename).save(Buffer.from(jsonl, "utf-8"), {
        contentType: "application/x-ndjson",
      });
    } catch (err) {
      logger.error("[audit-archive] GCS upload failed — abort delete", {
        filename,
        err: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // Firestore 에서 삭제 (batch 500)
    let deleted = 0;
    const docs = snap.docs;
    while (deleted < docs.length) {
      const batch = db.batch();
      const chunk = docs.slice(deleted, deleted + 500);
      for (const doc of chunk) batch.delete(doc.ref);
      try {
        await batch.commit();
        deleted += chunk.length;
      } catch (err) {
        logger.error("[audit-archive] batch delete failed", {
          deleted,
          remaining: docs.length - deleted,
          err: err instanceof Error ? err.message : String(err),
        });
        break;
      }
    }

    try {
      await db.collection("auditLogs").add({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "AUDIT_LOGS_ARCHIVED",
        targetType: "AuditLog",
        targetId: "batch",
        after: {archived: items.length, deleted, filename},
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[audit-archive] audit log write failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info(
      `[audit-archive] archived ${items.length} entries to ${filename}, deleted ${deleted}`,
    );
  },
);
