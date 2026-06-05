"use client";

// Wave V — _retryQueue 컬렉션 entry 관리.
// 재시도 (status=PENDING 으로 되돌리기) / 취소 (status=CANCELLED).

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  Loader2,
  RotateCcw,
  RefreshCw,
  X,
} from "lucide-react";

import { trpc } from "@/lib/trpc/client";

type StatusFilter = "ALL" | "PENDING" | "RESOLVED" | "CANCELLED" | "FAILED";

type RetryEntry = {
  id: string;
  type?: string;
  status?: string;
  attemptCount?: number;
  errorMessage?: string;
  createdAt?: string;
  lastRetryAt?: string;
  cancelledAt?: string;
  [key: string]: unknown;
};

export function RetryQueueClient() {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const utils = trpc.useUtils();
  const listQ = trpc.admin.debug.listRetryQueue.useQuery(
    { status: filter === "ALL" ? undefined : (filter as Exclude<StatusFilter, "ALL">) },
    { retry: false },
  );

  const retryM = trpc.admin.debug.retryEntry.useMutation({
    onSuccess: () => {
      setMsg({ ok: true, text: "큐 entry 재시도 — status PENDING 으로 복귀" });
      utils.admin.debug.listRetryQueue.invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: e.message }),
  });

  const cancelM = trpc.admin.debug.cancelEntry.useMutation({
    onSuccess: () => {
      setMsg({ ok: true, text: "큐 entry 취소 완료" });
      utils.admin.debug.listRetryQueue.invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: e.message }),
  });

  const entries = (listQ.data ?? []) as RetryEntry[];

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <Link
        href="/admin/debug"
        className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        디버그 도구
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <RotateCcw className="mt-1 h-5 w-5 text-[var(--color-accent)]" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            디버그 · 재시도 큐
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            _retryQueue 관리자
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            ALIMTALK / UDI / PORTONE / GROUPBUY_FINALIZE 큐. 재시도 시 status PENDING
            으로 복귀 — cron · trigger 가 다시 처리합니다.
          </p>
        </div>
      </div>

      {/* filter + refresh */}
      <div className="mt-10 flex flex-wrap items-center gap-2">
        {(["ALL", "PENDING", "RESOLVED", "CANCELLED", "FAILED"] as StatusFilter[]).map(
          (s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`h-7 rounded-full border px-3 text-xs ${
                filter === s
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                  : "border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)]"
              }`}
            >
              {s}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => utils.admin.debug.listRetryQueue.invalidate()}
          className="ml-auto inline-flex h-7 items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          <RefreshCw className="h-3 w-3" />
          새로고침
        </button>
      </div>

      {msg && (
        <p
          className={`mt-6 text-xs ${
            msg.ok ? "text-[var(--color-success)]" : "text-[var(--color-error)]"
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* table */}
      <div className="mt-6">
        {listQ.isLoading ? (
          <p className="py-12 text-center text-xs text-[var(--color-text-tertiary)]">
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          </p>
        ) : entries.length === 0 ? (
          <p className="border-y border-[var(--color-border-light)] py-12 text-center text-xs text-[var(--color-text-secondary)]">
            큐 entry 가 없습니다
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {entries.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-1 gap-2 px-2 py-4 md:grid-cols-[200px_120px_80px_1fr_auto_auto] md:items-center"
              >
                <div>
                  <p className="font-mono text-[11px] tabular-nums text-[var(--color-text-primary)]">
                    {e.id.slice(0, 16)}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">
                    {e.createdAt
                      ? new Date(e.createdAt).toLocaleString("ko-KR")
                      : "—"}
                  </p>
                </div>
                <span className="text-xs font-medium">{e.type ?? "—"}</span>
                <StatusBadge status={e.status} />
                <span className="truncate text-xs text-[var(--color-text-tertiary)]">
                  {typeof e.errorMessage === "string" ? e.errorMessage : ""}
                  {e.attemptCount !== undefined && (
                    <span className="ml-2 font-mono tabular-nums">
                      · {e.attemptCount}회
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={retryM.isPending}
                  onClick={() => retryM.mutate({ entryId: e.id })}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-3 text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  재시도
                </button>
                <button
                  type="button"
                  disabled={cancelM.isPending || e.status === "CANCELLED"}
                  onClick={() => {
                    if (confirm(`${e.id} 를 취소하시겠습니까?`)) {
                      cancelM.mutate({ entryId: e.id });
                    }
                  }}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-3 text-[11px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                  취소
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const colorClass =
    status === "PENDING"
      ? "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
      : status === "RESOLVED"
        ? "border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]"
        : status === "CANCELLED"
          ? "border-[var(--color-border-light)] bg-transparent text-[var(--color-text-tertiary)]"
          : status === "FAILED"
            ? "border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-[var(--color-error)]"
            : "border-[var(--color-border-light)] bg-transparent text-[var(--color-text-tertiary)]";
  return (
    <span
      className={`inline-flex h-5 items-center justify-center rounded-full border px-2 text-[11px] font-medium ${colorClass}`}
    >
      {status ?? "—"}
    </span>
  );
}
