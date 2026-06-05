"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  LineChart as LineChartIcon,
  Package,
  Receipt,
  Users,
} from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseBadge } from "@/components/shared/phase-badge";
import { trpc } from "@/lib/trpc/client";

/**
 * Wave P2 — 파트너센터 분석 (tRPC 실시간 KPI + mock 차트).
 *
 * 본격 BigQuery 통계 (시계열·Top N) 는 Phase 3+. MVP 는 vendor.order.counts /
 * vendor.settlement.counts 로 누적 KPI 만 실시간. 차트·Top 리스트는 mock 유지.
 * 디자인 DNA: 박스 없음, 라인 only. 기간 selector 가 차트 데이터만 갱신.
 */

const PERIODS = [
  { key: "7d" as const, label: "최근 7일" },
  { key: "30d" as const, label: "최근 30일" },
  { key: "90d" as const, label: "최근 90일" },
];
type PeriodKey = (typeof PERIODS)[number]["key"];

type KpiEntry = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  delta: number;
  icon: typeof Receipt;
  tone: "success" | "accent" | "warning";
};

// 기간별 mock 데이터 — 실제 차이를 보여주기 위해 약간씩 다른 값
const KPI_DATA: Record<PeriodKey, KpiEntry[]> = {
  "7d": [
    { label: "총 매출", value: 2840000, prefix: "₩", delta: 8, icon: Receipt, tone: "success" },
    { label: "주문 수", value: 42, suffix: "건", delta: 5, icon: Package, tone: "accent" },
    { label: "평균 객단가", value: 67600, prefix: "₩", delta: 3, icon: LineChartIcon, tone: "accent" },
    { label: "신규 거래처", value: 3, suffix: "곳", delta: -10, icon: Users, tone: "warning" },
  ],
  "30d": [
    { label: "총 매출", value: 12380000, prefix: "₩", delta: 14, icon: Receipt, tone: "success" },
    { label: "주문 수", value: 186, suffix: "건", delta: 8, icon: Package, tone: "accent" },
    { label: "평균 객단가", value: 66500, prefix: "₩", delta: 5, icon: LineChartIcon, tone: "accent" },
    { label: "신규 거래처", value: 12, suffix: "곳", delta: -3, icon: Users, tone: "warning" },
  ],
  "90d": [
    { label: "총 매출", value: 34210000, prefix: "₩", delta: 22, icon: Receipt, tone: "success" },
    { label: "주문 수", value: 512, suffix: "건", delta: 18, icon: Package, tone: "accent" },
    { label: "평균 객단가", value: 66800, prefix: "₩", delta: 4, icon: LineChartIcon, tone: "accent" },
    { label: "신규 거래처", value: 31, suffix: "곳", delta: 12, icon: Users, tone: "success" },
  ],
};

// 차트 데이터 — 기간별로 다른 곡선
const CHART_DATA: Record<PeriodKey, number[]> = {
  "7d": [55, 70, 60, 80, 95, 85, 110],
  "30d": [160, 140, 150, 110, 120, 90, 100, 70, 80, 55, 40],
  "90d": [180, 160, 150, 135, 120, 110, 95, 85, 75, 60, 45, 35],
};

const TOP_PRODUCTS = [
  { name: "수술용 라텍스 장갑 (M)", units: 248, revenue: 2208200 },
  { name: "일회용 마스크 KF94 50매", units: 142, revenue: 1704000 },
  { name: "살균 알코올 1리터", units: 96, revenue: 748800 },
  { name: "디지털 청진기 (블루투스)", units: 18, revenue: 6300000 },
  { name: "수술용 가운 (멸균) 5매", units: 34, revenue: 952000 },
];

const TOP_HOSPITALS = [
  { name: "더미 종합병원", orders: 24, revenue: 3420000 },
  { name: "강남 메디 클리닉", orders: 18, revenue: 2870000 },
  { name: "더미 정형외과", orders: 14, revenue: 1840000 },
  { name: "더미 산부인과", orders: 12, revenue: 1240000 },
  { name: "더미 내과의원", orders: 9, revenue: 880000 },
];

export default function SellerAnalyticsPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");

  // 실 데이터 — 누적 카운터 (Wave P2). 시계열은 BigQuery 도입 후.
  const orderCountsQuery = trpc.vendor.order.counts.useQuery();
  const settlementCountsQuery = trpc.vendor.settlement.counts.useQuery();

  const mockKpis = KPI_DATA[period];
  // 실데이터 우선, 없으면 mock
  const kpis = useMemo(() => {
    const oc = orderCountsQuery.data;
    const sc = settlementCountsQuery.data;
    if (!oc || !sc) return mockKpis;

    const totalOrders = oc.accepted + oc.packing + oc.shipped + oc.delivered;
    const avgOrderValue = totalOrders > 0 ? Math.round(oc.totalAmount / totalOrders) : 0;

    // 기간 selector 는 차트에만 적용. KPI 는 누적 (Phase 2 단순화).
    return [
      {
        label: "누적 매출",
        value: oc.totalAmount,
        prefix: "₩",
        delta: 0,
        icon: Receipt,
        tone: "success" as const,
      },
      {
        label: "총 주문 수",
        value: totalOrders,
        suffix: "건",
        delta: 0,
        icon: Package,
        tone: "accent" as const,
      },
      {
        label: "평균 객단가",
        value: avgOrderValue,
        prefix: "₩",
        delta: 0,
        icon: LineChartIcon,
        tone: "accent" as const,
      },
      {
        label: "이번 달 정산",
        value: sc.thisMonth,
        prefix: "₩",
        delta: 0,
        icon: Users,
        tone: sc.thisMonth > 0 ? ("success" as const) : ("warning" as const),
      },
    ];
  }, [orderCountsQuery.data, settlementCountsQuery.data, mockKpis]);

  const chartData = useMemo(() => CHART_DATA[period], [period]);
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
      <div className="mb-4">
        <PhaseBadge phase="Phase 6">출시 예정</PhaseBadge>
      </div>
      <PageHeader
        label="파트너센터 · 분석"
        title="분석"
        description="매출·고객·상품의 핵심 지표. 실시간 데이터 연결은 6단계 출시 후 활성화됩니다."
      />

      {/* 기간 selector — 라인 underline 탭 */}
      <nav
        aria-label="기간 선택"
        className="mt-10 flex w-full items-stretch border-b border-[var(--color-border-light)]"
      >
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              aria-pressed={active}
              className={`-mb-px flex-1 border-b-2 py-3 text-xs font-medium transition-colors ${
                active
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </nav>

      {/* KPI 4컬럼 */}
      <section className="grid grid-cols-2 gap-y-8 border-b border-[var(--color-border-light)] py-8 lg:grid-cols-4 lg:gap-y-0">
        {kpis.map((k, i) => (
          <KpiItem key={k.label} {...k} hasDivider={i > 0} />
        ))}
      </section>

      {/* 매출 추이 차트 — 박스 없음 */}
      <section className="mt-12 border-b border-[var(--color-border-light)] pb-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              매출 추이
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{periodLabel}</h2>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-3 rounded-full bg-[var(--color-accent)]" />
              <span className="font-medium">매출</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[var(--color-text-tertiary)]">
              <span className="h-1 w-3 rounded-full bg-[var(--color-text-tertiary)]/50" />
              주문 수
            </span>
          </div>
        </div>

        <LineChart data={chartData} />
      </section>

      {/* Top 리스트 2개 — 박스 없음 */}
      <section className="mt-12 grid gap-12 md:grid-cols-2">
        <TopList
          title="인기 상품 Top 5"
          icon={Package}
          unitLabel="개"
          rows={TOP_PRODUCTS.map((p) => ({
            name: p.name,
            qty: p.units,
            revenue: p.revenue,
          }))}
        />
        <TopList
          title="단골 거래처 Top 5"
          icon={Building2}
          unitLabel="건"
          rows={TOP_HOSPITALS.map((h) => ({
            name: h.name,
            qty: h.orders,
            revenue: h.revenue,
          }))}
        />
      </section>

      <p className="mt-16 border-t border-[var(--color-border-light)] pt-6 text-xs text-[var(--color-text-tertiary)]">
        24시간 주기 갱신 · Phase 6 실시간 전환 예정
      </p>
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
  prefix,
  suffix,
  delta,
  tone,
  hasDivider,
}: {
  icon: typeof Receipt;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  delta: number;
  tone: "success" | "accent" | "warning";
  hasDivider: boolean;
}) {
  const iconColor = {
    success: "text-[var(--color-success)]",
    accent: "text-[var(--color-accent)]",
    warning: "text-[var(--color-warning)]",
  }[tone];
  const positive = delta >= 0;
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
      <p
        className={`mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium ${
          positive ? "text-[var(--color-success)]" : "text-[var(--color-error)]"
        }`}
      >
        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(delta)}% 전 기간 대비
      </p>
    </div>
  );
}

function LineChart({ data }: { data: number[] }) {
  const max = Math.max(...data);
  // viewBox 600x200 으로 정규화
  const stepX = 600 / (data.length - 1);
  const normalize = (v: number) => 200 - (v / max) * 180; // 위쪽 여백 20
  const points = data.map((v, i) => [i * stepX, normalize(v)] as const);
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${(points[points.length - 1][0]).toFixed(1)} 200 L 0 200 Z`;

  return (
    <div className="relative mt-8 h-48 w-full">
      <svg
        viewBox="0 0 600 200"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0066CC" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0066CC" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 가로 grid 라인 (얇게) — vector preserveAspectRatio=none 으로 강제 stroke 두께 보정용 */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1="0"
            y1={200 * p}
            x2="600"
            y2={200 * p}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={areaPath} fill="url(#lineGrad)" className="chart-area" />
        <path
          key={`line-${data.length}-${data[0]}`}
          d={linePath}
          fill="none"
          stroke="#0066CC"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="chart-line-draw"
        />
        {points.map(([x, y], i) => (
          <circle
            key={`dot-${data.length}-${i}`}
            cx={x}
            cy={y}
            r="3"
            fill="#0066CC"
            vectorEffect="non-scaling-stroke"
            className="chart-dot"
            style={{ animationDelay: `${800 + i * 60}ms` }}
          />
        ))}
      </svg>
    </div>
  );
}

function TopList({
  title,
  icon: Icon,
  rows,
  unitLabel,
}: {
  title: string;
  icon: typeof Package;
  rows: Array<{ name: string; qty: number; revenue: number }>;
  unitLabel: string;
}) {
  return (
    <div>
      <header className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Icon className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
      </header>
      <ol className="divide-y divide-[var(--color-border-light)] text-sm">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-4 py-3">
            <span className="w-5 text-xs font-semibold tabular-nums text-[var(--color-accent)]">
              {i + 1}
            </span>
            <p className="min-w-0 flex-1 truncate">{r.name}</p>
            <p className="text-xs tabular-nums text-[var(--color-text-tertiary)]">
              {r.qty}
              {unitLabel}
            </p>
            <p className="w-24 text-right text-sm font-semibold tabular-nums">
              ₩{r.revenue.toLocaleString()}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
