import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CountUp } from "@/components/shared/count-up";

export const dynamic = "force-dynamic";

/**
 * 운영자 대시보드 (Wave 1 mock).
 *
 * 매일 첫 화면. 긴급 처리 + KPI 6 + 오늘 할 일 4 + 차트 2 + 시스템 상태.
 */

type DeltaTone = "accent" | "warning" | "error" | "success";

type Urgent = {
  label: string;
  count: number;
  since: string;
  href: string;
};

const URGENT: Urgent[] = [
  {
    label: "결제 webhook 실패",
    count: 3,
    since: "지난 10분",
    href: "/admin/monitoring",
  },
];

export default function AdminDashboardPage() {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
        운영자 대시보드
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        오늘 {today}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        오늘 처리해야 할 작업을 한눈에 확인하세요.
      </p>

      {/* 긴급 처리 */}
      {URGENT.length > 0 && (
        <div className="mt-10 border-l-2 border-[var(--color-error)] bg-[var(--color-error)]/5 px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-error)]">
            긴급 처리
          </p>
          <ul className="mt-2 space-y-1.5">
            {URGENT.map((u) => (
              <li key={u.label} className="flex items-center gap-3 text-sm">
                <span className="status-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-error)]" />
                <span className="font-medium">{u.label}</span>
                <span className="font-mono tabular-nums text-[var(--color-error)]">
                  {u.count}건
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  · {u.since}
                </span>
                <Link
                  href={u.href}
                  className="ml-auto text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  확인 →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI Bar — 6칸 */}
      <dl className="mt-12 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-3 lg:grid-cols-6">
        <KpiCell
          label="신규 입점 신청"
          value={12}
          unit="건"
          delta="+3"
          deltaTone="accent"
          href="/admin/vendors"
        />
        <KpiCell
          label="상품 모더레이션"
          value={8}
          unit="건"
          href="/admin/products"
        />
        <KpiCell
          label="미배송"
          value={23}
          unit="건"
          delta="영업일 1+"
          deltaTone="warning"
          href="/admin/orders"
        />
        <KpiCell
          label="분쟁 진행 중"
          value={4}
          unit="건"
          delta="1건 마감 임박"
          deltaTone="error"
          href="/admin/disputes"
        />
        <KpiCell
          label="이번주 정산"
          value={48200000}
          unit="원"
          mono
        />
        <KpiCell
          label="알림톡 실패율"
          value={0.8}
          unit="%"
          deltaTone="success"
          decimal
        />
      </dl>

      {/* 오늘 할 일 */}
      <section className="mt-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          오늘 할 일
        </p>
        <div className="mt-6 grid gap-x-12 gap-y-10 md:grid-cols-2">
          <TodoPanel
            title="입점 심사 큐"
            href="/admin/vendors"
            items={[
              {
                label: "(주)메디서플라이",
                meta: "DISTRIBUTOR · 3일 전",
                tone: "warning",
              },
              { label: "한빛메디칼(주)", meta: "MANUFACTURER · 2일 전" },
              { label: "케어스토어", meta: "IMPORTER · 1일 전" },
            ]}
          />
          <TodoPanel
            title="상품 모더레이션"
            href="/admin/products"
            items={[
              {
                label: "수술용 라텍스 장갑 (M)",
                meta: "메디서플라이 · CLASS_2",
              },
              { label: "디지털 청진기", meta: "헬스케어 · CLASS_3" },
              { label: "KF94 마스크 50매", meta: "메디서플라이 · CLASS_1" },
            ]}
          />
          <TodoPanel
            title="분쟁 — 24h 이내 응답"
            href="/admin/disputes"
            items={[
              {
                label: "주문 MP-...0231 환불 요청",
                meta: "병원: 서울메디컬 · 마감 8h",
                tone: "error",
              },
              {
                label: "주문 MP-...0228 미수령",
                meta: "병원: 동대문 · 마감 22h",
                tone: "warning",
              },
            ]}
          />
          <TodoPanel
            title="빠른정산 신청"
            href="/admin/settlement"
            items={[
              {
                label: "메디서플라이 — ₩2,340,000",
                meta: "수수료 ₩28,000 · 처리일 D+0",
              },
              {
                label: "한빛메디칼 — ₩1,820,000",
                meta: "수수료 ₩21,800 · 처리일 D+0",
              },
            ]}
          />
        </div>
      </section>

      {/* 차트 row */}
      <section className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <ChartPanel
          title="일별 GMV 추이"
          subtitle="지난 30일"
          tone="accent"
          data={GMV_DATA}
        />
        <ChartPanel
          title="신규 가입 / 활성 사용자"
          subtitle="지난 30일"
          tone="text"
          data={USERS_DATA}
        />
      </section>

      {/* 시스템 상태 */}
      <section className="mt-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          시스템 상태
        </p>
        <ul className="mt-5 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <SystemRow
            service="PortOne"
            status="정상"
            latency="124ms"
            lastCheck="1분 전"
          />
          <SystemRow
            service="Solapi"
            status="정상"
            latency="89ms"
            lastCheck="1분 전"
          />
          <SystemRow
            service="Algolia"
            status="정상"
            latency="42ms"
            lastCheck="1분 전"
          />
          <SystemRow
            service="Firebase Storage"
            status="지연"
            latency="412ms"
            lastCheck="2분 전"
            tone="warning"
          />
        </ul>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function KpiCell({
  label,
  value,
  unit,
  delta,
  deltaTone,
  href,
  mono,
  decimal,
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: string;
  deltaTone?: DeltaTone;
  href?: string;
  mono?: boolean;
  decimal?: boolean;
}) {
  const deltaColor: Record<DeltaTone, string> = {
    accent: "text-[var(--color-accent)]",
    warning: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
    success: "text-[var(--color-success)]",
  };

  const inner = (
    <div className="group px-4 py-6 md:px-6 md:py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl ${
          mono ? "font-mono" : ""
        }`}
      >
        <CountUp value={value} integer={!decimal} />
        {unit && (
          <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
            {unit}
          </span>
        )}
      </p>
      {delta && (
        <p
          className={`mt-2 text-xs ${
            deltaTone ? deltaColor[deltaTone] : "text-[var(--color-text-tertiary)]"
          }`}
        >
          {delta}
        </p>
      )}
    </div>
  );

  if (!href) return inner;
  return (
    <Link
      href={href}
      className="block transition-colors hover:bg-[var(--color-bg-secondary)]/40"
    >
      {inner}
    </Link>
  );
}

function TodoPanel({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: Array<{ label: string; meta: string; tone?: "warning" | "error" }>;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-[var(--color-border-light)] pb-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          모두 보기
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="divide-y divide-[var(--color-border-light)]">
        {items.map((it) => {
          const toneColor =
            it.tone === "error"
              ? "bg-[var(--color-error)]"
              : it.tone === "warning"
                ? "bg-[var(--color-warning)]"
                : "bg-[var(--color-text-tertiary)]";
          return (
            <li
              key={it.label}
              className="flex items-start gap-3 py-3 text-sm"
            >
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${toneColor}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--color-text-primary)]">
                  {it.label}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                  {it.meta}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 차트 데모 데이터 — 30 포인트
const GMV_DATA: number[] = [
  42, 48, 51, 45, 52, 58, 62, 55, 60, 65, 70, 68, 72, 78, 80, 76, 82, 88, 85,
  92, 95, 90, 98, 102, 105, 100, 108, 112, 115, 120,
];

const USERS_DATA: number[] = [
  18, 22, 25, 21, 28, 30, 26, 32, 35, 31, 38, 40, 36, 42, 45, 41, 48, 50, 46,
  52, 55, 51, 58, 60, 56, 62, 65, 61, 68, 70,
];

function ChartPanel({
  title,
  subtitle,
  tone,
  data,
}: {
  title: string;
  subtitle: string;
  tone: "accent" | "text";
  data: number[];
}) {
  const w = 600;
  const h = 180;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 24;
  const maxV = Math.max(...data);
  const minV = Math.min(...data);
  const range = maxV - minV || 1;
  const stepX = (w - padL - padR) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = padL + stepX * i;
    const y = padT + (h - padT - padB) * (1 - (v - minV) / range);
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0]},${h - padB} L${points[0][0]},${h - padB} Z`;

  const stroke = tone === "accent" ? "var(--color-accent)" : "var(--color-text-primary)";
  const fill = tone === "accent" ? "var(--color-accent)" : "var(--color-text-primary)";

  const xLabels = ["30일 전", "15일 전", "오늘"];

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-[var(--color-border-light)] pb-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {subtitle}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="mt-4 h-44 w-full"
        role="img"
        aria-label={`${title} 차트`}
      >
        {/* 가로 격자선 4개 */}
        {[0, 1, 2, 3].map((i) => {
          const y = padT + ((h - padT - padB) / 3) * i;
          return (
            <line
              key={i}
              x1={padL}
              x2={w - padR}
              y1={y}
              y2={y}
              stroke="var(--color-border-light)"
              strokeWidth={0.5}
            />
          );
        })}
        {/* 영역 fill */}
        <path d={areaPath} fill={fill} opacity={0.06} />
        {/* 라인 */}
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 마지막 점 강조 */}
        <circle
          cx={points[points.length - 1][0]}
          cy={points[points.length - 1][1]}
          r={3}
          fill={stroke}
        />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {xLabels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function SystemRow({
  service,
  status,
  latency,
  lastCheck,
  tone = "success",
}: {
  service: string;
  status: string;
  latency: string;
  lastCheck: string;
  tone?: "success" | "warning" | "error";
}) {
  const dotColor =
    tone === "error"
      ? "bg-[var(--color-error)]"
      : tone === "warning"
        ? "bg-[var(--color-warning)]"
        : "bg-[var(--color-success)]";
  const statusColor =
    tone === "error"
      ? "text-[var(--color-error)]"
      : tone === "warning"
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-success)]";
  return (
    <li className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-3 text-sm">
      <div className="flex items-center gap-2.5">
        <span
          className={`status-pulse-dot h-1.5 w-1.5 rounded-full ${dotColor}`}
        />
        <span className="font-medium">{service}</span>
      </div>
      <span className={`text-xs font-medium ${statusColor}`}>{status}</span>
      <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
        {latency}
      </span>
      <span className="text-xs text-[var(--color-text-tertiary)]">
        {lastCheck}
      </span>
    </li>
  );
}
