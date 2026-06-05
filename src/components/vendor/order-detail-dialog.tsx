"use client";

import { useState, type FormEvent } from "react";
import { Building2, Calendar, Loader2, Package, Truck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type OrderDetailRow = {
  orderNo: string;
  date: string;
  hospital: string;
  items: string;
  total: number;
  status: "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  trackingNo?: string;
};

/**
 * 주문 상세 + 발송 처리 모달.
 *
 *  - PAID / PREPARING → 운송장 입력 폼 (발송 처리)
 *  - SHIPPED → 등록된 운송장 표시 + 배송 완료 처리 액션
 *  - DELIVERED / CANCELLED → 상세 정보만 표시
 */

const COURIERS = ["CJ대한통운", "한진택배", "롯데택배", "우체국", "기타"];

export function OrderDetailDialog({
  open,
  row,
  onClose,
  onShipped,
  onDelivered,
}: {
  open: boolean;
  row: OrderDetailRow | null;
  onClose: () => void;
  onShipped: (orderNo: string, courier: string, trackingNo: string) => void;
  onDelivered: (orderNo: string) => void;
}) {
  const [courier, setCourier] = useState(COURIERS[0]);
  const [trackingNo, setTrackingNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!row) return null;

  const needsShipping = row.status === "PAID" || row.status === "PREPARING";
  const isShipped = row.status === "SHIPPED";

  async function handleShip(e: FormEvent) {
    e.preventDefault();
    if (submitting || !trackingNo.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    onShipped(row!.orderNo, courier, trackingNo.trim());
    setSubmitting(false);
    setTrackingNo("");
    onClose();
  }

  async function handleDelivered() {
    if (submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    onDelivered(row!.orderNo);
    setSubmitting(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-tight">
            주문 상세
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--color-text-secondary)] tabular-nums">
            {row.orderNo}
          </DialogDescription>
        </DialogHeader>

        {/* 주문 정보 */}
        <dl className="divide-y divide-[var(--color-border-light)] text-sm">
          <RowLine icon={Calendar} term="주문일">
            <span className="tabular-nums">{row.date}</span>
          </RowLine>
          <RowLine icon={Building2} term="병원">
            {row.hospital}
          </RowLine>
          <RowLine icon={Package} term="상품">
            <span className="text-right">{row.items}</span>
          </RowLine>
          <RowLine icon={Truck} term="결제 금액">
            <span className="font-semibold tabular-nums">
              ₩{row.total.toLocaleString()}
            </span>
          </RowLine>
        </dl>

        {/* 액션 영역 */}
        {needsShipping && (
          <form
            onSubmit={handleShip}
            className="space-y-3 border-t border-[var(--color-border-light)] pt-4"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              운송장 등록 후 발송 처리
            </p>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="h-9 border-b border-[var(--color-border-light)] bg-transparent text-sm outline-none focus:border-[var(--color-accent)]"
              >
                {COURIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
                placeholder="운송장 번호 입력"
                className="h-9 border-b border-[var(--color-border-light)] bg-transparent text-sm placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={submitting || !trackingNo.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                발송 처리
              </button>
            </div>
          </form>
        )}

        {isShipped && (
          <div className="space-y-3 border-t border-[var(--color-border-light)] pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              운송장
            </p>
            <p className="text-sm tabular-nums">
              {row.trackingNo ?? "CJ대한통운 1234-5678-9012"}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleDelivered}
                disabled={submitting}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                배송 완료 처리
              </button>
            </div>
          </div>
        )}

        {!needsShipping && !isShipped && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              닫기
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RowLine({
  icon: Icon,
  term,
  children,
}: {
  icon: typeof Calendar;
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
        <Icon className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        {term}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
