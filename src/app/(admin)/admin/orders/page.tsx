import Link from "next/link";
import { ArrowRight, ChevronDown, Search } from "lucide-react";

import { AdminKpiCell } from "@/components/admin/admin-kpi-cell";
import { CountUp } from "@/components/shared/count-up";
import { trpcServer } from "@/lib/trpc/server";
import { formatDateTime } from "@/lib/utils/firestore-time";

import { ExportCsvButton } from "./export-csv-button";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * 운영자 — 전체 주문 감시 (Wave D 실연동).
 *
 * tRPC `admin.order.list` + `admin.order.counts` 호출.
 * 실패 시 PREVIEW_MODE 면 mock 데이터 fallback.
 */

type Tab = "ALL" | "FAILED" | "PREPARING" | "DISPUTED" | "REFUNDING";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "FAILED", label: "결제 실패" },
  { value: "PREPARING", label: "미배송" },
  { value: "DISPUTED", label: "분쟁" },
  { value: "REFUNDING", label: "환불 진행" },
];

const STATUS_LABEL: Record<string, string> = {
  PAID: "결제 완료",
  PENDING_PAYMENT: "결제 대기",
  PENDING_APPROVAL: "승인 대기",
  PARTIALLY_SHIPPED: "부분 배송",
  SHIPPED: "배송 중",
  COMPLETED: "배송 완료",
  CANCELLED: "취소",
  REFUND_REQUESTED: "환불 진행",
  REFUNDED: "환불 완료",
  FAILED: "결제 실패",
};

const STATUS_TONE: Record<string, { dot: string; text: string }> = {
  PAID: { dot: "bg-[var(--color-accent)]", text: "text-[var(--color-accent)]" },
  PENDING_PAYMENT: { dot: "bg-[var(--color-warning)]", text: "text-[var(--color-warning)]" },
  PENDING_APPROVAL: { dot: "bg-[var(--color-warning)]", text: "text-[var(--color-warning)]" },
  PARTIALLY_SHIPPED: { dot: "bg-[var(--color-accent)]", text: "text-[var(--color-accent)]" },
  SHIPPED: { dot: "bg-[var(--color-accent)]", text: "text-[var(--color-accent)]" },
  COMPLETED: { dot: "bg-[var(--color-success)]", text: "text-[var(--color-success)]" },
  CANCELLED: { dot: "bg-[var(--color-text-tertiary)]", text: "text-[var(--color-text-tertiary)]" },
  REFUND_REQUESTED: { dot: "bg-[var(--color-warning)]", text: "text-[var(--color-warning)]" },
  REFUNDED: { dot: "bg-[var(--color-text-tertiary)]", text: "text-[var(--color-text-tertiary)]" },
  FAILED: { dot: "bg-[var(--color-error)]", text: "text-[var(--color-error)]" },
};

type DemoOrder = {
  id: string;
  orderNo?: string;
  createdAt?: { seconds: number };
  hospitalName?: string;
  vendorIds?: string[];
  totalAmount?: number;
  status?: string;
  payment?: { status?: string; method?: string };
  paymentMethod?: string;
  disputed?: boolean;
  subOrderCount?: number;
};

const DEMO_ORDERS: DemoOrder[] = [
  {
    id: "MP-2026-06-01-0042",
    orderNo: "MP-2026-06-01-0042",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 1800 },
    hospitalName: "서울메디컬의원",
    vendorIds: ["v1", "v2"],
    totalAmount: 469800,
    status: "PAID",
    payment: { status: "PAID", method: "CARD" },
    paymentMethod: "CARD",
    subOrderCount: 2,
  },
  {
    id: "MP-2026-06-01-0041",
    orderNo: "MP-2026-06-01-0041",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 2400 },
    hospitalName: "동대문가정의학과",
    vendorIds: ["v1"],
    totalAmount: 89000,
    status: "PENDING_PAYMENT",
    payment: { status: "FAILED", method: "CARD" },
    paymentMethod: "CARD",
    subOrderCount: 1,
  },
  {
    id: "MP-2026-06-01-0040",
    orderNo: "MP-2026-06-01-0040",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 4000 },
    hospitalName: "한빛병원",
    vendorIds: ["v1", "v2", "v3"],
    totalAmount: 1280400,
    status: "PAID",
    payment: { status: "PAID", method: "BANK_TRANSFER" },
    paymentMethod: "BANK_TRANSFER",
    subOrderCount: 3,
  },
  {
    id: "MP-2026-06-01-0039",
    orderNo: "MP-2026-06-01-0039",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 6000 },
    hospitalName: "강남미소치과",
    vendorIds: ["v1"],
    totalAmount: 145200,
    status: "SHIPPED",
    payment: { status: "PAID", method: "CARD" },
    paymentMethod: "CARD",
    subOrderCount: 1,
  },
  {
    id: "MP-2026-06-01-0038",
    orderNo: "MP-2026-06-01-0038",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 7800 },
    hospitalName: "서울메디컬의원",
    vendorIds: ["v1", "v2"],
    totalAmount: 320500,
    status: "COMPLETED",
    payment: { status: "PAID", method: "CARD" },
    paymentMethod: "CARD",
    subOrderCount: 2,
  },
  {
    id: "MP-2026-06-01-0037",
    orderNo: "MP-2026-06-01-0037",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 9600 },
    hospitalName: "수원우리내과",
    vendorIds: ["v1"],
    totalAmount: 58800,
    status: "PENDING_PAYMENT",
    payment: { status: "FAILED", method: "CARD" },
    paymentMethod: "CARD",
    subOrderCount: 1,
  },
  {
    id: "MP-2026-06-01-0036",
    orderNo: "MP-2026-06-01-0036",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 11400 },
    hospitalName: "광주중앙병원",
    vendorIds: ["v1", "v2", "v3", "v4"],
    totalAmount: 2840000,
    status: "PAID",
    payment: { status: "PAID", method: "BANK_TRANSFER" },
    paymentMethod: "BANK_TRANSFER",
    subOrderCount: 4,
  },
  {
    id: "MP-2026-06-01-0035",
    orderNo: "MP-2026-06-01-0035",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 13200 },
    hospitalName: "부산해운대정형외과",
    vendorIds: ["v1", "v2"],
    totalAmount: 412000,
    status: "PAID",
    payment: { status: "PAID", method: "CARD" },
    paymentMethod: "CARD",
    disputed: true,
    subOrderCount: 2,
  },
  {
    id: "MP-2026-05-31-0234",
    orderNo: "MP-2026-05-31-0234",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 86400 },
    hospitalName: "서울메디컬의원",
    vendorIds: ["v1"],
    totalAmount: 28900,
    status: "REFUND_REQUESTED",
    payment: { status: "PAID", method: "CARD" },
    paymentMethod: "CARD",
    subOrderCount: 1,
  },
  {
    id: "MP-2026-05-31-0231",
    orderNo: "MP-2026-05-31-0231",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 90000 },
    hospitalName: "동대문가정의학과",
    vendorIds: ["v1", "v2"],
    totalAmount: 178400,
    status: "PAID",
    payment: { status: "PAID", method: "CARD" },
    paymentMethod: "CARD",
    disputed: true,
    subOrderCount: 2,
  },
];

const DEMO_KPI = {
  todayCount: 68,
  paymentSuccessRate: 98.2,
  undeliveredCount: 23,
  disputeRate: 0.4,
};

type ListItem = DemoOrder;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const requestedTab = (sp.status as Tab | undefined) ?? "ALL";
  const tab: Tab =
    TABS.find((t) => t.value === requestedTab)?.value ?? "ALL";
  const search = sp.search?.trim() ?? "";

  let orders: ListItem[] = [];
  let kpi = {
    todayCount: 0,
    paymentSuccessRate: 0,
    undeliveredCount: 0,
    disputeRate: 0,
  };
  let totalCounts: Record<Tab, number> = {
    ALL: 0,
    FAILED: 0,
    PREPARING: 0,
    DISPUTED: 0,
    REFUNDING: 0,
  };
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    // Phase γ-1 — counts 호출 1회 + 현재 tab list 만.
    // 기존: 5× list 호출 → 변경: 1× tabCounts() + 1× list().
    const [listRes, kpiRes, tabCountsRes] = await Promise.all([
      trpc.admin.order.list({
        status: tab,
        search: search || undefined,
        pageSize: 50,
      }),
      trpc.admin.order.counts(),
      trpc.admin.order.tabCounts(),
    ]);
    orders = listRes.orders as ListItem[];
    kpi = kpiRes;
    totalCounts = tabCountsRes as Record<Tab, number>;
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      kpi = DEMO_KPI;
      const filterByTab = (o: DemoOrder, t: Tab): boolean => {
        if (t === "ALL") return true;
        if (t === "FAILED")
          return o.payment?.status === "FAILED" || o.status === "PENDING_PAYMENT";
        if (t === "PREPARING")
          return ["PAID", "PENDING_APPROVAL"].includes(o.status ?? "");
        if (t === "DISPUTED") return !!o.disputed;
        if (t === "REFUNDING") return o.status === "REFUND_REQUESTED";
        return true;
      };
      totalCounts = {
        ALL: DEMO_ORDERS.length,
        FAILED: DEMO_ORDERS.filter((o) => filterByTab(o, "FAILED")).length,
        PREPARING: DEMO_ORDERS.filter((o) => filterByTab(o, "PREPARING")).length,
        DISPUTED: DEMO_ORDERS.filter((o) => filterByTab(o, "DISPUTED")).length,
        REFUNDING: DEMO_ORDERS.filter((o) => filterByTab(o, "REFUNDING")).length,
      };
      orders = DEMO_ORDERS.filter((o) => filterByTab(o, tab)).filter((o) =>
        search ? (o.id ?? "").toLowerCase().includes(search.toLowerCase()) : true,
      );
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
        운영 · 주문 감시
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        전체 주문 감시
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        결제·배송·분쟁 이상 감지
      </p>

      {/* KPI 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <AdminKpiCell
          label="오늘 주문"
          value={<CountUp value={kpi.todayCount} integer />}
          sub="건"
        />
        <AdminKpiCell
          label="결제 성공률"
          value={<CountUp value={kpi.paymentSuccessRate} />}
          sub="%"
          deltaColor="success"
        />
        <AdminKpiCell
          label="미배송"
          value={<CountUp value={kpi.undeliveredCount} integer />}
          sub="건"
          deltaColor="warning"
        />
        <AdminKpiCell
          label="분쟁 발생률"
          value={<CountUp value={kpi.disputeRate} />}
          sub="%"
          delta="지난 7일"
        />
      </dl>

      {/* Segment Tabs */}
      <nav
        className="mt-10 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="주문 상태 필터"
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/orders?status=${t.value}${
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

      {/* Filter Chip Row + 검색 */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {(["기간", "Vendor", "병원", "금액 범위", "결제수단"] as const).map(
          (label) => (
            <button
              key={label}
              type="button"
              disabled
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-3 text-xs text-[var(--color-text-tertiary)] opacity-60"
            >
              {label}
              <ChevronDown className="h-3 w-3" />
            </button>
          ),
        )}
        <form action="/admin/orders" className="relative ml-auto min-w-[240px]">
          <input type="hidden" name="status" value={tab} />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="주문번호 검색"
            className="h-8 w-full border-b border-[var(--color-border-light)] bg-transparent pl-8 pr-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </form>
      </div>

      {isPreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          PREVIEW · 비로그인 상태입니다. 실제 데이터가 아닙니다.
        </p>
      )}

      {/* Line Table */}
      <div className="mt-8 border-y border-[var(--color-border-light)]">
        <div className="hidden md:grid grid-cols-[200px_140px_1fr_60px_120px_140px_40px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>주문번호</span>
          <span>일시</span>
          <span>병원</span>
          <span className="text-right">vendor</span>
          <span className="text-right">총액</span>
          <span>상태</span>
          <span />
        </div>
        {orders.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-text-secondary)]">
            해당 상태의 주문이 없습니다
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)]">
            {orders.map((o) => {
              const displayStatus = o.disputed
                ? "분쟁"
                : STATUS_LABEL[o.status ?? ""] ?? o.status ?? "—";
              const tone = o.disputed
                ? { dot: "bg-[var(--color-error)]", text: "text-[var(--color-error)]" }
                : STATUS_TONE[o.status ?? ""] ?? {
                    dot: "bg-[var(--color-text-tertiary)]",
                    text: "text-[var(--color-text-tertiary)]",
                  };
              return (
                <li key={o.id}>
                  {/* Desktop: grid row */}
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="hidden md:grid grid-cols-[200px_140px_1fr_60px_120px_140px_40px] items-center gap-4 px-2 py-4 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]/40"
                  >
                    <span className="font-mono text-xs tabular-nums text-[var(--color-accent)]">
                      {o.orderNo ?? o.id}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {formatDateTime(o.createdAt)}
                    </span>
                    <span className="truncate text-[var(--color-text-primary)]">
                      {o.hospitalName ?? "—"}
                    </span>
                    <span className="text-right font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {o.subOrderCount ?? o.vendorIds?.length ?? 0}
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      ₩{(o.totalAmount ?? 0).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={`status-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`}
                        aria-hidden
                      />
                      <span className={`text-xs font-medium ${tone.text}`}>
                        {displayStatus}
                      </span>
                    </span>
                    <span className="flex justify-end text-[var(--color-text-tertiary)]">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                  {/* Mobile: card layout */}
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="flex flex-col gap-2 px-3 py-4 transition-colors hover:bg-[var(--color-bg-secondary)]/40 md:hidden"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-xs tabular-nums text-[var(--color-accent)]">
                        {o.orderNo ?? o.id}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          aria-hidden
                          className={`status-pulse-dot h-1.5 w-1.5 rounded-full ${tone.dot}`}
                        />
                        <span className={`text-xs font-medium ${tone.text}`}>
                          {displayStatus}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {o.hospitalName ?? "—"}
                      </span>
                      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                        ₩{(o.totalAmount ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                      <span className="font-mono tabular-nums">
                        {formatDateTime(o.createdAt)}
                      </span>
                      <span className="tabular-nums">
                        vendor {o.subOrderCount ?? o.vendorIds?.length ?? 0}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination + CSV */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          1 ~ {orders.length} / 전체 {totalCounts.ALL}건
        </p>
        <ExportCsvButton status={tab} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

