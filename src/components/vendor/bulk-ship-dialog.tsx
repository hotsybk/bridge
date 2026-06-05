"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Phase γ-2 — vendor 일괄 발송 처리 dialog.
 *
 * - 표 입력: 각 row 별 택배사 + 운송장 번호
 * - CSV paste: 한 줄에 "subOrderId,carrier,trackingNo" — bulk 입력 헬퍼
 * - 의료기기 LOT 은 별도 단건 dialog 에서 처리. 일괄 처리는 비의료기기 + 단일 LOT 케이스용.
 */

export type BulkShipTargetRow = {
  subOrderId: string;
  orderId: string;
  orderNo: string;
};

const COURIERS = [
  "CJ대한통운",
  "한진택배",
  "롯데택배",
  "우체국",
  "로젠택배",
  "기타",
];

type ShipmentInput = {
  carrier: string;
  trackingNo: string;
};

export function BulkShipDialog({
  open,
  targets,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  targets: BulkShipTargetRow[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (
    shipments: Array<{
      orderId: string;
      subOrderId: string;
      carrier: string;
      trackingNo: string;
    }>,
  ) => Promise<void>;
}) {
  const [shipments, setShipments] = useState<Record<string, ShipmentInput>>({});
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const targetMap = useMemo(() => {
    const m = new Map<string, BulkShipTargetRow>();
    for (const t of targets) {
      m.set(t.subOrderId, t);
      m.set(t.orderNo, t);
    }
    return m;
  }, [targets]);

  function updateRow(
    subOrderId: string,
    patch: Partial<ShipmentInput>,
  ) {
    setShipments((prev) => ({
      ...prev,
      [subOrderId]: {
        carrier: prev[subOrderId]?.carrier ?? COURIERS[0],
        trackingNo: prev[subOrderId]?.trackingNo ?? "",
        ...patch,
      },
    }));
  }

  function parseCsv(text: string) {
    setCsvText(text);
    const next: Record<string, ShipmentInput> = { ...shipments };
    const lines = text.split(/\r?\n/);
    let matched = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(",").map((s) => s.trim());
      if (parts.length < 3) continue;
      const [idOrNo, carrier, trackingNo] = parts;
      const target = targetMap.get(idOrNo);
      if (!target) continue;
      next[target.subOrderId] = {
        carrier: carrier || COURIERS[0],
        trackingNo,
      };
      matched++;
    }
    setShipments(next);
    if (matched > 0) {
      setError(null);
    }
  }

  async function handleSubmit() {
    setError(null);
    const out: Array<{
      orderId: string;
      subOrderId: string;
      carrier: string;
      trackingNo: string;
    }> = [];
    for (const t of targets) {
      const s = shipments[t.subOrderId];
      if (!s || !s.trackingNo.trim() || !s.carrier.trim()) {
        setError(`${t.orderNo} 의 택배사 / 운송장 번호를 모두 입력하세요.`);
        return;
      }
      if (s.trackingNo.trim().length < 5) {
        setError(`${t.orderNo} 의 운송장 번호는 5자 이상이어야 합니다.`);
        return;
      }
      out.push({
        orderId: t.orderId,
        subOrderId: t.subOrderId,
        carrier: s.carrier.trim(),
        trackingNo: s.trackingNo.trim(),
      });
    }
    await onSubmit(out);
  }

  function handleClose() {
    if (isPending) return;
    setShipments({});
    setCsvText("");
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-tight">
            {targets.length}건 일괄 발송 처리
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--color-text-secondary)]">
            각 주문에 택배사 + 운송장 번호를 입력하세요. 의료기기(2등급+)
            상품은 LOT/유통기한이 필요하므로 단건 발송을 이용해야 합니다.
          </DialogDescription>
        </DialogHeader>

        {/* CSV paste 토글 */}
        <details className="border-t border-[var(--color-border-light)] pt-3">
          <summary className="cursor-pointer text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]">
            CSV 로 일괄 입력
          </summary>
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              한 줄에 한 건. 형식:{" "}
              <span className="font-mono">
                주문번호 또는 SubOrderId,택배사,운송장
              </span>
            </p>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                parseCsv(e.target.value)
              }
              placeholder={
                "MP-2026-06-02-A1B2,CJ대한통운,123456789012\nMP-2026-06-02-X9Y8,한진택배,987654321098"
              }
              className="w-full resize-none border border-[var(--color-border-light)] bg-transparent p-2 text-xs font-mono placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
        </details>

        {/* 표 입력 */}
        <div className="max-h-[40vh] overflow-y-auto border-y border-[var(--color-border-light)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--color-bg-primary)]">
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                <th className="py-2 pr-3 font-medium">주문번호</th>
                <th className="px-3 py-2 font-medium">택배사</th>
                <th className="px-3 py-2 font-medium">운송장</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => {
                const s = shipments[t.subOrderId];
                return (
                  <tr
                    key={t.subOrderId}
                    className="border-t border-[var(--color-border-light)]"
                  >
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {t.orderNo}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={s?.carrier ?? COURIERS[0]}
                        onChange={(e) =>
                          updateRow(t.subOrderId, { carrier: e.target.value })
                        }
                        className="h-8 w-full border-b border-[var(--color-border-light)] bg-transparent text-xs outline-none focus:border-[var(--color-accent)]"
                      >
                        {COURIERS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={s?.trackingNo ?? ""}
                        onChange={(e) =>
                          updateRow(t.subOrderId, {
                            trackingNo: e.target.value,
                          })
                        }
                        placeholder="운송장 번호"
                        inputMode="numeric"
                        autoComplete="off"
                        enterKeyHint="next"
                        className="h-8 w-full border-b border-[var(--color-border-light)] bg-transparent text-xs tabular-nums placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && (
          <p className="text-xs text-[var(--color-error)]">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--color-border-light)] pt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {targets.length}건 발송 처리
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
