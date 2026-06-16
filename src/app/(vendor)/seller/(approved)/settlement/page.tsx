"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Edit3,
  Loader2,
  TrendingUp,
  Zap,
} from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { AccountChangeDialog } from "@/components/vendor/account-change-dialog";
import {
  SettlementDetailDialog,
  type SettlementDetailRow,
} from "@/components/vendor/settlement-detail-dialog";
import { downloadCsv, todayStamp } from "@/lib/csv-download";
import { trpc } from "@/lib/trpc/client";

/**
 * Wave P2 — 파트너센터 정산 (tRPC 실시간 연동).
 *
 * D+3 자동 정산이 핵심 가치 (CLAUDE.md §0).
 * 디자인 DNA: 박스 없음. KPI 4컬럼 라인, 차트도 라인 only,
 * 정산 계좌 인라인, 정산 이력은 행 사이 divider 만.
 *
 * - 데이터: trpc.vendor.settlement.list / counts / payouts
 * - 빠른정산 신청: trpc.vendor.settlement.requestFastSettlement
 * - PREVIEW fallback: 인증 미완료 / 빈 결과 시 미리보기 dummy rows
 */

type UiStatus = "PAID" | "PROCESSING" | "HOLD";

const STATUS_META: Record<UiStatus, { label: string; color: string }> = {
  PAID: { label: "입금 완료", color: "text-[var(--color-status-delivered)]" },
  PROCESSING: { label: "처리 중", color: "text-[var(--color-status-paid)]" },
  HOLD: { label: "보류", color: "text-[var(--color-error)]" },
};

const FILTERS = [
  { key: "ALL" as const, label: "전체" },
  { key: "PROCESSING" as const, label: "처리 중" },
  { key: "PAID" as const, label: "입금 완료" },
  { key: "HOLD" as const, label: "보류" },
];
type FilterKey = (typeof FILTERS)[number]["key"];

// Backend SettlementStatus → UI
function backendToUi(s: string): UiStatus {
  if (s === "PAID") return "PAID";
  if (s === "HOLD") return "HOLD";
  return "PROCESSING"; // PENDING, REQUESTED, APPROVED, FAILED
}

function tsToDateStr(ts: unknown): string {
  if (!ts) return "—";
  const w = ts as { _seconds?: number; seconds?: number; toDate?: () => Date };
  if (typeof w.toDate === "function") {
    try {
      return w.toDate().toISOString().slice(0, 10);
    } catch {
      /* fallthrough */
    }
  }
  const sec = w._seconds ?? w.seconds;
  if (typeof sec === "number") {
    return new Date(sec * 1000).toISOString().slice(0, 10);
  }
  return "—";
}

function tsToPeriodStr(start: unknown, end: unknown): string {
  const s = tsToDateStr(start);
  const e = tsToDateStr(end);
  if (s === "—" || e === "—") return s !== "—" ? s : e;
  return `${s} ~ ${e.slice(5)}`;
}

type SettleRow = {
  id: string;
  period: string;
  paidOn: string;
  gross: number;
  fee: number;
  net: number;
  status: UiStatus;
  isFastEligible?: boolean; // PENDING 이고 빠른정산 신청 가능
  backendStatus: string;
};

const PREVIEW_ROWS: SettleRow[] = [
  { id: "preview-1", period: "2026-05-18 ~ 05-21", paidOn: "2026-05-23", gross: 469800, fee: 23490, net: 446310, status: "PROCESSING", isFastEligible: true, backendStatus: "PENDING" },
  { id: "preview-2", period: "2026-05-11 ~ 05-17", paidOn: "2026-05-20", gross: 1240000, fee: 62000, net: 1178000, status: "PAID", backendStatus: "PAID" },
  { id: "preview-3", period: "2026-05-04 ~ 05-10", paidOn: "2026-05-13", gross: 2180000, fee: 109000, net: 2071000, status: "PAID", backendStatus: "PAID" },
  { id: "preview-4", period: "2026-04-27 ~ 05-03", paidOn: "2026-05-06", gross: 1980000, fee: 99000, net: 1881000, status: "PAID", backendStatus: "PAID" },
  { id: "preview-5", period: "2026-04-20 ~ 04-26", paidOn: "2026-04-29", gross: 2840000, fee: 142000, net: 2698000, status: "PAID", backendStatus: "PAID" },
  { id: "preview-6", period: "2026-04-13 ~ 04-19", paidOn: "—", gross: 187500, fee: 9375, net: 178125, status: "HOLD", backendStatus: "HOLD" },
];

const PREVIEW_COUNTS = {
  totalPaid: 8430000,
  thisMonth: 5895000,
  pending: 1842300,
  held: 178125,
};

const PREVIEW_ACCOUNT = {
  bank: "국민은행",
  account: "••••-••••-1234",
  holder: "더미 의료기기 유한회사",
  cycle: "D+3 자동 입금",
  feeRate: "5.0%",
};

// Phase γ-2 — 차트 값은 raw KRW (monthlyGmv 실데이터와 단위 통일).
const PREVIEW_CHART = [
  { label: "12월", value: 8_200_000 },
  { label: "1월", value: 7_400_000 },
  { label: "2월", value: 9_100_000 },
  { label: "3월", value: 10_800_000 },
  { label: "4월", value: 10_900_000 },
  { label: "5월", value: 12_400_000, current: true },
];

export default function SellerSettlementPage() {
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [accountOpen, setAccountOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<SettlementDetailRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Phase γ-2 — cursor pagination
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulated, setAccumulated] = useState<SettleRow[]>([]);

  const listQuery = trpc.vendor.settlement.list.useQuery({
    pageSize: 50,
    cursor,
  });
  const countsQuery = trpc.vendor.settlement.counts.useQuery();
  const vendorQuery = trpc.vendor.getCurrent.useQuery();
  const monthlyGmvQuery = trpc.vendor.settlement.monthlyGmv.useQuery();

  const utils = trpc.useUtils();
  const fastMutation = trpc.vendor.settlement.requestFastSettlement.useMutation({
    onSuccess: () => {
      void utils.vendor.settlement.list.invalidate();
      void utils.vendor.settlement.counts.invalidate();
    },
  });
  const payoutChangeMutation =
    trpc.vendor.settlement.requestPayoutChange.useMutation({
      onSuccess: () => {
        void utils.vendor.getCurrent.invalidate();
      },
    });

  const usePreview =
    !listQuery.isPending &&
    (listQuery.error !== null ||
      (listQuery.data?.settlements.length ?? 0) === 0);

  // 페이지 응답을 accumulated 에 적재 (cursor pagination)
  useEffect(() => {
    if (!listQuery.data) return;
    const pageRows: SettleRow[] = listQuery.data.settlements.map((s) => {
      const sd = s as {
        id: string;
        status?: string;
        periodStart?: unknown;
        periodEnd?: unknown;
        paidAt?: unknown;
        scheduledPayoutAt?: unknown;
        grossAmount?: number;
        commissionAmount?: number;
        commissionVatAmount?: number;
        paymentFeeAmount?: number;
        paymentFeeVatAmount?: number;
        finalPayout?: number;
      };
      const fee =
        (sd.commissionAmount ?? 0) +
        (sd.commissionVatAmount ?? 0) +
        (sd.paymentFeeAmount ?? 0) +
        (sd.paymentFeeVatAmount ?? 0);
      return {
        id: sd.id,
        period: tsToPeriodStr(sd.periodStart, sd.periodEnd),
        paidOn:
          sd.status === "PAID"
            ? tsToDateStr(sd.paidAt)
            : tsToDateStr(sd.scheduledPayoutAt),
        gross: sd.grossAmount ?? 0,
        fee,
        net: sd.finalPayout ?? 0,
        status: backendToUi(sd.status ?? "PENDING"),
        isFastEligible: sd.status === "PENDING",
        backendStatus: sd.status ?? "PENDING",
      };
    });
    setAccumulated((prev) => {
      if (!cursor) return pageRows;
      const seen = new Set(prev.map((r) => r.id));
      const merged = [...prev];
      for (const r of pageRows) if (!seen.has(r.id)) merged.push(r);
      return merged;
    });
  }, [listQuery.data, cursor]);

  const rawRows: SettleRow[] = usePreview ? PREVIEW_ROWS : accumulated;
  const nextCursor = listQuery.data?.nextCursor;

  const counts = countsQuery.data ?? (usePreview ? PREVIEW_COUNTS : undefined);
  const vendor = vendorQuery.data;

  const account = vendor
    ? {
        bank: vendor.payoutBankCode || "은행 미등록",
        account: vendor.payoutBankAccount
          ? `••••-••••-${vendor.payoutBankAccount.slice(-4)}`
          : "계좌 미등록",
        holder: vendor.payoutAccountHolder || vendor.companyName || "—",
        cycle: vendor.fastSettlementEnabled
          ? "D+3 빠른정산 활성"
          : "D+7 자동 입금",
        feeRate: `${((vendor.defaultCommissionRate ?? 0.05) * 100).toFixed(1)}%`,
      }
    : PREVIEW_ACCOUNT;

  const totalGmv = vendor?.totalGmv ?? 12380000;

  const filteredRows = useMemo(() => {
    if (filter === "ALL") return rawRows;
    return rawRows.filter((r) => r.status === filter);
  }, [filter, rawRows]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function onDownloadAll() {
    downloadCsv(
      `tax_invoices_${todayStamp()}.csv`,
      ["정산 주기", "입금일", "총매출", "수수료", "실수령", "상태"],
      rawRows.map((r) => [
        r.period,
        r.paidOn,
        r.gross,
        r.fee,
        r.net,
        STATUS_META[r.status].label,
      ]),
    );
    showToast(`${rawRows.length}건의 정산 명세를 CSV 로 내보냈습니다.`);
  }

  function onAccountChange() {
    setAccountOpen(true);
  }

  async function onAccountSubmit(next: {
    bankCode: string;
    bankLabel: string;
    bankAccount: string;
    accountHolder: string;
  }) {
    try {
      await payoutChangeMutation.mutateAsync({
        bankCode: next.bankCode,
        bankAccount: next.bankAccount,
        accountHolder: next.accountHolder,
      });
      const masked =
        next.bankAccount.length > 4
          ? "•".repeat(next.bankAccount.length - 4) + next.bankAccount.slice(-4)
          : next.bankAccount;
      showToast(
        `계좌 변경 요청 접수 — ${next.bankLabel} ${masked} (운영자 검토 후 반영)`,
      );
      setAccountOpen(false);
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  function loadMore() {
    if (nextCursor) setCursor(nextCursor);
  }

  function onRowDetail(row: SettleRow) {
    setDetailRow({
      period: row.period,
      paidOn: row.paidOn,
      gross: row.gross,
      fee: row.fee,
      net: row.net,
      status: row.status,
    });
  }

  async function onRequestFast(row: SettleRow) {
    if (row.id.startsWith("preview-")) {
      showToast("미리보기 데이터에는 빠른정산을 신청할 수 없습니다.");
      return;
    }
    try {
      const res = await fastMutation.mutateAsync({ settlementId: row.id });
      showToast(
        `빠른정산 신청 완료 — 수수료 ₩${res.fastFee.toLocaleString()} 차감, 실수령 ₩${res.finalPayout.toLocaleString()}`,
      );
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  const KPIS = [
    {
      label: "정산 예정",
      icon: Clock,
      value: counts?.pending ?? 0,
      sub: "PENDING + REQUESTED + APPROVED",
      tone: "pending" as const,
    },
    {
      label: "이번 달 정산 완료",
      icon: CheckCircle2,
      value: counts?.thisMonth ?? 0,
      sub: "PAID 누적",
      tone: "delivered" as const,
    },
    {
      label: "누적 정산",
      icon: TrendingUp,
      value: counts?.totalPaid ?? 0,
      sub: "전체 PAID 합계",
      tone: "accent" as const,
    },
    {
      label: "보류 금액",
      icon: CreditCard,
      value: counts?.held ?? 0,
      sub: counts && counts.held > 0 ? "운영자 검토 중" : "—",
      tone: "tertiary" as const,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
      <PageHeader
        label="파트너센터 · 정산"
        title="정산"
        description="배송 완료 후 영업일 기준 3일 안에 등록 계좌로 자동 입금됩니다."
      >
        <button
          type="button"
          onClick={onDownloadAll}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-secondary)]"
        >
          <Download className="h-3.5 w-3.5" />
          세금계산서 일괄 다운로드
        </button>
      </PageHeader>

      {/* KPI 4 컬럼 */}
      <section className="mt-12 grid grid-cols-2 gap-y-8 border-y border-[var(--color-border-light)] py-8 lg:grid-cols-4 lg:gap-y-0">
        {KPIS.map((k, i) => (
          <KpiItem key={k.label} {...k} hasDivider={i > 0} />
        ))}
      </section>

      {/* 매출 차트 + 정산 계좌 — 박스 없음, 2 컬럼 분할 */}
      <section className="mt-12 grid gap-12 border-b border-[var(--color-border-light)] pb-12 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                월별 매출
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                ₩{totalGmv.toLocaleString()}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-success)]">
              <TrendingUp className="h-3 w-3" />
              누적 GMV
            </span>
          </div>
          <BarChart
            data={(() => {
              const live = monthlyGmvQuery.data;
              if (live && live.length > 0 && live.some((d) => d.value > 0)) {
                // 마지막 항목을 current 로 마킹
                return live.map((d, i) => ({
                  label: d.label,
                  value: d.value,
                  current: i === live.length - 1,
                }));
              }
              // fallback — preview
              return PREVIEW_CHART;
            })()}
          />
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            정산 계좌
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Banknote className="h-4 w-4 text-[var(--color-accent)]" />
            <div>
              <p className="text-sm font-semibold">{account.bank}</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)] tabular-nums">
                {account.account}
              </p>
            </div>
          </div>
          <dl className="mt-6 divide-y divide-[var(--color-border-light)] text-xs">
            <RowDef term="예금주" def={account.holder} />
            <RowDef term="정산 주기" def={account.cycle} />
            <RowDef term="기본 요율" def={account.feeRate} />
          </dl>
          <button
            type="button"
            onClick={onAccountChange}
            className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            <Edit3 className="h-3 w-3" />
            계좌 변경 요청
          </button>
        </div>
      </section>

      {/* 정산 이력 */}
      <section className="mt-12">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              정산 이력
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              총 {rawRows.length}건
            </h2>
          </div>
        </header>

        {/* 필터 탭 */}
        <nav
          aria-label="정산 상태 필터"
          className="mt-6 flex w-full items-stretch border-b border-[var(--color-border-light)]"
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={`-mb-px flex-1 border-b-2 py-3 text-xs font-medium transition-colors ${
                  active
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </nav>

        {/* 표 — Desktop only */}
        <div className="mt-2 hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] text-left text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                <th className="py-3 pr-6 font-medium">정산 주기</th>
                <th className="px-6 py-3 font-medium">입금일</th>
                <th className="px-6 py-3 text-right font-medium">총매출</th>
                <th className="px-6 py-3 text-right font-medium">수수료</th>
                <th className="px-6 py-3 text-right font-medium">실수령</th>
                <th className="px-6 py-3 font-medium">상태</th>
                <th className="px-6 py-3 text-right font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-16 text-center text-sm text-[var(--color-text-tertiary)]"
                  >
                    조건에 맞는 정산 내역이 없습니다.
                    <button
                      type="button"
                      onClick={() => setFilter("ALL")}
                      className="ml-2 font-medium text-[var(--color-accent)] hover:underline"
                    >
                      필터 초기화
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, i) => (
                  <SettleTableRow
                    key={`${filter}-${r.id}`}
                    row={r}
                    index={i}
                    onDetail={() => onRowDetail(r)}
                    onRequestFast={() => onRequestFast(r)}
                    isPending={fastMutation.isPending}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="mt-2 md:hidden">
          {filteredRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--color-text-tertiary)]">
              조건에 맞는 정산 내역이 없습니다.
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className="ml-2 font-medium text-[var(--color-accent)] hover:underline"
              >
                필터 초기화
              </button>
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              {filteredRows.map((r) => {
                const meta = STATUS_META[r.status];
                return (
                  <li
                    key={`m-${filter}-${r.id}`}
                    className="flex flex-col gap-2 px-3 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Calendar className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                        <span className="font-mono tabular-nums">{r.period}</span>
                      </span>
                      <span className={`shrink-0 text-xs font-semibold ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        실수령
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        ₩{r.net.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                      <span className="font-mono tabular-nums">
                        총 ₩{r.gross.toLocaleString()} · 수수료 −₩
                        {r.fee.toLocaleString()}
                      </span>
                      <span className="font-mono tabular-nums">
                        입금 {r.paidOn}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-end gap-3">
                      {r.isFastEligible && (
                        <button
                          type="button"
                          onClick={() => onRequestFast(r)}
                          disabled={fastMutation.isPending}
                          className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-accent)] hover:underline disabled:opacity-60"
                        >
                          {fastMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          빠른정산
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRowDetail(r)}
                        className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
                      >
                        상세
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Phase γ-2 — 더 보기 cursor pagination */}
        {!usePreview && nextCursor && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={listQuery.isFetching}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-5 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
            >
              {listQuery.isFetching
                ? "불러오는 중…"
                : `더 보기 (${rawRows.length}건 표시 중)`}
            </button>
          </div>
        )}
      </section>

      <p className="mt-12 border-t border-[var(--color-border-light)] pt-6 text-xs text-[var(--color-text-tertiary)]">
        Cloud Function `settle-suborder` 가 매일 03:00 KST 실행되어 자동 정산됩니다.
      </p>

      <AccountChangeDialog
        open={accountOpen}
        current={{
          bank: account.bank,
          account: account.account,
          holder: account.holder,
        }}
        isPending={payoutChangeMutation.isPending}
        onClose={() => setAccountOpen(false)}
        onSubmit={onAccountSubmit}
      />

      <SettlementDetailDialog
        open={!!detailRow}
        row={detailRow}
        onClose={() => setDetailRow(null)}
      />

      {toast && (
        <div
          role="status"
          className="toast-slide-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-text-primary)] px-5 py-3 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub components
// ─────────────────────────────────────────────────────────────

function KpiItem({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  hasDivider,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  sub: string;
  tone: "pending" | "delivered" | "accent" | "tertiary";
  hasDivider: boolean;
}) {
  const iconColor = {
    pending: "text-[var(--color-status-pending)]",
    delivered: "text-[var(--color-status-delivered)]",
    accent: "text-[var(--color-accent)]",
    tertiary: "text-[var(--color-text-tertiary)]",
  }[tone];
  return (
    <div
      className={`px-6 first:pl-0 lg:px-8 ${
        hasDivider ? "lg:border-l lg:border-[var(--color-border-light)]" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        <CountUp value={value} prefix="₩" />
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
        {sub}
      </p>
    </div>
  );
}

function RowDef({ term, def }: { term: string; def: string }) {
  return (
    <div className="flex justify-between py-2.5">
      <dt className="text-[var(--color-text-secondary)]">{term}</dt>
      <dd className="font-medium">{def}</dd>
    </div>
  );
}

function BarChart({
  data,
}: {
  data: Array<{ label: string; value: number; current?: boolean }>;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  // 모바일에서 6개월 grid 가로 폭이 좁아 막대가 잘려 보이므로 horizontal scroll 로 분기
  return (
    <div className="mt-6 -mx-3 overflow-x-auto px-3 md:mx-0 md:px-0" aria-hidden>
      <div
        className="grid items-end gap-3"
        style={{
          gridTemplateColumns: `repeat(${data.length}, minmax(48px, 1fr))`,
          minWidth: data.length >= 6 ? "320px" : undefined,
        }}
      >
        {data.map((d) => {
          const heightPct = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <div key={d.label} className="flex flex-col items-center gap-2">
              <div className="relative flex h-32 w-full items-end">
                <div
                  className={`chart-bar w-full rounded-t-sm ${
                    d.current
                      ? "bg-[var(--color-accent)]"
                      : "bg-[var(--color-accent)]/25"
                  }`}
                  style={{
                    height: `${heightPct}%`,
                    animationDelay: `${100 + data.indexOf(d) * 90}ms`,
                  }}
                />
              </div>
              <p
                className={`text-[11px] tabular-nums ${
                  d.current
                    ? "font-semibold text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-tertiary)]"
                }`}
              >
                {d.label}
              </p>
              <p className="text-[11px] text-[var(--color-text-tertiary)] tabular-nums">
                ₩{d.value.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettleTableRow({
  row,
  index,
  onDetail,
  onRequestFast,
  isPending,
}: {
  row: SettleRow;
  index: number;
  onDetail: () => void;
  onRequestFast: () => void;
  isPending: boolean;
}) {
  const meta = STATUS_META[row.status];
  return (
    <tr
      className="row-fade-in border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-bg-tertiary)]/60"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <td className="py-4 pr-6">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
          <span className="font-medium tabular-nums">{row.period}</span>
        </div>
      </td>
      <td className="px-6 py-4 tabular-nums text-[var(--color-text-secondary)]">
        {row.paidOn}
      </td>
      <td className="px-6 py-4 text-right tabular-nums">
        ₩{row.gross.toLocaleString()}
      </td>
      <td className="px-6 py-4 text-right tabular-nums text-[var(--color-text-tertiary)]">
        −₩{row.fee.toLocaleString()}
      </td>
      <td className="px-6 py-4 text-right font-semibold tabular-nums">
        ₩{row.net.toLocaleString()}
      </td>
      <td className="px-6 py-4">
        <span className={`text-xs font-semibold ${meta.color}`}>
          {meta.label}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="inline-flex items-center gap-3">
          {row.isFastEligible && (
            <button
              type="button"
              onClick={onRequestFast}
              disabled={isPending}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--color-accent)] hover:underline disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              빠른정산
            </button>
          )}
          <button
            type="button"
            onClick={onDetail}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
          >
            상세
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}
