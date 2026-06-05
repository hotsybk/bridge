"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";

export type AnomalyItem = {
  id: string;
  type?: string;
  severity?: string;
  title?: string;
  message?: string;
  acknowledged?: boolean;
  payload?: Record<string, unknown>;
  orderId?: string;
  disputeId?: string;
  vendorId?: string;
  hospitalId?: string;
  createdAt?: { seconds?: number; _seconds?: number; toDate?: () => Date } | null;
};

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatTime(ts: AnomalyItem["createdAt"]): string {
  if (!ts) return "—";
  let d: Date | null = null;
  if (typeof ts.toDate === "function") {
    try {
      d = ts.toDate();
    } catch {
      d = null;
    }
  }
  if (!d) {
    const sec = ts.seconds ?? ts._seconds;
    if (typeof sec === "number") d = new Date(sec * 1000);
  }
  if (!d) return "—";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toneFor(severity?: string): string {
  if (severity === "ERROR") return "bg-[var(--color-error)]";
  if (severity === "WARNING") return "bg-[var(--color-warning)]";
  return "bg-[var(--color-accent)]";
}

/**
 * 운영자 — 시스템 모니터링 이상 감지 ledger.
 *
 * Phase γ-1 — "확인 처리" 버튼 추가.
 * 기본 view 는 미확인 alert 만. "모두 보기" toggle 로 ack 된 것 함께 표시.
 */
export function SystemAlertsLedger({ anomalies }: { anomalies: AnomalyItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [showAck, setShowAck] = useState(false);

  const ackMut = trpc.admin.monitoring.ackAlert.useMutation();

  async function handleAck(alertId: string) {
    try {
      await ackMut.mutateAsync({ alertId });
      toast.success("확인 처리되었습니다");
      router.refresh();
    } catch (err) {
      const e2 = err as { message?: string };
      toast.error(e2.message ?? "확인 처리에 실패했습니다");
    }
  }

  const visible = showAck ? anomalies : anomalies.filter((a) => !a.acknowledged);
  const ackedCount = anomalies.filter((a) => a.acknowledged).length;

  return (
    <>
      <div className="mt-3 flex items-center justify-end gap-3 text-[11px] text-[var(--color-text-tertiary)]">
        {ackedCount > 0 && (
          <span>확인 완료 {ackedCount}건</span>
        )}
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={showAck}
            onChange={(e) => setShowAck(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          모두 보기
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="mt-4 border-y border-[var(--color-border-light)] py-12 text-center text-sm text-[var(--color-text-secondary)]">
          {showAck
            ? "이상 감지 기록이 없습니다"
            : "확인하지 않은 이상 감지가 없습니다"}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          {visible.map((a) => {
            const isOpen = open === a.id;
            const acked = !!a.acknowledged;
            const payload =
              a.payload ??
              {
                type: a.type,
                severity: a.severity,
                orderId: a.orderId,
                disputeId: a.disputeId,
                vendorId: a.vendorId,
                hospitalId: a.hospitalId,
                acknowledged: a.acknowledged,
              };
            return (
              <li
                key={a.id}
                className={acked ? "opacity-50" : ""}
              >
                {/* Desktop: inline row */}
                <div className="hidden md:flex items-center gap-4 px-2 py-3.5">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : a.id)}
                    className="flex flex-1 items-center gap-4 text-left hover:bg-[var(--color-bg-secondary)]/40"
                  >
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                      {formatTime(a.createdAt)}
                    </span>
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneFor(a.severity)}`}
                    />
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {a.title ?? a.type ?? "—"}
                    </span>
                    {a.message && (
                      <span className="truncate text-xs text-[var(--color-text-tertiary)]">
                        · {a.message}
                      </span>
                    )}
                    <ChevronDown
                      className={`ml-auto h-3 w-3 text-[var(--color-text-tertiary)] transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {!acked ? (
                    <button
                      type="button"
                      onClick={() => handleAck(a.id)}
                      disabled={ackMut.isPending}
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-3 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" strokeWidth={2.4} />
                      확인 처리
                    </button>
                  ) : (
                    <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-3 text-[11px] font-medium text-[var(--color-text-tertiary)]">
                      <Check className="h-3 w-3" strokeWidth={2.4} />
                      확인 완료
                    </span>
                  )}
                </div>
                {/* Mobile: card layout */}
                <div className="flex flex-col gap-2 px-3 py-3.5 md:hidden">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : a.id)}
                    className="flex w-full flex-col gap-1.5 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneFor(a.severity)}`}
                        />
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {a.title ?? a.type ?? "—"}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                        {formatTime(a.createdAt)}
                      </span>
                    </div>
                    {a.message && (
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {a.message}
                      </p>
                    )}
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]">
                      {isOpen ? "payload 숨기기" : "payload 보기"}
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </button>
                  {!acked ? (
                    <button
                      type="button"
                      onClick={() => handleAck(a.id)}
                      disabled={ackMut.isPending}
                      className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/5 px-3 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                      확인 처리
                    </button>
                  ) : (
                    <span className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-3 text-xs font-medium text-[var(--color-text-tertiary)]">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                      확인 완료
                    </span>
                  )}
                </div>
                {isOpen && (
                  <pre className="overflow-x-auto bg-[var(--color-bg-secondary)]/40 px-4 py-3 font-mono text-[11px] tabular-nums text-[var(--color-text-secondary)]">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
