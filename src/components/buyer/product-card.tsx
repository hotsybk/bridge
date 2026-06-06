import Image from "next/image";
import Link from "next/link";
import { Package, Repeat, Users } from "lucide-react";

import type { Product } from "@/lib/types";

const DEVICE_CLASS_LABEL: Record<string, string> = {
  CLASS_1: "1등급",
  CLASS_2: "2등급",
  CLASS_3: "3등급",
  CLASS_4: "4등급",
  NON_DEVICE: "비의료기기",
};

const DEVICE_CLASS_TONE: Record<string, string> = {
  CLASS_1: "text-[var(--color-class-1)]",
  CLASS_2: "text-[var(--color-class-2)]",
  CLASS_3: "text-[var(--color-class-3)]",
  CLASS_4: "text-[var(--color-class-4)]",
  NON_DEVICE: "text-[var(--color-text-secondary)]",
};

/**
 * Wave 2 — 밀도(density) 카드. 쿠팡/네이버 스마트스토어 스타일.
 *
 * 이전(Apple 스타일) 대비 변경:
 *  - 회색 박스 배경 제거 → 흰 배경 + 이미지만 회색 placeholder
 *  - 가격 text-2xl/3xl → text-base (대폭 축소)
 *  - padding 축소(p-5 → pt-3), 정보 영역 좌우 패딩 0
 *  - 등급 배지는 이미지 좌상단 흰 글래스로 최소화, 거래 배지는 작은 칩
 *  - 6열 그리드에서도 깔끔하게 보이도록 컴팩트
 */
export function ProductCard({ product }: { product: Product }) {
  const lowestTier = product.priceTiers?.length
    ? Math.min(...product.priceTiers.map((t) => t.price))
    : null;
  const hasTier = lowestTier !== null && lowestTier < product.basePrice;
  const displayPrice = hasTier ? lowestTier! : product.basePrice;

  const classLabel = DEVICE_CLASS_LABEL[product.deviceClass];
  const classTone =
    DEVICE_CLASS_TONE[product.deviceClass] ?? "text-[var(--color-text-secondary)]";

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex h-full flex-col transition-transform duration-300 hover:-translate-y-0.5"
    >
      {/* 이미지 — 회색 placeholder, 얇은 라인 */}
      <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-tertiary)]">
        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package
              className="h-8 w-8 text-[var(--color-text-tertiary)]"
              strokeWidth={1.25}
              aria-hidden
            />
          </div>
        )}

        {/* 좌상단 — 등급 배지 (흰 글래스 + 컬러 텍스트, 최소화) */}
        {classLabel && (
          <span
            className={`absolute left-2 top-2 inline-flex items-center rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm ${classTone}`}
          >
            {classLabel}
          </span>
        )}
      </div>

      {/* 본문 — 좌우 패딩 0, 위 패딩만 */}
      <div className="flex flex-1 flex-col pt-2.5">
        {/* 카테고리/진료과 (선택) */}
        <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
          {product.categoryPath?.[product.categoryPath.length - 1] ?? "—"}
        </p>

        {/* 상품명 — T4 */}
        <h3 className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug">
          {product.name}
        </h3>

        {/* vendor */}
        <p className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">
          {product.vendorName}
        </p>

        {/* 가격 — T4 강조, text-base */}
        <div className="mt-1.5">
          <p className="text-base font-semibold tabular-nums leading-none">
            {hasTier && (
              <span className="mr-0.5 text-[11px] font-normal text-[var(--color-text-tertiary)]">
                최저
              </span>
            )}
            ₩{displayPrice.toLocaleString()}
            <span className="ml-0.5 text-[11px] font-normal text-[var(--color-text-tertiary)]">
              /{product.unit}
            </span>
          </p>
        </div>

        {/* 거래 배지 — 작은 칩, 있을 때만 */}
        {(product.groupBuyable || product.subscribable) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {product.groupBuyable && (
              <span className="inline-flex items-center gap-0.5 rounded bg-[var(--color-accent-light)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                <Users className="h-2.5 w-2.5" aria-hidden />
                공동구매
              </span>
            )}
            {product.subscribable && (
              <span className="inline-flex items-center gap-0.5 rounded bg-[var(--color-success)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-success)]">
                <Repeat className="h-2.5 w-2.5" aria-hidden />
                정기구독
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
