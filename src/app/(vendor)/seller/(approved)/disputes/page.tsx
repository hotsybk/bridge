import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";

import { Breadcrumb } from "@/components/shared/breadcrumb";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatDateTime, formatKRW, formatRelative } from "@/lib/format";
import { trpcServer } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * 공급업체 — 본인 분쟁 list (Phase ν-4 신규).
 *
 * dispute.listMine 호출 (vendorId 기준 격리).
 * 응답 필요 (NEEDS_ADMIN_RESPONSE / OPEN) 우선 정렬.
 */

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
  NEEDS_ADMIN_RESPONSE: "응답 필요",
  RESOLVED: "해결",
  REJECTED: "거부",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "text-[var(--color-warning)]",
  IN_PROGRESS: "text-[var(--color-accent)]",
  NEEDS_ADMIN_RESPONSE: "text-[var(--color-warning)]",
  RESOLVED: "text-[var(--color-success)]",
  REJECTED: "text-[var(--color-text-tertiary)]",
};

const ACTIVE_STATUSES = new Set(["OPEN", "IN_PROGRESS", "NEEDS_ADMIN_RESPONSE"]);
const URGENT_STATUSES = new Set(["OPEN", "NEEDS_ADMIN_RESPONSE"]);

type Tab = "ALL" | "ACTIVE" | "CLOSED";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "ACTIVE", label: "진행 중" },
  { value: "CLOSED", label: "완료" },
  { value: "ALL", label: "전체" },
];

type DisputeRow = {
  id: string;
  orderId?: string;
  hospitalName?: string;
  vendorName?: string;
  type?: string;
  amount?: number;
  reason?: string;
  status?: string;
  openedAt?: { seconds?: number; _seconds?: number };
  deadlineAt?: { seconds?: number; _seconds?: number };
};

const nowSec = () => Math.floor(Date.now() / 1000);
const hoursAgo = (h: number) => ({ seconds: nowSec() - Math.floor(h * 3600) });
const hoursFromNow = (h: number) => ({ seconds: nowSec() + Math.floor(h * 3600) });

const DEMO_DISPUTES: DisputeRow[] = [
  {
    id: "dp-demo-v-001",
    orderId: "MP-2026-05-30-0231",
    hospitalName: "서울메디컬의원",
    type: "REFUND",
    amount: 469800,
    reason: "포장 손상으로 사용 불가합니다.",
    status: "NEEDS_ADMIN_RESPONSE",
    openedAt: hoursAgo(8),
    deadlineAt: hoursFromNow(40),
  },
  {
    id: "dp-demo-v-002",
    orderId: "MP-2026-05-28-0142",
    hospitalName: "마포365의원",
    type: "QUALITY",
    amount: 92400,
    reason: "제품 변색 — 반품 요청",
    status: "OPEN",
    openedAt: hoursAgo(2),
    deadlineAt: hoursFromNow(46),
  },
  {
    id: "dp-demo-v-003",
    orderId: "MP-2026-05-15-0098",
    hospitalName: "분당미소치과",
    type: "RETURN",
    amount: 318900,
    reason: "주문 수량 일부 반품 처리.",
    status: "RESOLVED",
    openedAt: hoursAgo(220),
    deadlineAt: hoursAgo(172),
  },
];

function matchesTab(row: DisputeRow, tab: Tab): boolean {
  const status = row.status ?? "OPEN";
  if (tab === "ALL") return true;
  if (tab === "ACTIVE") return ACTIVE_STATUSES.has(status);
  return !ACTIVE_STATUSES.has(status);
}

function sortByUrgency(rows: DisputeRow[]): DisputeRow[] {
  return [...rows].sort((a, b) => {
    const aUrgent = URGENT_STATUSES.has(a.status ?? "OPEN") ? 0 : 1;
    const bUrgent = URGENT_STATUSES.has(b.status ?? "OPEN") ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;
    const aDeadline = a.deadlineAt?.seconds ?? a.deadlineAt?._seconds ?? Infinity;
    const bDeadline = b.deadlineAt?.seconds ?? b.deadlineAt?._seconds ?? Infinity;
    return aDeadline - bDeadline;
  });
}

export default async function VendorDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const requested = (sp.status as Tab | undefined) ?? "ACTIVE";
  const tab: Tab = TABS.some((t) => t.value === requested) ? requested : "ACTIVE";

  let disputes: DisputeRow[] = [];
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    disputes = (await trpc.dispute.listMine()) as DisputeRow[];
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      disputes = DEMO_DISPUTES;
    } else {
      throw new Error("분쟁 list 를 불러올 수 없습니다.");
    }
  }

  const counts: Record<Tab, number> = {
    ALL: disputes.length,
    ACTIVE: disputes.filter((d) => matchesTab(d, "ACTIVE")).length,
    CLOSED: disputes.filter((d) => matchesTab(d, "CLOSED")).length,
  };
  const urgentCount = disputes.filter((d) =>
    URGENT_STATUSES.has(d.status ?? "OPEN"),
  ).length;
  const filtered = sortByUrgency(disputes.filter((d) => matchesTab(d, tab)));

  return (
    <main
      id="main-content"
      className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16"
    >
      <Breadcrumb
        items={[
          { label: "셀러센터", href: "/seller/orders" },
          { label: "분쟁" },
        ]}
      />

      {/* 헤더 */}
      <div className="mt-6">
        <PageHeader
          label="파트너센터 · 분쟁"
          title="분쟁"
          description={
            isPreview
              ? "병원이 신청한 분쟁에 대응합니다. 응답이 필요한 항목이 우선 표시됩니다. · PREVIEW (비로그인)"
              : "병원이 신청한 분쟁에 대응합니다. 응답이 필요한 항목이 우선 표시됩니다."
          }
        >
          {urgentCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning)]/10 px-3 py-1 text-xs font-medium text-[var(--color-warning)]">
              <AlertCircle className="h-3 w-3" aria-hidden />
              응답 필요 {urgentCount}건
            </span>
          )}
        </PageHeader>
      </div>

      {/* 탭 */}
      <nav
        aria-label="분쟁 상태 필터"
        className="mt-10 flex border-b border-[var(--color-border-light)]"
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <Link
              key={t.value}
              href={`/seller/disputes?status=${t.value}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-5 py-4 text-sm font-medium transition-colors ${
                active
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 text-xs tabular-nums ${
                  active
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text-tertiary)]"
                }`}
              >
                {counts[t.value]}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={AlertCircle}
            title={
              tab === "ACTIVE"
                ? "진행 중인 분쟁이 없습니다"
                : tab === "CLOSED"
                  ? "완료된 분쟁이 없습니다"
                  : "분쟁 내역이 없습니다"
            }
            description="병원이 분쟁을 신청하면 여기에 자동으로 표시됩니다."
          />
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--color-border-light)] border-b border-[var(--color-border-light)]">
          {filtered.map((d) => (
            <DisputeRowItem key={d.id} dispute={d} />
          ))}
        </ul>
      )}
    </main>
  );
}

function DisputeRowItem({ dispute }: { dispute: DisputeRow }) {
  const status = dispute.status ?? "OPEN";
  const isUrgent = URGENT_STATUSES.has(status);
  const closed = !ACTIVE_STATUSES.has(status);
  const deadlineSec = dispute.deadlineAt?.seconds ?? dispute.deadlineAt?._seconds;
  const openedSec = dispute.openedAt?.seconds ?? dispute.openedAt?._seconds;
  const hoursLeft = deadlineSec
    ? Math.floor((deadlineSec * 1000 - Date.now()) / 3600000)
    : null;

  return (
    <li>
      <Link
        href={`/seller/disputes/${dispute.id}`}
        className={`relative grid grid-cols-1 gap-3 py-6 pl-4 transition-colors hover:bg-[var(--color-bg-secondary)]/40 md:grid-cols-[1fr_auto] md:items-center md:gap-6 ${
          isUrgent
            ? "before:absolute before:left-0 before:top-6 before:h-[calc(100%-3rem)] before:w-[3px] before:bg-[var(--color-warning)]"
            : ""
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-xs tabular-nums text-[var(--color-accent)]">
              {dispute.orderId ?? "—"}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              · {TYPE_LABEL[dispute.type ?? "OTHER"] ?? "기타"}
            </span>
            <span className="text-xs tabular-nums text-[var(--color-text-secondary)]">
              · {formatKRW(dispute.amount)}
            </span>
          </div>
          <p className="mt-2 truncate text-sm font-medium text-[var(--color-text-primary)]">
            {dispute.reason ?? "분쟁 사유 없음"}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-2 text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
            <span>병원 {dispute.hospitalName ?? "—"}</span>
            <span aria-hidden>·</span>
            <span>{openedSec ? formatDateTime(openedSec * 1000) : "—"} 신청</span>
            {!closed && deadlineSec && (
              <>
                <span aria-hidden>·</span>
                <SlaChip hours={hoursLeft} />
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4 md:justify-end">
          <span
            className={`text-xs font-medium ${
              STATUS_COLOR[status] ?? STATUS_COLOR.OPEN
            }`}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
          <ChevronRight
            aria-hidden
            className="h-4 w-4 text-[var(--color-text-tertiary)]"
          />
        </div>
      </Link>
    </li>
  );
}

function SlaChip({ hours }: { hours: number | null }) {
  if (hours === null) return null;
  if (hours <= 0) {
    return <span className="text-[var(--color-error)]">마감 이탈</span>;
  }
  if (hours <= 6) {
    return (
      <span className="text-[var(--color-error)]">마감 {hours}h 남음</span>
    );
  }
  if (hours < 24) {
    return (
      <span className="text-[var(--color-warning)]">마감 {hours}h 남음</span>
    );
  }
  return (
    <span className="text-[var(--color-text-tertiary)]">
      마감 {formatRelative(new Date(Date.now() + hours * 3600000))}
    </span>
  );
}
