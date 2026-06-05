"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";

import { AuditDiffViewer } from "@/components/admin/audit-diff-viewer";
import { app } from "@/lib/firebase/client";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

export type LogItem = {
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
  status?: "SUCCESS" | "FAILURE";
  createdAt?: { seconds?: number; _seconds?: number; toDate?: () => Date } | null;
};

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatTs(ts: LogItem["createdAt"]): string {
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function roleColor(role?: string): string {
  if (role === "ADMIN" || role === "SUPER_ADMIN")
    return "border-[var(--color-accent)] text-[var(--color-accent)]";
  if (role === "SYSTEM")
    return "border-[var(--color-warning)] text-[var(--color-warning)]";
  if (role === "BUYER_OWNER" || role === "BUYER_STAFF" || role === "BUYER_VIEWER")
    return "border-[var(--color-border-default)] text-[var(--color-text-secondary)]";
  if (role === "VENDOR_OWNER" || role === "VENDOR_STAFF")
    return "border-[var(--color-border-default)] text-[var(--color-text-secondary)]";
  return "border-[var(--color-text-tertiary)] text-[var(--color-text-tertiary)]";
}

/**
 * 운영자 — 감사 로그 line table + drawer.
 *
 * Server Component 에서 fetch 된 logs 를 받아 hover/click 만 처리.
 */
export function AuditLogDrawerList({ logs }: { logs: LogItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const selected = logs.find((l) => l.id === selectedId) ?? null;

  async function handleExport(format: "csv" | "json") {
    if (PREVIEW_MODE) {
      alert(`PREVIEW · ${format.toUpperCase()} export 는 운영 환경에서만 동작합니다.`);
      return;
    }
    setExporting(format);
    try {
      const functions = getFunctions(app, "asia-northeast3");
      const fn = httpsCallable<
        { format: "csv" | "json" },
        { url: string; filename: string; rowCount: number; format: string }
      >(functions, "exportAuditLogs");
      const { data } = await fn({ format });
      alert(`${data.rowCount}건 export 완료 (${data.format.toUpperCase()})`);
      window.location.href = data.url;
    } catch (err) {
      alert("export 실패: " + (err as Error).message);
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <div className="mt-8 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => handleExport("csv")}
          disabled={exporting !== null}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] px-3 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]/60 disabled:opacity-50"
        >
          <Download className="h-3 w-3" />
          {exporting === "csv" ? "내보내는 중…" : "CSV export"}
        </button>
        <button
          type="button"
          onClick={() => handleExport("json")}
          disabled={exporting !== null}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] px-3 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]/60 disabled:opacity-50"
        >
          <Download className="h-3 w-3" />
          {exporting === "json" ? "내보내는 중…" : "JSON export"}
        </button>
      </div>

      <div className="mt-4 border-y border-[var(--color-border-light)]">
        <div className="hidden md:grid grid-cols-[180px_180px_1fr_200px_120px_80px] gap-3 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>Timestamp</span>
          <span>Actor</span>
          <span>액션</span>
          <span>대상</span>
          <span>IP</span>
          <span>Status</span>
        </div>
        {logs.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-text-secondary)]">
            기록된 감사 로그가 없습니다
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)]">
            {logs.map((l) => {
              const statusColor =
                l.status === "FAILURE"
                  ? "text-[var(--color-error)]"
                  : "text-[var(--color-success)]";
              return (
                <li key={l.id}>
                  {/* Desktop: grid row */}
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className="hidden md:grid w-full grid-cols-[180px_180px_1fr_200px_120px_80px] items-center gap-3 px-2 py-3.5 text-left text-sm hover:bg-[var(--color-bg-secondary)]/40"
                  >
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {formatTs(l.createdAt)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium">
                        {l.actorName ?? l.actorId ?? "—"}
                      </span>
                      <span
                        className={`inline-flex h-4 shrink-0 items-center rounded-full border px-1.5 text-[11px] ${roleColor(
                          l.actorRole,
                        )}`}
                      >
                        {l.actorRole ?? "—"}
                      </span>
                    </div>
                    <span className="truncate text-[var(--color-text-secondary)]">
                      {l.action ?? "—"}
                    </span>
                    <span className="truncate font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                      {l.targetType ?? "—"} · {l.targetId ?? "—"}
                    </span>
                    <span className="truncate font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                      {l.ip ?? "—"}
                    </span>
                    <span className={`text-xs font-medium ${statusColor}`}>
                      {l.status ?? "SUCCESS"}
                    </span>
                  </button>
                  {/* Mobile: card layout — tap opens drawer (which is fullscreen on mobile) */}
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className="flex w-full flex-col gap-2 px-3 py-4 text-left hover:bg-[var(--color-bg-secondary)]/40 md:hidden"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {l.action ?? "—"}
                      </span>
                      <span className={`shrink-0 text-xs font-medium ${statusColor}`}>
                        {l.status ?? "SUCCESS"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                      <span className="truncate font-medium">
                        {l.actorName ?? l.actorId ?? "—"}
                      </span>
                      <span
                        className={`inline-flex h-4 shrink-0 items-center rounded-full border px-1.5 text-[11px] ${roleColor(
                          l.actorRole,
                        )}`}
                      >
                        {l.actorRole ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                      <span className="truncate font-mono tabular-nums">
                        {l.targetType ?? "—"} · {l.targetId ?? "—"}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {formatTs(l.createdAt)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Drawer */}
      {selected && (
        <>
          <div
            aria-hidden
            onClick={() => setSelectedId(null)}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <aside
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 overflow-y-auto border-l-0 border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-6 py-6 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-full md:max-w-md md:border-l md:px-8 md:py-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
                  Audit · {selected.actorRole ?? "—"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  {selected.action ?? "—"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="닫기"
                className="-mr-2 h-8 w-8 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-8 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              <Row label="Timestamp" value={formatTs(selected.createdAt)} mono />
              <Row
                label="Actor"
                value={`${selected.actorName ?? selected.actorId ?? "—"} (${
                  selected.actorRole ?? "—"
                })`}
              />
              <Row label="IP" value={selected.ip ?? "—"} mono />
              <Row label="User-Agent" value={selected.ua ?? "—"} mono />
              <Row
                label="Resource"
                value={`${selected.targetType ?? "—"} · ${selected.targetId ?? "—"}`}
                mono
              />
              <Row
                label="Status"
                value={
                  <span
                    className={`text-xs font-medium ${
                      selected.status === "FAILURE"
                        ? "text-[var(--color-error)]"
                        : "text-[var(--color-success)]"
                    }`}
                  >
                    {selected.status ?? "SUCCESS"}
                  </span>
                }
              />
            </dl>

            {(selected.before || selected.after) && (
              <div className="mt-8">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  Diff
                </p>
                <div className="mt-3">
                  <AuditDiffViewer
                    before={selected.before}
                    after={selected.after}
                  />
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-2 py-2.5">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd
        className={`text-xs text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums break-all" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
