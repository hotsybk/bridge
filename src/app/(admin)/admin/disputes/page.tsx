import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { AdminKpiCell } from "@/components/admin/admin-kpi-cell";
import { CountUp } from "@/components/shared/count-up";
import { trpcServer } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * 운영자 — 분쟁 조정 list (Wave E 실연동).
 *
 * tRPC `admin.dispute.list` + `admin.dispute.counts` 호출.
 * 실패 시 PREVIEW_MODE 면 mock 데이터 fallback.
 */

type Tab = "ALL" | "OPEN" | "IN_PROGRESS" | "NEEDS_ADMIN_RESPONSE" | "CLOSED";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "OPEN", label: "신규" },
  { value: "IN_PROGRESS", label: "진행 중" },
  { value: "NEEDS_ADMIN_RESPONSE", label: "운영자 응답 필요" },
  { value: "CLOSED", label: "종결" },
];

const TYPE_LABEL: Record<string, string> = {
  REFUND: "환불",
  RETURN: "반품",
  NOT_DELIVERED: "미수령",
  QUALITY: "품질",
  OTHER: "기타",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "신규",
  IN_PROGRESS: "진행 중",
  NEEDS_ADMIN_RESPONSE: "운영자 응답 필요",
  RESOLVED: "해결",
  REJECTED: "거부",
};

const STATUS_TONE: Record<string, string> = {
  OPEN: "text-[var(--color-text-tertiary)]",
  IN_PROGRESS: "text-[var(--color-accent)]",
  NEEDS_ADMIN_RESPONSE: "text-[var(--color-warning)]",
  RESOLVED: "text-[var(--color-success)]",
  REJECTED: "text-[var(--color-text-tertiary)]",
};

// ─────────────────────────────────────────────────────────────
// Demo data — PREVIEW_MODE fallback
// ─────────────────────────────────────────────────────────────

type DemoDispute = {
  id: string;
  orderId: string;
  hospitalName: string;
  vendorName: string;
  type: "REFUND" | "RETURN" | "NOT_DELIVERED" | "QUALITY" | "OTHER";
  amount: number;
  status: "OPEN" | "IN_PROGRESS" | "NEEDS_ADMIN_RESPONSE" | "RESOLVED" | "REJECTED";
  openedAt: { seconds: number };
  deadlineAt: { seconds: number };
};

function hoursFromNow(h: number) {
  return { seconds: Math.floor(Date.now() / 1000) + Math.floor(h * 3600) };
}
function hoursAgo(h: number) {
  return { seconds: Math.floor(Date.now() / 1000) - Math.floor(h * 3600) };
}

const DEMO_DISPUTES: DemoDispute[] = [
  {
    id: "dp-001",
    orderId: "MP-2026-05-30-0231",
    hospitalName: "서울메디컬의원",
    vendorName: "메디서플라이",
    type: "REFUND",
    amount: 469800,
    status: "NEEDS_ADMIN_RESPONSE",
    openedAt: hoursAgo(8),
    deadlineAt: hoursFromNow(8),
  },
  {
    id: "dp-002",
    orderId: "MP-2026-05-29-0188",
    hospitalName: "강남수치과",
    vendorName: "덴탈프로",
    type: "QUALITY",
    amount: 182000,
    status: "IN_PROGRESS",
    openedAt: hoursAgo(26),
    deadlineAt: hoursFromNow(22),
  },
  {
    id: "dp-003",
    orderId: "MP-2026-05-28-0142",
    hospitalName: "마포365의원",
    vendorName: "헬스케어",
    type: "NOT_DELIVERED",
    amount: 92400,
    status: "NEEDS_ADMIN_RESPONSE",
    openedAt: hoursAgo(44),
    deadlineAt: hoursFromNow(4),
  },
  {
    id: "dp-004",
    orderId: "MP-2026-05-28-0119",
    hospitalName: "한빛가정의학과",
    vendorName: "한빛메디칼(주)",
    type: "RETURN",
    amount: 318900,
    status: "IN_PROGRESS",
    openedAt: hoursAgo(12),
    deadlineAt: hoursFromNow(36),
  },
  {
    id: "dp-005",
    orderId: "MP-2026-05-27-0098",
    hospitalName: "분당미소치과",
    vendorName: "메디서플라이",
    type: "REFUND",
    amount: 1240000,
    status: "NEEDS_ADMIN_RESPONSE",
    openedAt: hoursAgo(42),
    deadlineAt: hoursFromNow(6),
  },
  {
    id: "dp-006",
    orderId: "MP-2026-05-27-0084",
    hospitalName: "성남24시소아과",
    vendorName: "케어스토어",
    type: "OTHER",
    amount: 47600,
    status: "OPEN",
    openedAt: hoursAgo(0.5),
    deadlineAt: hoursFromNow(47.5),
  },
  {
    id: "dp-009",
    orderId: "MP-2026-05-22-0041",
    hospitalName: "용산메디플러스",
    vendorName: "프리메디칼",
    type: "REFUND",
    amount: 542000,
    status: "RESOLVED",
    openedAt: hoursAgo(220),
    deadlineAt: hoursAgo(170),
  },
];

const DEMO_KPI = {
  inProgress: 14,
  needsAdmin: 6,
  slaCloseCount: 3,
  avgDays: 1.8,
};

function matchesTab(d: DemoDispute, tab: Tab): boolean {
  if (tab === "ALL") return true;
  if (tab === "CLOSED") return d.status === "RESOLVED" || d.status === "REJECTED";
  return d.status === tab;
}

type ListItem = {
  id: string;
  orderId?: string;
  hospitalName?: string;
  vendorName?: string;
  type?: string;
  amount?: number;
  status?: string;
  openedAt?: { seconds?: number };
  deadlineAt?: { seconds?: number };
};

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const requested = (sp.status as Tab | undefined) ?? "IN_PROGRESS";
  const tab: Tab =
    [...TABS.map((t) => t.value), "ALL"].includes(requested) ? requested : "IN_PROGRESS";
  const search = sp.search?.trim() ?? "";

  let disputes: ListItem[] = [];
  let kpi = {
    inProgress: 0,
    needsAdmin: 0,
    slaCloseCount: 0,
    avgDays: 0,
  };
  let totalCounts: Record<Tab, number> = {
    ALL: 0,
    OPEN: 0,
    IN_PROGRESS: 0,
    NEEDS_ADMIN_RESPONSE: 0,
    CLOSED: 0,
  };
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    // Phase γ-1 — counts 호출 1회 + 현재 tab list 만.
    // 기존: 5× list 호출 → 변경: 1× tabCounts() + 1× list().
    const [listRes, kpiRes, tabCountsRes] = await Promise.all([
      trpc.admin.dispute.list({
        status: tab,
        search: search || undefined,
        pageSize: 50,
      }),
      trpc.admin.dispute.counts(),
      trpc.admin.dispute.tabCounts(),
    ]);
    disputes = listRes.disputes as ListItem[];
    kpi = kpiRes;
    totalCounts = tabCountsRes as Record<Tab, number>;
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      kpi = DEMO_KPI;
      totalCounts = {
        ALL: DEMO_DISPUTES.length,
        OPEN: DEMO_DISPUTES.filter((d) => matchesTab(d, "OPEN")).length,
        IN_PROGRESS: DEMO_DISPUTES.filter((d) => matchesTab(d, "IN_PROGRESS")).length,
        NEEDS_ADMIN_RESPONSE: DEMO_DISPUTES.filter((d) =>
          matchesTab(d, "NEEDS_ADMIN_RESPONSE"),
        ).length,
        CLOSED: DEMO_DISPUTES.filter((d) => matchesTab(d, "CLOSED")).length,
      };
      disputes = DEMO_DISPUTES.filter((d) => matchesTab(d, tab))
        .filter((d) =>
          search
            ? [d.id, d.orderId, d.hospitalName, d.vendorName]
                .join(" ")
                .toLowerCase()
                .includes(search.toLowerCase())
            : true,
        )
        .map((d) => ({
          id: d.id,
          orderId: d.orderId,
          hospitalName: d.hospitalName,
          vendorName: d.vendorName,
          type: d.type,
          amount: d.amount,
          status: d.status,
          openedAt: d.openedAt,
          deadlineAt: d.deadlineAt,
        }));
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
        운영 · 분쟁
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        분쟁 조정
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        분쟁 중재
      </p>

      {/* KPI 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <AdminKpiCell
          label="진행 중"
          value={<CountUp value={kpi.inProgress} integer />}
          sub="건"
          delta="OPEN + IN_PROGRESS"
          deltaColor="neutral"
        />
        <AdminKpiCell
          label="운영자 응답 필요"
          value={<CountUp value={kpi.needsAdmin} integer />}
          sub="건"
          delta="중재 대기"
          deltaColor="accent"
        />
        <AdminKpiCell
          label="마감 임박 (24h)"
          value={<CountUp value={kpi.slaCloseCount} integer />}
          sub="건"
          delta="마감 이탈 위험"
          deltaColor="warning"
        />
        <AdminKpiCell
          label="평균 처리 시간"
          value={<CountUp value={kpi.avgDays} />}
          sub="일"
          delta="최근 해결 기준"
          deltaColor="success"
        />
      </dl>

      {/* Segment Tabs */}
      <nav
        className="mt-10 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="분쟁 상태 필터"
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/disputes?status=${t.value}${
                search ? `&search=${encodeURIComponent(search)}` : ""
              }`}
              aria-current={active ? "page" : undefined}
              className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs tabular-nums text-[var(--color-text-tertiary)]">
                {totalCounts[t.value]}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-0.5 bg-[var(--color-accent)]"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Filter Chip Row */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {(["유형", "금액 범위", "기간"] as const).map((label) => (
          <button
            key={label}
            type="button"
            disabled
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-3 text-xs text-[var(--color-text-tertiary)] opacity-60"
          >
            {label}
            <ChevronDown className="h-3 w-3" />
          </button>
        ))}
        <form action="/admin/disputes" className="relative ml-auto min-w-[240px]">
          <input type="hidden" name="status" value={tab} />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="분쟁 ID 또는 주문번호"
            className="h-8 w-full border-b border-[var(--color-border-light)] bg-transparent pl-8 pr-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </form>
      </div>

      {isPreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          PREVIEW · 비로그인 상태입니다. 실제 데이터가 아닙니다.
        </p>
      )}

      {/* Table */}
      <div className="mt-8 border-y border-[var(--color-border-light)]">
        <div className="hidden md:grid grid-cols-[110px_180px_1fr_1fr_80px_140px_130px_140px_28px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>분쟁 ID</span>
          <span>주문번호</span>
          <span>병원</span>
          <span>Vendor</span>
          <span>유형</span>
          <span>발생일</span>
          <span>마감</span>
          <span>상태</span>
          <span />
        </div>
        {disputes.length === 0 ? (
          <p className="px-2 py-12 text-center text-sm text-[var(--color-text-tertiary)]">
            해당 상태의 분쟁이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)]">
            {disputes.map((d) => {
              const status = d.status ?? "OPEN";
              const closed = status === "RESOLVED" || status === "REJECTED";
              const deadlineSec = d.deadlineAt?.seconds;
              const hoursLeft = deadlineSec
                ? Math.floor((deadlineSec * 1000 - Date.now()) / 3600000)
                : null;
              const openedSec = d.openedAt?.seconds;
              const openedDate = openedSec
                ? new Date(openedSec * 1000)
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 16)
                : "—";
              // 모바일 카드 좌측 border 색상 — SLA 위험·종결 상태 시각화
              const slaBorder =
                closed
                  ? "border-l-transparent"
                  : hoursLeft !== null && hoursLeft <= 6
                    ? "border-l-[var(--color-error)]"
                    : hoursLeft !== null && hoursLeft < 24
                      ? "border-l-[var(--color-warning)]"
                      : "border-l-transparent";
              return (
                <li key={d.id}>
                  {/* Desktop: grid row */}
                  <Link
                    href={`/admin/disputes/${d.id}`}
                    className="hidden md:grid grid-cols-[110px_180px_1fr_1fr_80px_140px_130px_140px_28px] items-center gap-4 px-2 py-4 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
                  >
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                      {d.id.slice(0, 12)}
                    </span>
                    <span className="truncate font-mono text-xs tabular-nums text-[var(--color-accent)]">
                      {d.orderId ?? "—"}
                    </span>
                    <span className="truncate font-medium">
                      {d.hospitalName ?? "—"}
                    </span>
                    <span className="truncate text-[var(--color-text-secondary)]">
                      {d.vendorName ?? "—"}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {TYPE_LABEL[d.type ?? "OTHER"] ?? "기타"}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                      {openedDate}
                    </span>
                    <SlaChip hours={hoursLeft} closed={closed} />
                    <span
                      className={`text-xs font-medium ${
                        STATUS_TONE[status] ?? STATUS_TONE.OPEN
                      }`}
                    >
                      {STATUS_LABEL[status] ?? status}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                  </Link>
                  {/* Mobile: card layout */}
                  <Link
                    href={`/admin/disputes/${d.id}`}
                    className={`flex flex-col gap-2 border-l-2 px-3 py-4 transition-colors hover:bg-[var(--color-bg-secondary)] md:hidden ${slaBorder}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {d.hospitalName ?? "—"}
                      </span>
                      <span
                        className={`shrink-0 text-xs font-medium ${
                          STATUS_TONE[status] ?? STATUS_TONE.OPEN
                        }`}
                      >
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-mono tabular-nums text-[var(--color-accent)]">
                        {d.orderId ?? "—"}
                      </span>
                      <SlaChip hours={hoursLeft} closed={closed} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                      <span className="truncate">
                        {TYPE_LABEL[d.type ?? "OTHER"] ?? "기타"} · {d.vendorName ?? "—"}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {openedDate}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function SlaChip({ hours, closed }: { hours: number | null; closed: boolean }) {
  if (closed) {
    return (
      <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
        —
      </span>
    );
  }
  if (hours === null) {
    return (
      <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
        —
      </span>
    );
  }
  if (hours <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-[var(--color-error)]">
        <span
          aria-hidden
          className="status-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--color-error)]"
        />
        이탈
      </span>
    );
  }
  if (hours <= 6) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-[var(--color-error)]">
        <span
          aria-hidden
          className="status-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--color-error)]"
        />
        {hours}h 남음
      </span>
    );
  }
  if (hours < 24) {
    return (
      <span className="font-mono text-xs tabular-nums text-[var(--color-warning)]">
        {hours}h 남음
      </span>
    );
  }
  return (
    <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
      {hours}h 남음
    </span>
  );
}

