"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Edit3,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { ProductMoreDialog } from "@/components/vendor/product-more-dialog";
import { trpc } from "@/lib/trpc/client";
import type { Product } from "@/lib/types";

/**
 * Wave P1 — vendor 상품 목록 (실시간 tRPC 연동).
 *
 * - 데이터: trpc.vendor.product.list / counts
 * - PREVIEW fallback: 에러/빈 결과 시 디자인 미리보기 dummy rows 사용 (Phase 1 정책)
 * - 신규 등록: /seller/products/new
 * - 편집: /seller/products/[productId]
 * - 액션 (일시 중단 · 재개 · 아카이브): trpc mutation
 */

const VENDOR_TYPE_LABEL: Record<string, string> = {
  DISTRIBUTOR: "판매업자",
  MANUFACTURER: "제조업자",
  IMPORTER: "수입업자",
};

const UNIT_LABEL: Record<string, string> = {
  BOX: "박스",
  EA: "개",
  CASE: "케이스",
  SET: "세트",
  KG: "kg",
  L: "L",
  ML: "ml",
  PACK: "팩",
  ROLL: "롤",
};

function unitLabel(unit: string): string {
  return UNIT_LABEL[unit] ?? unit;
}

// Status meta — moderation.status 우선
type EffectiveStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "REVISION_REQUESTED"
  | "ACTIVE"
  | "REJECTED"
  | "PAUSED"
  | "ARCHIVED";

function statusOf(p: Product): EffectiveStatus {
  const mod = (p as { moderation?: { status?: EffectiveStatus } }).moderation
    ?.status;
  return (mod ?? p.status ?? "DRAFT") as EffectiveStatus;
}

const STATUS_META: Record<EffectiveStatus, { label: string; tone: string }> = {
  DRAFT: { label: "초안", tone: "text-[var(--color-text-tertiary)]" },
  PENDING_REVIEW: { label: "심사 대기", tone: "text-[var(--color-warning)]" },
  REVISION_REQUESTED: {
    label: "수정 요청",
    tone: "text-[var(--color-warning)]",
  },
  ACTIVE: { label: "노출 중", tone: "text-[var(--color-success)]" },
  PAUSED: { label: "일시 중단", tone: "text-[var(--color-text-secondary)]" },
  REJECTED: { label: "반려", tone: "text-[var(--color-error)]" },
  ARCHIVED: { label: "아카이브", tone: "text-[var(--color-text-tertiary)]" },
};

const CLASS_META: Record<string, { label: string; color: string }> = {
  CLASS_1: { label: "1등급", color: "text-[var(--color-class-1)]" },
  CLASS_2: { label: "2등급", color: "text-[var(--color-class-2)]" },
  CLASS_3: { label: "3등급", color: "text-[var(--color-warning)]" },
  CLASS_4: { label: "4등급", color: "text-[var(--color-error)]" },
  NON_DEVICE: {
    label: "비의료기기",
    color: "text-[var(--color-text-tertiary)]",
  },
};

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "DRAFT", label: "초안" },
  { key: "PENDING_REVIEW", label: "심사 대기" },
  { key: "REVISION_REQUESTED", label: "수정 요청" },
  { key: "ACTIVE", label: "노출 중" },
  { key: "PAUSED", label: "일시 중단" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

// PREVIEW fallback rows — 인증 미완료 / Firestore 빈 상태에서 디자인 검수용
const PREVIEW_ROWS: Product[] = [
  fakeProduct({
    id: "preview-1",
    name: "수술용 라텍스 장갑 (M) 100매",
    categoryPath: ["의료소모품", "일회용 의료용품", "장갑"],
    deviceClass: "CLASS_1",
    basePrice: 8900,
    unit: "BOX",
    stock: 480,
    status: "ACTIVE",
    subscribable: true,
    groupBuyable: true,
  }),
  fakeProduct({
    id: "preview-2",
    name: "일회용 마스크 KF94 50매",
    categoryPath: ["의료소모품", "일회용 의료용품", "마스크"],
    deviceClass: "NON_DEVICE",
    basePrice: 12000,
    unit: "BOX",
    stock: 320,
    status: "ACTIVE",
    subscribable: true,
    groupBuyable: true,
  }),
  fakeProduct({
    id: "preview-3",
    name: "디지털 청진기 (블루투스)",
    categoryPath: ["진단기기", "청진기"],
    deviceClass: "CLASS_2",
    basePrice: 350000,
    unit: "EA",
    stock: 12,
    status: "PENDING_REVIEW",
    subscribable: false,
    groupBuyable: true,
  }),
  fakeProduct({
    id: "preview-4",
    name: "수술용 가운 (멸균) 5매",
    categoryPath: ["의료소모품", "수술 용품"],
    deviceClass: "CLASS_1",
    basePrice: 28000,
    unit: "BOX",
    stock: 4,
    status: "REVISION_REQUESTED",
    subscribable: false,
    groupBuyable: true,
  }),
  fakeProduct({
    id: "preview-5",
    name: "구형 핸드피스 (단종 예정)",
    categoryPath: ["치과 재료"],
    deviceClass: "CLASS_2",
    basePrice: 124000,
    unit: "EA",
    stock: 8,
    status: "PAUSED",
    subscribable: false,
    groupBuyable: false,
  }),
];

const PREVIEW_COUNTS = {
  total: PREVIEW_ROWS.length,
  DRAFT: 0,
  PENDING_REVIEW: 1,
  REVISION_REQUESTED: 1,
  ACTIVE: 2,
  PAUSED: 1,
  REJECTED: 0,
  ARCHIVED: 0,
};

export default function SellerProductsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [moreDialog, setMoreDialog] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Phase γ-2 — cursor pagination
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulated, setAccumulated] = useState<Product[]>([]);

  // 필터 변경 시 cursor 초기화
  useEffect(() => {
    setCursor(undefined);
    setAccumulated([]);
  }, [filter]);

  // 실 데이터
  const listQuery = trpc.vendor.product.list.useQuery({
    pageSize: 50,
    status: filter === "all" ? undefined : filter,
    cursor,
  });
  const countsQuery = trpc.vendor.product.counts.useQuery();
  const vendorQuery = trpc.vendor.getCurrent.useQuery();

  const utils = trpc.useUtils();
  const pauseMutation = trpc.vendor.product.pause.useMutation({
    onSuccess: () => {
      void utils.vendor.product.list.invalidate();
      void utils.vendor.product.counts.invalidate();
    },
  });
  const resumeMutation = trpc.vendor.product.resume.useMutation({
    onSuccess: () => {
      void utils.vendor.product.list.invalidate();
      void utils.vendor.product.counts.invalidate();
    },
  });
  const archiveMutation = trpc.vendor.product.archive.useMutation({
    onSuccess: () => {
      void utils.vendor.product.list.invalidate();
      void utils.vendor.product.counts.invalidate();
    },
  });

  // PREVIEW fallback — 인증/데이터 없을 때 디자인 검수용
  const usePreview =
    !listQuery.isPending &&
    (listQuery.error !== null || (listQuery.data?.products.length ?? 0) === 0);

  // 페이지 응답 누적
  useEffect(() => {
    if (!listQuery.data) return;
    setAccumulated((prev) => {
      if (!cursor) return listQuery.data.products;
      const seen = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      for (const p of listQuery.data.products) if (!seen.has(p.id)) merged.push(p);
      return merged;
    });
  }, [listQuery.data, cursor]);

  const rawRows = usePreview ? PREVIEW_ROWS : accumulated;
  const nextCursor = listQuery.data?.nextCursor;

  function loadMore() {
    if (nextCursor) setCursor(nextCursor);
  }
  const counts = usePreview ? PREVIEW_COUNTS : countsQuery.data;

  const filteredRows = useMemo(() => {
    return rawRows.filter((p) => {
      if (filter !== "all" && statusOf(p) !== filter) return false;
      if (!query.trim()) return true;
      const k = query.trim().toLowerCase();
      return (
        p.name.toLowerCase().includes(k) ||
        (p.brand ?? "").toLowerCase().includes(k) ||
        (p.id ?? "").toLowerCase().includes(k) ||
        (p.categoryPath?.join(" ") ?? "").toLowerCase().includes(k)
      );
    });
  }, [rawRows, filter, query]);

  // 통계
  const stats = useMemo(() => {
    const active = counts?.ACTIVE ?? 0;
    const total = counts?.total ?? rawRows.length;
    const lowStock = rawRows.filter(
      (p) => p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock < 20,
    ).length;
    const outOfStock = rawRows.filter((p) => p.stock === 0).length;
    const pending = counts?.PENDING_REVIEW ?? 0;
    return { active, total, lowStock, outOfStock, pending };
  }, [counts, rawRows]);

  const KPIS = [
    {
      label: "등록 상품",
      value: stats.total,
      suffix: "개",
      sub:
        (counts?.DRAFT ?? 0) > 0
          ? `초안 ${counts?.DRAFT}개 포함`
          : "심사 통과 + 초안",
    },
    {
      label: "노출 중",
      value: stats.active,
      suffix: "개",
      sub:
        stats.total > 0
          ? `전체의 ${Math.round((stats.active / stats.total) * 100)}%`
          : "—",
    },
    {
      label: "심사 대기",
      value: stats.pending,
      suffix: "건",
      sub: stats.pending > 0 ? "운영자 검토 중" : "모두 처리됨",
    },
    {
      label: "재고 부족",
      value: stats.lowStock,
      suffix: "건",
      sub: stats.outOfStock > 0 ? `품절 ${stats.outOfStock}건 포함` : "충분",
    },
  ];

  const vendor = vendorQuery.data;
  const vendorLabel = vendor
    ? VENDOR_TYPE_LABEL[vendor.vendorType] ?? vendor.vendorType
    : "공급업체";
  // vendorName 은 향후 sub-section 헤더에서 다시 사용될 수 있어 변수는 유지.
  // 현재 사용처가 없어 lint 회피를 위해 void 처리.
  const vendorName = vendor?.companyName ?? "더미 의료기기 유한회사";
  void vendorName;
  const approvedAt = vendor?.approvedAt
    ? new Date(
        (vendor.approvedAt as unknown as { _seconds?: number; seconds?: number })
          ?._seconds ??
          (vendor.approvedAt as unknown as { seconds?: number })?.seconds ??
          Date.now(),
      ).toISOString().slice(0, 10)
    : "2026-04-15";

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function onNewProduct() {
    router.push("/seller/products/new");
  }

  function onEdit(row: Product) {
    if (row.id.startsWith("preview-")) {
      showToast("미리보기 데이터는 편집할 수 없습니다. 실제 상품을 등록해주세요.");
      return;
    }
    router.push(`/seller/products/${row.id}`);
  }

  function onMore(row: Product) {
    if (row.id.startsWith("preview-")) {
      showToast("미리보기 데이터에는 액션을 적용할 수 없습니다.");
      return;
    }
    setMoreDialog(row);
  }

  async function onMoreAction(
    action: "duplicate" | "toggle-visible" | "discontinue",
  ) {
    if (!moreDialog) return;
    const p = moreDialog;
    const status = statusOf(p);
    try {
      if (action === "duplicate") {
        showToast(`복제 기능은 다음 단계에서 제공됩니다.`);
        return;
      }
      if (action === "toggle-visible") {
        if (status === "ACTIVE") {
          await pauseMutation.mutateAsync({ productId: p.id });
          showToast(`"${p.name}" 일시 중단되었습니다.`);
        } else if (status === "PAUSED") {
          await resumeMutation.mutateAsync({ productId: p.id });
          showToast(`"${p.name}" 다시 노출됩니다.`);
        } else {
          showToast("노출 중 또는 일시 중단 상태에서만 전환할 수 있습니다.");
        }
        return;
      }
      if (action === "discontinue") {
        await archiveMutation.mutateAsync({ productId: p.id });
        showToast(`"${p.name}" 단종 처리되었습니다.`);
      }
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
      {/* Header */}
      <PageHeader
        label={`파트너센터 · ${vendorLabel}`}
        title="상품 카탈로그"
        description={`승인일 ${approvedAt} · 카탈로그·재고·노출을 한 곳에서 관리합니다.`}
      >
        <button
          type="button"
          onClick={onNewProduct}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          새 상품 등록
        </button>
      </PageHeader>

      {/* KPI */}
      <section className="mt-12 grid grid-cols-2 gap-y-8 border-y border-[var(--color-border-light)] py-8 lg:grid-cols-4 lg:gap-y-0">
        {KPIS.map((k, i) => (
          <KpiItem
            key={k.label}
            {...k}
            hasDivider={i > 0 && i < KPIS.length}
          />
        ))}
      </section>

      {/* Preview notice */}
      {usePreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          ※ 디자인 미리보기 데이터입니다. 실제 상품을 등록하면 자동으로 교체됩니다.
        </p>
      )}

      {/* Notice — 재고 부족 */}
      {(stats.lowStock > 0 || stats.outOfStock > 0) && (
        <section className="mt-8 flex flex-wrap items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
          <span className="font-semibold">
            재고 부족 {stats.lowStock}건 · 품절 {stats.outOfStock}건
          </span>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            아래 표에서 직접 발주하거나 일괄 갱신
          </span>
        </section>
      )}

      {/* Toolbar — 검색 + 필터 */}
      <div className="mt-10 relative">
        <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="상품명·식약처 코드·카테고리 검색"
          className="h-10 w-full border-b border-[var(--color-border-light)] bg-transparent pl-6 pr-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
      </div>

      <nav
        aria-label="상품 필터"
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

      {/* Table — desktop only */}
      <section className="mt-2 hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-light)] text-left text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              <th className="py-3 pr-6 font-medium">상품</th>
              <th className="px-6 py-3 font-medium">상태</th>
              <th className="px-6 py-3 font-medium">등급</th>
              <th className="px-6 py-3 text-right font-medium">단가</th>
              <th className="px-6 py-3 text-right font-medium">재고</th>
              <th className="px-6 py-3 font-medium">옵션</th>
              <th className="px-6 py-3 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isPending && !usePreview ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-[var(--color-text-tertiary)]" />
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-16 text-center text-sm text-[var(--color-text-tertiary)]"
                >
                  조건에 맞는 상품이 없습니다.
                  {(filter !== "all" || query.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("all");
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
                <ProductRow
                  key={r.id}
                  row={r}
                  index={i}
                  onEdit={() => onEdit(r)}
                  onMore={() => onMore(r)}
                />
              ))
            )}
          </tbody>
        </table>

        {/* Phase γ-2 — 더 보기 */}
        {!usePreview && nextCursor && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={listQuery.isFetching}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-5 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
            >
              {listQuery.isFetching
                ? "불러오는 중…"
                : `더 보기 (${rawRows.length}건 표시 중)`}
            </button>
          </div>
        )}
      </section>

      {/* Mobile card list */}
      <section className="mt-2 md:hidden">
        {listQuery.isPending && !usePreview ? (
          <p className="py-16 text-center">
            <Loader2 className="mx-auto h-4 w-4 animate-spin text-[var(--color-text-tertiary)]" />
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-text-tertiary)]">
            조건에 맞는 상품이 없습니다.
            {(filter !== "all" || query.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
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
            {filteredRows.map((p) => {
              const status = statusOf(p);
              const sm = STATUS_META[status];
              const cls = CLASS_META[p.deviceClass] ?? CLASS_META.NON_DEVICE;
              const category =
                p.categoryPath?.[p.categoryPath.length - 1] ?? "—";
              return (
                <li key={`m-${p.id}`} className="flex flex-col gap-2 px-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/seller/products/${p.id}`}
                      onClick={(e) => {
                        if (p.id.startsWith("preview-")) e.preventDefault();
                      }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-[var(--color-accent)]"
                    >
                      {p.name}
                    </Link>
                    <span className={`shrink-0 text-xs font-medium ${sm.tone}`}>
                      {sm.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-[var(--color-text-tertiary)]">
                      {category}
                    </span>
                    <span className={`font-semibold ${cls.color}`}>
                      {cls.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      ₩{p.basePrice.toLocaleString()}
                      <span className="ml-0.5 text-[11px] font-normal text-[var(--color-text-tertiary)]">
                        /{unitLabel(p.unit)}
                      </span>
                    </span>
                    <span className="font-mono text-xs tabular-nums">
                      재고{" "}
                      {p.stock === null || p.stock === undefined
                        ? "무제한"
                        : `${p.stock.toLocaleString()}${unitLabel(p.unit)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] font-medium">
                      {p.subscribable && (
                        <span className="text-[var(--color-success)]">정기</span>
                      )}
                      {p.groupBuyable && (
                        <span className="text-[var(--color-accent)]">공동</span>
                      )}
                      {!p.subscribable && !p.groupBuyable && (
                        <span className="text-[var(--color-text-tertiary)]">
                          —
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(p)}
                        aria-label={`${p.name} 편집`}
                        className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-accent)]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMore(p)}
                        aria-label={`${p.name} 더보기`}
                        className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
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
              {listQuery.isFetching
                ? "불러오는 중…"
                : `더 보기 (${rawRows.length}건 표시 중)`}
            </button>
          </div>
        )}
      </section>

      {/* Promo */}
      <section className="mt-16 border-t border-[var(--color-border-light)] pt-10">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          곧 추가되는 기능
        </p>
        <div className="mt-6 grid gap-8 md:grid-cols-3">
          <PromoItem
            phaseLabel="3단계 출시 예정"
            title="정기구독 자동화"
            desc="정기구독 등록 → 매달 자동 발주"
          />
          <PromoItem
            phaseLabel="4단계 출시 예정"
            title="공동구매 활성화"
            desc="공동구매 옵션을 켜면 여러 병원이 모일 때 자동 할인 단가가 적용됩니다."
          />
          <PromoItem
            phaseLabel="6단계 출시 예정"
            title="식약처 UDI 자동 보고"
            desc="배송 완료 시 식약처 의료기기통합정보시스템에 자동 보고됩니다."
          />
        </div>
      </section>

      {/* Dialog */}
      {moreDialog && (
        <ProductMoreDialog
          open
          productName={moreDialog.name}
          visible={statusOf(moreDialog) === "ACTIVE"}
          onClose={() => setMoreDialog(null)}
          onAction={onMoreAction}
        />
      )}

      {/* Toast */}
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
  label,
  value,
  prefix,
  suffix,
  sub,
  hasDivider,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  sub: string;
  hasDivider: boolean;
}) {
  return (
    <div
      className={`px-6 first:pl-0 lg:px-8 ${
        hasDivider ? "lg:border-l lg:border-[var(--color-border-light)]" : ""
      }`}
    >
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        <CountUp value={value} prefix={prefix ?? ""} suffix={suffix ?? ""} />
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">{sub}</p>
    </div>
  );
}

function ProductRow({
  row,
  index,
  onEdit,
  onMore,
}: {
  row: Product;
  index: number;
  onEdit: () => void;
  onMore: () => void;
}) {
  const status = statusOf(row);
  const sm = STATUS_META[status];
  const cls = CLASS_META[row.deviceClass] ?? CLASS_META.NON_DEVICE;
  const category = row.categoryPath?.[row.categoryPath.length - 1] ?? "—";

  return (
    <tr
      className="row-fade-in border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-bg-tertiary)]/60"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <td className="py-4 pr-6">
        <Link
          href={`/seller/products/${row.id}`}
          className="font-medium hover:text-[var(--color-accent)]"
          onClick={(e) => {
            if (row.id.startsWith("preview-")) {
              e.preventDefault();
            }
          }}
        >
          {row.name}
        </Link>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
          {category} · <span className="tabular-nums">{row.id.slice(0, 8)}</span>
        </p>
      </td>
      <td className="px-6 py-4">
        <span className={`text-xs font-medium ${sm.tone}`}>{sm.label}</span>
      </td>
      <td className="px-6 py-4">
        <span className={`text-xs font-semibold ${cls.color}`}>{cls.label}</span>
      </td>
      <td className="px-6 py-4 text-right tabular-nums font-semibold">
        ₩{row.basePrice.toLocaleString()}
        <span className="ml-0.5 text-[11px] font-normal text-[var(--color-text-tertiary)]">
          /{unitLabel(row.unit)}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <p className="font-medium tabular-nums">
          {row.stock === null || row.stock === undefined
            ? "무제한"
            : `${row.stock.toLocaleString()}${unitLabel(row.unit)}`}
        </p>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium">
          {row.subscribable && (
            <span className="text-[var(--color-success)]">정기</span>
          )}
          {row.groupBuyable && (
            <span className="text-[var(--color-accent)]">공동</span>
          )}
          {!row.subscribable && !row.groupBuyable && (
            <span className="text-[var(--color-text-tertiary)]">—</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`${row.name} 편집`}
            className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-accent)]"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMore}
            aria-label={`${row.name} 더보기`}
            className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function PromoItem({
  phaseLabel,
  title,
  desc,
}: {
  phaseLabel: string;
  title: string;
  desc: string;
}) {
  return (
    <article>
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-accent)]">
        {phaseLabel}
      </span>
      <h3 className="mt-3 text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {desc}
      </p>
    </article>
  );
}

// PREVIEW 데이터 helper — Product 타입 만족하는 mock
function fakeProduct(p: {
  id: string;
  name: string;
  categoryPath: string[];
  deviceClass: Product["deviceClass"];
  basePrice: number;
  unit: string;
  stock: number;
  status: EffectiveStatus;
  subscribable: boolean;
  groupBuyable: boolean;
}): Product {
  return {
    id: p.id,
    vendorId: "preview-vendor",
    vendorName: "더미 의료기기 유한회사",
    categoryId: "preview-cat",
    categoryPath: p.categoryPath,
    name: p.name,
    deviceClass: p.deviceClass,
    images: [],
    thumbnail: "",
    basePrice: p.basePrice,
    unit: p.unit,
    moq: 1,
    stock: p.stock,
    shippingFee: 0,
    description: "",
    status: p.status as Product["status"],
    moderation: { status: p.status as Product["status"] },
    subscribable: p.subscribable,
    groupBuyable: p.groupBuyable,
    viewCount: 0,
    orderCount: 0,
    reviewCount: 0,
    // Timestamp mocks — runtime 에서 사용 안 함
    createdAt: undefined as unknown as Product["createdAt"],
    updatedAt: undefined as unknown as Product["updatedAt"],
  };
}
