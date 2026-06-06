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
import { serializeFirestore } from "@/lib/utils/serialize-firestore";
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

  const [categoriesRaw] = await Promise.all([trpc.product.categories()]);
  // Firestore Timestamp(클래스) → plain object 변환 (Server→Client 직렬화).
  const categories = serializeFirestore(categoriesRaw);

  if (useSearch) {
    const sr = await trpc.product.search({
      query: q || undefined,
      categoryId,
      vendorId,
      sort: searchSort,
      hitsPerPage: 60,
      page: 0,
    });
    products = serializeFirestore(sr.hits) as typeof products;
    searchSource = sr.source;
  } else {
    const lr = await trpc.product.list({
      search: q || undefined,
      categoryId,
      sort,
      limit: 60,
    });
    products = serializeFirestore(lr.items);
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

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav initialQ={q} />
      <CatalogNav categories={categories} />

      <main className="mx-auto max-w-screen-2xl px-4 md:px-8">
        {/* ─── 미니멀 페이지 헤더 ─── */}
        <PageHeader
          isFiltered={isFiltered}
          query={q}
          filterCategoryName={filterCategoryName}
          filterVendorName={filterVendorName}
          filterVendorId={vendorId ?? null}
          productCount={products.length}
        />

        {/* dev 전용 source 배지 — production 빌드에서는 숨김 */}
        {process.env.NODE_ENV !== "production" && useSearch && (
          <div className="-mt-3 mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
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

        {/* ─── Featured — 필터 안 걸렸을 때만, 컴팩트 ─── */}
        {!isFiltered && featured.length > 0 && (
          <div className="mt-8 md:mt-10">
            <FeaturedProductSection products={featured} />
          </div>
        )}

        {/* ─── 전체 상품 그리드 ─── */}
        <section
          id="all-products"
          className={`border-t border-[var(--color-border-light)] pt-8 md:pt-10 ${
            isFiltered ? "mt-2" : "mt-10 md:mt-12"
          }`}
        >
          {/* 그리드 헤더 — 컴팩트 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-base font-semibold tracking-[-0.02em] md:text-lg">
                {isFiltered
                  ? q
                    ? `"${q}" 검색 결과`
                    : (filterCategoryName ?? "모든 상품")
                  : "전체 상품"}
              </h2>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                <span className="font-semibold tabular-nums text-[var(--color-text-secondary)]">
                  <CountUp value={products.length} duration={700} />
                </span>
                개
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
                    className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
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
            <div className="mt-10">
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
            <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {products.map((p, i) => (
                <Reveal key={p.id} delay={(i % 12) * 40}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          )}
        </section>

        {/* 푸터 여백 */}
        <div className="h-16 md:h-24" />
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
}: {
  isFiltered: boolean;
  query: string;
  filterCategoryName: string | null;
  filterVendorName: string | null;
  filterVendorId: string | null;
  productCount: number;
}) {
  // vendorId 모드 — vendor 이름 헤더 + 전체 카탈로그로 돌아가기
  if (isFiltered && filterVendorId) {
    return (
      <header className="py-8 md:py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
          공급업체
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="break-keep text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            {filterVendorName ?? "공급업체 상품"}
          </h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            <span className="font-semibold tabular-nums text-[var(--color-text-secondary)]">
              <CountUp value={productCount} duration={700} />
            </span>
            개 상품
          </p>
          <Link
            href="/search"
            className="text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            전체 카탈로그 →
          </Link>
        </div>
      </header>
    );
  }

  // 검색·카테고리 필터 — 한 줄 헤더
  if (isFiltered) {
    return (
      <header className="py-8 md:py-10">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="break-keep text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            {query ? `"${query}"` : (filterCategoryName ?? "필터 결과")}
          </h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            <span className="font-semibold tabular-nums text-[var(--color-text-secondary)]">
              <CountUp value={productCount} duration={700} />
            </span>
            개 {query ? "검색 결과" : "상품"}
          </p>
        </div>
      </header>
    );
  }

  // 기본 — 카탈로그 전체 헤더 (컴팩트, 한 줄 + 총 N개 메타)
  return (
    <header className="py-8 md:py-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="break-keep text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          의료 카탈로그
        </h1>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          식약처 인증 의료기기·소모품{" "}
          <span className="font-semibold tabular-nums text-[var(--color-text-secondary)]">
            <CountUp value={productCount} duration={700} />
          </span>
          개
        </p>
      </div>
    </header>
  );
}
