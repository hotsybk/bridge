// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/callable/export-settlements must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onCall, HttpsError} from "firebase-functions/v2/https";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {Timestamp} from "firebase-admin/firestore";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";

type Input = {
  fromDate?: string;   // YYYY-MM-DD inclusive
  toDate?: string;     // YYYY-MM-DD inclusive
  status?: string;     // SettlementStatus
  vendorId?: string;
};

type SettlementDoc = {
  vendorId?: string;
  vendorName?: string;
  status?: string;
  periodStart?: {toDate?: () => Date; seconds?: number};
  periodEnd?: {toDate?: () => Date; seconds?: number};
  grossAmount?: number;
  commissionAmount?: number;
  paymentFeeAmount?: number;
  paymentFeeVatAmount?: number;
  commissionVatAmount?: number;
  refundDeductAmount?: number;
  couponDeductAmount?: number;
  netPayout?: number;
  finalPayout?: number;
  isFastSettlement?: boolean;
  fastSettlementDays?: number;
  fastSettlementFee?: number;
  paidAt?: {toDate?: () => Date; seconds?: number};
  scheduledPayoutAt?: {toDate?: () => Date; seconds?: number};
  payoutRef?: string;
  payoutId?: string;
};

function tsToDate(ts: unknown): Date | null {
  if (!ts || typeof ts !== "object") return null;
  const w = ts as {toDate?: () => Date; seconds?: number; _seconds?: number};
  if (typeof w.toDate === "function") {
    try {
      return w.toDate();
    } catch {
      /* fallthrough */
    }
  }
  const sec = w.seconds ?? w._seconds;
  if (typeof sec === "number") return new Date(sec * 1000);
  return null;
}

function formatDate(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * HTTPS Callable — 운영자 settlement CSV export.
 *
 * 입력: { fromDate?, toDate?, status?, vendorId? }
 * 1. ADMIN/SUPER_ADMIN role 검증
 * 2. settlements 조회 (필터 적용)
 * 3. UTF-8 BOM CSV 문자열 생성
 * 4. CSV 문자열을 직접 반환 (client-side 다운로드)
 * 5. auditLog 적재
 *
 * Phase γ-2 신규.
 */
export const exportSettlements = onCall(
  {region: "asia-northeast3", memory: "1GiB", timeoutSeconds: 540},
  async (request) => {
    const role = (request.auth?.token?.role as string | undefined) ?? "";
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }

    const input = (request.data ?? {}) as Input;
    logger.info("[export-settlements] start", {
      uid: request.auth?.uid,
      input,
    });

    // ── 1) settlements 쿼리 (필터)
    let q: FirebaseFirestore.Query = db.collection(COLLECTIONS.settlements);
    if (input.vendorId) q = q.where("vendorId", "==", input.vendorId);
    if (input.status) q = q.where("status", "==", input.status);
    if (input.fromDate) {
      const fromMs = new Date(input.fromDate + "T00:00:00").getTime();
      if (!Number.isNaN(fromMs)) {
        q = q.where("createdAt", ">=", Timestamp.fromMillis(fromMs));
      }
    }
    if (input.toDate) {
      const toMs = new Date(input.toDate + "T23:59:59").getTime();
      if (!Number.isNaN(toMs)) {
        q = q.where("createdAt", "<=", Timestamp.fromMillis(toMs));
      }
    }
    q = q.orderBy("createdAt", "desc").limit(10000);

    const snap = await q.get();
    const settlements: Array<SettlementDoc & {id: string}> = snap.docs.map(
      (d) => ({id: d.id, ...(d.data() as SettlementDoc)}),
    );

    // ── 2) CSV 생성 (UTF-8 BOM 으로 Excel 호환)
    const headers = [
      "정산ID",
      "vendorId",
      "vendor명",
      "기간시작",
      "기간종료",
      "상태",
      "총매출",
      "수수료",
      "수수료VAT",
      "결제수수료",
      "결제수수료VAT",
      "환불차감",
      "쿠폰차감",
      "정산금",
      "빠른정산여부",
      "빠른정산일수",
      "빠른정산수수료",
      "최종지급액",
      "이체일",
      "이체참조",
      "예정일",
    ];
    const dataRows = settlements.map((s) => [
      s.id,
      s.vendorId ?? "",
      s.vendorName ?? "",
      formatDate(tsToDate(s.periodStart)),
      formatDate(tsToDate(s.periodEnd)),
      s.status ?? "",
      String(s.grossAmount ?? 0),
      String(s.commissionAmount ?? 0),
      String(s.commissionVatAmount ?? 0),
      String(s.paymentFeeAmount ?? 0),
      String(s.paymentFeeVatAmount ?? 0),
      String(s.refundDeductAmount ?? 0),
      String(s.couponDeductAmount ?? 0),
      String(s.netPayout ?? 0),
      s.isFastSettlement ? "Y" : "N",
      String(s.fastSettlementDays ?? ""),
      String(s.fastSettlementFee ?? 0),
      String(s.finalPayout ?? 0),
      formatDate(tsToDate(s.paidAt)),
      s.payoutRef ?? s.payoutId ?? "",
      formatDate(tsToDate(s.scheduledPayoutAt)),
    ]);
    const allRows = [headers, ...dataRows];
    const csv =
      "﻿" + allRows.map((r) => r.map(csvEscape).join(",")).join("\n");

    // ── 3) auditLog
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: request.auth?.uid ?? "system",
        actorRole: role,
        action: "SETTLEMENT_EXPORT",
        targetType: "Settlement",
        targetId: "batch",
        after: {
          rowCount: settlements.length,
          filters: input,
        },
        status: "SUCCESS",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[export-settlements] audit log failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[export-settlements] complete", {
      rowCount: settlements.length,
    });

    return {csv, count: settlements.length};
  },
);
