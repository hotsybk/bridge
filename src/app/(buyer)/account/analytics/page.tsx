"use client";

import { useMemo } from "react";
import {
  Building2,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { trpc } from "@/lib/trpc/client";

/**
 * Phase Φ-C 작업1 — 병원 지출 분석 (/account/analytics).
 *
 * account layout 안 (layout 이 H1 보유) → 페이지는 H2 섹션.
 * 디자인 DNA: 박스 없음, 라인 only, tabular-nums.
 *
 * 데이터: hospital.spending (월별·카테고리·공급사·top상품 in-memory 집계).
 */

function fmtKrw(n: number): string {
  return n.toLocaleString("ko-KR");
}

function monthLabel(period: string): string {
  // "2026-06" → "6월"
  const parts = period.split("-");
  if (parts.length !== 2) return period;
  return `${Number(parts[1])}월`;
}

export default function AccountAnalyticsPage() {
  const { data, isLoading } = trpc.hospital.spending.useQuery({ months: 6 });

  const monthly = data?.monthlySpending ?? [];
  const maxMonthly = useMemo(
    () => Math.max(1, ...monthly.map((m) => m.amount)),
    [monthly],
  );
  const totalCategory = useMemo(
    () => (data?.byCategory ?? []).reduce((s, c) => s + c.amount, 0),
    [data?.byCategory],
  );

  const hasData = (data?.orderCount ?? 0) > 0;

  return (
    <div className="space-y-20">
      {/* KPI */}
      <section>
        <SectionHeader
          title="지출 요약"
          hint={isLoading ? "불러오는 중…" : "최근 6개월 기준"}
        />
        <div className="mt-8 grid grid-cols-2 gap-y-8 border-y border-[var(--color-border-light)] py-8 lg:grid-cols-4 lg:gap-y-0">
          <KpiItem
            icon={Receipt}
            label="누적 지출"
            value={data?.totalSpending ?? 0}
            prefix="₩"
            tone="accent"
            hasDivider={false}
          />
          <KpiItem
            icon={TrendingUp}
            label="이번 달 지출"
            value={data?.thisMonthSpending ?? 0}
            prefix="₩"
            tone="success"
            hasDivider
          />
          <KpiItem
            icon={ShoppingBag}
            label="주문 수"
            value={data?.orderCount ?? 0}
            suffix="건"
            tone="accent"
            hasDivider
          />
          <KpiItem
            icon={Package}
            label="평균 주문액"
            value={data?.avgOrderValue ?? 0}
            prefix="₩"
            tone="accent"
            hasDivider
          />
        </div>
      </section>

      {!isLoading && !hasData && (
        <section className="border-y border-[var(--color-border-light)] py-16 text-center">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            아직 분석할 지출 내역이 없습니다
          </p>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            결제 완료 주문이 쌓이면 월별·카테고리·공급사별 지출이 여기에
            표시됩니다.
          </p>
        </section>
      )}

      {hasData && (
        <>
          {/* 월별 지출 막대 차트 */}
          <section>
            <SectionHeader title="월별 지출" hint="최근 6개월" />
            <div className="mt-10 flex items-end justify-between gap-3 border-b border-[var(--color-border-light)] pb-4">
              {monthly.map((m) => {
                const heightPct = Math.round((m.amount / maxMonthly) * 100);
                return (
                  <div
                    key={m.month}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-[11px] font-medium tabular-nums text-[var(--color-text-tertiary)]">
                      {m.amount > 0 ? `₩${fmtKrw(Math.round(m.amount / 1000))}k` : ""}
                    </span>
                    <div className="flex h-40 w-full max-w-[44px] items-end">
                      <div
                        className="chart-bar w-full rounded-t-sm bg-[var(--color-accent)]"
                        style={{
                          height: `${Math.max(heightPct, m.amount > 0 ? 4 : 0)}%`,
                        }}
                        title={`${m.month} · ₩${fmtKrw(m.amount)}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between gap-3">
              {monthly.map((m) => (
                <span
                  key={m.month}
                  className="flex-1 text-center text-[11px] text-[var(--color-text-tertiary)]"
                >
                  {monthLabel(m.month)}
                </span>
              ))}
            </div>
          </section>

          {/* 카테고리별 지출 */}
          <section>
            <SectionHeader title="카테고리별 지출" />
            {(data?.byCategory ?? []).length === 0 ? (
              <p className="mt-6 text-sm text-[var(--color-text-tertiary)]">
                카테고리 정보가 없습니다.
              </p>
            ) : (
              <ul className="mt-8 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                {(data?.byCategory ?? []).map((c) => {
                  const pct =
                    totalCategory > 0
                      ? Math.round((c.amount / totalCategory) * 100)
                      : 0;
                  return (
                    <li key={c.category} className="py-4">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="min-w-0 truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {c.category}
                        </p>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          ₩{fmtKrw(c.amount)}
                          <span className="ml-2 text-xs font-normal text-[var(--color-text-tertiary)]">
                            {pct}%
                          </span>
                        </p>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-accent)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                        {c.count}개 품목
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 공급사 Top 5 + 자주 구매 상품 Top 10 */}
          <section className="grid gap-12 md:grid-cols-2">
            <div>
              <header className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-3">
                <h2 className="text-sm font-semibold">공급사 Top 5</h2>
                <Building2 className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
              </header>
              {(data?.byVendor ?? []).length === 0 ? (
                <p className="py-6 text-sm text-[var(--color-text-tertiary)]">
                  공급사 내역이 없습니다.
                </p>
              ) : (
                <ol className="divide-y divide-[var(--color-border-light)] text-sm">
                  {(data?.byVendor ?? []).map((v, i) => (
                    <li
                      key={`${v.vendorName}-${i}`}
                      className="flex items-center gap-4 py-3"
                    >
                      <span className="w-5 text-xs font-semibold tabular-nums text-[var(--color-accent)]">
                        {i + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate">{v.vendorName}</p>
                      <p className="text-xs tabular-nums text-[var(--color-text-tertiary)]">
                        {v.count}건
                      </p>
                      <p className="w-28 text-right text-sm font-semibold tabular-nums">
                        ₩{fmtKrw(v.amount)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div>
              <header className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-3">
                <h2 className="text-sm font-semibold">자주 구매 상품 Top 10</h2>
                <Package className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
              </header>
              {(data?.topProducts ?? []).length === 0 ? (
                <p className="py-6 text-sm text-[var(--color-text-tertiary)]">
                  구매 상품 내역이 없습니다.
                </p>
              ) : (
                <ol className="divide-y divide-[var(--color-border-light)] text-sm">
                  {(data?.topProducts ?? []).map((p, i) => (
                    <li
                      key={`${p.name}-${i}`}
                      className="flex items-center gap-4 py-3"
                    >
                      <span className="w-5 text-xs font-semibold tabular-nums text-[var(--color-accent)]">
                        {i + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate">{p.name}</p>
                      <p className="text-xs tabular-nums text-[var(--color-text-tertiary)]">
                        {p.qty}개
                      </p>
                      <p className="w-28 text-right text-sm font-semibold tabular-nums">
                        ₩{fmtKrw(p.amount)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <p className="border-t border-[var(--color-border-light)] pt-6 text-xs text-[var(--color-text-tertiary)]">
            결제 완료 주문(PAID 이상) 기준 집계 · 최근 6개월 데이터
          </p>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub components
// ─────────────────────────────────────────────────────────────

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="flex items-baseline justify-between gap-4">
      <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
        {title}
      </h2>
      {hint && (
        <p className="text-xs text-[var(--color-text-tertiary)]">{hint}</p>
      )}
    </header>
  );
}

function KpiItem({
  icon: Icon,
  label,
  value,
  prefix,
  suffix,
  tone,
  hasDivider,
}: {
  icon: typeof Receipt;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  tone: "success" | "accent";
  hasDivider: boolean;
}) {
  const iconColor =
    tone === "success"
      ? "text-[var(--color-success)]"
      : "text-[var(--color-accent)]";
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
        <CountUp value={value} prefix={prefix ?? ""} suffix={suffix ?? ""} />
      </p>
    </div>
  );
}
