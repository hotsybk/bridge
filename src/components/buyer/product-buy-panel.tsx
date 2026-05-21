"use client";

import { useState } from "react";
import {
  Minus,
  Plus,
  Repeat,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";

/**
 * 상품 상세 우측 — 수량 + 가격 + CTA 패널 (client component).
 * 실제 카트 연동은 Phase 2 cart 작업에서. 지금은 alert mock.
 *
 * server-component 에서 Firestore Timestamp 같은 non-serializable 객체가 client 로
 * 전달되지 않도록, 필요한 plain field 만 받는 별도 타입 사용.
 */
type BuyPanelProduct = {
  id: string;
  name: string;
  basePrice: number;
  priceTiers?: Array<{ minQty: number; price: number }>;
  unit: string;
  moq: number;
  stock?: number;
  shippingFee: number;
  subscribable?: boolean;
  groupBuyable?: boolean;
};

export function ProductBuyPanel({ product }: { product: BuyPanelProduct }) {
  const [qty, setQty] = useState(product.moq);
  const [error, setError] = useState<string | null>(null);

  // 현재 수량 기준 단가 (priceTiers 적용)
  const tiers = product.priceTiers ?? [];
  const sortedTiers = [...tiers].sort((a, b) => b.minQty - a.minQty);
  const applicableTier = sortedTiers.find((t) => qty >= t.minQty);
  const unitPrice = applicableTier?.price ?? product.basePrice;
  const totalPrice = unitPrice * qty;
  const savings = (product.basePrice - unitPrice) * qty;

  const decrease = () => {
    setError(null);
    if (qty > product.moq) setQty(qty - 1);
    else setError(`최소 주문 수량은 ${product.moq}${product.unit} 입니다.`);
  };
  const increase = () => {
    setError(null);
    if (product.stock && qty + 1 > product.stock) {
      setError(`재고는 ${product.stock}${product.unit} 까지 가능합니다.`);
      return;
    }
    setQty(qty + 1);
  };
  const onChange = (v: string) => {
    setError(null);
    const n = Math.max(1, Math.floor(Number(v) || product.moq));
    setQty(n);
  };

  function onAddToCart() {
    // Phase 2 cart 작업 전 — alert mock
    alert(
      `장바구니에 담겼습니다 (mock)\n\n${product.name}\n수량: ${qty} ${product.unit}\n합계: ₩${totalPrice.toLocaleString()}\n\n* 실제 장바구니 연동은 Phase 2 에서 진행됩니다.`,
    );
  }

  function onBuyNow() {
    alert(
      `바로 구매 (mock)\n\n${product.name}\n수량: ${qty} ${product.unit}\n합계: ₩${totalPrice.toLocaleString()}\n\n* 실제 결제는 Phase 2 에서 진행됩니다.`,
    );
  }

  return (
    <div className="space-y-6">
      {/* 가격 영역 */}
      <div>
        {tiers.length > 0 && unitPrice < product.basePrice && (
          <p className="text-sm">
            <span className="text-[var(--color-text-tertiary)] line-through">
              ₩{product.basePrice.toLocaleString()}
            </span>
            <span className="ml-2 inline-flex items-center rounded-full bg-[var(--color-success)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]">
              -{Math.round(((product.basePrice - unitPrice) / product.basePrice) * 100)}%
            </span>
          </p>
        )}
        <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">
          ₩{unitPrice.toLocaleString()}
          <span className="ml-2 text-base font-normal text-[var(--color-text-tertiary)]">
            / {product.unit}
          </span>
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          부가세 별도 · 배송비{" "}
          {product.shippingFee === 0
            ? "무료"
            : `₩${product.shippingFee.toLocaleString()}`}
        </p>
      </div>

      {/* 가격 티어 표 (있을 때만) */}
      {tiers.length > 0 && (
        <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            수량별 단가
          </p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              <tr className="border-b border-[var(--color-border-light)]">
                <td className="py-1.5 text-[var(--color-text-secondary)]">
                  {product.moq}~
                </td>
                <td className="py-1.5 text-right font-medium tabular-nums">
                  ₩{product.basePrice.toLocaleString()}
                </td>
              </tr>
              {tiers.map((t) => (
                <tr
                  key={t.minQty}
                  className="border-b border-[var(--color-border-light)] last:border-0"
                >
                  <td className="py-1.5 text-[var(--color-text-secondary)]">
                    {t.minQty}~
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums text-[var(--color-accent)]">
                    ₩{t.price.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 수량 선택 */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          수량
        </label>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center rounded-full border border-[var(--color-border-default)]">
            <button
              type="button"
              onClick={decrease}
              className="grid h-10 w-10 place-items-center rounded-l-full hover:bg-[var(--color-bg-secondary)]"
              aria-label="수량 감소"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              min={product.moq}
              max={product.stock}
              value={qty}
              onChange={(e) => onChange(e.target.value)}
              className="h-10 w-16 border-x border-[var(--color-border-default)] bg-transparent text-center text-sm font-medium tabular-nums focus:outline-none"
            />
            <button
              type="button"
              onClick={increase}
              className="grid h-10 w-10 place-items-center rounded-r-full hover:bg-[var(--color-bg-secondary)]"
              aria-label="수량 증가"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            최소 {product.moq} {product.unit} · 단위 {product.unit}
          </span>
        </div>

        {error && (
          <p className="mt-2 text-xs text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}

        {/* 총 합계 */}
        <div className="mt-4 flex items-baseline justify-between rounded-xl bg-[var(--color-bg-secondary)] px-4 py-3">
          <span className="text-sm text-[var(--color-text-secondary)]">
            합계 ({qty} {product.unit})
          </span>
          <span className="text-2xl font-semibold tabular-nums">
            ₩{totalPrice.toLocaleString()}
          </span>
        </div>
        {savings > 0 && (
          <p className="mt-1.5 text-right text-xs text-[var(--color-success)]">
            ₩{savings.toLocaleString()} 절약
          </p>
        )}
      </div>

      {/* CTA 버튼 */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={onBuyNow}
          className="landing-cta-glow inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-base font-semibold text-white"
        >
          바로 구매
        </button>
        <button
          type="button"
          onClick={onAddToCart}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-6 text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
        >
          <ShoppingCart className="h-4 w-4" />
          장바구니에 담기
        </button>

        {/* 보조 옵션 */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {product.subscribable && (
            <button
              type="button"
              onClick={() =>
                alert(
                  `정기 주문 등록 (mock)\n\n${product.name} · ${qty}${product.unit}\n매달 자동 발주\n\n* Phase 3 정기구독에서 정식 출시`,
                )
              }
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--color-success)]/12 text-sm font-medium text-[var(--color-success)] transition-colors hover:bg-[var(--color-success)]/20"
            >
              <Repeat className="h-3.5 w-3.5" />
              정기 주문
            </button>
          )}
          {product.groupBuyable && (
            <button
              type="button"
              onClick={() =>
                alert(
                  `공동구매 참여 (mock)\n\n${product.name}\n현재 진행 중인 공동구매에 참여합니다.\n\n* Phase 4 공동구매에서 정식 출시`,
                )
              }
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent-light)] text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-light)]/70"
            >
              <Users className="h-3.5 w-3.5" />
              공동구매
            </button>
          )}
        </div>

        <p className="mt-3 flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
          <Sparkles className="h-3 w-3" />
          Phase 1 베타 — 실 결제·실 거래 진행되지 않습니다
        </p>
      </div>
    </div>
  );
}
