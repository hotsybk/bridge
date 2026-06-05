// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/callable/export-orders-csv must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onCall, HttpsError} from "firebase-functions/v2/https";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {getStorage} from "firebase-admin/storage";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";

type OrderRow = {
  id: string;
  orderNo?: string;
  hospitalName?: string;
  vendorIds?: string[];
  totalAmount?: number;
  status?: string;
  payment?: {status?: string};
  createdAt?: {toDate?: () => Date; seconds?: number};
};

type Input = {
  status?: string;
  dateRange?: {from?: string; to?: string};
  vendorId?: string;
};

function formatDateTime(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "";
  const w = ts as {toDate?: () => Date; seconds?: number; _seconds?: number};
  let d: Date | null = null;
  if (typeof w.toDate === "function") {
    try {
      d = w.toDate();
    } catch {
      d = null;
    }
  }
  if (!d) {
    const sec = w.seconds ?? w._seconds;
    if (typeof sec === "number") d = new Date(sec * 1000);
  }
  if (!d) return "";
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * HTTPS Callable — 운영자 주문 CSV export.
 *
 * 입력: { status?, dateRange?, vendorId? }
 * 1. ADMIN/SUPER_ADMIN role 검증
 * 2. orders 최신 1000건 조회 (필터 적용)
 * 3. CSV 문자열 생성 (UTF-8 BOM + 헤더)
 * 4. Storage `exports/orders-{ts}.csv` 업로드
 * 5. signed URL (15분 만료) 반환
 * 6. auditLog 적재
 */
export const exportOrdersCsv = onCall(
  {region: "asia-northeast3", maxInstances: 5},
  async (request) => {
    const role = (request.auth?.token?.role as string | undefined) ?? "";
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }

    const input = (request.data ?? {}) as Input;
    logger.info("[export-orders-csv] start", {
      uid: request.auth?.uid,
      input,
    });

    // ── 1) orders 조회 (최대 1000건, createdAt desc)
    let query = db
      .collection(COLLECTIONS.orders)
      .orderBy("createdAt", "desc")
      .limit(1000);

    if (input.vendorId) {
      // vendorIds 배열 contains
      query = db
        .collection(COLLECTIONS.orders)
        .where("vendorIds", "array-contains", input.vendorId)
        .orderBy("createdAt", "desc")
        .limit(1000);
    }

    const snap = await query.get();
    let orders: OrderRow[] = snap.docs.map(
      (d) => ({id: d.id, ...(d.data() as Omit<OrderRow, "id">)}),
    );

    // status 필터 (in-memory — Phase 3+ composite index 로 전환)
    if (input.status && input.status !== "ALL") {
      orders = orders.filter((o) => o.status === input.status);
    }

    // dateRange 필터 (옵션)
    if (input.dateRange?.from) {
      const fromMs = new Date(input.dateRange.from).getTime();
      orders = orders.filter((o) => {
        const ts = o.createdAt as {seconds?: number} | undefined;
        const sec = ts?.seconds ?? 0;
        return sec * 1000 >= fromMs;
      });
    }
    if (input.dateRange?.to) {
      const toMs = new Date(input.dateRange.to).getTime();
      orders = orders.filter((o) => {
        const ts = o.createdAt as {seconds?: number} | undefined;
        const sec = ts?.seconds ?? 0;
        return sec * 1000 <= toMs;
      });
    }

    // ── 2) CSV 생성 (UTF-8 BOM 으로 Excel 호환)
    const header = [
      "주문번호",
      "일시",
      "병원",
      "vendor 수",
      "총액(원)",
      "주문 상태",
      "결제 상태",
    ];
    const dataRows = orders.map((o) => [
      o.orderNo ?? o.id,
      formatDateTime(o.createdAt),
      o.hospitalName ?? "",
      String(o.vendorIds?.length ?? 0),
      String(o.totalAmount ?? 0),
      o.status ?? "",
      o.payment?.status ?? "",
    ]);
    const allRows = [header, ...dataRows];
    const csv =
      "﻿" +
      allRows.map((r) => r.map(csvEscape).join(",")).join("\n");

    // ── 3) Storage 업로드
    const bucket = getStorage().bucket();
    const filename = `exports/orders-${Date.now()}.csv`;
    const file = bucket.file(filename);
    await file.save(Buffer.from(csv, "utf-8"), {
      contentType: "text/csv; charset=utf-8",
      metadata: {
        cacheControl: "private, max-age=900",
      },
    });

    // ── 4) signed URL (15분)
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
    });

    // ── 5) auditLog
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: request.auth?.uid ?? "system",
        actorRole: role,
        action: "ORDERS_EXPORT_CSV",
        targetType: "Order",
        targetId: "bulk",
        after: {
          filename,
          rowCount: dataRows.length,
          filters: input,
        },
        status: "SUCCESS",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[export-orders-csv] audit log failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[export-orders-csv] complete", {
      filename,
      rowCount: dataRows.length,
    });

    return {
      url: signedUrl,
      filename,
      rowCount: dataRows.length,
    };
  },
);
