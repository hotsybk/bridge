// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/callable/export-audit-logs must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onCall, HttpsError} from "firebase-functions/v2/https";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {getStorage} from "firebase-admin/storage";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";

type AuditLogRow = {
  id: string;
  actorId?: string;
  actorRole?: string;
  actorName?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string;
  ua?: string;
  status?: string;
  createdAt?: {
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
  };
};

type Input = {
  actorRole?: string;
  action?: string;
  targetType?: string;
  dateFrom?: string;
  dateTo?: string;
  format?: "csv" | "json";
};

function tsSeconds(ts: unknown): number {
  if (!ts || typeof ts !== "object") return 0;
  const w = ts as {seconds?: number; _seconds?: number};
  return w.seconds ?? w._seconds ?? 0;
}

function isoFromTs(ts: unknown): string {
  const sec = tsSeconds(ts);
  if (sec === 0) return "";
  return new Date(sec * 1000).toISOString();
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * HTTPS Callable — 운영자 감사 로그 CSV/JSON export.
 *
 * 입력: { actorRole?, action?, targetType?, dateFrom?, dateTo?, format? }
 *
 * 1. ADMIN/SUPER_ADMIN role 검증
 * 2. auditLogs 최대 5000건 조회 (필터 적용)
 * 3. CSV (UTF-8 BOM) 또는 JSON pretty 직렬화
 * 4. Storage `exports/audit-logs-{ts}.{ext}` 업로드
 * 5. signed URL (15분 만료) 반환
 * 6. auditLog 적재 (AUDIT_LOGS_EXPORT)
 */
export const exportAuditLogs = onCall(
  {
    region: "asia-northeast3",
    memory: "512MiB",
    timeoutSeconds: 300,
    maxInstances: 5,
  },
  async (request) => {
    const role = (request.auth?.token?.role as string | undefined) ?? "";
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }

    const input = (request.data ?? {}) as Input;
    logger.info("[export-audit-logs] start", {
      uid: request.auth?.uid,
      input,
    });

    // ── 1) 쿼리 빌드 (Firestore composite-index 활용 가능한 필드만 server-side filter)
    // actorRole · targetType 은 단일 equality 라 createdAt orderBy 와 함께 동작 (인덱스 존재).
    // action · 날짜 필터는 in-memory.
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTIONS.auditLogs)
      .orderBy("createdAt", "desc")
      .limit(5000);

    if (input.actorRole) {
      query = db
        .collection(COLLECTIONS.auditLogs)
        .where("actorRole", "==", input.actorRole)
        .orderBy("createdAt", "desc")
        .limit(5000);
    }
    if (input.targetType) {
      // actorRole 과 targetType 동시 필터는 composite index 가 없을 수 있으므로 한 쪽만 server-side.
      // actorRole 이 있으면 그걸 우선하고 targetType 은 in-memory.
      if (!input.actorRole) {
        query = db
          .collection(COLLECTIONS.auditLogs)
          .where("targetType", "==", input.targetType)
          .orderBy("createdAt", "desc")
          .limit(5000);
      }
    }

    const snap = await query.get();
    let items: AuditLogRow[] = snap.docs.map(
      (d) => ({id: d.id, ...(d.data() as Omit<AuditLogRow, "id">)}),
    );

    // in-memory 후처리 필터
    if (input.actorRole && input.targetType) {
      items = items.filter((i) => i.targetType === input.targetType);
    }
    if (input.action) {
      const needle = input.action.toUpperCase();
      items = items.filter((i) => (i.action ?? "").toUpperCase().includes(needle));
    }
    if (input.dateFrom) {
      const fromSec = new Date(input.dateFrom).getTime() / 1000;
      items = items.filter((i) => tsSeconds(i.createdAt) >= fromSec);
    }
    if (input.dateTo) {
      const toSec = new Date(input.dateTo).getTime() / 1000;
      items = items.filter((i) => tsSeconds(i.createdAt) <= toSec);
    }

    // ── 2) 직렬화
    const format = input.format ?? "csv";
    let content: string;
    let contentType: string;
    let ext: string;

    if (format === "json") {
      // createdAt 을 사람이 읽을 수 있게 변환
      const exportable = items.map((i) => ({
        ...i,
        createdAt: isoFromTs(i.createdAt),
      }));
      content = JSON.stringify(exportable, null, 2);
      contentType = "application/json; charset=utf-8";
      ext = "json";
    } else {
      const header = [
        "timestamp",
        "actorId",
        "actorRole",
        "actorName",
        "action",
        "targetType",
        "targetId",
        "ip",
        "status",
        "before",
        "after",
      ];
      const dataRows = items.map((i) => [
        isoFromTs(i.createdAt),
        i.actorId ?? "",
        i.actorRole ?? "",
        i.actorName ?? "",
        i.action ?? "",
        i.targetType ?? "",
        i.targetId ?? "",
        i.ip ?? "",
        i.status ?? "SUCCESS",
        i.before ? JSON.stringify(i.before) : "",
        i.after ? JSON.stringify(i.after) : "",
      ]);
      const allRows = [header, ...dataRows];
      content =
        "﻿" +
        allRows.map((r) => r.map(csvEscape).join(",")).join("\n");
      contentType = "text/csv; charset=utf-8";
      ext = "csv";
    }

    // ── 3) Storage 업로드
    const bucket = getStorage().bucket();
    const filename = `exports/audit-logs-${Date.now()}.${ext}`;
    const file = bucket.file(filename);
    await file.save(Buffer.from(content, "utf-8"), {
      contentType,
      metadata: {
        cacheControl: "private, max-age=900",
      },
    });

    // ── 4) signed URL (15분)
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
    });

    // ── 5) auditLog 자체 기록
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: request.auth?.uid ?? "system",
        actorRole: role,
        action: "AUDIT_LOGS_EXPORT",
        targetType: "AuditLog",
        targetId: "bulk",
        after: {
          format,
          rowCount: items.length,
          filename,
          filters: input,
        },
        status: "SUCCESS",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[export-audit-logs] audit log failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[export-audit-logs] complete", {
      filename,
      format,
      rowCount: items.length,
    });

    return {
      url: signedUrl,
      filename,
      rowCount: items.length,
      format,
    };
  },
);
