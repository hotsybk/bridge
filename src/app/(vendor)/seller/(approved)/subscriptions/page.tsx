"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, RefreshCw, Repeat } from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { trpc } from "@/lib/trpc/client";

// Wave Q2 — 파트너센터 정기 구독 (read-only).
// 실제 구독 시스템은 Phase 3 출시 예정. 현재는 vendor 가 받는 구독 list 만 표시.

export const dynamic = "force-dynamic";

type SubRow = {
  id: string;
  hospitalName: string;
  productName: string;
  cadence: string;
  nextRunAt: string;
  runCount: number;
  qty: number;
  unitPrice: number;
  totalAmount: number;
  status: "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED";
};

const STATUS_META: Record<
  SubRow["status"],
  { label: string; color: string }
> = {
  ACTIVE: { label: "정기 발주", color: "text-[var(--color-success)]" },
  PAUSED: { label: "일시 정지", color: "text-[var(--color-warning)]" },
  CANCELLED: { label: "해지", color: "text-[var(--color-text-tertiary)]" },
  EXPIRED: { label: "만료", color: "text-[var(--color-text-tertiary)]" },
};

const CADENCE_LABEL: Record<string, string> = {
  WEEKLY: "주 1회",
  BIWEEKLY: "격주",
  MONTHLY: "월 1회",
  CUSTOM: "맞춤",
};

// PREVIEW — 인증/데이터 없을 때 디자인 검수용
const PREVIEW_ROWS: SubRow[] = [
  {
    id: "preview-1",
    hospitalName: "서울 명동 가정의학과",
    productName: "수술용 라텍스 장갑 (M) 100매",
    cadence: "MONTHLY",
    nextRunAt: "2026-06-15",
    runCount: 12,
    qty: 20,
    unitPrice: 8900,
    totalAmount: 178000,
    status: "ACTIVE",
  },
  {
    id: "preview-2",
    hospitalName: "강남 베스트치과",
    productName: "일회용 마스크 KF94 50매",
    cadence: "BIWEEKLY",
    nextRunAt: "2026-06-08",
    runCount: 24,
    qty: 10,
    unitPrice: 12000,
    totalAmount: 120000,
    status: "ACTIVE",
  },
  {
    id: "preview-3",
    hospitalName: "분당 한사랑내과",
    productName: "수술용 가운 (멸균) 5매",
    cadence: "MONTHLY",
    nextRunAt: "2026-06-30",
    runCount: 6,
    qty: 4,
    unitPrice: 28000,
    totalAmount: 112000,
    status: "PAUSED",
  },
];

const PREVIEW_COUNTS = { active: 8, paused: 2, next7Days: 3 };

export default function SellerSubscriptionsPage() {
  // Phase γ-2 — cursor pagination
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulated, setAccumulated] = useState<SubRow[]>([]);

  const listQuery = trpc.vendor.subscription.list.useQuery({
    pageSize: 50,
    cursor,
  });
  const countsQuery = trpc.vendor.subscription.counts.useQuery();

  const usePreview =
    !listQuery.isPending &&
    (listQuery.error !== null ||
      (listQuery.data?.subscriptions.length ?? 0) === 0);

  const livePageRows: SubRow[] = (listQuery.data?.subscriptions ?? []).map((s) => {
    const sd = s as {
      id: string;
      hospitalName?: string;
      productName?: string;
      cadence?: string;
      nextRunAt?: { toMillis?: () => number; seconds?: number };
      runCount?: number;
      qty?: number;
      unitPrice?: number;
      totalAmount?: number;
      status?: string;
    };
    const nextMillis =
      sd.nextRunAt?.toMillis?.() ??
      (typeof sd.nextRunAt?.seconds === "number"
        ? sd.nextRunAt.seconds * 1000
        : 0);
    return {
      id: sd.id,
      hospitalName: sd.hospitalName ?? "—",
      productName: sd.productName ?? "—",
      cadence: sd.cadence ?? "MONTHLY",
      nextRunAt: nextMillis
        ? new Date(nextMillis).toISOString().slice(0, 10)
        : "—",
      runCount: sd.runCount ?? 0,
      qty: sd.qty ?? 0,
      unitPrice: sd.unitPrice ?? 0,
      totalAmount: sd.totalAmount ?? 0,
      status: (sd.status as SubRow["status"]) ?? "ACTIVE",
    };
  });

  // 페이지 누적
  useEffect(() => {
    if (!listQuery.data) return;
    setAccumulated((prev) => {
      if (!cursor) return livePageRows;
      const seen = new Set(prev.map((r) => r.id));
      const merged = [...prev];
      for (const r of livePageRows) if (!seen.has(r.id)) merged.push(r);
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQuery.data, cursor]);

  const rows: SubRow[] = usePreview ? PREVIEW_ROWS : accumulated;
  const nextCursor = listQuery.data?.nextCursor;

  function loadMore() {
    if (nextCursor) setCursor(nextCursor);
  }

  const counts = countsQuery.data ?? (usePreview ? PREVIEW_COUNTS : undefined);

  const totalMonthlyGmv = useMemo(
    () =>
      rows
        .filter((r) => r.status === "ACTIVE")
        .reduce((sum, r) => sum + r.totalAmount, 0),
    [rows],
  );

  const KPIS = [
    {
      label: "활성 구독",
      icon: Repeat,
      value: counts?.active ?? 0,
      suffix: "건",
      sub: "정기 발주 진행 중",
    },
    {
      label: "일시 정지",
      icon: RefreshCw,
      value: counts?.paused ?? 0,
      suffix: "건",
      sub: "사유 확인 필요",
    },
    {
      label: "다음 7일 발주",
      icon: Clock,
      value: counts?.next7Days ?? 0,
      suffix: "건",
      sub: "재고 미리 확보",
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
      <PageHeader
        label="파트너센터 · 정기구독"
        title="정기구독"
        description="병원이 등록한 정기 발주가 자동으로 들어옵니다. Phase 3 출시 후 본격 가동됩니다."
      />

      {/* KPI 3 컬럼 */}
      <section className="mt-12 grid grid-cols-1 gap-y-8 border-y border-[var(--color-border-light)] py-8 sm:grid-cols-3">
        {KPIS.map((k, i) => (
          <KpiItem key={k.label} {...k} hasDivider={i > 0} />
        ))}
      </section>

      {usePreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          ※ 디자인 미리보기 데이터입니다. Phase 3 정기구독 시스템 출시 후 실제
          데이터로 자동 교체됩니다.
        </p>
      )}

      {/* 누적 자동 매출 */}
      <section className="mt-12 border-b border-[var(--color-border-light)] pb-10">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          이번 주기 자동 매출
        </p>
        <p className="mt-3 text-2xl font-semibold tabular-nums md:text-3xl">
          ₩<CountUp value={totalMonthlyGmv} />
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          활성 구독 {counts?.active ?? rows.length}건 기준 회당 합계
        </p>
      </section>

      {/* 구독 list */}
      <section className="mt-12">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              구독 목록
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              총 {rows.length}건
            </h2>
          </div>
        </header>

        <div className="mt-6 hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] text-left text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                <th className="py-3 pr-6 font-medium">병원</th>
                <th className="px-6 py-3 font-medium">상품</th>
                <th className="px-6 py-3 font-medium">주기</th>
                <th className="px-6 py-3 font-medium">다음 발주일</th>
                <th className="px-6 py-3 text-right font-medium">누적 횟수</th>
                <th className="px-6 py-3 text-right font-medium">회당 금액</th>
                <th className="px-6 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isPending && !usePreview ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin text-[var(--color-text-tertiary)]" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-16 text-center text-sm text-[var(--color-text-tertiary)]"
                  >
                    아직 등록된 정기 구독이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className="row-fade-in border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-bg-tertiary)]/60"
                    style={{
                      animationDelay: `${Math.min(i, 12) * 35}ms`,
                    }}
                  >
                    <td className="py-4 pr-6 font-medium">{r.hospitalName}</td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                      {r.productName}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                      {CADENCE_LABEL[r.cadence] ?? r.cadence}
                    </td>
                    <td className="px-6 py-4 tabular-nums">{r.nextRunAt}</td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {r.runCount}회
                    </td>
                    <td className="px-6 py-4 text-right font-semibold tabular-nums">
                      ₩{r.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold ${STATUS_META[r.status].color}`}
                      >
                        {STATUS_META[r.status].label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="mt-6 md:hidden">
          {listQuery.isPending && !usePreview ? (
            <p className="py-16 text-center">
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-[var(--color-text-tertiary)]" />
            </p>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--color-text-tertiary)]">
              아직 등록된 정기 구독이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              {rows.map((r) => (
                <li key={`m-${r.id}`} className="flex flex-col gap-2 px-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="truncate text-sm font-medium">
                      {r.hospitalName}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${STATUS_META[r.status].color}`}
                    >
                      {STATUS_META[r.status].label}
                    </span>
                  </div>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">
                    {r.productName}
                  </p>
                  <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                    <span>
                      {CADENCE_LABEL[r.cadence] ?? r.cadence} · 다음{" "}
                      <span className="font-mono tabular-nums">{r.nextRunAt}</span>
                    </span>
                    <span className="font-mono tabular-nums">{r.runCount}회</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                      회당 금액
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      ₩{r.totalAmount.toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Phase γ-2 — 더 보기 */}
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
                : `더 보기 (${rows.length}건 표시 중)`}
            </button>
          </div>
        )}
      </section>

      <p className="mt-12 border-t border-[var(--color-border-light)] pt-6 text-xs text-[var(--color-text-tertiary)]">
        Cloud Function `subscription-runner` 가 매일 03:00 KST 실행되어 활성
        구독을 자동 발주합니다.
      </p>
    </main>
  );
}

function KpiItem({
  icon: Icon,
  label,
  value,
  suffix,
  sub,
  hasDivider,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  suffix?: string;
  sub: string;
  hasDivider: boolean;
}) {
  return (
    <div
      className={`px-6 first:pl-0 lg:px-8 ${
        hasDivider ? "lg:border-l lg:border-[var(--color-border-light)]" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        <CountUp value={value} suffix={suffix ?? ""} />
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
        {sub}
      </p>
    </div>
  );
}
