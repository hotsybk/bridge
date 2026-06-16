import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PreviewBadge } from "@/components/shared/preview-badge";
import { formatDateTime, formatKRW, formatRelative } from "@/lib/format";
import { trpcServer } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * 병원 사용자 — 본인 분쟁 list (Phase ν-4 신규).
 *
 * dispute.listMine 호출. role 자동 분기 — buyer 는 hospitalId 기준.
 * 탭: 진행 중 / 완료 / 전체.
 *
 * 디자인 DNA:
 *  - 박스 없음. CatalogTopNav 글로벌 + 본문은 라인·타이포 중심
 *  - 헤더 eyebrow + H1 + sub-text
 *  - 탭 underline + 카운트
 *  - row 클릭 → /disputes/[disputeId]
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
  NEEDS_ADMIN_RESPONSE: "운영자 응답 대기",
  RESOLVED: "해결",
  REJECTED: "거부",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "text-[var(--color-text-tertiary)]",
  IN_PROGRESS: "text-[var(--color-accent)]",
  NEEDS_ADMIN_RESPONSE: "text-[var(--color-warning)]",
  RESOLVED: "text-[var(--color-success)]",
  REJECTED: "text-[var(--color-text-tertiary)]",
};

const ACTIVE_STATUSES = new Set(["OPEN", "IN_PROGRESS", "NEEDS_ADMIN_RESPONSE"]);

type Tab = "ALL" | "ACTIVE" | "CLOSED";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "ACTIVE", label: "진행 중" },
  { value: "CLOSED", label: "완료" },
  { value: "ALL", label: "전체" },
];

// ─────────────────────────────────────────────────────────────
// Demo fallback
// ─────────────────────────────────────────────────────────────

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
    id: "dp-demo-001",
    orderId: "MP-2026-05-30-0231",
    vendorName: "메디서플라이",
    type: "REFUND",
    amount: 469800,
    reason: "포장 손상으로 사용 불가합니다.",
    status: "NEEDS_ADMIN_RESPONSE",
    openedAt: hoursAgo(8),
    deadlineAt: hoursFromNow(40),
  },
  {
    id: "dp-demo-002",
    orderId: "MP-2026-05-28-0142",
    vendorName: "헬스케어",
    type: "NOT_DELIVERED",
    amount: 92400,
    reason: "운송장 등록 후 배송이 5일째 멈춰있습니다.",
    status: "IN_PROGRESS",
    openedAt: hoursAgo(28),
    deadlineAt: hoursFromNow(20),
  },
  {
    id: "dp-demo-003",
    orderId: "MP-2026-05-15-0098",
    vendorName: "프리메디칼",
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

export default async function BuyerDisputesPage({
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
  const filtered = disputes.filter((d) => matchesTab(d, tab));

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main
        id="main-content"
        className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20"
      >
        <Breadcrumb
          items={[
            { label: "주문 이력", href: "/orders" },
            { label: "분쟁" },
          ]}
        />

        {/* 헤더 */}
        <div className="mt-6 border-b border-[var(--color-border-light)] pb-12">
          <PageHeader
            label="분쟁 · Disputes"
            title="내 분쟁"
            description="내가 신청·받은 분쟁. 운영자 48시간 내 검토."
          />
          {isPreview && (
            <div className="mt-4">
              <PreviewBadge message="비로그인 상태입니다. 실제 데이터가 아닙니다." />
            </div>
          )}
        </div>

        {/* 탭 */}
        <nav
          aria-label="분쟁 상태 필터"
          className="mt-10 flex w-full items-stretch border-b border-[var(--color-border-light)]"
        >
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <Link
                key={t.value}
                href={`/disputes?status=${t.value}`}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex-1 border-b-2 py-4 text-center text-sm font-medium transition-colors ${
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
                    : "신청한 분쟁이 없습니다"
              }
              description="주문 상세 페이지의 '분쟁 신청' 버튼으로 새 분쟁을 접수할 수 있습니다."
              action={
                <Link
                  href="/orders"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  주문 이력 보기
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--color-border-light)] border-b border-[var(--color-border-light)]">
            {filtered.map((d) => (
              <DisputeRowItem key={d.id} dispute={d} />
            ))}
          </ul>
        )}

        <div className="h-24 md:h-32" />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────

function DisputeRowItem({ dispute }: { dispute: DisputeRow }) {
  const status = dispute.status ?? "OPEN";
  const closed = !ACTIVE_STATUSES.has(status);
  const deadlineSec = dispute.deadlineAt?.seconds ?? dispute.deadlineAt?._seconds;
  const openedSec = dispute.openedAt?.seconds ?? dispute.openedAt?._seconds;
  const hoursLeft = deadlineSec
    ? Math.floor((deadlineSec * 1000 - Date.now()) / 3600000)
    : null;

  return (
    <li>
      <Link
        href={`/disputes/${dispute.id}`}
        className="grid grid-cols-1 gap-3 py-6 transition-colors hover:bg-[var(--color-bg-secondary)]/40 md:grid-cols-[1fr_auto] md:items-center md:gap-6"
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
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs tabular-nums text-[var(--color-text-tertiary)]">
            <span>공급업체 {dispute.vendorName ?? "—"}</span>
            <span aria-hidden className="text-[var(--color-text-tertiary)]/60">·</span>
            <span>{openedSec ? formatDateTime(openedSec * 1000) : "—"} 신청</span>
            {!closed && deadlineSec && (
              <>
                <span aria-hidden className="text-[var(--color-text-tertiary)]/60">·</span>
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
    return (
      <span className="text-[var(--color-error)]">마감 이탈</span>
    );
  }
  if (hours <= 6) {
    return (
      <span className="text-[var(--color-error)]">
        마감 {hours}h 남음
      </span>
    );
  }
  if (hours < 24) {
    return (
      <span className="text-[var(--color-warning)]">
        마감 {hours}h 남음
      </span>
    );
  }
  return (
    <span className="text-[var(--color-text-tertiary)]">
      마감 {formatRelative(new Date(Date.now() + hours * 3600000))}
    </span>
  );
}
