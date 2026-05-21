import Link from "next/link";
import {
  Filter,
  Package,
  Repeat,
  Search as SearchIcon,
  Stethoscope,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Reveal } from "@/components/shared/reveal";
import { trpcServer } from "@/lib/trpc/server";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORT_OPTIONS = [
  { value: "latest", label: "최신순" },
  { value: "priceAsc", label: "낮은 가격" },
  { value: "priceDesc", label: "높은 가격" },
  { value: "popular", label: "인기순" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const DEVICE_CLASS_LABEL: Record<string, string> = {
  CLASS_1: "1등급",
  CLASS_2: "2등급",
  CLASS_3: "3등급",
  CLASS_4: "4등급",
  NON_DEVICE: "비의료기기",
};

const DEVICE_CLASS_TONE: Record<string, string> = {
  CLASS_1: "bg-[var(--color-class-1)]/15 text-[var(--color-class-1)]",
  CLASS_2: "bg-[var(--color-class-2)]/15 text-[var(--color-class-2)]",
  CLASS_3: "bg-[var(--color-class-3)]/15 text-[var(--color-class-3)]",
  CLASS_4: "bg-[var(--color-class-4)]/15 text-[var(--color-class-4)]",
  NON_DEVICE: "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    sort?: string;
    subscribable?: string;
    groupBuyable?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const categoryId = sp.categoryId;
  const sort = (SORT_OPTIONS.find((s) => s.value === sp.sort)?.value ??
    "latest") as SortValue;
  const subscribable = sp.subscribable === "true";
  const groupBuyable = sp.groupBuyable === "true";

  const trpc = await trpcServer();

  const [{ items: products }, categories] = await Promise.all([
    trpc.product.list({
      search: q || undefined,
      categoryId,
      sort,
      subscribable: subscribable || undefined,
      groupBuyable: groupBuyable || undefined,
      limit: 24,
    }),
    trpc.product.categories(),
  ]);

  // 대분류 + 중분류 트리 구조
  const topCategories = categories.filter((c) => c.depth === 1);
  const subCategories = categories.filter((c) => c.depth === 2);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <SearchTopBar initialQ={q} />

      <main className="mx-auto max-w-7xl px-6 py-10 md:px-12 md:py-14">
        <PageHeader
          label={categoryId ? "카테고리" : "전체"}
          title={
            q
              ? `"${q}" 검색 결과`
              : categoryId
                ? categories.find((c) => c.id === categoryId)?.name ?? "둘러보기"
                : "둘러보기"
          }
          description={`${products.length}개 상품 · ${categories.find((c) => c.id === categoryId)?.path.join(" › ") ?? "전체 카테고리"}`}
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* 좌측 필터 */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <FilterPanel
              topCategories={topCategories}
              subCategories={subCategories}
              currentCategoryId={categoryId}
              subscribable={subscribable}
              groupBuyable={groupBuyable}
              sort={sort}
            />
          </aside>

          {/* 본문 — 상품 그리드 */}
          <section className="min-w-0">
            {products.length === 0 ? (
              <EmptyState
                icon={Package}
                title={q ? `"${q}" 결과가 없습니다` : "해당 조건의 상품이 없습니다"}
                description="다른 키워드나 필터를 시도해보세요."
                action={
                  <Link
                    href="/search"
                    className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                  >
                    전체 보기
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p, i) => (
                  <Reveal key={p.id} delay={(i % 6) * 80}>
                    <ProductCard product={p} />
                  </Reveal>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 상단 검색바
// ─────────────────────────────────────────────────────────────

function SearchTopBar({ initialQ }: { initialQ: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6 md:px-12">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            MedPlace
          </span>
        </Link>

        <form action="/search" method="get" className="flex flex-1 items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <SearchIcon
              className="pointer-events-none absolute left-4 h-4 w-4 text-[var(--color-text-tertiary)]"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={initialQ}
              placeholder="상품명, 브랜드, 공급업체 검색"
              className="h-11 w-full rounded-full border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] pl-11 pr-4 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-[var(--color-bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            검색
          </button>
        </form>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          <Link
            href="/cart"
            className="rounded-full px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            장바구니
          </Link>
          <Link
            href="/orders"
            className="rounded-full px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            주문 이력
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// 좌측 필터 패널
// ─────────────────────────────────────────────────────────────

type Category = {
  id: string;
  name: string;
  parentId?: string;
  depth: number;
  path: string[];
};

function FilterPanel({
  topCategories,
  subCategories,
  currentCategoryId,
  subscribable,
  groupBuyable,
  sort,
}: {
  topCategories: Category[];
  subCategories: Category[];
  currentCategoryId?: string;
  subscribable: boolean;
  groupBuyable: boolean;
  sort: SortValue;
}) {
  return (
    <div className="space-y-6 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] p-5">
      {/* 정렬 */}
      <div>
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          <Filter className="h-3 w-3" />
          정렬
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map((s) => (
            <FilterChip
              key={s.value}
              active={sort === s.value}
              href={buildSearchUrl({
                categoryId: currentCategoryId,
                sort: s.value,
                subscribable,
                groupBuyable,
              })}
            >
              {s.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* 거래 형태 */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          거래 형태
        </p>
        <div className="mt-3 space-y-2">
          <ToggleChip
            icon={Repeat}
            active={subscribable}
            href={buildSearchUrl({
              categoryId: currentCategoryId,
              sort,
              subscribable: !subscribable,
              groupBuyable,
            })}
          >
            자동 정기 주문
          </ToggleChip>
          <ToggleChip
            icon={Users}
            active={groupBuyable}
            href={buildSearchUrl({
              categoryId: currentCategoryId,
              sort,
              subscribable,
              groupBuyable: !groupBuyable,
            })}
          >
            공동구매 가능
          </ToggleChip>
        </div>
      </div>

      {/* 카테고리 트리 */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          카테고리
        </p>
        <div className="mt-3 space-y-3">
          <Link
            href="/search"
            className={`block rounded-lg px-2 py-1.5 text-sm transition-colors ${
              !currentCategoryId
                ? "bg-[var(--color-accent-light)] font-medium text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            }`}
          >
            전체
          </Link>
          {topCategories.map((top) => {
            const children = subCategories.filter((s) => s.parentId === top.id);
            return (
              <div key={top.id}>
                <Link
                  href={`/search?categoryId=${top.id}`}
                  className={`block rounded-lg px-2 py-1.5 text-sm transition-colors ${
                    currentCategoryId === top.id
                      ? "bg-[var(--color-accent-light)] font-medium text-[var(--color-accent)]"
                      : "font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                  }`}
                >
                  {top.name}
                </Link>
                {children.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {children.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          href={`/search?categoryId=${sub.id}`}
                          className={`block rounded-lg px-2 py-1 text-xs transition-colors ${
                            currentCategoryId === sub.id
                              ? "bg-[var(--color-accent-light)] font-medium text-[var(--color-accent)]"
                              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                          }`}
                        >
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-7 items-center rounded-full px-3 text-xs transition-colors ${
        active
          ? "bg-[var(--color-accent)] text-white"
          : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-light)]"
      }`}
    >
      {children}
    </Link>
  );
}

function ToggleChip({
  icon: Icon,
  active,
  href,
  children,
}: {
  icon: typeof Repeat;
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
      }`}
    >
      <span
        className={`grid h-7 w-7 place-items-center rounded-lg ${
          active
            ? "bg-[var(--color-accent)] text-white"
            : "bg-[var(--color-bg-secondary)]"
        }`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="flex-1">{children}</span>
      <span
        aria-hidden
        className={`h-3 w-3 shrink-0 rounded-full border-2 ${
          active
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
            : "border-[var(--color-border-default)]"
        }`}
      />
    </Link>
  );
}

function buildSearchUrl(params: {
  categoryId?: string;
  sort: SortValue;
  subscribable: boolean;
  groupBuyable: boolean;
}): string {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.sort !== "latest") qs.set("sort", params.sort);
  if (params.subscribable) qs.set("subscribable", "true");
  if (params.groupBuyable) qs.set("groupBuyable", "true");
  const s = qs.toString();
  return s ? `/search?${s}` : "/search";
}

// ─────────────────────────────────────────────────────────────
// 상품 카드
// ─────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  const lowestTier = product.priceTiers?.length
    ? Math.min(...product.priceTiers.map((t) => t.price))
    : null;
  const hasTier = lowestTier !== null && lowestTier < product.basePrice;

  const classLabel = DEVICE_CLASS_LABEL[product.deviceClass];
  const classTone = DEVICE_CLASS_TONE[product.deviceClass];

  return (
    <Link
      href={`/products/${product.id}`}
      className="landing-tilt group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] transition-shadow duration-300 hover:shadow-md"
    >
      {/* 이미지 영역 */}
      <div className="relative aspect-square overflow-hidden bg-[var(--color-bg-secondary)]">
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-[var(--color-text-tertiary)]" />
          </div>
        )}

        {/* 좌상단 — 등급 배지 */}
        {classLabel && (
          <span
            className={`absolute left-3 top-3 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${classTone}`}
          >
            {classLabel}
          </span>
        )}

        {/* 우상단 — 거래 형태 배지 */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          {product.groupBuyable && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
              <Users className="h-2.5 w-2.5" />
              공동구매
            </span>
          )}
          {product.subscribable && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              <Repeat className="h-2.5 w-2.5" />
              정기 주문
            </span>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {product.categoryPath?.[product.categoryPath.length - 1] ?? "—"}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
          {product.name}
        </h3>
        <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
          {product.vendorName}
        </p>

        <div className="mt-auto pt-4">
          {hasTier ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">
              <span className="text-[var(--color-text-secondary)]">from</span>{" "}
              <span className="text-base font-semibold tabular-nums text-[var(--color-text-primary)]">
                {lowestTier!.toLocaleString()}
              </span>
              <span className="ml-0.5">원</span>
            </p>
          ) : (
            <p className="text-base font-semibold tabular-nums">
              {product.basePrice.toLocaleString()}
              <span className="ml-0.5 text-xs font-normal text-[var(--color-text-tertiary)]">
                원 / {product.unit}
              </span>
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
            최소 주문 {product.moq} {product.unit}
          </p>
        </div>
      </div>
    </Link>
  );
}
