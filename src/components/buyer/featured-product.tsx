import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";

import type { Product } from "@/lib/types";

/**
 * Apple "Apple Watch" 큰 헤드라인 + 3 카드 패턴.
 *
 * 리뉴얼 (2026-05-21):
 * - 중첩 박스 제거 — 카드 회색 배경 위에 이미지 직접 (둥근 모서리)
 * - 등급 dots 만 유지, inline 라벨 제거. 등급 배지는 이미지 좌상단 absolute.
 * - 설명·MOQ 표시 제거 (정보 피로 감소).
 * - 카테고리·공급업체 한 줄 메타 + 제품명 + 가격 + 2 CTA 구성.
 */

const DEVICE_CLASS_COLORS: Record<string, string> = {
  CLASS_1: "bg-[var(--color-class-1)]",
  CLASS_2: "bg-[var(--color-class-2)]",
  CLASS_3: "bg-[var(--color-class-3)]",
  CLASS_4: "bg-[var(--color-class-4)]",
  NON_DEVICE: "bg-[var(--color-text-tertiary)]",
};

const DEVICE_CLASS_TEXT: Record<string, string> = {
  CLASS_1: "text-[var(--color-class-1)]",
  CLASS_2: "text-[var(--color-class-2)]",
  CLASS_3: "text-[var(--color-class-3)]",
  CLASS_4: "text-[var(--color-class-4)]",
  NON_DEVICE: "text-[var(--color-text-secondary)]",
};

function classLabel(classKey: string): string {
  if (classKey === "NON_DEVICE") return "비의료기기";
  const n = classKey.replace("CLASS_", "");
  return `${n}등급`;
}

export function FeaturedProductSection({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section id="featured">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            이번 주 가장 많이 담긴
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            인기 상품.
          </h2>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] md:text-sm">
          전국 병원이 지금 주문하는 의료 용품
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
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

  const classKey = product.deviceClass;
  const classTextColor =
    DEVICE_CLASS_TEXT[classKey] ?? "text-[var(--color-text-secondary)]";

  // 시드에 만료된 Unsplash URL 이 있으면 thumbnail 자체를 무효 처리 → 컴포넌트 fallback 표시
  const usableThumbnail =
    product.thumbnail && !BROKEN_UNSPLASH.has(extractUnsplashId(product.thumbnail))
      ? product.thumbnail
      : null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl bg-[var(--color-bg-tertiary)] transition-colors duration-300">
      {/* 이미지 영역 — 카드 상단 edge-to-edge. 패딩 없이 풀너비. */}
      <Link
        href={`/products/${product.id}`}
        className="group relative block aspect-square overflow-hidden bg-[var(--color-bg-secondary)]"
      >
        {/* 등급 배지 — 좌상단 absolute. 흰색 글래스 + 컬러 텍스트 */}
        <span
          className={`absolute left-4 top-4 z-10 inline-flex h-6 items-center rounded-full bg-white/90 px-2.5 text-[10px] font-medium shadow-sm backdrop-blur-sm ${classTextColor}`}
        >
          {classLabel(classKey)}
        </span>

        {usableThumbnail ? (
          <Image
            src={usableThumbnail}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          // 깨진 URL · 누락 시 — 깔끔한 inline SVG fallback (외부 placeholder 서비스 의존 X)
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[var(--color-accent-light)] to-[var(--color-bg-secondary)] text-[var(--color-accent)]">
            <Package className="h-14 w-14 opacity-40" strokeWidth={1.25} aria-hidden />
            <span className="px-4 text-center text-xs font-medium opacity-60">
              {product.name}
            </span>
          </div>
        )}
      </Link>

      {/* 하단 콘텐츠 — 패딩 적용 */}
      <div className="flex flex-1 flex-col p-6 md:p-8">
        {/* Color dots — 의료기기 등급 시각화 */}
        <div className="flex items-center gap-2" aria-hidden>
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
        </div>

        {/* 제품 정보 */}
        <div className="mt-4 flex flex-1 flex-col">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {product.categoryPath?.[product.categoryPath.length - 1] ?? "—"} ·{" "}
            {product.vendorName}
          </p>
          <h3 className="mt-1.5 text-sm font-semibold tracking-tight">
            {product.name}
          </h3>

          <p className="mt-5 text-2xl font-semibold tabular-nums md:text-3xl">
            ₩{displayPrice.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-[var(--color-text-tertiary)]">
              부터 / {product.unit}
            </span>
          </p>

          {/* CTA */}
          <div className="mt-6 flex items-center gap-4">
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
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// Unsplash 404 회피 — 시드 데이터의 일부 URL 이 만료된 경우 placeholder 로 대체
// ─────────────────────────────────────────────────────────────

const BROKEN_UNSPLASH = new Set<string>([
  "photo-1666214280165-c3e7c9b6f7a4", // 청진기
  "photo-1632053002434-c7c30b6f3236", // 주사기
  "photo-1583912267550-bb6e1c7c4baa", // 장갑·알코올 1L
]);

function extractUnsplashId(url: string): string {
  const m = url.match(/images\.unsplash\.com\/(photo-[a-z0-9-]+)/i);
  return m ? m[1] : "";
}
