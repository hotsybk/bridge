import { CountUp } from "@/components/shared/count-up";
import { trpcServer } from "@/lib/trpc/server";

import { AuditLogDrawerList } from "./drawer-list";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * 운영자 — 감사 로그 (Wave F 실연동, Phase γ-1 필터 활성화).
 *
 * tRPC `admin.audit.list` + `admin.audit.counts` 호출.
 * 실패 시 PREVIEW_MODE 면 mock 데이터 fallback.
 *
 * Filter chip — URL searchParam 기반:
 *   actor (ADMIN|SUPER_ADMIN|SYSTEM|VENDOR_OWNER|...)
 *   targetType (Vendor|Product|Order|Dispute|...)
 *   status (SUCCESS|FAILURE)
 */

const ACTOR_OPTIONS = [
  { value: "", label: "Actor" },
  { value: "ADMIN", label: "운영자" },
  { value: "SUPER_ADMIN", label: "최고운영자" },
  { value: "SYSTEM", label: "시스템" },
  { value: "VENDOR_OWNER", label: "공급업체" },
  { value: "BUYER_OWNER", label: "병원" },
];

const TARGET_OPTIONS = [
  { value: "", label: "Resource" },
  { value: "Vendor", label: "공급업체" },
  { value: "Hospital", label: "병원" },
  { value: "Product", label: "상품" },
  { value: "Order", label: "주문" },
  { value: "Dispute", label: "분쟁" },
  { value: "Payment", label: "결제" },
  { value: "SystemAlert", label: "시스템 알림" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Status" },
  { value: "SUCCESS", label: "성공" },
  { value: "FAILURE", label: "실패" },
];

type LogItem = {
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

// PREVIEW mock — 비로그인 dev 미리보기용
const DEMO_LOGS: LogItem[] = [
  {
    id: "demo-1",
    actorName: "이관리",
    actorRole: "ADMIN",
    action: "VENDOR_APPROVED",
    targetType: "Vendor",
    targetId: "v-014",
    status: "SUCCESS",
    ip: "203.0.113.18",
    ua: "Mozilla/5.0",
    before: { status: "PENDING" },
    after: { status: "ACTIVE" },
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 600 },
  },
  {
    id: "demo-2",
    actorName: "subscription-runner",
    actorRole: "SYSTEM",
    action: "SUBSCRIPTION_RUN_CREATED",
    targetType: "Order",
    targetId: "MP-2026-06-01-0234",
    status: "SUCCESS",
    ip: "—",
    ua: "Cloud Functions/2nd-gen",
    after: { subscriptionId: "sub-082", amount: 234000 },
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 1200 },
  },
  {
    id: "demo-3",
    actorName: "박지원",
    actorRole: "ADMIN",
    action: "DISPUTE_RESOLVED",
    targetType: "Dispute",
    targetId: "dispute-031",
    status: "SUCCESS",
    ip: "203.0.113.22",
    ua: "Mozilla/5.0",
    before: { status: "NEEDS_ADMIN_RESPONSE" },
    after: { status: "RESOLVED", refundAmount: 234900 },
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 1800 },
  },
  {
    id: "demo-4",
    actorName: "PortOne webhook",
    actorRole: "SYSTEM",
    action: "WEBHOOK_SIGNATURE_DENIED",
    targetType: "Payment",
    targetId: "pay-0982",
    status: "FAILURE",
    ip: "203.0.113.42",
    ua: "PortOne/v2",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 2400 },
  },
  {
    id: "demo-5",
    actorName: "최지훈",
    actorRole: "ADMIN",
    action: "PRODUCT_APPROVED",
    targetType: "Product",
    targetId: "pd-3412",
    status: "SUCCESS",
    ip: "203.0.113.21",
    ua: "Mozilla/5.0",
    before: { status: "REVIEW" },
    after: { status: "ACTIVE" },
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 3600 },
  },
];

const DEMO_COUNTS = { todayTotal: 1234, adminActions: 142, denied: 8 };

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string;
    targetType?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const actor = sp.actor?.trim() || undefined;
  const targetType = sp.targetType?.trim() || undefined;
  const status =
    sp.status === "SUCCESS" || sp.status === "FAILURE" ? sp.status : undefined;
  const searchQ = sp.q?.trim() ?? "";

  let logs: LogItem[] = [];
  let counts = { todayTotal: 0, adminActions: 0, denied: 0 };
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [listRes, countsRes] = await Promise.all([
      trpc.admin.audit.list({
        pageSize: 50,
        actor,
        targetType,
        status,
      }),
      trpc.admin.audit.counts(),
    ]);
    logs = listRes.items as LogItem[];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      logs = logs.filter((l) =>
        [l.actorId, l.actorName, l.targetId, l.action]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    counts = countsRes;
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      logs = DEMO_LOGS;
      counts = DEMO_COUNTS;
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            시스템 · 감사
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            감사 로그
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            모든 운영자·시스템 액션의 변경 불가 기록
          </p>
        </div>
      </div>

      {/* KPI 3 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-3">
        <KpiCell label="오늘 이벤트" value={counts.todayTotal} unit="건" />
        <KpiCell label="운영자 액션" value={counts.adminActions} unit="건" />
        <KpiCell
          label="거부된 시도"
          value={counts.denied}
          unit="건"
          deltaTone="error"
          delta={counts.denied > 0 ? "모니터링 중" : "정상"}
        />
      </dl>

      {/* Filter chip row — Phase γ-1 활성화 (URL searchParam 기반 form) */}
      <form
        action="/admin/audit-logs"
        method="get"
        className="mt-10 flex flex-wrap items-center gap-3"
      >
        <FilterSelect
          name="actor"
          options={ACTOR_OPTIONS}
          defaultValue={actor ?? ""}
        />
        <FilterSelect
          name="targetType"
          options={TARGET_OPTIONS}
          defaultValue={targetType ?? ""}
        />
        <FilterSelect
          name="status"
          options={STATUS_OPTIONS}
          defaultValue={status ?? ""}
        />
        <input
          type="search"
          name="q"
          defaultValue={searchQ}
          placeholder="actor 또는 resource ID 검색…"
          className="ml-auto h-8 w-64 border-b border-[var(--color-border-light)] bg-transparent text-xs placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-full border border-[var(--color-border-default)] px-4 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
        >
          필터 적용
        </button>
        {(actor || targetType || status || searchQ) && (
          <a
            href="/admin/audit-logs"
            className="inline-flex h-8 items-center text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            초기화
          </a>
        )}
      </form>

      {isPreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          PREVIEW · 비로그인 상태입니다. 실제 데이터가 아닙니다.
        </p>
      )}

      <AuditLogDrawerList logs={logs} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Filter select — native, URL form 일부.
// ─────────────────────────────────────────────────────────────

function FilterSelect({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue: string;
}) {
  const isActive = !!defaultValue;
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={`h-8 cursor-pointer rounded-full border bg-transparent px-3 text-xs font-medium transition-colors focus:outline-none ${
        isActive
          ? "border-[var(--color-accent)] text-[var(--color-accent)]"
          : "border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)]"
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI cell
// ─────────────────────────────────────────────────────────────

type DeltaTone = "accent" | "warning" | "error" | "success";

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
  deltaTone?: DeltaTone;
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
        <CountUp value={value} integer />
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
