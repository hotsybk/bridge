"use client";

// Wave N — /admin/udi-reports client island.
// timeline + KPI + Tab + Table + 즉시 보고 Cloud Function 호출.

import {useMemo, useState} from "react";
import Link from "next/link";
import {ChevronDown, Loader2} from "lucide-react";

import {AdminKpiCell} from "@/components/admin/admin-kpi-cell";
import {CountUp} from "@/components/shared/count-up";
import {PageHeader} from "@/components/shared/page-header";
import {PreviewBadge} from "@/components/shared/preview-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {app} from "@/lib/firebase/client";

export type UdiCounts = {
  totalCount: number;
  successCount: number;
  failCount: number;
  retryAvailable: number;
};

export type AdminUdiReportRow = {
  id: string;
  period: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "PARTIAL" | "FAILED";
  totalCount: number;
  successCount: number;
  failCount: number;
  completedAt?: unknown;
};

type Tab = "ALL" | "DONE" | "PARTIAL" | "PENDING";

const TABS: Array<{value: Tab; label: string}> = [
  {value: "ALL", label: "전체"},
  {value: "DONE", label: "보고 완료"},
  {value: "PARTIAL", label: "일부 실패"},
  {value: "PENDING", label: "대기/진행중"},
];

const FILTERS = ["Vendor", "실패 사유", "등급"] as const;

function tsToDateStr(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "—";
  const w1 = ts as {toDate?: () => Date; seconds?: number; _seconds?: number};
  let d: Date | null = null;
  if (typeof w1.toDate === "function") {
    try {
      d = w1.toDate();
    } catch {
      d = null;
    }
  }
  if (!d) {
    const sec = w1.seconds ?? w1._seconds;
    if (typeof sec === "number") d = new Date(sec * 1000);
  }
  if (!d) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function periodLabel(period: string): string {
  return `${period.slice(5, 7)}월`;
}

function statusKor(status: AdminUdiReportRow["status"]): string {
  switch (status) {
    case "COMPLETED":
      return "성공";
    case "PARTIAL":
      return "일부 실패";
    case "IN_PROGRESS":
      return "진행중";
    case "FAILED":
      return "실패";
    default:
      return "미보고";
  }
}

function statusDot(status: AdminUdiReportRow["status"]): string {
  switch (status) {
    case "COMPLETED":
      return "bg-[var(--color-success)]";
    case "PARTIAL":
      return "bg-[var(--color-warning)]";
    case "IN_PROGRESS":
      return "bg-[var(--color-accent)]";
    case "FAILED":
      return "bg-[var(--color-error)]";
    default:
      return "bg-[var(--color-text-tertiary)]";
  }
}

function statusColor(status: AdminUdiReportRow["status"]): string {
  switch (status) {
    case "COMPLETED":
      return "text-[var(--color-success)]";
    case "PARTIAL":
      return "text-[var(--color-warning)]";
    case "IN_PROGRESS":
      return "text-[var(--color-accent)]";
    case "FAILED":
      return "text-[var(--color-error)]";
    default:
      return "text-[var(--color-text-tertiary)]";
  }
}

export function UdiReportsClient({
  reports,
  counts,
  currentPeriod,
  isPreview,
}: {
  reports: AdminUdiReportRow[];
  counts: UdiCounts;
  currentPeriod: string;
  isPreview: boolean;
}) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [reportOpen, setReportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // timeline 은 항상 12개월 모두 표시 (오름차순)
  const timeline = useMemo(
    () => [...reports].sort((a, b) => a.period.localeCompare(b.period)),
    [reports],
  );

  const filtered = useMemo(() => {
    if (tab === "ALL") return reports;
    if (tab === "DONE") return reports.filter((r) => r.status === "COMPLETED");
    if (tab === "PARTIAL")
      return reports.filter((r) => r.status === "PARTIAL");
    return reports.filter(
      (r) => r.status === "PENDING" || r.status === "IN_PROGRESS",
    );
  }, [reports, tab]);

  const tabCounts: Record<Tab, number> = {
    ALL: reports.length,
    DONE: reports.filter((r) => r.status === "COMPLETED").length,
    PARTIAL: reports.filter((r) => r.status === "PARTIAL").length,
    PENDING: reports.filter(
      (r) => r.status === "PENDING" || r.status === "IN_PROGRESS",
    ).length,
  };

  const successRate =
    counts.totalCount > 0
      ? Math.round((counts.successCount / counts.totalCount) * 1000) / 10
      : 0;

  async function handleTriggerNow(period?: string) {
    if (submitting) return;
    const target = period ?? currentPeriod;
    setSubmitting(true);
    try {
      const {getFunctions, httpsCallable} = await import("firebase/functions");
      const functions = getFunctions(app, "asia-northeast3");
      const fn = httpsCallable<
        {period?: string},
        {success: number; fail: number; total: number; period: string}
      >(functions, "triggerUdiReport");
      const {data} = await fn({period: target});
      setReportOpen(false);
      alert(
        `${data.period} 보고 완료\n총 ${data.total}건 / 성공 ${data.success} / 실패 ${data.fail}`,
      );
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`즉시 보고 실패: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <PageHeader
        label="재무 · UDI 보고"
        title="식약처 UDI 보고"
        description="월말 e-MEDI 자동 보고"
      >
        {isPreview && <PreviewBadge />}
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          disabled={submitting}
          className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          이번달 즉시 보고
        </button>
      </PageHeader>

      {/* KPI 4 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <AdminKpiCell
          label="이번달 총 건수"
          value={<CountUp value={counts.totalCount} integer />}
          sub="건"
          delta={`${currentPeriod}`}
          deltaColor="accent"
        />
        <AdminKpiCell
          label="이번달 보고 완료"
          value={<CountUp value={counts.successCount} integer />}
          sub="건"
          delta="누적"
          deltaColor="success"
        />
        <AdminKpiCell
          label="식약처 응답 에러"
          value={<CountUp value={counts.failCount} integer />}
          sub="건"
          delta="재시도 가능"
          deltaColor="error"
        />
        <AdminKpiCell
          label="보고 성공률"
          value={<CountUp value={successRate} integer={false} />}
          sub="%"
          delta="목표 99% 상회"
          deltaColor="success"
        />
      </dl>

      {/* Month timeline */}
      <section className="mt-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          최근 12개월
        </p>
        <ul className="mt-4 grid grid-cols-6 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-12">
          {timeline.map((m) => (
            <li key={m.period} className="px-2 py-4">
              <Link
                href={`/admin/udi-reports/${m.period}`}
                className="block text-center hover:opacity-80"
                title={`${(m.totalCount ?? 0).toLocaleString()}건 · ${statusKor(m.status)}`}
              >
                <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">
                  {periodLabel(m.period)}
                </span>
                <span
                  aria-hidden
                  className={`mx-auto mt-2 block h-2 w-2 rounded-full ${statusDot(m.status)}`}
                />
                <span className="mt-1.5 block font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                  {(m.totalCount ?? 0).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Segment tabs */}
      <nav
        className="mt-10 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="UDI 보고 필터"
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={active}
              className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs tabular-nums text-[var(--color-text-tertiary)]">
                {tabCounts[t.value]}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-0.5 bg-[var(--color-accent)]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Table */}
      <div className="mt-8 border-y border-[var(--color-border-light)]">
        <div className="grid grid-cols-[120px_120px_100px_100px_100px_140px_100px] gap-3 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>보고 월</span>
          <span className="text-right">총 건수</span>
          <span className="text-right">성공</span>
          <span className="text-right">실패</span>
          <span className="text-right">성공률</span>
          <span>완료 일자</span>
          <span>상태</span>
        </div>
        <ul className="divide-y divide-[var(--color-border-light)]">
          {filtered.length === 0 && (
            <li className="px-2 py-10 text-center text-xs text-[var(--color-text-tertiary)]">
              해당 조건에 맞는 보고가 없습니다
            </li>
          )}
          {filtered.map((m) => {
            const total = m.totalCount ?? 0;
            const ok = m.successCount ?? 0;
            const fail = m.failCount ?? 0;
            const rate =
              total > 0 ? `${((ok / total) * 100).toFixed(1)}%` : "—";
            return (
              <li
                key={m.period}
                className="grid grid-cols-[120px_120px_100px_100px_100px_140px_100px] items-center gap-3 px-2 py-3.5 text-sm"
              >
                <Link
                  href={`/admin/udi-reports/${m.period}`}
                  className="font-mono text-xs tabular-nums text-[var(--color-accent)] hover:underline"
                >
                  {m.period}
                </Link>
                <span className="text-right font-mono tabular-nums">
                  {total.toLocaleString()}
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-[var(--color-success)]">
                  {ok.toLocaleString()}
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-[var(--color-error)]">
                  {fail.toLocaleString()}
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                  {rate}
                </span>
                <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                  {tsToDateStr(m.completedAt)}
                </span>
                <span className={`text-xs font-medium ${statusColor(m.status)}`}>
                  {statusKor(m.status)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Filter chip row */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {FILTERS.map((label) => (
          <button
            key={label}
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-3 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]"
          >
            {label}
            <ChevronDown className="h-3 w-3" />
          </button>
        ))}
      </div>

      {/* Dialog — 이번달 즉시 보고 */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentPeriod} 즉시 보고</DialogTitle>
            <DialogDescription>
              이번달 미보고 SubOrder {counts.totalCount.toLocaleString()}건을
              식약처 OpenAPI 로 전송합니다. 완료까지 약 2~3분 소요됩니다.
            </DialogDescription>
          </DialogHeader>
          <dl className="mt-2 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <DialogRow
              label="대상 SubOrder"
              value={`${counts.totalCount.toLocaleString()}건`}
              mono
            />
            <DialogRow label="예상 소요" value="2~3분" mono />
            <DialogRow label="식약처 API" value="emedi.mfds.go.kr" mono />
          </dl>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => handleTriggerNow()}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              즉시 보고
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DialogRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-2 py-3">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd
        className={`text-sm text-[var(--color-text-primary)] ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
