import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { Product } from "@/lib/types";

/**
 * Apple "Apple Watch" 큰 헤드라인 + 3 카드 패턴.
 * 큰 정사각 이미지 + 컬러 dots + 제품명 + 가격 + 2 CTA.
 */

const DEVICE_CLASS_COLORS: Record<string, string> = {
  CLASS_1: "bg-[var(--color-class-1)]",
  CLASS_2: "bg-[var(--color-class-2)]",
  CLASS_3: "bg-[var(--color-class-3)]",
  CLASS_4: "bg-[var(--color-class-4)]",
  NON_DEVICE: "bg-[var(--color-text-tertiary)]",
};

export function FeaturedProductSection({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section
      id="featured"
      className="mx-auto max-w-6xl px-6 py-24 md:px-12 md:py-32"
    >
      <h2 className="text-4xl font-semibold tracking-[-0.04em] md:text-6xl">
        인기 상품
      </h2>
      <p className="mt-3 text-base text-[var(--color-text-secondary)] md:text-lg">
        지금 가장 많이 둘러보는 상품을 만나보세요.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-3 md:gap-5">
        {products.slice(0, 3).map((p) => (
          <FeaturedProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

function FeaturedProductCard({ product }: { product: Product }) {
  const lowestTier = product.priceTiers?.length
    ? Math.min(...product.priceTiers.map((t) => t.price))
    : null;
  const hasTier = lowestTier !== null && lowestTier < product.basePrice;
  const displayPrice = hasTier ? lowestTier! : product.basePrice;

  // 의료기기 등급을 색상 dots 로 시각화
  const classKey = product.deviceClass;
  const classColor = DEVICE_CLASS_COLORS[classKey] ?? "bg-[var(--color-text-tertiary)]";

  return (
    <article className="flex h-full flex-col rounded-3xl bg-[var(--color-bg-secondary)] p-7 transition-colors duration-300 md:p-9">
      {/* 이미지 영역 */}
      <Link
        href={`/products/${product.id}`}
        className="group block overflow-hidden rounded-2xl bg-[var(--color-bg-primary)]"
      >
        <div className="relative aspect-square">
          {product.thumbnail ? (
            <Image
              src={product.thumbnail}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--color-text-tertiary)]">
              No image
            </div>
          )}
        </div>
      </Link>

      {/* Color dots — 의료기기 등급 시각화 (1·2·3·4 + NON) */}
      <div className="mt-7 flex items-center gap-2" aria-hidden>
        {(["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4"] as const).map((c) => (
          <span
            key={c}
            className={`h-2 w-2 rounded-full ${
              c === classKey
                ? DEVICE_CLASS_COLORS[c]
                : "bg-[var(--color-border-default)]/40"
            }`}
          />
        ))}
        <span
          className={`ml-1 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ${classColor} text-white`}
        >
          {classKey === "NON_DEVICE"
            ? "비의료기기"
            : `${classKey.replace("CLASS_", "")}등급`}
        </span>
      </div>

      {/* 제품 정보 */}
      <div className="mt-5 flex flex-1 flex-col">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {product.categoryPath?.[product.categoryPath.length - 1] ?? "—"} ·{" "}
          {product.vendorName}
        </p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          {product.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
          {(product as { description?: string }).description ?? "—"}
        </p>

        <p className="mt-5 text-lg font-semibold tabular-nums">
          {hasTier && (
            <span className="text-sm font-normal text-[var(--color-text-secondary)]">
              from{" "}
            </span>
          )}
          ₩{displayPrice.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-[var(--color-text-tertiary)]">
            부터 / {product.unit}
          </span>
        </p>

        {/* CTA */}
        <div className="mt-7 flex items-center gap-4">
          <Link
            href={`/products/${product.id}`}
            className="inline-flex h-10 items-center rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            더 알아보기
          </Link>
          <Link
            href={`/products/${product.id}?action=buy`}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            구입하기
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
