"use client";

// Wave N — /admin/udi-reports/[period] client island.
// master + items 받아 KPI + Tab + table 렌더. 재시도 mutation 호출.

import {useMemo, useState} from "react";
import {toast} from "sonner";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowLeft, ChevronDown, Loader2} from "lucide-react";

import {CountUp} from "@/components/shared/count-up";
import {trpc} from "@/lib/trpc/client";

export type DetailCounts = {
  totalCount: number;
  successCount: number;
  failCount: number;
  retryAvailable: number;
};

export type AdminUdiMaster = {
  id: string;
  period: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "PARTIAL" | "FAILED";
  totalCount?: number;
  successCount?: number;
  failCount?: number;
  completedAt?: unknown;
  startedAt?: unknown;
};

export type AdminUdiItem = {
  id: string;
  subOrderId: string;
  vendorId?: string;
  vendorName?: string;
  vendorBizRegNo?: string;
  hospitalId?: string;
  hospitalName?: string;
  hospitalBizRegNo?: string;
  productId?: string;
  productName?: string;
  udiCode?: string;
  lotNo?: string;
  expiry?: string;
  mfdsLicenseNo?: string;
  quantity?: number;
  unitPrice?: number;
  saleDate?: string;
  result?: {
    success: boolean;
    resultCode?: string;
    resultMessage?: string;
    receiptNo?: string;
    source?: "mfds" | "mock";
  };
  retryCount?: number;
  reportedAt?: unknown;
};

type Tab = "ALL" | "OK" | "FAIL";

const TABS: Array<{value: Tab; label: string}> = [
  {value: "ALL", label: "전체"},
  {value: "OK", label: "성공"},
  {value: "FAIL", label: "실패"},
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

function masterStatusLabel(
  status?: AdminUdiMaster["status"],
): {label: string; tone: string} {
  switch (status) {
    case "COMPLETED":
      return {label: "성공", tone: "success"};
    case "PARTIAL":
      return {label: "일부 실패", tone: "warning"};
    case "IN_PROGRESS":
      return {label: "진행중", tone: "accent"};
    case "FAILED":
      return {label: "실패", tone: "error"};
    default:
      return {label: "미보고", tone: "tertiary"};
  }
}

export function UdiReportDetailClient({
  period,
  master,
  items: initialItems,
  counts,
  isPreview,
}: {
  period: string;
  master: AdminUdiMaster | null;
  items: AdminUdiItem[];
  counts: DetailCounts;
  isPreview: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ALL");
  const [open, setOpen] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const retryMutation = trpc.admin.udi.retryItem.useMutation();

  const items = initialItems;

  const filtered = useMemo(() => {
    if (tab === "ALL") return items;
    if (tab === "OK")
      return items.filter((r) => r.result?.success === true);
    return items.filter((r) => r.result?.success === false);
  }, [items, tab]);

  const tabCounts: Record<Tab, number> = {
    ALL: items.length,
    OK: items.filter((r) => r.result?.success === true).length,
    FAIL: items.filter((r) => r.result?.success === false).length,
  };

  const yearMonth = `${period.slice(0, 4)}년 ${parseInt(period.slice(5, 7), 10)}월`;
  const status = masterStatusLabel(master?.status);

  async function handleRetry(it: AdminUdiItem) {
    if (retryingId) return;
    setRetryingId(it.id);
    try {
      await retryMutation.mutateAsync({period, subOrderId: it.subOrderId});
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`재시도 실패: ${msg}`);
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
        <Link
          href="/admin/udi-reports"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3 w-3" />
          UDI 보고 list
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            UDI Report
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            {yearMonth} 보고
          </h1>
          {isPreview && (
            <p className="mt-2 text-[11px] text-[var(--color-warning)]">
              미리보기 모드 — 로그인하면 실제 데이터가 표시됩니다
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
            완료 일자: {tsToDateStr(master?.completedAt)}
          </span>
          <span
            className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium ${
              status.tone === "success"
                ? "border-[var(--color-success)] bg-[var(--color-success)]/5 text-[var(--color-success)]"
                : status.tone === "warning"
                  ? "border-[var(--color-warning)] bg-[var(--color-warning)]/5 text-[var(--color-warning)]"
                  : status.tone === "accent"
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5 text-[var(--color-accent)]"
                    : status.tone === "error"
                      ? "border-[var(--color-error)] bg-[var(--color-error)]/5 text-[var(--color-error)]"
                      : "border-[var(--color-border-light)] text-[var(--color-text-tertiary)]"
            }`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* KPI 4 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <KpiCell label="총 SubOrder" value={counts.totalCount} unit="건" />
        <KpiCell
          label="성공"
          value={counts.successCount}
          unit="건"
          deltaTone="success"
          delta={
            counts.totalCount > 0
              ? `${((counts.successCount / counts.totalCount) * 100).toFixed(2)}%`
              : "—"
          }
        />
        <KpiCell
          label="실패"
          value={counts.failCount}
          unit="건"
          deltaTone="error"
          delta="검토 필요"
        />
        <KpiCell
          label="재시도 가능"
          value={counts.retryAvailable}
          unit="건"
          deltaTone="warning"
          delta="수동 재시도"
        />
      </dl>

      {/* Filter chip row */}
      <div className="mt-10 flex flex-wrap items-center gap-3">
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

      {/* Segment tabs */}
      <nav
        className="mt-8 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="결과 필터"
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
      <div className="mt-6 border-y border-[var(--color-border-light)]">
        <div className="grid grid-cols-[140px_140px_1fr_220px_120px_100px_100px_120px] gap-3 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>SubOrder</span>
          <span>Vendor</span>
          <span>상품</span>
          <span>UDI</span>
          <span>LOT</span>
          <span>유통기한</span>
          <span>상태</span>
          <span className="text-right">액션</span>
        </div>
        <ul className="divide-y divide-[var(--color-border-light)]">
          {filtered.length === 0 && (
            <li className="px-2 py-10 text-center text-xs text-[var(--color-text-tertiary)]">
              해당 조건에 맞는 항목이 없습니다
            </li>
          )}
          {filtered.map((r) => {
            const isOpen = open === r.id;
            const success = r.result?.success === true;
            const failed = r.result?.success === false;
            const stColor = success
              ? "text-[var(--color-success)]"
              : failed
                ? "text-[var(--color-error)]"
                : "text-[var(--color-text-tertiary)]";
            const stLabel = success ? "성공" : failed ? "실패" : "대기";
            return (
              <li key={r.id}>
                <div className="grid grid-cols-[140px_140px_1fr_220px_120px_100px_100px_120px] items-center gap-3 px-2 py-3.5 text-sm">
                  <span className="truncate font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                    {r.subOrderId}
                  </span>
                  <span className="truncate text-xs">
                    {r.vendorName ?? "—"}
                  </span>
                  <span className="truncate font-medium">
                    {r.productName ?? "—"}
                  </span>
                  <span className="truncate font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                    {r.udiCode ?? "—"}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                    {r.lotNo ?? "—"}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                    {r.expiry ?? "—"}
                  </span>
                  <span className={`text-xs font-medium ${stColor}`}>
                    {stLabel}
                    {failed && r.result?.resultCode && (
                      <span className="ml-1 text-[11px] text-[var(--color-text-tertiary)]">
                        {r.result.resultCode}
                      </span>
                    )}
                  </span>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : r.id)}
                      className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-2.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    >
                      raw
                    </button>
                    {failed && (
                      <button
                        type="button"
                        onClick={() => handleRetry(r)}
                        disabled={retryingId === r.id}
                        className="inline-flex h-7 items-center rounded-full bg-[var(--color-warning)]/10 px-2.5 text-xs font-medium text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20 disabled:opacity-60"
                      >
                        {retryingId === r.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "재시도"
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <pre className="overflow-x-auto bg-[var(--color-bg-secondary)]/40 px-4 py-3 font-mono text-[11px] tabular-nums text-[var(--color-text-secondary)]">
                    {JSON.stringify(
                      {
                        subOrderId: r.subOrderId,
                        vendor: {
                          id: r.vendorId,
                          name: r.vendorName,
                          bizRegNo: r.vendorBizRegNo,
                        },
                        hospital: {
                          id: r.hospitalId,
                          name: r.hospitalName,
                          bizRegNo: r.hospitalBizRegNo,
                        },
                        product: {
                          id: r.productId,
                          name: r.productName,
                          udi: r.udiCode,
                          lotNo: r.lotNo,
                          expiry: r.expiry,
                          mfdsLicenseNo: r.mfdsLicenseNo,
                        },
                        sale: {
                          quantity: r.quantity,
                          unitPrice: r.unitPrice,
                          saleDate: r.saleDate,
                        },
                        result: r.result,
                        retryCount: r.retryCount,
                        reportedAt: tsToDateStr(r.reportedAt),
                      },
                      null,
                      2,
                    )}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  unit,
  delta,
  deltaTone,
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: string;
  deltaTone?: "accent" | "warning" | "error" | "success";
}) {
  const deltaColor = {
    accent: "text-[var(--color-accent)]",
    warning: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
    success: "text-[var(--color-success)]",
  } as const;
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
        <CountUp value={value} integer />
        {unit && (
          <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
            {unit}
          </span>
        )}
      </p>
      {delta && (
        <p
          className={`mt-2 text-xs ${deltaTone ? deltaColor[deltaTone] : "text-[var(--color-text-tertiary)]"}`}
        >
          {delta}
        </p>
      )}
    </div>
  );
}
