"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Receipt } from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { DisputeOpenButton } from "@/components/buyer/dispute-open-button";
import { CountUp } from "@/components/shared/count-up";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * 주문 이력 — Phase 2 mock.
 *
 * 디자인:
 *  - 박스 컨테이너 0개. 라인 + 타이포 중심.
 *  - 헤더 우측에 통계 (총 주문 / 진행 중 / 완료)
 *  - 필터 탭은 라인 + 카운트, 클릭 시 즉시 필터링
 *  - 각 주문은 horizontal divider 로 구분
 */

type SubOrderStatus = "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

const STATUS_META: Record<
  SubOrderStatus,
  { label: string; color: string; dotColor: string; inProgress: boolean }
> = {
  PAID: {
    label: "결제 완료",
    color: "text-[var(--color-status-paid)]",
    dotColor: "bg-[var(--color-status-paid)]",
    inProgress: true,
  },
  PREPARING: {
    label: "준비 중",
    color: "text-[var(--color-status-pending)]",
    dotColor: "bg-[var(--color-status-pending)]",
    inProgress: true,
  },
  SHIPPED: {
    label: "배송 중",
    color: "text-[var(--color-status-shipped)]",
    dotColor: "bg-[var(--color-status-shipped)]",
    inProgress: true,
  },
  DELIVERED: {
    label: "배송 완료",
    color: "text-[var(--color-status-delivered)]",
    dotColor: "bg-[var(--color-status-delivered)]",
    inProgress: false,
  },
  CANCELLED: {
    label: "취소됨",
    color: "text-[var(--color-status-cancelled)]",
    dotColor: "bg-[var(--color-status-cancelled)]",
    inProgress: false,
  },
};

type Order = {
  id: string;
  orderNo: string;
  orderedAt: string;
  subOrders: Array<{
    vendorName: string;
    items: Array<{ name: string; qty: number; unit: string }>;
    status: SubOrderStatus;
    total: number;
    trackingNo?: string;
  }>;
};

const UNIT_LABEL: Record<string, string> = {
  BOX: "박스",
  EA: "개",
  KG: "kg",
  L: "L",
  ML: "ml",
};
function unit(u: string): string {
  return UNIT_LABEL[u] ?? u;
}

const MOCK_ORDERS: Order[] = [
  {
    id: "ord-0001",
    orderNo: "MP-2026-05-22-0001",
    orderedAt: "2026-05-22",
    subOrders: [
      {
        vendorName: "더미 의료기기 유한회사",
        items: [
          { name: "수술용 라텍스 장갑 (M)", qty: 12, unit: "BOX" },
          { name: "일회용 마스크 KF94 50매", qty: 30, unit: "BOX" },
        ],
        status: "SHIPPED",
        total: 469800,
        trackingNo: "CJ 1234-5678-9012",
      },
      {
        vendorName: "더미 헬스케어",
        items: [{ name: "디지털 청진기 (블루투스)", qty: 2, unit: "EA" }],
        status: "PREPARING",
        total: 703000,
      },
    ],
  },
  {
    id: "ord-0002",
    orderNo: "MP-2026-05-18-0042",
    orderedAt: "2026-05-18",
    subOrders: [
      {
        vendorName: "더미 의료기기 유한회사",
        items: [{ name: "살균 알코올 1L", qty: 12, unit: "EA" }],
        status: "DELIVERED",
        total: 96600,
        trackingNo: "CJ 1234-5678-9011",
      },
    ],
  },
  {
    id: "ord-0003",
    orderNo: "MP-2026-05-11-0019",
    orderedAt: "2026-05-11",
    subOrders: [
      {
        vendorName: "더미 의료기기 유한회사",
        items: [
          { name: "수술용 가운 (멸균) 5매", qty: 4, unit: "BOX" },
          { name: "수술용 메스 (No.11) 100개", qty: 2, unit: "BOX" },
        ],
        status: "DELIVERED",
        total: 151000,
        trackingNo: "CJ 1234-5678-9000",
      },
    ],
  },
];

const FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "PAID", label: "결제 완료" },
  { id: "SHIPPED", label: "배송 중" },
  { id: "DELIVERED", label: "배송 완료" },
  { id: "CANCELLED", label: "취소" },
] as const;
type FilterKey = (typeof FILTERS)[number]["id"];

export default function OrdersPage() {
  const [filter, setFilter] = useState<FilterKey>("ALL");

  // 각 상태별 카운트 (sub-order 기준)
  const counts = useMemo(() => {
    const c: Record<SubOrderStatus, number> = {
      PAID: 0,
      PREPARING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    MOCK_ORDERS.forEach((o) => o.subOrders.forEach((so) => c[so.status]++));
    return c;
  }, []);

  const totalSubOrders = Object.values(counts).reduce((a, b) => a + b, 0);
  const inProgressCount = counts.PAID + counts.PREPARING + counts.SHIPPED;
  const completedCount = counts.DELIVERED;

  // 필터링된 주문 목록 (필터 매칭되는 sub-order 가 하나라도 있는 주문)
  const filteredOrders = useMemo(() => {
    if (filter === "ALL") return MOCK_ORDERS;
    if (filter === "SHIPPED") {
      // "배송 중" = PAID, PREPARING, SHIPPED
      return MOCK_ORDERS.filter((o) =>
        o.subOrders.some(
          (so) =>
            so.status === "PAID" ||
            so.status === "PREPARING" ||
            so.status === "SHIPPED",
        ),
      );
    }
    return MOCK_ORDERS.filter((o) =>
      o.subOrders.some((so) => so.status === filter),
    );
  }, [filter]);

  const isEmpty = filteredOrders.length === 0;

  // 필터 카운트
  const filterCounts: Record<FilterKey, number> = {
    ALL: MOCK_ORDERS.length,
    PAID: counts.PAID,
    SHIPPED: counts.PAID + counts.PREPARING + counts.SHIPPED,
    DELIVERED: counts.DELIVERED,
    CANCELLED: counts.CANCELLED,
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main
        id="main-content"
        className="mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-24"
      >
        {/* Phase 1.5 안내 — 실 데이터 연결 진행 중 */}
        <div className="mb-10 rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-warning)]">
            Phase 1.5 출시 예정
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            이 페이지는 실 주문 데이터 연결이 진행 중입니다. 아래 항목은 디자인
            미리보기로, 실제 주문 이력은 정식 출시 후 표시됩니다.
          </p>
        </div>

        {/* ─── 헤더 ─── */}
        <div className="grid gap-10 border-b border-[var(--color-border-light)] pb-12 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">
          <PageHeader
            label="주문 · 이력"
            title="주문 이력"
            description="주문 진행·배송 정보 한 곳에서."
          />

          {/* 통계 — 3 컬럼 */}
          <dl className="grid grid-cols-3 gap-2">
            <StatItem value={MOCK_ORDERS.length} label="총 주문" />
            <StatItem
              value={inProgressCount}
              label="진행 중"
              tone="accent"
              hasDivider
            />
            <StatItem
              value={completedCount}
              label="완료"
              tone="success"
              hasDivider
            />
          </dl>
        </div>

        {/* ─── 필터 탭 — 전체 폭 균등 underline ─── */}
        <nav
          aria-label="주문 상태 필터"
          className="mt-12 flex w-full items-stretch border-b border-[var(--color-border-light)]"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const count = filterCounts[f.id];
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={`-mb-px flex-1 border-b-2 py-4 text-sm font-medium transition-colors ${
                  active
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {f.label}
                <span
                  className={`ml-1.5 text-xs tabular-nums ${
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-tertiary)]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* ─── 주문 목록 ─── */}
        {isEmpty ? (
          <EmptyOrders hasFilter={filter !== "ALL"} onReset={() => setFilter("ALL")} />
        ) : (
          <ol className="mt-2">
            {filteredOrders.map((order) => (
              <OrderItem key={order.id} order={order} />
            ))}
          </ol>
        )}

        <div className="h-24 md:h-32" />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat item (헤더 우측)
// ─────────────────────────────────────────────────────────────

function StatItem({
  value,
  label,
  tone = "neutral",
  hasDivider,
}: {
  value: number;
  label: string;
  tone?: "neutral" | "accent" | "success";
  hasDivider?: boolean;
}) {
  const color = {
    neutral: "text-[var(--color-text-primary)]",
    accent: "text-[var(--color-accent)]",
    success: "text-[var(--color-success)]",
  }[tone];
  return (
    <div
      className={`px-2 lg:px-5 ${
        hasDivider ? "lg:border-l lg:border-[var(--color-border-light)]" : ""
      }`}
    >
      <p
        className={`text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl ${color}`}
      >
        <CountUp value={value} duration={900} />
      </p>
      <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
        {label}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OrderItem — 박스 없음, divider 로 구분
// ─────────────────────────────────────────────────────────────

function OrderItem({ order }: { order: Order }) {
  const total = order.subOrders.reduce((s, so) => s + so.total, 0);
  return (
    <li className="border-b border-[var(--color-border-light)] py-10 last:border-0 md:py-14">
      {/* 주문 헤더 — 라벨 + 주문번호 + 날짜 + 상세 */}
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            <Receipt className="mr-1 inline h-3 w-3" />
            주문번호
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="text-sm font-semibold tabular-nums tracking-tight">
              {order.orderNo}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)] tabular-nums">
              {order.orderedAt}
            </span>
          </p>
        </div>
        <Link
          href={`/orders/${order.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          상세 보기
          <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      {/* SubOrders */}
      <ul className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        {order.subOrders.map((so, idx) => (
          <SubOrderRow key={idx} subOrder={so} />
        ))}
      </ul>

      {/* 푸터 — 총 결제 + 분쟁 신청 */}
      <footer className="mt-5 flex items-baseline justify-between">
        <DisputeOpenButton orderId={order.id} isPreview={PREVIEW_MODE} />
        <p className="text-2xl font-semibold tabular-nums tracking-[-0.02em] md:text-3xl">
          ₩<CountUp value={total} duration={600} />
        </p>
      </footer>
    </li>
  );
}

function SubOrderRow({ subOrder }: { subOrder: Order["subOrders"][number] }) {
  const meta = STATUS_META[subOrder.status];
  return (
    <li className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:items-center md:gap-6">
      {/* 좌측 — 벤더 + 상품 + 운송장 */}
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight">
          {subOrder.vendorName}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {subOrder.items
            .map((i) => `${i.name} × ${i.qty}${unit(i.unit)}`)
            .join(" · ")}
        </p>
        {subOrder.trackingNo && (
          <p className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)] tabular-nums">
            운송장 {subOrder.trackingNo}
          </p>
        )}
      </div>

      {/* 우측 — 상태 + 금액 */}
      <div className="flex items-center justify-between gap-6 md:justify-end">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.color}`}
        >
          {meta.inProgress && (
            <span
              aria-hidden
              className={`status-pulse-dot h-1.5 w-1.5 rounded-full ${meta.dotColor}`}
            />
          )}
          {meta.label}
          <ChevronRight className="h-3 w-3 opacity-40" />
        </span>
        <p className="text-sm font-semibold tabular-nums">
          ₩{subOrder.total.toLocaleString()}
        </p>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Empty
// ─────────────────────────────────────────────────────────────

function EmptyOrders({
  hasFilter,
  onReset,
}: {
  hasFilter: boolean;
  onReset: () => void;
}) {
  return (
    <div className="mt-12">
      <EmptyState
        icon={Receipt}
        title={hasFilter ? "해당 조건의 주문이 없습니다" : "아직 주문이 없습니다"}
        description={
          hasFilter
            ? "필터를 초기화하거나 다른 상태를 선택해보세요."
            : "첫 주문 후 진행 상황이 여기에 표시됩니다."
        }
        action={
          hasFilter ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              전체 보기
            </button>
          ) : (
            <Link
              href="/search"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              카탈로그 둘러보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          )
        }
      />
    </div>
  );
}
