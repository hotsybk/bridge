// Phase ν-1 — /admin/payouts index (지급 이력 vendor 별 집계).
// 사이드바 '지급 이력' 진입 시 404 였던 페이지. 본 라우트에서 vendor 별 row 노출.
// 각 row 클릭 → /admin/payouts/[vendorId] 단건 페이지.

import Link from "next/link";
import {ArrowUpRight, Coins} from "lucide-react";

import {AdminKpiCell} from "@/components/admin/admin-kpi-cell";
import {CountUp} from "@/components/shared/count-up";
import {PageHeader} from "@/components/shared/page-header";
import {PreviewBadge} from "@/components/shared/preview-badge";
import {trpcServer} from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

type PayoutRow = {
  vendorId: string;
  vendorName: string;
  totalPaid: number;
  thisMonth: number;
  unpaid: number;
  held: number;
  lastPaidAt: number | null;
  hasHold: boolean;
  hasFastPending: boolean;
  countPaid: number;
  countPending: number;
};

type GlobalCounts = {
  thisMonthPaid: number;
  unpaid: number;
  paidCount: number;
  holdCount: number;
};

const MOCK_ROWS: PayoutRow[] = [
  {
    vendorId: "demo-v1",
    vendorName: "메디서플라이",
    totalPaid: 142300000,
    thisMonth: 12400000,
    unpaid: 3120000,
    held: 0,
    lastPaidAt: Date.now() - 2 * 86400000,
    hasHold: false,
    hasFastPending: true,
    countPaid: 42,
    countPending: 3,
  },
  {
    vendorId: "demo-v2",
    vendorName: "한빛메디칼(주)",
    totalPaid: 98200000,
    thisMonth: 8400000,
    unpaid: 1820000,
    held: 0,
    lastPaidAt: Date.now() - 4 * 86400000,
    hasHold: false,
    hasFastPending: false,
    countPaid: 31,
    countPending: 2,
  },
  {
    vendorId: "demo-v3",
    vendorName: "케어스토어",
    totalPaid: 67400000,
    thisMonth: 4200000,
    unpaid: 0,
    held: 850000,
    lastPaidAt: Date.now() - 9 * 86400000,
    hasHold: true,
    hasFastPending: false,
    countPaid: 22,
    countPending: 1,
  },
  {
    vendorId: "demo-v4",
    vendorName: "헬스케어",
    totalPaid: 54200000,
    thisMonth: 6280000,
    unpaid: 6280000,
    held: 0,
    lastPaidAt: Date.now() - 15 * 86400000,
    hasHold: false,
    hasFastPending: false,
    countPaid: 14,
    countPending: 1,
  },
];

const MOCK_COUNTS: GlobalCounts = {
  thisMonthPaid: 31280000,
  unpaid: 11220000,
  paidCount: 109,
  holdCount: 1,
};

function formatRelativeDay(ms: number | null): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 0) return "예정";
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export default async function AdminPayoutsIndexPage() {
  let rows: PayoutRow[] = [];
  let counts: GlobalCounts = MOCK_COUNTS;
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [r, c] = await Promise.all([
      trpc.admin.settlement.payoutSummaryByVendor(),
      trpc.admin.settlement.payoutGlobalCounts(),
    ]);
    rows = r;
    counts = c;
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      rows = MOCK_ROWS;
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      {/* Header */}
      <PageHeader
        label="재무 · 지급"
        title="지급 이력"
        description="vendor별 지급·잔액·보류"
      >
        {isPreview && <PreviewBadge />}
        <Link
          href="/admin/settlement"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-4 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-primary)] hover:text-[var(--color-text-primary)]"
        >
          정산 운영으로
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </PageHeader>

      {/* KPI 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <AdminKpiCell
          label="이번 달 지급"
          value={<CountUp value={counts.thisMonthPaid} integer />}
          sub="원"
          deltaColor="accent"
        />
        <AdminKpiCell
          label="미지급 잔액"
          value={<CountUp value={counts.unpaid} integer />}
          sub="원"
          deltaColor={counts.unpaid > 0 ? "warning" : "neutral"}
        />
        <AdminKpiCell
          label="지급 완료"
          value={<CountUp value={counts.paidCount} integer />}
          sub="건"
          deltaColor="success"
        />
        <AdminKpiCell
          label="보류"
          value={<CountUp value={counts.holdCount} integer />}
          sub="건"
          deltaColor={counts.holdCount > 0 ? "error" : "neutral"}
        />
      </dl>

      {/* Vendor 별 Line Table */}
      <h2 className="mt-12 text-xl font-semibold tracking-[-0.02em]">
        공급업체별 지급 현황
      </h2>
      <div className="mt-3 border-y border-[var(--color-border-light)]">
        <div className="hidden md:grid grid-cols-[1fr_120px_140px_140px_140px_100px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>공급업체</span>
          <span className="text-right">누적 지급</span>
          <span className="text-right">이번 달</span>
          <span className="text-right">미지급</span>
          <span>최근 지급</span>
          <span>상태</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-2 py-20 text-center">
            <Coins className="mx-auto h-6 w-6 text-[var(--color-text-tertiary)]" />
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              지급 이력이 없습니다
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)]">
            {rows.map((r) => {
              const tone = r.hasHold
                ? {dot: "bg-[var(--color-error)]", text: "text-[var(--color-error)]", label: "보류"}
                : r.hasFastPending
                  ? {dot: "bg-[var(--color-accent)]", text: "text-[var(--color-accent)]", label: "빠른정산 대기"}
                  : r.unpaid > 0
                    ? {dot: "bg-[var(--color-text-tertiary)]", text: "text-[var(--color-text-tertiary)]", label: "예약"}
                    : {dot: "bg-[var(--color-success)]", text: "text-[var(--color-success)]", label: "정상"};
              return (
                <li key={r.vendorId}>
                  {/* Desktop */}
                  <Link
                    href={`/admin/payouts/${r.vendorId}`}
                    className="hidden md:grid grid-cols-[1fr_120px_140px_140px_140px_100px] items-center gap-4 px-2 py-4 text-sm transition-colors hover:bg-[var(--color-bg-tertiary)]/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[var(--color-text-primary)]">
                        {r.vendorName}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-[var(--color-text-tertiary)]">
                        {r.vendorId}
                      </span>
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      ₩{r.totalPaid.toLocaleString()}
                    </span>
                    <span className="text-right font-mono tabular-nums text-[var(--color-text-secondary)]">
                      ₩{r.thisMonth.toLocaleString()}
                    </span>
                    <span
                      className={`text-right font-mono tabular-nums ${
                        r.unpaid > 0
                          ? "text-[var(--color-warning)]"
                          : "text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      ₩{r.unpaid.toLocaleString()}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {formatRelativeDay(r.lastPaidAt)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`status-pulse-dot h-1.5 w-1.5 rounded-full ${tone.dot}`}
                      />
                      <span className={`text-xs font-medium ${tone.text}`}>
                        {tone.label}
                      </span>
                    </span>
                  </Link>
                  {/* Mobile */}
                  <Link
                    href={`/admin/payouts/${r.vendorId}`}
                    className="flex flex-col gap-2 px-3 py-4 transition-colors hover:bg-[var(--color-bg-tertiary)]/40 md:hidden"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {r.vendorName}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          aria-hidden
                          className={`status-pulse-dot h-1.5 w-1.5 rounded-full ${tone.dot}`}
                        />
                        <span className={`text-xs font-medium ${tone.text}`}>
                          {tone.label}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[var(--color-text-tertiary)]">
                        누적 지급
                      </span>
                      <span className="font-mono font-semibold tabular-nums">
                        ₩{r.totalPaid.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                      <span>
                        이번 달 ₩{r.thisMonth.toLocaleString()}
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          r.unpaid > 0
                            ? "text-[var(--color-warning)]"
                            : ""
                        }`}
                      >
                        미지급 ₩{r.unpaid.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-tertiary)]">
                      최근 지급 {formatRelativeDay(r.lastPaidAt)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--color-text-tertiary)]">
        총 {rows.length}개 공급업체 · 지급 완료 {counts.paidCount}건 · 보류 {counts.holdCount}건
      </p>
    </div>
  );
}

