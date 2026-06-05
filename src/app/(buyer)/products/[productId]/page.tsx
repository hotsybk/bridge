import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Package, Repeat, Truck, Users } from "lucide-react";

import { CatalogNav } from "@/components/buyer/catalog-nav";
import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { ProductBuyPanel } from "@/components/buyer/product-buy-panel";
import { ProductCard } from "@/components/buyer/product-card";
import { Reveal } from "@/components/shared/reveal";
import { trpcServer } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

/** Phase ν-2 — 상품 메타. productName + vendorName 으로 동적 생성. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  const { productId } = await params;
  try {
    const trpc = await trpcServer();
    const product = (await trpc.product.getById({ id: productId })) as
      | { name?: string; vendorName?: string } | null;
    if (!product) {
      return { title: "상품을 찾을 수 없습니다", robots: { index: false } };
    }
    const title = product.name ?? "상품";
    const vendor = product.vendorName ?? "공급업체";
    const desc = `${vendor} · ${title} · 한국 의료 B2B 마켓플레이스 MedPlace`;
    return {
      title,
      description: desc,
      openGraph: { title: `${title} | MedPlace`, description: desc },
    };
  } catch {
    return { title: "상품" };
  }
}

const DEVICE_CLASS_LABEL: Record<string, string> = {
  CLASS_1: "1등급",
  CLASS_2: "2등급",
  CLASS_3: "3등급",
  CLASS_4: "4등급",
  NON_DEVICE: "비의료기기",
};

const DEVICE_CLASS_TEXT: Record<string, string> = {
  CLASS_1: "text-[var(--color-class-1)]",
  CLASS_2: "text-[var(--color-class-2)]",
  CLASS_3: "text-[var(--color-class-3)]",
  CLASS_4: "text-[var(--color-class-4)]",
  NON_DEVICE: "text-[var(--color-text-tertiary)]",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const trpc = await trpcServer();

  let product;
  try {
    product = await trpc.product.getById({ id: productId });
  } catch {
    notFound();
  }
  if (!product) notFound();

  const { items: sameCategory } = await trpc.product.list({
    categoryId: product.categoryId,
    limit: 8,
  });
  const related = sameCategory.filter((p) => p.id !== productId).slice(0, 4);

  const classLabel = DEVICE_CLASS_LABEL[product.deviceClass];
  const classTextColor = DEVICE_CLASS_TEXT[product.deviceClass];
  const description = (product as { description?: string }).description;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />
      <CatalogNav />

      {/* Breadcrumb */}
      <nav className="mx-auto max-w-7xl px-6 pt-8 text-xs text-[var(--color-text-tertiary)] md:px-12">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              href="/"
              className="transition-colors hover:text-[var(--color-text-primary)]"
            >
              홈
            </Link>
          </li>
          <ChevronRight className="h-3 w-3" />
          <li>
            <Link
              href="/search"
              className="transition-colors hover:text-[var(--color-text-primary)]"
            >
              둘러보기
            </Link>
          </li>
          {product.categoryPath?.map((p, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3" />
              <li>
                <Link
                  href={
                    i === product.categoryPath.length - 1
                      ? `/search?categoryId=${product.categoryId}`
                      : "/search"
                  }
                  className="transition-colors hover:text-[var(--color-text-primary)]"
                >
                  {p}
                </Link>
              </li>
            </span>
          ))}
        </ol>
      </nav>

      {/* ─── Hero — 좌측 큰 이미지 sticky / 우측 정보·CTA ─── */}
      {/* pb-32 = 모바일 sticky CTA(약 70px) + bottom tab bar(56px) 공간 확보 */}
      <main className="mx-auto max-w-7xl px-6 py-10 pb-32 md:px-12 md:py-16 md:pb-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          {/* Left — Hero 이미지 + thumbnail */}
          <div className="lg:sticky lg:top-40 lg:self-start">
            <ProductHero
              image={product.thumbnail}
              alt={product.name}
              classLabel={classLabel}
              classTextColor={classTextColor}
            />
          </div>

          {/* Right — 정보 + CTA */}
          <div className="flex flex-col">
            {/* eyebrow */}
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {product.categoryPath?.join(" · ")}
            </p>

            {/* 상품명 */}
            <h1 className="mt-4 break-keep text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">
              {product.name}
            </h1>

            {/* 브랜드 · 공급업체 한 줄 — 박스 없이 인라인 */}
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {product.brand && (
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {product.brand}
                </span>
              )}
              {product.brand && (
                <span className="text-[var(--color-text-tertiary)]">·</span>
              )}
              <Link
                href={`/vendors/${product.vendorId}`}
                className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)] hover:underline"
              >
                {product.vendorName}
              </Link>
            </div>

            {/* 설명 */}
            {description && (
              <p className="mt-6 max-w-md text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {description}
              </p>
            )}

            {/* Feature chips — 라인 only */}
            <div className="mt-8 flex flex-wrap gap-2">
              {product.subscribable && (
                <FeatureChip
                  icon={Repeat}
                  label="자동 정기구독"
                  tone="success"
                />
              )}
              {product.groupBuyable && (
                <FeatureChip
                  icon={Users}
                  label="공동구매 가능"
                  tone="accent"
                />
              )}
              {product.shippingFee === 0 && (
                <FeatureChip icon={Truck} label="무료 배송" tone="neutral" />
              )}
            </div>

            {/* 가격 + 수량 + CTA 패널 */}
            <div className="mt-10 border-t border-[var(--color-border-light)] pt-10">
              <ProductBuyPanel
                product={{
                  id: product.id,
                  name: product.name,
                  basePrice: product.basePrice,
                  priceTiers: product.priceTiers,
                  unit: product.unit,
                  moq: product.moq,
                  stock: product.stock,
                  shippingFee: product.shippingFee,
                  subscribable: (product as { subscribable?: boolean })
                    .subscribable,
                  groupBuyable: (product as { groupBuyable?: boolean })
                    .groupBuyable,
                  vendorId: (product as { vendorId?: string }).vendorId,
                }}
              />
            </div>

            {/* 하단 안내 — 라인 only */}
            <ul className="mt-10 grid gap-3 border-t border-[var(--color-border-light)] pt-8 text-xs text-[var(--color-text-secondary)] md:grid-cols-2">
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]"
                />
                1~3 영업일 발송 · 도서산간 추가비
              </li>
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]"
                />
                배송 완료 후 영업일 3일 정산
              </li>
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]"
                />
                세금계산서 자동 발행
              </li>
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]"
                />
                식약처 의료기기 사용 보고 자동
              </li>
            </ul>
          </div>
        </div>

        {/* ─── 안전·인증 — 박스 없이 4 컬럼 라인 ─── */}
        <section className="mt-32 border-t border-[var(--color-border-light)] pt-16 md:mt-40 md:pt-24">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  안전 · 인증
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
                  식약처가 검증한 상품
                </h2>
              </div>
              <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
                모든 의료기기는 식약처 허가와 식약처 의료기기 코드로 추적됩니다.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-y-10 sm:grid-cols-2 md:grid-cols-4 md:gap-y-0">
            <TrustItem
              label="의료기기 등급"
              value={classLabel ?? "—"}
              valueClass={classTextColor}
              hasDivider={false}
            />
            <TrustItem
              label="식약처 코드"
              value={product.udiCode ?? "—"}
              mono
              hasDivider
            />
            <TrustItem
              label="식약처 허가"
              value={product.mfdsLicenseNo ?? "—"}
              mono
              hasDivider
            />
            <TrustItem
              label="원산지"
              value={product.origin ?? "—"}
              hasDivider
            />
          </div>
        </section>

        {/* ─── 상세 정보 — 박스 없이 정렬된 표 ─── */}
        <section className="mt-32 border-t border-[var(--color-border-light)] pt-16 md:mt-40 md:pt-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            상세 정보
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            상품 명세서
          </h2>

          <dl className="mt-12 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <SpecRow k="제품명" v={product.name} />
            {product.brand && <SpecRow k="브랜드" v={product.brand} />}
            {product.manufacturer && (
              <SpecRow k="제조사" v={product.manufacturer} />
            )}
            {product.origin && <SpecRow k="원산지" v={product.origin} />}
            <SpecRow k="단위" v={unitLabel(product.unit)} />
            <SpecRow
              k="최소 주문 수량"
              v={`${product.moq} ${unitLabel(product.unit)}`}
            />
            <SpecRow
              k="배송비"
              v={
                product.shippingFee === 0
                  ? "무료"
                  : `₩${product.shippingFee.toLocaleString()}`
              }
            />
            <SpecRow k="공급업체" v={product.vendorName} />
            {product.udiCode && (
              <SpecRow k="식약처 의료기기 코드" v={product.udiCode} mono />
            )}
            {product.mfdsLicenseNo && (
              <SpecRow k="식약처 허가번호" v={product.mfdsLicenseNo} mono />
            )}
          </dl>
        </section>

        {/* ─── 비슷한 상품 ─── */}
        {related.length > 0 && (
          <section className="mt-32 border-t border-[var(--color-border-light)] pt-16 md:mt-40 md:pt-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  같은 카테고리
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
                  비슷한 상품
                </h2>
              </div>
              <Link
                href={`/search?categoryId=${product.categoryId}`}
                className="text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                전체 보기 →
              </Link>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <Reveal key={p.id} delay={i * 100}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub components
// ─────────────────────────────────────────────────────────────

/**
 * 상품 hero 이미지 — 큰 사각 + accent 글로우 + 등급 글래스 배지.
 */
function ProductHero({
  image,
  alt,
  classLabel,
  classTextColor,
}: {
  image: string | null | undefined;
  alt: string;
  classLabel?: string;
  classTextColor: string;
}) {
  return (
    <div className="relative">
      {/* 글로우 배경 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 translate-y-8 rounded-[3rem] bg-[var(--color-accent)]/8 blur-3xl"
      />

      {/* 메인 이미지 */}
      <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] md:rounded-[2.5rem]">
        {image ? (
          <Image
            src={image}
            alt={alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package
              className="h-24 w-24 text-[var(--color-text-tertiary)]/40"
              strokeWidth={1}
            />
          </div>
        )}

        {/* 등급 배지 — 글래스 효과 좌상단 */}
        {classLabel && (
          <span
            className={`absolute left-5 top-5 inline-flex items-center rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur-md ${classTextColor}`}
          >
            {classLabel}
          </span>
        )}
      </div>

      {/* 썸네일 strip — 가운데 active, 양옆 placeholder */}
      <div className="mt-5 grid grid-cols-5 gap-2.5">
        <ThumbItem image={image} alt={alt} active />
        {[1, 2, 3, 4].map((i) => (
          <ThumbItem key={i} />
        ))}
      </div>
    </div>
  );
}

function ThumbItem({
  image,
  alt,
  active,
}: {
  image?: string | null;
  alt?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`relative aspect-square overflow-hidden rounded-2xl transition-all ${
        active
          ? "ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg-primary)]"
          : "border border-[var(--color-border-light)] hover:border-[var(--color-text-secondary)]/40"
      }`}
    >
      {image ? (
        <Image src={image} alt={alt ?? ""} fill sizes="80px" className="object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-xs text-[var(--color-text-tertiary)]">
          +
        </span>
      )}
    </button>
  );
}

/**
 * Feature chip — 라인 only.
 */
function FeatureChip({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Repeat;
  label: string;
  tone: "success" | "accent" | "neutral";
}) {
  const color = {
    success: "border-[var(--color-success)]/40 text-[var(--color-success)]",
    accent: "border-[var(--color-accent)]/40 text-[var(--color-accent)]",
    neutral:
      "border-[var(--color-border-light)] text-[var(--color-text-secondary)]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${color}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

/**
 * 안전·인증 항목 — 박스 없이 컬럼 라벨 + 큰 값.
 */
function TrustItem({
  label,
  value,
  valueClass = "",
  mono,
  hasDivider,
}: {
  label: string;
  value: string;
  valueClass?: string;
  mono?: boolean;
  hasDivider: boolean;
}) {
  return (
    <div
      className={`px-6 first:pl-0 md:px-8 ${
        hasDivider
          ? "md:border-l md:border-[var(--color-border-light)]"
          : ""
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p
        className={`mt-3 text-sm font-semibold tracking-tight ${valueClass} ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SpecRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-4 md:grid-cols-[200px_1fr] md:py-5">
      <dt className="text-sm text-[var(--color-text-tertiary)]">{k}</dt>
      <dd
        className={`text-sm ${
          mono ? "font-mono tabular-nums" : "font-medium"
        }`}
      >
        {v}
      </dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────

const UNIT_LABEL: Record<string, string> = {
  BOX: "박스",
  EA: "개",
  KG: "kg",
  L: "L",
  ML: "ml",
  PACK: "팩",
  SET: "세트",
};
function unitLabel(u: string): string {
  return UNIT_LABEL[u] ?? u;
}
