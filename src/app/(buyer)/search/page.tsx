import Link from "next/link";
import { Package } from "lucide-react";

import { BenefitSection } from "@/components/buyer/benefit-card";
import { CatalogNav } from "@/components/buyer/catalog-nav";
import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { CategoryHeroSection } from "@/components/buyer/category-hero-card";
import { FeaturedProductSection } from "@/components/buyer/featured-product";
import { HeroBanner } from "@/components/buyer/hero-banner";
import { ProductCard } from "@/components/buyer/product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { trpcServer } from "@/lib/trpc/server";

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
  searchParams: Promise<{ q?: string; categoryId?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const categoryId = sp.categoryId;
  const sort = (SORT_OPTIONS.find((s) => s.value === sp.sort)?.value ??
    "latest") as SortValue;

  const trpc = await trpcServer();
  const [{ items: products }, categories] = await Promise.all([
    trpc.product.list({
      search: q || undefined,
      categoryId,
      sort,
      limit: 60, // 시드 12개 + 여유
    }),
    trpc.product.categories(),
  ]);

  const isFiltered = Boolean(q || categoryId);
  const filterCategoryName = categoryId
    ? categories.find((c) => c.id === categoryId)?.name
    : null;

  // 인기 상품: 처음 3개 (정렬 = latest 기준 또는 viewCount 기반)
  const featured = isFiltered ? [] : products.slice(0, 3);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav initialQ={q} />
      <CatalogNav />

      {/* 검색·필터 모드면 hero 등 생략 */}
      {!isFiltered && (
        <>
          <HeroBanner />
          <FeaturedProductSection products={featured} />
          <BenefitSection />
          <CategoryHeroSection />
        </>
      )}

      {/* 전체 상품 그리드 */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-5xl">
              {q
                ? `"${q}" 검색 결과`
                : filterCategoryName
                  ? filterCategoryName
                  : "모든 상품"}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {products.length}개 상품
            </p>
          </div>

          {/* 정렬 chip */}
          <div className="flex gap-1">
            {SORT_OPTIONS.map((s) => {
              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (categoryId) params.set("categoryId", categoryId);
              if (s.value !== "latest") params.set("sort", s.value);
              const href = params.toString()
                ? `/search?${params.toString()}`
                : "/search";
              const active = sort === s.value;
              return (
                <Link
                  key={s.value}
                  href={href}
                  className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-light)]"
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
          </div>
        </div>

        {products.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={Package}
              title={
                q
                  ? `"${q}" 결과가 없습니다`
                  : "해당 조건의 상품이 없습니다"
              }
              description="다른 키워드나 카테고리를 시도해보세요."
              action={
                <Link
                  href="/search"
                  className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white"
                >
                  전체 보기
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p, i) => (
              <Reveal key={p.id} delay={(i % 8) * 60}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

