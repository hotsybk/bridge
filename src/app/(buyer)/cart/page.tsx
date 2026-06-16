"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { CountUp } from "@/components/shared/count-up";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { calculateShippingTotal } from "@/lib/constants/shipping";
import { trpc } from "@/lib/trpc/client";

/**
 * 장바구니 페이지 — Wave Q1 풀 연동 (tRPC).
 *
 * 디자인:
 *  - CatalogTopNav 재사용
 *  - 멀티벤더 그룹핑
 *  - 좌 2/3: 벤더별 카트 그룹 / 우 1/3: sticky 합계 패널 (lg+)
 *
 * 데이터:
 *  - cart.get (query) — 카트 조회. 비로그인 시 빈 카트 반환 (PREVIEW)
 *  - cart.updateQty / cart.remove / cart.applyCoupon / cart.removeCoupon (mutation)
 */

type CartItem = {
  productId: string;
  vendorId: string;
  vendorName: string;
  productName: string;
  thumbnail?: string | null;
  unitPrice: number;
  qty: number;
  amount: number;
  unit: string;
  moq?: number;
};

const UNIT_LABEL: Record<string, string> = {
  BOX: "박스",
  EA: "개",
  KG: "kg",
  L: "L",
  ML: "ml",
  PACK: "팩",
  SET: "세트",
};
function unit(u: string): string {
  return UNIT_LABEL[u] ?? u;
}

const FEE_RATE = 0.05;
const REMOVE_ANIM_MS = 380;

export default function CartPage() {
  const cartQuery = trpc.cart.get.useQuery(undefined, {
    retry: false,
  });

  const utils = trpc.useUtils();
  const refetchCart = () => utils.cart.get.invalidate();

  const updateQtyMutation = trpc.cart.updateQty.useMutation({
    onSuccess: refetchCart,
  });
  const removeMutation = trpc.cart.remove.useMutation({
    onSuccess: refetchCart,
  });
  const applyCouponMutation = trpc.cart.applyCoupon.useMutation({
    onSuccess: refetchCart,
  });
  const removeCouponMutation = trpc.cart.removeCoupon.useMutation({
    onSuccess: refetchCart,
  });

  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);

  const items: CartItem[] = useMemo(
    () => (cartQuery.data?.items as CartItem[]) ?? [],
    [cartQuery.data],
  );
  const couponCode = cartQuery.data?.couponCode ?? null;

  const itemsByVendor = useMemo(() => groupByVendor(items), [items]);
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.amount, 0),
    [items],
  );
  const shipping = calculateShippingTotal(items.map((i) => i.vendorId));
  const fee = Math.round(subtotal * FEE_RATE);
  const total = subtotal + shipping;
  const isEmpty = items.length === 0;
  const isLoading = cartQuery.isLoading;

  function handleQty(productId: string, delta: number, currentQty: number, moq: number) {
    const next = Math.max(moq, currentQty + delta);
    if (next === currentQty) return;
    updateQtyMutation.mutate({ productId, qty: next });
  }

  function handleRemove(productId: string) {
    if (removingIds.has(productId)) return;
    setRemovingIds((prev) => new Set(prev).add(productId));
    window.setTimeout(() => {
      removeMutation.mutate(
        { productId },
        {
          onSettled: () => {
            setRemovingIds((prev) => {
              const next = new Set(prev);
              next.delete(productId);
              return next;
            });
          },
        },
      );
    }, REMOVE_ANIM_MS);
  }

  function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponError(null);
    if (!couponInput.trim()) return;
    applyCouponMutation.mutate(
      { code: couponInput.trim() },
      {
        onSuccess: () => {
          setCouponInput("");
        },
        onError: (err) => {
          setCouponError(err.message);
        },
      },
    );
  }

  function handleRemoveCoupon() {
    removeCouponMutation.mutate();
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main
        id="main-content"
        className="mx-auto max-w-7xl px-6 py-16 pb-32 md:px-12 md:py-24 md:pb-24"
      >
        {/* Header */}
        <div className="border-b border-[var(--color-border-light)] pb-10">
          <PageHeader label="주문 · 장바구니" title="장바구니">
            {!isEmpty && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                상품{" "}
                <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">
                  {items.length}
                </span>
                개 · 공급업체{" "}
                <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">
                  {Object.keys(itemsByVendor).length}
                </span>
                곳
              </p>
            )}
          </PageHeader>
        </div>

        {isLoading ? (
          <CartSkeleton />
        ) : isEmpty ? (
          <EmptyCart />
        ) : (
          <div className="mt-12 grid gap-16 lg:grid-cols-[1fr_340px] lg:gap-20">
            {/* Left — 벤더별 그룹 */}
            <div className="space-y-14">
              {Object.entries(itemsByVendor).map(([vendorId, vendorItems]) => (
                <VendorGroup
                  key={vendorId}
                  vendorName={vendorItems[0].vendorName}
                  items={vendorItems}
                  removingIds={removingIds}
                  onQty={handleQty}
                  onRemove={handleRemove}
                />
              ))}
            </div>

            {/* Right — sticky 결제 패널 */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <SummaryCard
                subtotal={subtotal}
                shipping={shipping}
                fee={fee}
                total={total}
                couponCode={couponCode}
                couponInput={couponInput}
                onCouponInputChange={setCouponInput}
                onApplyCoupon={handleApplyCoupon}
                onRemoveCoupon={handleRemoveCoupon}
                couponLoading={applyCouponMutation.isPending}
                couponError={couponError}
              />
            </aside>
          </div>
        )}
      </main>

      {/* Phase ξ-1 — 모바일 sticky 결제 CTA (bottom tab bar 위) */}
      {!isLoading && !isEmpty && (
        <div
          className="fixed inset-x-0 bottom-14 z-20 border-t border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/95 backdrop-blur-md md:hidden"
          style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                결제 예정
              </p>
              <p className="text-base font-semibold tabular-nums tracking-tight">
                ₩{total.toLocaleString()}
              </p>
            </div>
            <Link
              href="/checkout"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              결제하기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub components
// ─────────────────────────────────────────────────────────────

function VendorGroup({
  vendorName,
  items,
  removingIds,
  onQty,
  onRemove,
}: {
  vendorName: string;
  items: CartItem[];
  removingIds: Set<string>;
  onQty: (productId: string, delta: number, currentQty: number, moq: number) => void;
  onRemove: (productId: string) => void;
}) {
  const vendorSubtotal = items
    .filter((i) => !removingIds.has(i.productId))
    .reduce((s, i) => s + i.amount, 0);
  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-3 pb-5">
        <div className="flex items-center gap-2.5">
          <Building2 className="h-4 w-4 text-[var(--color-accent)]" />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              공급업체
            </p>
            <p className="mt-0.5 text-sm font-semibold tracking-tight">
              {vendorName}
            </p>
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          소계{" "}
          <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
            ₩<CountUp value={vendorSubtotal} duration={500} />
          </span>
        </p>
      </header>

      <ul className="border-t border-[var(--color-border-light)]">
        {items.map((item) => (
          <CartRow
            key={item.productId}
            item={item}
            removing={removingIds.has(item.productId)}
            onQty={onQty}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  );
}

function CartRow({
  item,
  removing,
  onQty,
  onRemove,
}: {
  item: CartItem;
  removing: boolean;
  onQty: (productId: string, delta: number, currentQty: number, moq: number) => void;
  onRemove: (productId: string) => void;
}) {
  const line = item.amount;
  const moq = item.moq ?? 1;
  return (
    <li
      className={`group flex gap-5 border-b border-[var(--color-border-light)] py-6 md:gap-6 md:py-8 ${removing ? "cart-row-removing" : ""}`}
      style={
        {
          "--row-pt": "1.5rem",
          "--row-pb": "1.5rem",
        } as React.CSSProperties
      }
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-border-light)] md:h-24 md:w-24">
        {item.thumbnail ? (
          <Image
            src={item.thumbnail}
            alt={item.productName}
            fill
            sizes="(min-width: 768px) 96px, 80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg-secondary)]/40 text-[var(--color-text-tertiary)]">
            <Package className="h-7 w-7" strokeWidth={1.25} />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/products/${item.productId}`}
              className="text-sm font-semibold tracking-tight transition-colors hover:text-[var(--color-accent)]"
            >
              {item.productName}
            </Link>
            <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)] tabular-nums">
              ₩{item.unitPrice.toLocaleString()} / {unit(item.unit)} · 최소{" "}
              {moq}
              {unit(item.unit)}
            </p>
          </div>
          <button
            type="button"
            aria-label={`${item.productName} 삭제`}
            onClick={() => onRemove(item.productId)}
            disabled={removing}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--color-text-tertiary)] transition-opacity hover:text-[var(--color-error)] disabled:opacity-50 md:h-9 md:w-9 md:opacity-60 md:group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <QtyStepper
            qty={item.qty}
            unit={item.unit}
            canDecrement={item.qty > moq}
            onMinus={() => onQty(item.productId, -1, item.qty, moq)}
            onPlus={() => onQty(item.productId, 1, item.qty, moq)}
          />
          <p className="text-sm font-semibold tabular-nums tracking-tight">
            ₩
            <CountUp value={line} duration={420} />
          </p>
        </div>
      </div>
    </li>
  );
}

function QtyStepper({
  qty,
  unit: u,
  canDecrement,
  onMinus,
  onPlus,
}: {
  qty: number;
  unit: string;
  canDecrement: boolean;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label="감소"
        disabled={!canDecrement}
        onClick={onMinus}
        className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-border-light)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:hover:border-[var(--color-border-light)] disabled:hover:text-[var(--color-text-secondary)] md:h-9 md:w-9"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[2.75rem] text-center text-sm font-medium tabular-nums">
        {qty}
        <span className="ml-0.5 text-[11px] font-normal text-[var(--color-text-tertiary)]">
          {unit(u)}
        </span>
      </span>
      <button
        type="button"
        aria-label="증가"
        onClick={onPlus}
        className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-border-light)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] md:h-9 md:w-9"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SummaryCard({
  subtotal,
  shipping,
  fee,
  total,
  couponCode,
  couponInput,
  onCouponInputChange,
  onApplyCoupon,
  onRemoveCoupon,
  couponLoading,
  couponError,
}: {
  subtotal: number;
  shipping: number;
  fee: number;
  total: number;
  couponCode: string | null;
  couponInput: string;
  onCouponInputChange: (v: string) => void;
  onApplyCoupon: (e: React.FormEvent) => void;
  onRemoveCoupon: () => void;
  couponLoading: boolean;
  couponError: string | null;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        주문 요약
      </p>

      <dl className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        <Row label="상품 합계" value={subtotal} />
        <Row label="배송비" sublabel="공급업체별" value={shipping} />
        <Row
          label="플랫폼 수수료"
          valueText="구매자 부담 없음"
          hint={`공급업체 ₩${fee.toLocaleString()} (5%)`}
        />
      </dl>

      {/* 쿠폰 */}
      <div className="mt-6">
        {couponCode ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-accent-light)]/30 px-4 py-3">
            <p className="flex items-center gap-2 text-xs">
              <Tag className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span className="font-mono font-semibold tracking-tight text-[var(--color-accent)]">
                {couponCode}
              </span>
              <span className="text-[var(--color-text-tertiary)]">
                적용됨
              </span>
            </p>
            <button
              type="button"
              onClick={onRemoveCoupon}
              aria-label="쿠폰 제거"
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={onApplyCoupon} className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              쿠폰 코드
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => onCouponInputChange(e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                className="flex-1 rounded-full border border-[var(--color-border-light)] bg-transparent px-4 py-2 font-mono text-xs tracking-tight focus:border-[var(--color-accent)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={couponLoading || !couponInput.trim()}
                className="inline-flex items-center justify-center rounded-full bg-[var(--color-text-primary)] px-4 text-xs font-medium text-white transition-colors hover:bg-[var(--color-text-secondary)] disabled:opacity-50"
              >
                {couponLoading ? "적용 중" : "적용"}
              </button>
            </div>
            {couponError && (
              <p className="text-[11px] text-[var(--color-error)]" role="alert">
                {couponError}
              </p>
            )}
          </form>
        )}
      </div>

      {/* 결제 예정 */}
      <div className="mt-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          결제 예정
        </p>
        <p className="mt-2 text-4xl font-semibold tracking-[-0.03em] tabular-nums md:text-5xl">
          ₩<CountUp value={total} duration={500} />
        </p>
      </div>

      <Link
        href="/checkout"
        className="mt-10 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
      >
        결제하기
        <ArrowRight className="h-4 w-4" />
      </Link>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
        베타 — 결제는 테스트 모드로 처리됩니다.
      </p>
    </div>
  );
}

function Row({
  label,
  sublabel,
  value,
  valueText,
  hint,
}: {
  label: string;
  sublabel?: string;
  value?: number;
  valueText?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3.5 text-sm">
      <dt>
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        {sublabel && (
          <span className="ml-1.5 text-[11px] text-[var(--color-text-tertiary)]">
            {sublabel}
          </span>
        )}
      </dt>
      <dd className="text-right">
        <span className="font-medium tabular-nums text-[var(--color-text-primary)]">
          {valueText ? (
            valueText
          ) : (
            <>
              ₩<CountUp value={value ?? 0} duration={500} />
            </>
          )}
        </span>
        {hint && (
          <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
            {hint}
          </p>
        )}
      </dd>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="mt-12">
      <EmptyState
        icon={ShoppingBag}
        title="장바구니가 비어 있습니다"
        description="카탈로그에서 의료기기·소모품을 담아보세요."
        action={
          <Link
            href="/search"
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            카탈로그 둘러보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="mt-12 grid gap-16 lg:grid-cols-[1fr_340px] lg:gap-20">
      <div className="space-y-8">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-6">
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
            <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" />
            <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" />
      </div>
    </div>
  );
}

function groupByVendor(items: CartItem[]): Record<string, CartItem[]> {
  const groups: Record<string, CartItem[]> = {};
  for (const item of items) {
    if (!groups[item.vendorId]) groups[item.vendorId] = [];
    groups[item.vendorId].push(item);
  }
  return groups;
}
