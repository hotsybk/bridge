import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { formatDate } from "@/lib/format";
import { trpcServer } from "@/lib/trpc/server";
import type { Product } from "@/lib/types";
import { serializeFirestore } from "@/lib/utils/serialize-firestore";

import { ProductReviewPanel } from "./review-panel";
import { ProductBulkBar } from "./bulk-actions";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

const STATUS_TABS: Array<{ value: ModerationStatus; label: string }> = [
  { value: "PENDING_REVIEW", label: "대기" },
  { value: "REVISION_REQUESTED", label: "수정 요청" },
  { value: "ACTIVE", label: "승인됨" },
  { value: "REJECTED", label: "반려" },
];

type ModerationStatus =
  | "PENDING_REVIEW"
  | "REVISION_REQUESTED"
  | "ACTIVE"
  | "REJECTED";

const FILTER_CHIPS = ["카테고리", "공급업체", "등급", "UDI 누락"] as const;

// 데모 데이터 — PREVIEW_MODE 비로그인 fallback
type DemoProduct = Product & {
  certificates?: Array<{ name: string; size: string }>;
};

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: "p-001",
    vendorId: "v-001",
    vendorName: "메디서플라이",
    categoryId: "surgical",
    categoryPath: ["수술 소모품", "장갑"],
    name: "수술용 라텍스 장갑 (M)",
    nameEn: "Surgical Latex Gloves M",
    brand: "MediGlove",
    udiCode: "08801234567890",
    mfdsLicenseNo: "제2026-001호",
    deviceClass: "CLASS_2",
    images: [],
    thumbnail: "",
    basePrice: 28900,
    priceTiers: [
      { minQty: 1, price: 28900 },
      { minQty: 10, price: 27500 },
      { minQty: 50, price: 25800 },
    ],
    unit: "BOX",
    moq: 1,
    shippingFee: 0,
    description: "라텍스 알러지 free 옵션 보유. 의료용 그레이드 ISO 10993 인증.",
    status: "PENDING_REVIEW",
    subscribable: true,
    groupBuyable: false,
    viewCount: 0,
    orderCount: 0,
    reviewCount: 0,
    moderation: {
      status: "PENDING_REVIEW",
      submittedAt: { seconds: Math.floor(Date.now() / 1000) - 86400 } as never,
    },
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 86400 } as never,
    updatedAt: { seconds: Math.floor(Date.now() / 1000) - 86400 } as never,
  },
  {
    id: "p-002",
    vendorId: "v-002",
    vendorName: "헬스케어",
    categoryId: "diagnostic",
    categoryPath: ["진단 기기"],
    name: "디지털 청진기 (블루투스)",
    brand: "HealthScope",
    udiCode: "08801234567891",
    mfdsLicenseNo: "제2026-002호",
    deviceClass: "CLASS_3",
    images: [],
    thumbnail: "",
    basePrice: 351500,
    priceTiers: [
      { minQty: 1, price: 351500 },
      { minQty: 5, price: 335000 },
    ],
    unit: "EA",
    moq: 1,
    shippingFee: 0,
    description: "블루투스 5.0 지원, 의료용 IEC 60601 인증.",
    status: "PENDING_REVIEW",
    subscribable: false,
    groupBuyable: true,
    viewCount: 0,
    orderCount: 0,
    reviewCount: 0,
    moderation: {
      status: "PENDING_REVIEW",
      submittedAt: { seconds: Math.floor(Date.now() / 1000) - 172800 } as never,
    },
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 172800 } as never,
    updatedAt: { seconds: Math.floor(Date.now() / 1000) - 172800 } as never,
  },
  {
    id: "p-003",
    vendorId: "v-001",
    vendorName: "메디서플라이",
    categoryId: "protective",
    categoryPath: ["방호 용품"],
    name: "KF94 마스크 50매",
    brand: "MaskCare",
    udiCode: "08801234567892",
    mfdsLicenseNo: "제2026-003호",
    deviceClass: "CLASS_1",
    images: [],
    thumbnail: "",
    basePrice: 18900,
    priceTiers: [
      { minQty: 1, price: 18900 },
      { minQty: 10, price: 17800 },
      { minQty: 100, price: 16500 },
    ],
    unit: "BOX",
    moq: 1,
    shippingFee: 0,
    description: "KF94 인증 마스크 50매입.",
    status: "PENDING_REVIEW",
    subscribable: true,
    groupBuyable: false,
    viewCount: 0,
    orderCount: 0,
    reviewCount: 0,
    moderation: {
      status: "PENDING_REVIEW",
      submittedAt: { seconds: Math.floor(Date.now() / 1000) - 259200 } as never,
    },
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 259200 } as never,
    updatedAt: { seconds: Math.floor(Date.now() / 1000) - 259200 } as never,
  },
  {
    id: "p-004",
    vendorId: "v-003",
    vendorName: "덴탈프로",
    categoryId: "dental",
    categoryPath: ["치과 재료"],
    name: "임시 충전재 (치과용) 30g",
    brand: "DentalFill",
    udiCode: "08801234567893",
    mfdsLicenseNo: "제2026-004호",
    deviceClass: "CLASS_1",
    images: [],
    thumbnail: "",
    basePrice: 42000,
    priceTiers: [{ minQty: 1, price: 42000 }],
    unit: "EA",
    moq: 1,
    shippingFee: 0,
    description: "치과용 임시 충전재.",
    status: "PENDING_REVIEW",
    subscribable: false,
    groupBuyable: false,
    viewCount: 0,
    orderCount: 0,
    reviewCount: 0,
    moderation: {
      status: "REVISION_REQUESTED",
      statusReason: "사용기한 표기 추가 요청",
      revisionFields: ["description"],
      submittedAt: { seconds: Math.floor(Date.now() / 1000) - 345600 } as never,
    },
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 345600 } as never,
    updatedAt: { seconds: Math.floor(Date.now() / 1000) - 345600 } as never,
  },
  {
    id: "p-006",
    vendorId: "v-002",
    vendorName: "헬스케어",
    categoryId: "diagnostic",
    categoryPath: ["진단 기기"],
    name: "혈압계 (자동·디지털)",
    brand: "BPMaster",
    udiCode: "08801234567895",
    mfdsLicenseNo: "제2026-006호",
    deviceClass: "CLASS_2",
    images: [],
    thumbnail: "",
    basePrice: 89000,
    priceTiers: [
      { minQty: 1, price: 89000 },
      { minQty: 5, price: 84000 },
    ],
    unit: "EA",
    moq: 1,
    shippingFee: 0,
    description: "자동 디지털 혈압계.",
    status: "ACTIVE",
    subscribable: false,
    groupBuyable: true,
    viewCount: 0,
    orderCount: 0,
    reviewCount: 0,
    moderation: {
      status: "ACTIVE",
      submittedAt: { seconds: Math.floor(Date.now() / 1000) - 432000 } as never,
      reviewedAt: { seconds: Math.floor(Date.now() / 1000) - 86400 } as never,
    },
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 432000 } as never,
    updatedAt: { seconds: Math.floor(Date.now() / 1000) - 86400 } as never,
  },
  {
    id: "p-009",
    vendorId: "v-004",
    vendorName: "올드메디",
    categoryId: "monitoring",
    categoryPath: ["환자 모니터링"],
    name: "임상용 모니터 (15인치)",
    brand: "ClinMonitor",
    udiCode: "08801234567898",
    mfdsLicenseNo: "제2026-009호",
    deviceClass: "CLASS_3",
    images: [],
    thumbnail: "",
    basePrice: 2400000,
    priceTiers: [{ minQty: 1, price: 2400000 }],
    unit: "EA",
    moq: 1,
    shippingFee: 0,
    description: "임상용 모니터 15인치.",
    status: "ARCHIVED",
    subscribable: false,
    groupBuyable: false,
    viewCount: 0,
    orderCount: 0,
    reviewCount: 0,
    moderation: {
      status: "REJECTED",
      statusReason: "식약처 허가번호 확인 불가",
      submittedAt: { seconds: Math.floor(Date.now() / 1000) - 691200 } as never,
      reviewedAt: { seconds: Math.floor(Date.now() / 1000) - 518400 } as never,
    },
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 691200 } as never,
    updatedAt: { seconds: Math.floor(Date.now() / 1000) - 518400 } as never,
  },
];

type CountsMap = {
  PENDING_REVIEW: number;
  REVISION_REQUESTED: number;
  ACTIVE: number;
  REJECTED: number;
  approvedToday: number;
  rejectedToday: number;
};

function demoCounts(): CountsMap {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = todayStart.getTime() / 1000;
  return {
    PENDING_REVIEW: DEMO_PRODUCTS.filter(
      (p) => p.moderation?.status === "PENDING_REVIEW",
    ).length,
    REVISION_REQUESTED: DEMO_PRODUCTS.filter(
      (p) => p.moderation?.status === "REVISION_REQUESTED",
    ).length,
    ACTIVE: DEMO_PRODUCTS.filter((p) => p.moderation?.status === "ACTIVE")
      .length,
    REJECTED: DEMO_PRODUCTS.filter((p) => p.moderation?.status === "REJECTED")
      .length,
    approvedToday: DEMO_PRODUCTS.filter(
      (p) =>
        p.moderation?.status === "ACTIVE" &&
        ((p.moderation?.reviewedAt as unknown as { seconds?: number })?.seconds ?? 0) >= todayTs,
    ).length,
    rejectedToday: DEMO_PRODUCTS.filter(
      (p) =>
        p.moderation?.status === "REJECTED" &&
        ((p.moderation?.reviewedAt as unknown as { seconds?: number })?.seconds ?? 0) >= todayTs,
    ).length,
  };
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; selectedId?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const requested = sp.status as ModerationStatus | undefined;
  const status: ModerationStatus =
    STATUS_TABS.find((t) => t.value === requested)?.value ?? "PENDING_REVIEW";
  const search = sp.search?.trim() ?? "";

  let products: Product[] = [];
  let counts: CountsMap = {
    PENDING_REVIEW: 0,
    REVISION_REQUESTED: 0,
    ACTIVE: 0,
    REJECTED: 0,
    approvedToday: 0,
    rejectedToday: 0,
  };
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [listRes, countsRes] = await Promise.all([
      trpc.admin.product.list({
        status,
        search: search || undefined,
        pageSize: 50,
      }),
      trpc.admin.product.counts(),
    ]);
    products = serializeFirestore(listRes.products);
    counts = countsRes;
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      const filtered = DEMO_PRODUCTS.filter(
        (p) => p.moderation?.status === status,
      ).filter((p) =>
        search ? p.name.toLowerCase().includes(search.toLowerCase()) : true,
      );
      products = filtered;
      counts = demoCounts();
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  const selectedId =
    sp.selectedId && products.some((p) => p.id === sp.selectedId)
      ? sp.selectedId
      : products[0]?.id ?? null;
  const selectedProduct = selectedId
    ? products.find((p) => p.id === selectedId) ?? null
    : null;

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
        운영 · 상품 모더레이션
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        상품 모더레이션
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        신청된 상품을 검토하고 승인·수정요청·반려를 결정합니다.
      </p>

      {/* KPI 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <KpiCell label="대기" value={counts.PENDING_REVIEW} unit="건" />
        <KpiCell label="오늘 승인" value={counts.approvedToday} unit="건" />
        <KpiCell label="오늘 반려" value={counts.rejectedToday} unit="건" />
        <KpiCell label="수정 요청" value={counts.REVISION_REQUESTED} unit="건" />
      </dl>

      {/* Segment Tabs */}
      <nav
        className="mt-10 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="status 필터"
      >
        {STATUS_TABS.map((t) => {
          const active = status === t.value;
          const tabCount =
            t.value === "PENDING_REVIEW"
              ? counts.PENDING_REVIEW
              : t.value === "REVISION_REQUESTED"
                ? counts.REVISION_REQUESTED
                : t.value === "ACTIVE"
                  ? counts.ACTIVE
                  : counts.REJECTED;
          return (
            <Link
              key={t.value}
              href={`/admin/products?status=${t.value}`}
              aria-current={active ? "page" : undefined}
              className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs tabular-nums text-[var(--color-text-tertiary)]">
                {tabCount}
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

      {/* Filter Chip Row + Search */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {FILTER_CHIPS.map((label) => (
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
        <form action="/admin/products" className="relative ml-auto min-w-[200px]">
          <input type="hidden" name="status" value={status} />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="상품명 검색"
            className="h-8 w-full border-b border-[var(--color-border-light)] bg-transparent pl-8 pr-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </form>
      </div>

      {isPreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          PREVIEW · 비로그인 상태입니다. 실제 데이터가 아닙니다.
        </p>
      )}

      {/* Bulk action bar — PENDING_REVIEW 에서만 활성화 */}
      {status === "PENDING_REVIEW" && products.length > 0 && !isPreview && (
        <ProductBulkBar productIds={products.map((p) => p.id)} />
      )}

      {/* Split Pane — mobile: list only (tap → detail page) / desktop: split */}
      <div className="mt-8 flex flex-col gap-0 border-t border-[var(--color-border-light)] md:flex-row">
        {/* 좌측 list */}
        <div className="w-full shrink-0 border-r-0 border-[var(--color-border-light)] md:w-[360px] md:border-r">
          {products.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--color-text-secondary)]">
              해당 상태의 상품이 없습니다
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border-light)]">
              {products.map((p) => {
                const isSelected = p.id === selectedId;
                return (
                  <li key={p.id}>
                    {/* Desktop: split-pane select via query */}
                    <Link
                      href={`/admin/products?status=${status}&selectedId=${p.id}${
                        search ? `&search=${encodeURIComponent(search)}` : ""
                      }`}
                      scroll={false}
                      className={`hidden w-full items-start gap-3 px-3 py-4 text-left transition-colors md:flex ${
                        isSelected
                          ? "bg-[var(--color-accent-light)]/30"
                          : "hover:bg-[var(--color-bg-secondary)]/40"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center border border-[var(--color-border-light)] text-[var(--color-text-tertiary)]"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {p.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                          {p.vendorName}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                            {classLabel(p.deviceClass)}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            ·
                          </span>
                          <span className="text-[10px] tabular-nums text-[var(--color-text-tertiary)]">
                            {formatDate(p.moderation?.submittedAt ?? p.createdAt)}
                          </span>
                        </div>
                      </div>
                    </Link>
                    {/* Mobile: navigate to dedicated detail page */}
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="flex w-full items-start gap-3 px-3 py-4 text-left transition-colors hover:bg-[var(--color-bg-secondary)]/40 md:hidden"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center border border-[var(--color-border-light)] text-[var(--color-text-tertiary)]"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {p.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                          {p.vendorName}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                            {classLabel(p.deviceClass)}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            ·
                          </span>
                          <span className="text-[10px] tabular-nums text-[var(--color-text-tertiary)]">
                            {formatDate(p.moderation?.submittedAt ?? p.createdAt)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 우측 detail — desktop only */}
        <div className="hidden min-w-0 flex-1 py-8 pl-12 pr-2 md:block">
          {selectedProduct ? (
            <ProductReviewPanel
              product={selectedProduct}
              isPreview={isPreview}
            />
          ) : (
            <p className="py-16 text-center text-sm text-[var(--color-text-secondary)]">
              상품을 선택하면 상세가 표시됩니다
            </p>
          )}
        </div>
      </div>
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
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
        <CountUp value={value} />
        <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
          {unit}
        </span>
      </p>
    </div>
  );
}

function classLabel(c: string): string {
  switch (c) {
    case "CLASS_1":
      return "1등급";
    case "CLASS_2":
      return "2등급";
    case "CLASS_3":
      return "3등급";
    case "CLASS_4":
      return "4등급";
    default:
      return "—";
  }
}

// formatDate 는 @/lib/format 에서 import 합니다 — Phase ν-4.
