"use client";

import { Calendar, Download } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadCsv } from "@/lib/csv-download";

export type SettlementDetailRow = {
  period: string;
  paidOn: string;
  gross: number;
  fee: number;
  net: number;
  status: "PAID" | "PROCESSING" | "HOLD";
};

const STATUS_LABEL = {
  PAID: "입금 완료",
  PROCESSING: "처리 중",
  HOLD: "보류",
} as const;

// 정산 상세 — mock 주문 breakdown
const MOCK_BREAKDOWN = [
  { orderNo: "MP-2026-05-18-0042", hospital: "더미 병원", gross: 96600, fee: 4830 },
  { orderNo: "MP-2026-05-19-0103", hospital: "더미 정형외과", gross: 187500, fee: 9375 },
  { orderNo: "MP-2026-05-20-0009", hospital: "더미 산부인과", gross: 154000, fee: 7700 },
  { orderNo: "MP-2026-05-21-0017", hospital: "강남 메디 클리닉", gross: 31700, fee: 1585 },
];

export function SettlementDetailDialog({
  open,
  row,
  onClose,
}: {
  open: boolean;
  row: SettlementDetailRow | null;
  onClose: () => void;
}) {
  if (!row) return null;

  function onDownload() {
    downloadCsv(
      `settlement_${row!.period.replace(/[~ ]/g, "_")}.csv`,
      ["주문번호", "병원", "총매출", "수수료"],
      MOCK_BREAKDOWN.map((b) => [b.orderNo, b.hospital, b.gross, b.fee])
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-tight">
            정산 명세
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] tabular-nums">
            <Calendar className="h-3 w-3" />
            {row.period} · 입금일 {row.paidOn}
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 border-y border-[var(--color-border-light)] py-4">
          <SummaryCol label="총매출" value={row.gross} />
          <SummaryCol label="수수료" value={-row.fee} tone="muted" />
          <SummaryCol label="실수령" value={row.net} tone="bold" />
        </div>

        {/* Status */}
        <p className="text-xs">
          상태:{" "}
          <span
            className={
              row.status === "PAID"
                ? "font-semibold text-[var(--color-status-delivered)]"
                : row.status === "PROCESSING"
                  ? "font-semibold text-[var(--color-status-paid)]"
                  : "font-semibold text-[var(--color-error)]"
            }
          >
            {STATUS_LABEL[row.status]}
          </span>
        </p>

        {/* Breakdown */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            주문별 내역 ({MOCK_BREAKDOWN.length}건)
          </p>
          <ul className="mt-2 divide-y divide-[var(--color-border-light)] text-xs">
            {MOCK_BREAKDOWN.map((b) => (
              <li
                key={b.orderNo}
                className="flex items-center justify-between py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="tabular-nums font-medium">{b.orderNo}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                    {b.hospital}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums font-medium">
                    ₩{b.gross.toLocaleString()}
                  </p>
                  <p className="mt-0.5 tabular-nums text-[10px] text-[var(--color-text-tertiary)]">
                    수수료 −₩{b.fee.toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-border-light)] pt-4">
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-4 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-secondary)]"
          >
            <Download className="h-3.5 w-3.5" />
            명세서 다운로드
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            닫기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCol({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "muted" | "bold";
}) {
  const valueClass =
    tone === "bold"
      ? "text-sm font-semibold"
      : tone === "muted"
        ? "text-sm text-[var(--color-text-tertiary)]"
        : "text-sm font-medium";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className={`mt-1 tabular-nums ${valueClass}`}>
        {value < 0 ? "−" : ""}₩{Math.abs(value).toLocaleString()}
      </p>
    </div>
  );
}
