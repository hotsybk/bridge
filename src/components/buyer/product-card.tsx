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
  CLASS_1: "bg-[var(--color-class-1)]/15 text-[var(--color-class-1)]",
  CLASS_2: "bg-[var(--color-class-2)]/15 text-[var(--color-class-2)]",
  CLASS_3: "bg-[var(--color-class-3)]/15 text-[var(--color-class-3)]",
  CLASS_4: "bg-[var(--color-class-4)]/15 text-[var(--color-class-4)]",
  NON_DEVICE: "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
};

/**
 * 그리드용 상품 카드 (Apple 스타일 — 회색 배경 카드, 그림자 거의 X).
 */
export function ProductCard({ product }: { product: Product }) {
  const lowestTier = product.priceTiers?.length
    ? Math.min(...product.priceTiers.map((t) => t.price))
    : null;
  const hasTier = lowestTier !== null && lowestTier < product.basePrice;
  const displayPrice = hasTier ? lowestTier! : product.basePrice;

  const classLabel = DEVICE_CLASS_LABEL[product.deviceClass];
  const classTone = DEVICE_CLASS_TONE[product.deviceClass];

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--color-bg-tertiary)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]"
    >
      {/* 이미지 */}
      <div className="relative aspect-square overflow-hidden bg-[var(--color-bg-primary)]">
        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
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

        {/* 우상단 — 거래 배지 */}
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
      <div className="flex flex-1 flex-col p-5">
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
          <p className="text-2xl font-semibold tabular-nums md:text-3xl">
            {hasTier && (
              <span className="text-xs font-normal text-[var(--color-text-secondary)]">
                from{" "}
              </span>
            )}
            ₩{displayPrice.toLocaleString()}
            <span className="ml-0.5 text-xs font-normal text-[var(--color-text-tertiary)]">
              / {product.unit}
            </span>
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
            최소 주문 {product.moq} {product.unit}
          </p>
        </div>
      </div>
    </Link>
  );
}
