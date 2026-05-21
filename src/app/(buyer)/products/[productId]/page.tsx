import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { CatalogNav } from "@/components/buyer/catalog-nav";
import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { ProductBuyPanel } from "@/components/buyer/product-buy-panel";
import { ProductCard } from "@/components/buyer/product-card";
import { Reveal } from "@/components/shared/reveal";
import { trpcServer } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

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

  // 같은 카테고리 추천 (자기 자신 제외, 최대 4개)
  const { items: sameCategory } = await trpc.product.list({
    categoryId: product.categoryId,
    limit: 8,
  });
  const related = sameCategory.filter((p) => p.id !== productId).slice(0, 4);

  const classLabel = DEVICE_CLASS_LABEL[product.deviceClass];
  const classTone = DEVICE_CLASS_TONE[product.deviceClass];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />
      <CatalogNav />

      {/* Breadcrumb */}
      <nav className="mx-auto max-w-7xl px-6 pt-6 text-xs text-[var(--color-text-secondary)] md:px-12">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              홈
            </Link>
          </li>
          <ChevronRight className="h-3 w-3 text-[var(--color-text-tertiary)]" />
          <li>
            <Link href="/search" className="hover:underline">
              둘러보기
            </Link>
          </li>
          {product.categoryPath?.map((p, i) => {
            const catIdAtThisDepth = product.categoryId; // 시드는 leaf
            return (
              <span key={i} className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 text-[var(--color-text-tertiary)]" />
                <li>
                  <Link
                    href={
                      i === product.categoryPath.length - 1
                        ? `/search?categoryId=${catIdAtThisDepth}`
                        : "/search"
                    }
                    className="hover:underline"
                  >
                    {p}
                  </Link>
                </li>
              </span>
            );
          })}
        </ol>
      </nav>

      {/* 메인 — 좌측 이미지 + 우측 정보·CTA */}
      <main className="mx-auto max-w-7xl px-6 py-8 md:px-12 md:py-12">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          {/* Left — sticky 이미지 */}
          <div className="lg:sticky lg:top-40 lg:self-start">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-[var(--color-bg-secondary)]">
              {product.thumbnail ? (
                <Image
                  src={product.thumbnail}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-20 w-20 text-[var(--color-text-tertiary)]" />
                </div>
              )}

              {/* 좌상단 — 등급 */}
              {classLabel && (
                <span
                  className={`absolute left-4 top-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${classTone}`}
                >
                  {classLabel}
                </span>
              )}
            </div>

            {/* 작은 썸네일 갤러리 (현재 1장만) */}
            <div className="mt-4 grid grid-cols-5 gap-2">
              <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-[var(--color-accent)]">
                {product.thumbnail && (
                  <Image
                    src={product.thumbnail}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                )}
              </div>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="grid aspect-square place-items-center rounded-xl bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-tertiary)]"
                >
                  +
                </div>
              ))}
            </div>
          </div>

          {/* Right — 정보 + CTA */}
          <div>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {product.categoryPath?.join(" · ")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] md:text-5xl">
              {product.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              {product.brand && (
                <span className="font-medium text-[var(--color-text-primary)]">
                  {product.brand}
                </span>
              )}
              <span>·</span>
              <Link
                href={`/search?vendorId=${product.vendorId}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Building2 className="h-3.5 w-3.5" />
                {product.vendorName}
              </Link>
            </div>

            {(product as { description?: string }).description && (
              <p className="mt-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
                {(product as { description?: string }).description}
              </p>
            )}

            {/* 핵심 spec — quick chips */}
            <div className="mt-6 flex flex-wrap gap-2">
              {product.subscribable && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/12 px-3 py-1 text-xs font-medium text-[var(--color-success)]">
                  자동 정기 주문
                </span>
              )}
              {product.groupBuyable && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
                  공동구매 가능
                </span>
              )}
              {product.shippingFee === 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                  <Truck className="h-3 w-3" />
                  무료 배송
                </span>
              )}
            </div>

            {/* 가격 + 수량 + CTA */}
            <div className="mt-8 border-t border-[var(--color-border-light)] pt-8">
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
                  subscribable: (product as { subscribable?: boolean }).subscribable,
                  groupBuyable: (product as { groupBuyable?: boolean }).groupBuyable,
                }}
              />
            </div>
          </div>
        </div>

        {/* 신뢰·인증 섹션 */}
        <section className="mt-24 md:mt-32">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-4xl">
              안전·인증
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)] md:text-base">
              모든 의료기기는 식약처 허가와 UDI 코드로 추적됩니다.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <TrustCard
              icon={ShieldCheck}
              label={`의료기기 ${classLabel ?? "—"}`}
              value={product.deviceClass}
              tone={classTone}
            />
            {product.udiCode && (
              <TrustCard
                icon={FileText}
                label="UDI 코드"
                value={product.udiCode}
                tone="bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                mono
              />
            )}
            {product.mfdsLicenseNo && (
              <TrustCard
                icon={CheckCircle2}
                label="식약처 허가/신고"
                value={product.mfdsLicenseNo}
                tone="bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                mono
              />
            )}
            {product.origin && (
              <TrustCard
                icon={Globe}
                label="원산지"
                value={product.origin}
                tone="bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            )}
          </div>
        </section>

        {/* 상세 spec 표 */}
        <section className="mt-24 md:mt-32">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-4xl">
            상세 정보
          </h2>
          <div className="mt-10 overflow-hidden rounded-2xl border border-[var(--color-border-light)]">
            <dl className="divide-y divide-[var(--color-border-light)]">
              <SpecRow k="제품명" v={product.name} />
              {product.brand && <SpecRow k="브랜드" v={product.brand} />}
              {product.manufacturer && (
                <SpecRow k="제조사" v={product.manufacturer} />
              )}
              {product.origin && <SpecRow k="원산지" v={product.origin} />}
              <SpecRow k="단위" v={product.unit} />
              <SpecRow k="최소 주문 수량" v={`${product.moq} ${product.unit}`} />
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
                <SpecRow k="UDI 코드" v={product.udiCode} mono />
              )}
              {product.mfdsLicenseNo && (
                <SpecRow k="식약처 번호" v={product.mfdsLicenseNo} mono />
              )}
            </dl>
          </div>
        </section>

        {/* 같은 카테고리 추천 */}
        {related.length > 0 && (
          <section className="mt-24 md:mt-32">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-4xl">
                  비슷한 상품
                </h2>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  같은 카테고리의 다른 상품을 살펴보세요.
                </p>
              </div>
              <Link
                href={`/search?categoryId=${product.categoryId}`}
                className="hidden text-sm font-medium text-[var(--color-accent)] hover:underline md:inline-flex"
              >
                전체 보기 →
              </Link>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
// 작은 컴포넌트
// ─────────────────────────────────────────────────────────────

function TrustCard({
  icon: Icon,
  label,
  value,
  tone,
  mono,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  tone: string;
  mono?: boolean;
}) {
  return (
    <article className="rounded-2xl bg-[var(--color-bg-secondary)] p-5">
      <span
        className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-4 text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p
        className={`mt-1.5 text-sm font-semibold ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </p>
    </article>
  );
}

function SpecRow({
  k,
  v,
  mono,
}: {
  k: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-5 py-3.5 md:grid-cols-[180px_1fr] md:px-7 md:py-4">
      <dt className="text-sm text-[var(--color-text-secondary)]">{k}</dt>
      <dd
        className={`text-sm ${mono ? "font-mono tabular-nums" : "font-medium"}`}
      >
        {v}
      </dd>
    </div>
  );
}
