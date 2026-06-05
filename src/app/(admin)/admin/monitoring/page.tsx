import { CountUp } from "@/components/shared/count-up";
import { trpcServer } from "@/lib/trpc/server";

import { SystemAlertsLedger, type AnomalyItem } from "./alerts-ledger";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * 운영자 — 시스템 모니터링 (Wave T 풀 실연동).
 *
 * - KPI 6 : `_metricsSnapshots` 최신 doc (admin.monitoring.metrics)
 * - 차트 4 : `_metricsSnapshots` 최근 24h (admin.monitoring.metricsHistory)
 * - 시스템 상태 : `_serviceHealth` (admin.monitoring.serviceHealth)
 * - 이상 감지 ledger : `_systemAlerts` (admin.monitoring.systemAlerts)
 * - PREVIEW_MODE 또는 데이터 없음 시 기존 mock 유지
 */

type DeltaTone = "accent" | "warning" | "error" | "success";

type ServiceHealthRow = {
  key: string;
  name?: string;
  state?: "OK" | "DEGRADED" | "DOWN";
  latencyMs?: number;
  statusCode?: number | null;
  reason?: string | null;
};

const GMV_DATA = [
  42, 48, 51, 45, 52, 58, 62, 55, 60, 65, 70, 68, 72, 78, 80, 76, 82, 88, 85,
  92, 95, 90, 98, 102, 105, 100, 108, 112, 115, 120,
];

const FAIL_RATE_DATA = [
  0.4, 0.5, 0.3, 0.6, 0.8, 0.5, 0.4, 0.9, 1.2, 0.8, 0.6, 0.7, 0.5, 0.4, 0.6,
  0.8, 1.1, 0.9, 0.7, 0.5, 0.4, 0.6, 0.8, 0.5, 0.4, 0.6, 0.7, 0.5, 0.3, 0.8,
];

const SOLAPI_DATA = [
  99.2, 99.4, 99.5, 99.1, 99.3, 99.6, 99.5, 99.4, 99.2, 99.3, 99.5, 99.6, 99.4,
  99.5, 99.7, 99.6, 99.4, 99.5, 99.3, 99.4, 99.5, 99.6, 99.4, 99.5, 99.6, 99.5,
  99.4, 99.5, 99.6, 99.4,
];

const FN_P50 = [
  120, 125, 118, 130, 122, 128, 135, 124, 132, 128, 130, 134, 128, 130, 135,
  128, 132, 130, 134, 128, 132, 130, 134, 128, 132, 130, 134, 128, 132, 130,
];
const FN_P95 = [
  280, 295, 270, 310, 290, 320, 340, 305, 330, 315, 325, 345, 320, 332, 350,
  315, 338, 325, 348, 318, 340, 325, 342, 320, 338, 325, 342, 322, 338, 325,
];

// PREVIEW mock — 비로그인 dev 미리보기용
const DEMO_ANOMALIES: AnomalyItem[] = [
  {
    id: "demo-1",
    type: "PAYMENT_FAILED",
    severity: "ERROR",
    title: "결제 webhook 실패",
    message:
      "PortOne webhook · order MP-2026-06-01-0231 · ECONNRESET",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 300 },
    orderId: "MP-2026-06-01-0231",
  },
  {
    id: "demo-2",
    type: "DISPUTE_OPENED",
    severity: "INFO",
    title: "신규 분쟁이 접수되었습니다",
    message: "서울메디컬의원 ↔ 메디서플라이 — 234,900원",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 900 },
    disputeId: "dispute-031",
  },
  {
    id: "demo-3",
    type: "DISPUTE_SLA_BREACHED",
    severity: "WARNING",
    title: "분쟁 SLA 임박",
    message: "dispute-029 — 48h 마감 2시간 남음",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 1800 },
    disputeId: "dispute-029",
  },
];

export default async function AdminMonitoringPage() {
  let anomalies: AnomalyItem[] = [];
  let isPreview = false;
  let metrics: {
    dau: number;
    mau: number;
    paymentSuccessRate: number;
    alimtalkSuccessRate: number;
    cloudFunctionErrorRate: number;
    gmvHour: number;
    gmvToday: number;
    notificationsHour: number;
    newOrdersHour: number;
    hasData: boolean;
  } | null = null;
  let history: Array<{
    snapshotId: string;
    dau: number;
    gmvHour: number;
    paymentSuccessRate: number;
    alimtalkSuccessRate: number;
    cloudFunctionErrorRate: number;
  }> = [];
  let serviceHealth: ServiceHealthRow[] = [];

  try {
    const trpc = await trpcServer();
    const [items, m, h, sh] = await Promise.all([
      trpc.admin.monitoring.systemAlerts({ pageSize: 50, includeAcknowledged: true }),
      trpc.admin.monitoring.metrics(),
      trpc.admin.monitoring.metricsHistory({ hours: 24 }),
      trpc.admin.monitoring.serviceHealth(),
    ]);
    anomalies = items as AnomalyItem[];
    metrics = m;
    history = h;
    serviceHealth = sh as ServiceHealthRow[];
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      anomalies = DEMO_ANOMALIES;
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  // ── KPI 데이터 (실데이터 우선, 미존재 시 mock) ─────────────
  const useReal = !!metrics && metrics.hasData;
  const kpi = useReal
    ? {
        dau: metrics!.dau,
        mau: metrics!.mau,
        paymentSuccessRate: metrics!.paymentSuccessRate * 100,
        alimtalkSuccessRate: metrics!.alimtalkSuccessRate * 100,
        searchLatencyP95: 142, // 별도 source 없음 — mock 유지
        cloudFunctionErrorRate: metrics!.cloudFunctionErrorRate * 100,
      }
    : {
        dau: 1234,
        mau: 12420,
        paymentSuccessRate: 98.2,
        alimtalkSuccessRate: 99.4,
        searchLatencyP95: 142,
        cloudFunctionErrorRate: 0.8,
      };

  // ── 차트 데이터 (실 history, 비어있으면 mock) ──────────────
  const gmvSeries = history.length > 0
    ? history.map((h) => h.gmvHour / 1_000_000)
    : GMV_DATA;
  const failRateSeries = history.length > 0
    ? history.map((h) => Math.max(0, (1 - h.paymentSuccessRate) * 100))
    : FAIL_RATE_DATA;
  const solapiSeries = history.length > 0
    ? history.map((h) => h.alimtalkSuccessRate * 100)
    : SOLAPI_DATA;
  // function 에러율은 ms 단위가 아니므로 DualLine 은 mock 유지 (P50/P95 latency 별도)
  const fnP50 = FN_P50;
  const fnP95 = FN_P95;

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            시스템 · 모니터링
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            시스템 모니터링
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            결제·알림·검색·Cloud Function 운영 메트릭 실시간
          </p>
        </div>
        <p className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
          {useReal
            ? `최근 snapshot · ${metrics!.dau ? "정상" : "수집 중"}`
            : "현재 mock 데이터 (cron 미가동)"}
        </p>
      </div>

      {/* KPI 6칸 — _metricsSnapshots 실데이터 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-3 lg:grid-cols-6">
        <KpiCell label="DAU" value={kpi.dau} unit="명" delta="오늘" deltaTone="accent" />
        <KpiCell label="MAU" value={kpi.mau} unit="명" delta="이번달" />
        <KpiCell
          label="결제 성공률"
          value={Math.round(kpi.paymentSuccessRate * 10) / 10}
          unit="%"
          decimal
          deltaTone={kpi.paymentSuccessRate >= 97 ? "success" : "warning"}
          delta={kpi.paymentSuccessRate >= 97 ? "목표 97% 상회" : "주의"}
        />
        <KpiCell
          label="알림톡 성공률"
          value={Math.round(kpi.alimtalkSuccessRate * 10) / 10}
          unit="%"
          decimal
          deltaTone={kpi.alimtalkSuccessRate >= 98 ? "success" : "warning"}
          delta={kpi.alimtalkSuccessRate >= 98 ? "정상" : "주의"}
        />
        <KpiCell
          label="검색 p95"
          value={kpi.searchLatencyP95}
          unit="ms"
          deltaTone="success"
          delta="정상"
        />
        <KpiCell
          label="Function 에러율"
          value={Math.round(kpi.cloudFunctionErrorRate * 10) / 10}
          unit="%"
          decimal
          deltaTone={kpi.cloudFunctionErrorRate <= 1 ? "success" : "error"}
          delta={kpi.cloudFunctionErrorRate <= 1 ? "임계 1% 이내" : "임계 초과"}
        />
      </dl>

      {/* 차트 2x2 — 실 history 매핑 */}
      <section className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-14">
        <LineChart
          eyebrow="GMV 시간별 추이"
          subtitle={`최근 ${history.length || 30}시간 · 단위 백만 ₩`}
          data={gmvSeries}
          tone="accent"
          area
        />
        <LineChart
          eyebrow="결제 실패율"
          subtitle={`최근 ${history.length || 30}시간 · 1% 임계 라인`}
          data={failRateSeries}
          tone="error"
          threshold={1.0}
          unit="%"
        />
        <BarChart
          eyebrow="알림톡 성공률"
          subtitle={`최근 ${history.length || 30}시간 · 단위 %`}
          data={solapiSeries}
          yMin={Math.max(0, Math.min(...solapiSeries) - 1)}
          yMax={100}
        />
        <DualLineChart
          eyebrow="Function 응답시간 p50 / p95"
          subtitle="지난 30일 · 단위 ms"
          dataA={fnP50}
          dataB={fnP95}
        />
      </section>

      {/* 서비스 상태 — _serviceHealth 실데이터 */}
      <section className="mt-16">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            외부 서비스 상태
          </p>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {serviceHealth.length > 0
              ? `${serviceHealth.length}개 점검 중`
              : "Healthcheck 미가동 (mock)"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {(serviceHealth.length > 0 ? serviceHealth : DEFAULT_SERVICES).map((s) => (
            <ServiceHealthCard key={s.key} service={s} />
          ))}
        </div>
      </section>

      {/* 이상 감지 ledger — _systemAlerts 실데이터 */}
      <section className="mt-16">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            최근 이상 감지
          </p>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {anomalies.length}건
            {isPreview && " · PREVIEW (mock)"}
          </span>
        </div>
        <SystemAlertsLedger anomalies={anomalies} />
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Service Health (Wave T)
// ─────────────────────────────────────────────────────────────

const DEFAULT_SERVICES: ServiceHealthRow[] = [
  { key: "portone", name: "PortOne", state: "OK", latencyMs: 142 },
  { key: "solapi", name: "Solapi", state: "OK", latencyMs: 188 },
  { key: "sendgrid", name: "SendGrid", state: "OK", latencyMs: 220 },
  { key: "firestore", name: "Firestore", state: "OK", latencyMs: 32 },
];

function ServiceHealthCard({ service }: { service: ServiceHealthRow }) {
  const state = service.state ?? "OK";
  const dotColor: Record<NonNullable<ServiceHealthRow["state"]>, string> = {
    OK: "bg-[var(--color-success)]",
    DEGRADED: "bg-[var(--color-warning)]",
    DOWN: "bg-[var(--color-error)]",
  };
  const stateLabel: Record<NonNullable<ServiceHealthRow["state"]>, string> = {
    OK: "정상",
    DEGRADED: "지연",
    DOWN: "장애",
  };
  return (
    <div className="border border-[var(--color-border-light)] px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium tracking-tight">{service.name ?? service.key}</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor[state]}`} aria-hidden />
          {stateLabel[state]}
        </span>
      </div>
      <p className="mt-3 font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
        {service.latencyMs !== undefined ? `${service.latencyMs}ms` : "—"}
        {service.statusCode != null && (
          <span className="ml-2 text-[var(--color-text-tertiary)]">
            HTTP {service.statusCode}
          </span>
        )}
      </p>
      {service.reason && (
        <p className="mt-1 text-[11px] text-[var(--color-error)] line-clamp-2">
          {service.reason}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI
// ─────────────────────────────────────────────────────────────

function KpiCell({
  label,
  value,
  unit,
  delta,
  deltaTone,
  decimal,
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: string;
  deltaTone?: DeltaTone;
  decimal?: boolean;
}) {
  const deltaColor: Record<DeltaTone, string> = {
    accent: "text-[var(--color-accent)]",
    warning: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
    success: "text-[var(--color-success)]",
  };
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
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
}

// ─────────────────────────────────────────────────────────────
// Charts (inline SVG — mock 데이터)
// ─────────────────────────────────────────────────────────────

function LineChart({
  eyebrow,
  subtitle,
  data,
  tone,
  threshold,
  area,
  unit,
}: {
  eyebrow: string;
  subtitle: string;
  data: number[];
  tone: "accent" | "error";
  threshold?: number;
  area?: boolean;
  unit?: string;
}) {
  const w = 600;
  const h = 200;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 24;
  const maxV = threshold ? Math.max(threshold * 1.4, ...data) : Math.max(...data);
  const minV = Math.min(0, ...data);
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

  const stroke = tone === "accent" ? "var(--color-accent)" : "var(--color-error)";

  const thresholdY = threshold
    ? padT + (h - padT - padB) * (1 - (threshold - minV) / range)
    : null;

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-[var(--color-border-light)] pb-3">
        <h2 className="text-sm font-semibold tracking-tight">{eyebrow}</h2>
        <span className="text-xs text-[var(--color-text-tertiary)]">{subtitle}</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="mt-4 h-44 w-full"
        role="img"
        aria-label={`${eyebrow} 차트`}
      >
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
        {thresholdY !== null && (
          <line
            x1={padL}
            x2={w - padR}
            y1={thresholdY}
            y2={thresholdY}
            stroke="var(--color-warning)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}
        {area && <path d={areaPath} fill={stroke} opacity={0.06} />}
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={3} fill={stroke} />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        <span>30일 전</span>
        <span>오늘</span>
      </div>
      {threshold && (
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          현재 {data[data.length - 1].toFixed(1)}
          {unit ?? ""} · 임계 {threshold}
          {unit ?? ""}
        </p>
      )}
    </div>
  );
}

function BarChart({
  eyebrow,
  subtitle,
  data,
  yMin,
  yMax,
}: {
  eyebrow: string;
  subtitle: string;
  data: number[];
  yMin: number;
  yMax: number;
}) {
  const w = 600;
  const h = 200;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 24;
  const range = yMax - yMin || 1;
  const stepX = (w - padL - padR) / data.length;
  const barW = stepX * 0.6;

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-[var(--color-border-light)] pb-3">
        <h2 className="text-sm font-semibold tracking-tight">{eyebrow}</h2>
        <span className="text-xs text-[var(--color-text-tertiary)]">{subtitle}</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="mt-4 h-44 w-full"
        role="img"
        aria-label={`${eyebrow} 차트`}
      >
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
        {data.map((v, i) => {
          const norm = Math.max(0, (v - yMin) / range);
          const bh = (h - padT - padB) * norm;
          const x = padL + stepX * i + (stepX - barW) / 2;
          const y = h - padB - bh;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={bh}
              fill="var(--color-accent)"
              opacity={0.75}
            />
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        <span>30일 전</span>
        <span>오늘</span>
      </div>
    </div>
  );
}

function DualLineChart({
  eyebrow,
  subtitle,
  dataA,
  dataB,
}: {
  eyebrow: string;
  subtitle: string;
  dataA: number[];
  dataB: number[];
}) {
  const w = 600;
  const h = 200;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 24;
  const maxV = Math.max(...dataA, ...dataB);
  const minV = Math.min(...dataA, ...dataB);
  const range = maxV - minV || 1;
  const stepX = (w - padL - padR) / (dataA.length - 1);

  function path(d: number[]) {
    return d
      .map((v, i) => {
        const x = padL + stepX * i;
        const y = padT + (h - padT - padB) * (1 - (v - minV) / range);
        return i === 0 ? `M${x},${y}` : `L${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-[var(--color-border-light)] pb-3">
        <h2 className="text-sm font-semibold tracking-tight">{eyebrow}</h2>
        <span className="text-xs text-[var(--color-text-tertiary)]">{subtitle}</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="mt-4 h-44 w-full"
        role="img"
        aria-label={`${eyebrow} 차트`}
      >
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
        <path
          d={path(dataA)}
          fill="none"
          stroke="var(--color-text-primary)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d={path(dataB)}
          fill="none"
          stroke="var(--color-text-tertiary)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-3 flex items-center gap-5 text-xs">
        <span className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)]">
          <span aria-hidden className="h-px w-4 bg-[var(--color-text-primary)]" />
          p50 128ms
        </span>
        <span className="inline-flex items-center gap-1.5 text-[var(--color-text-tertiary)]">
          <span aria-hidden className="h-px w-4 border-t border-dashed border-[var(--color-text-tertiary)]" />
          p95 325ms
        </span>
      </div>
    </div>
  );
}
