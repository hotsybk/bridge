import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";

import { CatalogNav } from "@/components/buyer/catalog-nav";
import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { FeaturedProductSection } from "@/components/buyer/featured-product";
import { ProductCard } from "@/components/buyer/product-card";
import { CountUp } from "@/components/shared/count-up";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { trpcServer } from "@/lib/trpc/server";

export const metadata: Metadata = {
  title: "상품 검색",
  description: "한국 의료기기·소모품을 카테고리·키워드·공급업체로 검색합니다.",
};

export const dynamic = "force-dynamic";

const SORT_OPTIONS = [
  { value: "latest", label: "최신순" },
  { value: "priceAsc", label: "낮은 가격" },
  { value: "priceDesc", label: "높은 가격" },
  { value: "popular", label: "인기순" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    vendorId?: string;
    sort?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const categoryId = sp.categoryId;
  const vendorId = sp.vendorId;
  const sort = (SORT_OPTIONS.find((s) => s.value === sp.sort)?.value ??
    "latest") as SortValue;

  const trpc = await trpcServer();

  // Wave Z — 쿼리가 있으면 product.search (Algolia ↔ Firestore fallback) 사용,
  // 빈 카탈로그 브라우즈는 기존 list 유지 (UI/sort 호환).
  // Phase ν-1 — vendorId 필터도 search/list 양쪽에서 지원.
  const useSearch = Boolean(q || vendorId);
  const searchSort: "popularity" | "newest" | "price_asc" | "price_desc" =
    sort === "priceAsc"
      ? "price_asc"
      : sort === "priceDesc"
        ? "price_desc"
        : sort === "popular"
          ? "popularity"
          : "newest";

  let products: Awaited<
    ReturnType<typeof trpc.product.list>
  >["items"] = [];
  let searchSource: "algolia" | "firestore-fallback" | "list" = "list";

  const [categories] = await Promise.all([trpc.product.categories()]);

  if (useSearch) {
    const sr = await trpc.product.search({
      query: q || undefined,
      categoryId,
      vendorId,
      sort: searchSort,
      hitsPerPage: 60,
      page: 0,
    });
    products = sr.hits as typeof products;
    searchSource = sr.source;
  } else {
    const lr = await trpc.product.list({
      search: q || undefined,
      categoryId,
      sort,
      limit: 60,
    });
    products = lr.items;
    searchSource = "list";
  }

  const isFiltered = Boolean(q || categoryId || vendorId);
  const filterCategoryName: string | null = categoryId
    ? (categories.find((c) => c.id === categoryId)?.name ?? null)
    : null;

  // vendorId 필터링 시 vendor 이름 — products 첫 항목에서 추출
  const filterVendorName: string | null = vendorId
    ? (products.find((p) => (p as { vendorId?: string }).vendorId === vendorId)
        ?.vendorName ?? null)
    : null;

  // 인기 상품: 처음 3개
  const featured = isFiltered ? [] : products.slice(0, 3);

  // 페이지 헤더용 통계
  const vendorCount = new Set(products.map((p) => p.vendorName)).size;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav initialQ={q} />
      <CatalogNav />

      <main className="mx-auto max-w-7xl px-6 md:px-12">
        {/* ─── 미니멀 페이지 헤더 ─── */}
        <PageHeader
          isFiltered={isFiltered}
          query={q}
          filterCategoryName={filterCategoryName}
          filterVendorName={filterVendorName}
          filterVendorId={vendorId ?? null}
          productCount={products.length}
          vendorCount={vendorCount}
        />

        {/* dev 전용 source 배지 — production 빌드에서는 숨김 */}
        {process.env.NODE_ENV !== "production" && useSearch && (
          <div className="-mt-6 mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            검색 소스:{" "}
            <span className="font-semibold text-[var(--color-text-secondary)]">
              {searchSource === "algolia"
                ? "Algolia"
                : searchSource === "firestore-fallback"
                  ? "기본 검색 (Firestore)"
                  : "list"}
            </span>
          </div>
        )}

        {/* ─── Featured — 필터 안 걸렸을 때만 ─── */}
        {!isFiltered && featured.length > 0 && (
          <div className="mt-20 md:mt-28">
            <FeaturedProductSection products={featured} />
          </div>
        )}

        {/* ─── 전체 상품 그리드 ─── */}
        <section
          id="all-products"
          className="mt-20 border-t border-[var(--color-border-light)] pt-16 md:mt-28 md:pt-24"
        >
          {/* 그리드 헤더 */}
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                {isFiltered ? "검색 결과" : "전체 카탈로그"}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
                {isFiltered
                  ? q
                    ? `"${q}"`
                    : (filterCategoryName ?? "모든 상품")
                  : "모든 상품"}
              </h2>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
                  <CountUp value={products.length} duration={700} />
                </span>
                개 상품
              </p>
            </div>

            {/* 정렬 — 라인 only chip */}
            <nav aria-label="정렬" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-2 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                정렬
              </span>
              {SORT_OPTIONS.map((s) => {
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                if (categoryId) params.set("categoryId", categoryId);
                if (vendorId) params.set("vendorId", vendorId);
                if (s.value !== "latest") params.set("sort", s.value);
                const href = params.toString()
                  ? `/search?${params.toString()}`
                  : "/search";
                const active = sort === s.value;
                return (
                  <Link
                    key={s.value}
                    href={href}
                    className={`inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {s.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* 그리드 또는 빈 상태 */}
          {products.length === 0 ? (
            <div className="mt-12">
              <EmptyState
                icon={SearchX}
                title={
                  q
                    ? `"${q}" 검색 결과가 없습니다`
                    : "해당 조건의 상품이 없습니다"
                }
                description={
                  q
                    ? `다른 키워드로 검색하거나, 카테고리 전체에서 둘러보세요.`
                    : "다른 카테고리를 시도하거나 전체 상품을 둘러보세요."
                }
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Link
                      href="/search"
                      className="inline-flex h-10 items-center rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                    >
                      전체 상품 보기
                    </Link>
                    {q && (
                      <Link
                        href="/search"
                        className="inline-flex h-10 items-center rounded-full border border-[var(--color-border-light)] px-5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-secondary)]"
                      >
                        검색어 초기화
                      </Link>
                    )}
                  </div>
                }
              />
            </div>
          ) : (
            <div className="mt-12 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <Reveal key={p.id} delay={(i % 8) * 60}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          )}
        </section>

        {/* 푸터 여백 */}
        <div className="h-24 md:h-32" />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PageHeader — 미니멀, 박스 0개
// ─────────────────────────────────────────────────────────────

function PageHeader({
  isFiltered,
  query,
  filterCategoryName,
  filterVendorName,
  filterVendorId,
  productCount,
  vendorCount,
}: {
  isFiltered: boolean;
  query: string;
  filterCategoryName: string | null;
  filterVendorName: string | null;
  filterVendorId: string | null;
  productCount: number;
  vendorCount: number;
}) {
  // 필터·검색 모드에서는 헤더를 가볍게 (간단 메타만)
  if (isFiltered) {
    // vendorId 모드 — vendor 이름 헤더 + 전체 카탈로그로 돌아가기
    if (filterVendorId) {
      return (
        <header className="py-12 md:py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            공급업체
          </p>
          <h1 className="mt-4 break-keep text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
            {filterVendorName ?? "공급업체 상품"}
          </h1>
          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
                <CountUp value={productCount} duration={700} />
              </span>
              개 상품을 판매 중입니다.
            </p>
            <Link
              href="/search"
              className="text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              전체 카탈로그 보기 →
            </Link>
          </div>
        </header>
      );
    }

    return (
      <header className="py-12 md:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          {query ? "검색 모드" : "카테고리"}
        </p>
        <h1 className="mt-4 break-keep text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
          {query ? `"${query}"` : (filterCategoryName ?? "필터 결과")}
        </h1>
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
            <CountUp value={productCount} duration={700} />
          </span>
          개 상품이 매칭됐습니다.
        </p>
      </header>
    );
  }

  // 기본 — 카탈로그 전체 헤더 (큰 타이포 + 우측 stats)
  return (
    <header className="border-b border-[var(--color-border-light)] py-16 md:py-24">
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            의료 카탈로그
          </p>
          <h1 className="mt-5 break-keep text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">
            전국 공급업체의
            <br />
            모든 상품을 한 곳에서.
          </h1>
          <p className="mt-6 max-w-xl text-sm text-[var(--color-text-secondary)]">
            식약처 인증을 받은 의료기기·소모품. 가격은 투명하게, 정산은 영업일
            3일.
          </p>
        </div>

        {/* 우측 — quick stats (박스 없이 numbers 만) */}
        <dl className="grid grid-cols-3 gap-4 border-t border-[var(--color-border-light)] pt-6 lg:border-t-0 lg:pt-0">
          <StatItem value={productCount} label="상품" />
          <StatItem value={vendorCount} label="공급업체" hasDivider />
          <StatItem value={9} label="카테고리" hasDivider />
        </dl>
      </div>
    </header>
  );
}

function StatItem({
  value,
  label,
  hasDivider,
}: {
  value: number;
  label: string;
  hasDivider?: boolean;
}) {
  return (
    <div
      className={`px-1 lg:px-4 ${
        hasDivider ? "lg:border-l lg:border-[var(--color-border-light)]" : ""
      }`}
    >
      <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
        <CountUp value={value} duration={900} />
      </p>
      <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
        {label}
      </p>
    </div>
  );
}
