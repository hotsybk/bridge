"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import {
  BulkShipDialog,
  type BulkShipTargetRow,
} from "@/components/vendor/bulk-ship-dialog";
import {
  OrderDetailDialog,
  type OrderDetailRow,
} from "@/components/vendor/order-detail-dialog";
import { downloadCsv, todayStamp } from "@/lib/csv-download";
import { trpc } from "@/lib/trpc/client";

/**
 * 파트너센터 — 주문 관리 (Wave P2 tRPC 실시간 연동).
 *
 * 디자인 DNA: 박스 컨테이너 없음. KPI 4컬럼 라인, full-width underline 필터 탭,
 * 표 행 사이 divider 만. 검색·필터·발송 처리 등 모든 버튼 작동.
 *
 * - 데이터: trpc.vendor.order.list / counts
 * - PREVIEW fallback: 에러/빈 결과 시 디자인 미리보기 dummy rows 사용 (Phase 1 정책)
 * - 액션: acceptOrder / ship / markDelivered / cancel mutation
 */

type OrderStatus = "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

const STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    color: string;
    dotBg: string;
    nextActionLabel: string | null;
  }
> = {
  PAID: {
    label: "결제 완료",
    color: "text-[var(--color-status-paid)]",
    dotBg: "bg-[var(--color-status-paid)]",
    nextActionLabel: "발송 처리",
  },
  PREPARING: {
    label: "준비 중",
    color: "text-[var(--color-status-pending)]",
    dotBg: "bg-[var(--color-status-pending)]",
    nextActionLabel: "발송 처리",
  },
  SHIPPED: {
    label: "배송 중",
    color: "text-[var(--color-status-shipped)]",
    dotBg: "bg-[var(--color-status-shipped)]",
    nextActionLabel: "운송장 보기",
  },
  DELIVERED: {
    label: "배송 완료",
    color: "text-[var(--color-status-delivered)]",
    dotBg: "bg-[var(--color-status-delivered)]",
    nextActionLabel: null,
  },
  CANCELLED: {
    label: "취소",
    color: "text-[var(--color-status-cancelled)]",
    dotBg: "bg-[var(--color-status-cancelled)]",
    nextActionLabel: null,
  },
};

const IN_PROGRESS_STATUS: ReadonlySet<OrderStatus> = new Set([
  "PAID",
  "PREPARING",
  "SHIPPED",
]);

function isInProgress(s: OrderStatus): boolean {
  return IN_PROGRESS_STATUS.has(s);
}

type KpiTone = "paid" | "pending" | "shipped" | "delivered";

const KPIS: Array<{
  key: OrderStatus;
  label: string;
  icon: typeof Clock;
  tone: KpiTone;
}> = [
  { key: "PAID", label: "결제 완료", icon: CreditCard, tone: "paid" },
  { key: "PREPARING", label: "준비 중", icon: Clock, tone: "pending" },
  { key: "SHIPPED", label: "배송 중", icon: Truck, tone: "shipped" },
  { key: "DELIVERED", label: "배송 완료", icon: PackageCheck, tone: "delivered" },
];

type Row = {
  id: string;            // subOrderId
  orderId: string;       // parent orderId (for mutation)
  orderNo: string;       // display
  date: string;
  hospital: string;
  items: string;
  total: number;
  status: OrderStatus;
  trackingNo?: string;
  carrier?: string;
};

// PREVIEW fallback rows — 인증 미완료 / Firestore 빈 상태에서 디자인 검수용
const PREVIEW_ROWS: Row[] = [
  { id: "preview-1", orderId: "preview-o-1", orderNo: "MP-2026-05-22-0001", date: "2026-05-22", hospital: "더미 병원", items: "수술용 라텍스 장갑 외 1건", total: 469800, status: "SHIPPED" },
  { id: "preview-2", orderId: "preview-o-2", orderNo: "MP-2026-05-22-0002", date: "2026-05-22", hospital: "강남 메디 클리닉", items: "디지털 청진기 외 2건", total: 703000, status: "PREPARING" },
  { id: "preview-3", orderId: "preview-o-3", orderNo: "MP-2026-05-21-0017", date: "2026-05-21", hospital: "더미 정형외과", items: "수술용 메스 외 3건", total: 187500, status: "PAID" },
  { id: "preview-4", orderId: "preview-o-4", orderNo: "MP-2026-05-20-0009", date: "2026-05-20", hospital: "더미 산부인과", items: "멸균 가운 외 1건", total: 154000, status: "SHIPPED" },
  { id: "preview-5", orderId: "preview-o-5", orderNo: "MP-2026-05-18-0042", date: "2026-05-18", hospital: "더미 병원", items: "살균 알코올 1리터", total: 96600, status: "DELIVERED" },
  { id: "preview-6", orderId: "preview-o-6", orderNo: "MP-2026-05-16-0028", date: "2026-05-16", hospital: "더미 한의원", items: "한방 거즈 외 2건", total: 84000, status: "DELIVERED" },
  { id: "preview-7", orderId: "preview-o-7", orderNo: "MP-2026-05-15-0033", date: "2026-05-15", hospital: "더미 내과의원", items: "일회용 주사기 외 2건", total: 124300, status: "CANCELLED" },
];

const PREVIEW_COUNTS = {
  accepted: 1,
  packing: 1,
  shipped: 2,
  delivered: 2,
  cancelled: 1,
  todayCount: 2,
  totalAmount: 1819200,
};

const FILTERS = [
  { key: "ALL" as const, label: "전체" },
  { key: "PAID" as const, label: "결제 완료" },
  { key: "PREPARING" as const, label: "준비 중" },
  { key: "SHIPPED" as const, label: "배송 중" },
  { key: "DELIVERED" as const, label: "배송 완료" },
  { key: "CANCELLED" as const, label: "취소" },
];
type FilterKey = (typeof FILTERS)[number]["key"];

// 백엔드 SubOrderStatus → UI OrderStatus 매핑
const STATUS_FROM_BACKEND: Record<string, OrderStatus> = {
  ACCEPTED: "PAID",
  PACKING: "PREPARING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  RETURN_REQUESTED: "CANCELLED",
  RETURNED: "CANCELLED",
};

const STATUS_TO_BACKEND: Record<Exclude<FilterKey, "ALL">, string> = {
  PAID: "ACCEPTED",
  PREPARING: "PACKING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

function tsToDateStr(ts: unknown): string {
  if (!ts) return "—";
  const w = ts as { _seconds?: number; seconds?: number; toDate?: () => Date };
  if (typeof w.toDate === "function") {
    try {
      return w.toDate().toISOString().slice(0, 10);
    } catch {
      /* fallthrough */
    }
  }
  const sec = w._seconds ?? w.seconds;
  if (typeof sec === "number") {
    return new Date(sec * 1000).toISOString().slice(0, 10);
  }
  return "—";
}

export default function SellerOrdersPage() {
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [query, setQuery] = useState("");
  const [detailRow, setDetailRow] = useState<OrderDetailRow | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailSubOrderId, setDetailSubOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Phase γ-2 — 일괄 발송 선택 상태
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  // Phase γ-2 — cursor pagination
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulated, setAccumulated] = useState<Row[]>([]);

  // tRPC
  const listQuery = trpc.vendor.order.list.useQuery({
    pageSize: 50,
    cursor,
    status:
      filter === "ALL"
        ? undefined
        : (STATUS_TO_BACKEND[filter] as
            | "ACCEPTED"
            | "PACKING"
            | "SHIPPED"
            | "DELIVERED"
            | "CANCELLED"),
  });
  const countsQuery = trpc.vendor.order.counts.useQuery();

  const utils = trpc.useUtils();
  const acceptMutation = trpc.vendor.order.acceptOrder.useMutation({
    onSuccess: () => {
      void utils.vendor.order.list.invalidate();
      void utils.vendor.order.counts.invalidate();
    },
  });
  const shipMutation = trpc.vendor.order.ship.useMutation({
    onSuccess: () => {
      void utils.vendor.order.list.invalidate();
      void utils.vendor.order.counts.invalidate();
    },
  });
  const deliveredMutation = trpc.vendor.order.markDelivered.useMutation({
    onSuccess: () => {
      void utils.vendor.order.list.invalidate();
      void utils.vendor.order.counts.invalidate();
    },
  });
  const bulkShipMutation = trpc.vendor.order.bulkShip.useMutation({
    onSuccess: () => {
      void utils.vendor.order.list.invalidate();
      void utils.vendor.order.counts.invalidate();
    },
  });

  // PREVIEW fallback — 인증/데이터 없을 때 디자인 검수용
  const usePreview =
    !listQuery.isPending &&
    (listQuery.error !== null || (listQuery.data?.subOrders.length ?? 0) === 0);

  // 필터 변경 시 cursor + accumulated 초기화
  useEffect(() => {
    setCursor(undefined);
    setAccumulated([]);
    setSelected(new Set());
  }, [filter]);

  // 새 페이지 응답 적재
  useEffect(() => {
    if (!listQuery.data) return;
    const pageRows: Row[] = listQuery.data.subOrders.map((so) => {
      const backendStatus = (so as { status?: string }).status ?? "ACCEPTED";
      return {
        id: so.id,
        orderId: so.orderId,
        orderNo: (so as { orderNo?: string }).orderNo ?? so.id.slice(0, 12),
        date: tsToDateStr((so as { createdAt?: unknown }).createdAt),
        hospital: (so as { hospitalName?: string }).hospitalName ?? "—",
        items: `${(so as { itemCount?: number }).itemCount ?? 1}개 품목`,
        total: (so as { total?: number }).total ?? 0,
        status: STATUS_FROM_BACKEND[backendStatus] ?? "PAID",
        trackingNo: (so as { trackingNo?: string }).trackingNo,
        carrier: (so as { trackingCarrier?: string }).trackingCarrier,
      };
    });
    setAccumulated((prev) => {
      if (!cursor) return pageRows;
      // 중복 방지 — id set
      const seen = new Set(prev.map((r) => r.id));
      const merged = [...prev];
      for (const r of pageRows) {
        if (!seen.has(r.id)) merged.push(r);
      }
      return merged;
    });
  }, [listQuery.data, cursor]);

  const rawRows: Row[] = usePreview ? PREVIEW_ROWS : accumulated;
  const nextCursor = listQuery.data?.nextCursor;

  const liveCounts = countsQuery.data ?? PREVIEW_COUNTS;
  // backend status → UI 라벨 매핑
  const counts: Record<OrderStatus, number> = useMemo(() => {
    if (usePreview) {
      const c: Record<OrderStatus, number> = {
        PAID: 0,
        PREPARING: 0,
        SHIPPED: 0,
        DELIVERED: 0,
        CANCELLED: 0,
      };
      for (const r of PREVIEW_ROWS) c[r.status]++;
      return c;
    }
    return {
      PAID: liveCounts.accepted,
      PREPARING: liveCounts.packing,
      SHIPPED: liveCounts.shipped,
      DELIVERED: liveCounts.delivered,
      CANCELLED: liveCounts.cancelled ?? 0,
    };
  }, [usePreview, liveCounts]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  const filteredRows = useMemo(() => {
    return rawRows.filter((r) => {
      if (filter !== "ALL" && r.status !== filter) return false;
      if (query.trim()) {
        const needle = query.trim().toLowerCase();
        return (
          r.orderNo.toLowerCase().includes(needle) ||
          r.hospital.toLowerCase().includes(needle) ||
          r.items.toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [rawRows, filter, query]);

  function onExport() {
    downloadCsv(
      `orders_${todayStamp()}.csv`,
      ["주문번호", "주문일", "병원", "상품", "금액", "상태"],
      filteredRows.map((r) => [
        r.orderNo,
        r.date,
        r.hospital,
        r.items,
        r.total,
        STATUS_META[r.status].label,
      ]),
    );
    showToast(`${filteredRows.length}건의 주문을 CSV 로 내보냈습니다.`);
  }

  function onRowAction(row: Row) {
    setDetailRow({
      orderNo: row.orderNo,
      date: row.date,
      hospital: row.hospital,
      items: row.items,
      total: row.total,
      status: row.status,
      trackingNo: row.trackingNo,
    });
    setDetailOrderId(row.orderId);
    setDetailSubOrderId(row.id);
  }

  async function onShipped(
    orderNo: string,
    courier: string,
    trackingNo: string,
  ) {
    if (
      !detailOrderId ||
      !detailSubOrderId ||
      detailSubOrderId.startsWith("preview-")
    ) {
      showToast(`${orderNo} 발송 처리 완료 (미리보기 모드)`);
      return;
    }
    try {
      // ACCEPTED 상태면 먼저 PACKING 으로 전환 후 ship — backend 에서 둘 다 허용
      await shipMutation.mutateAsync({
        orderId: detailOrderId,
        subOrderId: detailSubOrderId,
        carrier: courier,
        trackingNo,
      });
      showToast(`${orderNo} 발송 처리 완료 · ${courier} ${trackingNo}`);
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function onDelivered(orderNo: string) {
    if (
      !detailOrderId ||
      !detailSubOrderId ||
      detailSubOrderId.startsWith("preview-")
    ) {
      showToast(`${orderNo} 배송 완료 처리되었습니다. (미리보기 모드)`);
      return;
    }
    try {
      await deliveredMutation.mutateAsync({
        orderId: detailOrderId,
        subOrderId: detailSubOrderId,
      });
      showToast(`${orderNo} 배송 완료 처리되었습니다.`);
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function onQuickAccept(row: Row) {
    if (row.id.startsWith("preview-")) {
      showToast("미리보기 데이터에는 액션을 적용할 수 없습니다.");
      return;
    }
    try {
      await acceptMutation.mutateAsync({
        orderId: row.orderId,
        subOrderId: row.id,
      });
      showToast(`${row.orderNo} 출고 준비로 전환되었습니다.`);
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  // Phase γ-2 — 일괄 발송 헬퍼
  const ELIGIBLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
    "PAID",
    "PREPARING",
  ]);

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const bulkTargets: BulkShipTargetRow[] = useMemo(() => {
    const out: BulkShipTargetRow[] = [];
    for (const r of rawRows) {
      if (!selected.has(r.id)) continue;
      if (!ELIGIBLE_STATUSES.has(r.status)) continue;
      out.push({
        subOrderId: r.id,
        orderId: r.orderId,
        orderNo: r.orderNo,
      });
    }
    return out;
  }, [rawRows, selected]);

  async function handleBulkShip(
    shipments: Array<{
      orderId: string;
      subOrderId: string;
      carrier: string;
      trackingNo: string;
    }>,
  ) {
    // preview 데이터 차단
    if (shipments.some((s) => s.subOrderId.startsWith("preview-"))) {
      showToast("미리보기 데이터에는 일괄 발송을 적용할 수 없습니다.");
      setBulkOpen(false);
      setSelected(new Set());
      return;
    }
    try {
      const res = await bulkShipMutation.mutateAsync({ shipments });
      const successCount = res.success.length;
      const failedCount = res.failed.length;
      if (failedCount === 0) {
        showToast(`${successCount}건 발송 처리 완료`);
      } else {
        showToast(
          `${successCount}건 성공 · ${failedCount}건 실패 (${res.failed[0]?.error ?? ""})`,
        );
      }
      setBulkOpen(false);
      setSelected(new Set());
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  function loadMore() {
    if (nextCursor) {
      setCursor(nextCursor);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
      <PageHeader
        label="파트너센터 · 주문"
        title="주문 관리"
        description="주문 처리 · 운송장 등록"
      >
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-secondary)]"
        >
          <Download className="h-3.5 w-3.5" />
          CSV 내보내기
        </button>
      </PageHeader>

      {/* KPI — 4 컬럼 텍스트 + divider */}
      <section className="mt-12 grid grid-cols-2 gap-y-8 border-y border-[var(--color-border-light)] py-8 lg:grid-cols-4 lg:gap-y-0">
        {KPIS.map((k, i) => (
          <KpiItem
            key={k.key}
            icon={k.icon}
            label={k.label}
            tone={k.tone}
            value={counts[k.key]}
            hasDivider={i > 0}
            isActive={filter === k.key}
            onClick={() => setFilter(filter === k.key ? "ALL" : k.key)}
          />
        ))}
      </section>

      {/* 검색 input — 하단 underline */}
      <div className="mt-10 relative">
        <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="주문번호·병원명·상품명 검색"
          className="h-10 w-full border-b border-[var(--color-border-light)] bg-transparent pl-6 pr-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
      </div>

      {/* 필터 탭 — 전체 폭 균등 분배 */}
      <nav
        aria-label="주문 상태 필터"
        className="mt-2 flex w-full items-stretch border-b border-[var(--color-border-light)]"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={`-mb-px flex-1 border-b-2 py-3 text-xs font-medium transition-colors ${
                active
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </nav>

      {/* 표 — Desktop only */}
      <section className="mt-2 hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-light)] text-left text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              <th className="w-8 py-3 pr-2 font-medium" aria-label="선택" />
              <th className="py-3 pr-6 font-medium">주문</th>
              <th className="px-6 py-3 font-medium">병원</th>
              <th className="px-6 py-3 font-medium">상품</th>
              <th className="px-6 py-3 text-right font-medium">금액</th>
              <th className="px-6 py-3 font-medium">상태</th>
              <th className="px-6 py-3 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-16 text-center text-sm text-[var(--color-text-tertiary)]"
                >
                  조건에 맞는 주문이 없습니다.
                  {(filter !== "ALL" || query.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("ALL");
                        setQuery("");
                      }}
                      className="ml-2 font-medium text-[var(--color-accent)] hover:underline"
                    >
                      필터 초기화
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredRows.map((r, i) => (
                <OrderRow
                  key={`${filter}-${query}-${r.id}`}
                  row={r}
                  index={i}
                  selectable={ELIGIBLE_STATUSES.has(r.status)}
                  selected={selected.has(r.id)}
                  onSelectChange={(checked) => toggleSelect(r.id, checked)}
                  onAction={() => onRowAction(r)}
                  onQuickAccept={() => onQuickAccept(r)}
                />
              ))
            )}
          </tbody>
        </table>

        {/* 더 보기 — cursor pagination */}
        {!usePreview && nextCursor && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={listQuery.isFetching}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-5 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
            >
              {listQuery.isFetching ? "불러오는 중…" : `더 보기 (${rawRows.length}건 표시 중)`}
            </button>
          </div>
        )}
      </section>

      {/* Mobile card list */}
      <section className="mt-2 md:hidden">
        {filteredRows.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-text-tertiary)]">
            조건에 맞는 주문이 없습니다.
            {(filter !== "ALL" || query.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setFilter("ALL");
                  setQuery("");
                }}
                className="ml-2 font-medium text-[var(--color-accent)] hover:underline"
              >
                필터 초기화
              </button>
            )}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {filteredRows.map((r) => {
              const meta = STATUS_META[r.status];
              const selectable = ELIGIBLE_STATUSES.has(r.status);
              return (
                <li key={`m-${filter}-${query}-${r.id}`} className="flex flex-col gap-2 px-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      {selectable && (
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={(e) => toggleSelect(r.id, e.target.checked)}
                          aria-label={`${r.orderNo} 선택`}
                          className="mt-1 h-4 w-4 cursor-pointer rounded border-[var(--color-border-light)]"
                        />
                      )}
                      <div className="min-w-0">
                        <a
                          href={`/seller/orders/${r.orderId}?sub=${r.id}`}
                          className="block truncate font-mono text-sm font-medium tabular-nums hover:text-[var(--color-accent)]"
                        >
                          {r.orderNo}
                        </a>
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)] tabular-nums">
                          {r.date}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold ${meta.color}`}>
                      {isInProgress(r.status) && (
                        <span
                          aria-hidden
                          className={`status-pulse-dot h-1.5 w-1.5 rounded-full ${meta.dotBg}`}
                        />
                      )}
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm">{r.hospital}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      ₩{r.total.toLocaleString()}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                    {r.items}
                  </p>
                  <div className="mt-1 flex justify-end gap-3">
                    {r.status === "PAID" && (
                      <button
                        type="button"
                        onClick={() => onQuickAccept(r)}
                        className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
                      >
                        출고 준비
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRowAction(r)}
                      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                        meta.nextActionLabel
                          ? "text-[var(--color-accent)] hover:underline"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {meta.nextActionLabel ?? "상세"}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!usePreview && nextCursor && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={listQuery.isFetching}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-5 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
            >
              {listQuery.isFetching ? "불러오는 중…" : `더 보기 (${rawRows.length}건 표시 중)`}
            </button>
          </div>
        )}
      </section>

      {/* Footer note */}
      <p className="mt-12 border-t border-[var(--color-border-light)] pt-6 text-xs text-[var(--color-text-tertiary)]">
        배송 완료 후 영업일 3일 자동 정산{" "}
        <a href="/seller/settlement" className="font-medium text-[var(--color-accent)] hover:underline">
          정산 내역 보기 →
        </a>
      </p>

      <OrderDetailDialog
        open={!!detailRow}
        row={detailRow}
        onClose={() => {
          setDetailRow(null);
          setDetailOrderId(null);
          setDetailSubOrderId(null);
        }}
        onShipped={onShipped}
        onDelivered={onDelivered}
      />

      {/* Phase γ-2 — 일괄 발송 sticky bar */}
      {bulkTargets.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-6 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <p className="text-sm font-medium">
              {bulkTargets.length}건 선택됨
              <span className="ml-2 text-[11px] text-[var(--color-text-tertiary)]">
                결제 완료/준비 중 상태만 가능
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="inline-flex h-9 items-center rounded-full px-4 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                선택 해제
              </button>
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
              >
                <Truck className="h-3.5 w-3.5" />
                일괄 발송 처리
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkShipDialog
        open={bulkOpen}
        targets={bulkTargets}
        isPending={bulkShipMutation.isPending}
        onClose={() => setBulkOpen(false)}
        onSubmit={handleBulkShip}
      />

      {toast && (
        <div
          role="status"
          className="toast-slide-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-text-primary)] px-5 py-3 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
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
  tone,
  hasDivider,
  isActive,
  onClick,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  tone: KpiTone;
  hasDivider: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const iconColor = {
    paid: "text-[var(--color-status-paid)]",
    pending: "text-[var(--color-status-pending)]",
    shipped: "text-[var(--color-status-shipped)]",
    delivered: "text-[var(--color-status-delivered)]",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`group text-left px-6 first:pl-0 lg:px-8 ${
        hasDivider ? "lg:border-l lg:border-[var(--color-border-light)]" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <p
          className={`text-xs transition-colors ${
            isActive
              ? "text-[var(--color-accent)] font-medium"
              : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
          }`}
        >
          {label}
        </p>
      </div>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums transition-colors ${
          isActive ? "text-[var(--color-accent)]" : ""
        }`}
      >
        <CountUp value={value} />
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">건</p>
    </button>
  );
}

function OrderRow({
  row,
  index,
  selectable,
  selected,
  onSelectChange,
  onAction,
  onQuickAccept,
}: {
  row: Row;
  index: number;
  selectable: boolean;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
  onAction: () => void;
  onQuickAccept: () => void;
}) {
  const meta = STATUS_META[row.status];
  return (
    <tr
      className="row-fade-in border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-bg-tertiary)]/60"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <td className="py-4 pr-2">
        <input
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          onChange={(e) => onSelectChange(e.target.checked)}
          aria-label={`${row.orderNo} 선택`}
          className="h-4 w-4 cursor-pointer rounded border-[var(--color-border-light)] disabled:cursor-not-allowed disabled:opacity-40"
        />
      </td>
      <td className="py-4 pr-6">
        <a
          href={`/seller/orders/${row.orderId}?sub=${row.id}`}
          className="font-medium tabular-nums hover:text-[var(--color-accent)]"
        >
          {row.orderNo}
        </a>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)] tabular-nums">
          {row.date}
        </p>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
          <span>{row.hospital}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-[var(--color-text-secondary)]">{row.items}</td>
      <td className="px-6 py-4 text-right font-semibold tabular-nums">
        ₩{row.total.toLocaleString()}
      </td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.color}`}
        >
          {isInProgress(row.status) && (
            <span
              aria-hidden
              className={`status-pulse-dot h-1.5 w-1.5 rounded-full ${meta.dotBg}`}
            />
          )}
          {meta.label}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="inline-flex items-center gap-2">
          {row.status === "PAID" && (
            <button
              type="button"
              onClick={onQuickAccept}
              className="inline-flex items-center text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
            >
              출고 준비
            </button>
          )}
          {meta.nextActionLabel ? (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              {meta.nextActionLabel}
              <ChevronRight className="h-3 w-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              상세
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
