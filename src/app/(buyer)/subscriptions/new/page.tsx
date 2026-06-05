"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Repeat,
} from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { trpc } from "@/lib/trpc/client";

export const dynamic = "force-dynamic";

type Cadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

const CADENCE_OPTIONS: Array<{ value: Cadence; label: string; desc: string }> = [
  { value: "WEEKLY", label: "매주", desc: "7일 간격" },
  { value: "BIWEEKLY", label: "격주", desc: "14일 간격" },
  { value: "MONTHLY", label: "매월", desc: "한 달 간격" },
];

function won(n: number): string {
  return `₩${n.toLocaleString()}`;
}

function resolveUnitPrice(
  product: { basePrice: number; priceTiers?: Array<{ minQty: number; price: number }> },
  qty: number,
): number {
  if (!product.priceTiers || product.priceTiers.length === 0) return product.basePrice;
  const sorted = [...product.priceTiers].sort((a, b) => b.minQty - a.minQty);
  const tier = sorted.find((t) => qty >= t.minQty);
  return tier ? tier.price : product.basePrice;
}

function calculateNextRunPreview(cadence: Cadence): string {
  const next = new Date();
  switch (cadence) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

export default function SubscriptionsNewPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <SubscriptionsNewInner />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--color-text-tertiary)]" />
      </main>
    </div>
  );
}

function SubscriptionsNewInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const productId = sp.get("productId") ?? "";

  // 상품 조회 (없으면 검색으로 안내)
  const productQuery = trpc.product.getById.useQuery(
    { id: productId },
    { enabled: !!productId, retry: false },
  );

  const [qty, setQty] = useState(1);
  const [cadence, setCadence] = useState<Cadence>("MONTHLY");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const product = productQuery.data;
  const unitPrice = useMemo(
    () =>
      product
        ? resolveUnitPrice(
            { basePrice: product.basePrice, priceTiers: product.priceTiers },
            qty,
          )
        : 0,
    [product, qty],
  );
  const totalAmount = unitPrice * qty;
  const moq = product?.moq ?? 1;

  const createMutation = trpc.subscription.create.useMutation({
    onSuccess: (data) => {
      router.push(`/subscriptions/${data.subscriptionId}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!productId) {
      setError("상품이 선택되지 않았습니다.");
      return;
    }
    if (!name || !phone || !zipcode || !address) {
      setError("배송지 정보를 모두 입력해주세요.");
      return;
    }
    if (qty < moq) {
      setError(`최소 주문 수량은 ${moq}${product?.unit ?? "EA"} 입니다.`);
      return;
    }
    createMutation.mutate({
      productId,
      cadence,
      qty,
      shippingAddress: {
        name,
        phone,
        zipcode,
        address,
        addressDetail: addressDetail || undefined,
      },
    });
  };

  if (!productId) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        <CatalogTopNav />
        <main className="mx-auto max-w-3xl px-6 py-16 md:px-12 md:py-24 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
            <Repeat className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-[-0.02em]">
            상품을 먼저 선택해주세요
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            카탈로그에서 정기구독 가능한 상품을 선택하면 이 페이지로 돌아옵니다.
          </p>
          <Link
            href="/search"
            className="mt-8 inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)]"
          >
            카탈로그 둘러보기
          </Link>
        </main>
      </div>
    );
  }

  if (productQuery.isLoading) {
    return <LoadingShell />;
  }

  if (productQuery.isError || !product) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        <CatalogTopNav />
        <main className="mx-auto max-w-3xl px-6 py-16 md:px-12 md:py-24 text-center">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            상품을 찾을 수 없습니다
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            정기구독을 시작할 상품을 다시 선택해주세요.
          </p>
          <Link
            href="/search"
            className="mt-8 inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white"
          >
            카탈로그로 이동
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-16">
        <Link
          href={`/products/${productId}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          상품 상세로 돌아가기
        </Link>

        <header className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            새 정기 주문
          </p>
          <h1 className="mt-3 break-keep text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
            구독 설정
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            주기·수량·배송지를 설정하면 다음 발주일부터 자동으로 주문됩니다.
          </p>
        </header>

        {/* Selected product */}
        <section className="mt-10 flex items-center gap-4 rounded-2xl bg-[var(--color-bg-tertiary)] p-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]">
            <Repeat className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">
              {product.name}
            </p>
            <p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">
              {product.vendorName} · {won(product.basePrice)} /{product.unit ?? "EA"}
            </p>
          </div>
        </section>

        <form onSubmit={onSubmit} className="mt-10 space-y-10">
          {/* Cadence */}
          <fieldset>
            <legend className="text-sm font-semibold tracking-tight">
              발주 주기
            </legend>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              자주 쓰는 품목이면 매주, 가끔 쓰는 품목이면 매월 추천.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {CADENCE_OPTIONS.map((opt) => {
                const selected = cadence === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setCadence(opt.value)}
                    className={`relative rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]"
                        : "border-[var(--color-border-light)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border)]"
                    }`}
                  >
                    {selected && (
                      <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-[var(--color-accent)]" />
                    )}
                    <p className="text-sm font-semibold tracking-tight">
                      {opt.label}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Qty */}
          <fieldset>
            <legend className="text-sm font-semibold tracking-tight">
              회당 수량
            </legend>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              매 발주마다 이 수량으로 자동 발주됩니다. 최소 {moq}
              {product.unit ?? "EA"}.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="inline-flex h-11 items-center rounded-full border border-[var(--color-border-light)] bg-[var(--color-bg-primary)]">
                <button
                  type="button"
                  onClick={() => setQty(Math.max(moq, qty - 1))}
                  className="grid h-11 w-11 place-items-center text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) =>
                    setQty(Math.max(moq, Math.floor(Number(e.target.value) || moq)))
                  }
                  className="w-16 bg-transparent text-center text-sm font-semibold tabular-nums focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQty(qty + 1)}
                  className="grid h-11 w-11 place-items-center text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {product.unit ?? "EA"} · 적용 단가{" "}
                <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">
                  {won(unitPrice)}
                </span>
              </p>
            </div>
          </fieldset>

          {/* Address */}
          <fieldset>
            <legend className="text-sm font-semibold tracking-tight">
              배송지
            </legend>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              매 발주마다 이 주소로 배송됩니다.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                type="text"
                placeholder="받는 사람"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                enterKeyHint="next"
                className="h-11 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-4 text-sm focus:border-[var(--color-accent)] focus:outline-none"
              />
              <input
                type="tel"
                placeholder="연락처"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                className="h-11 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-4 text-sm focus:border-[var(--color-accent)] focus:outline-none"
              />
              <input
                type="text"
                placeholder="우편번호"
                value={zipcode}
                onChange={(e) => setZipcode(e.target.value)}
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                enterKeyHint="next"
                className="h-11 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-4 text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
              />
              <input
                type="text"
                placeholder="주소"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
                enterKeyHint="next"
                className="h-11 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-4 text-sm focus:border-[var(--color-accent)] focus:outline-none"
              />
              <input
                type="text"
                placeholder="상세 주소 (선택)"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                autoComplete="address-line2"
                enterKeyHint="done"
                className="h-11 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-4 text-sm focus:border-[var(--color-accent)] focus:outline-none md:col-span-2"
              />
            </div>
          </fieldset>

          {/* Summary */}
          <section className="rounded-2xl bg-[var(--color-bg-tertiary)] p-6">
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
              발주 미리보기
            </p>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">주기</p>
                <p className="mt-1 font-semibold">
                  {CADENCE_OPTIONS.find((o) => o.value === cadence)?.label}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  다음 발주일
                </p>
                <p className="mt-1 font-semibold tabular-nums">
                  {calculateNextRunPreview(cadence)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">회당 수량</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {qty}
                  {product.unit ?? "EA"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">회당 금액</p>
                <p className="mt-1 font-semibold tabular-nums">{won(totalAmount)}</p>
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error)]/5 p-4 text-sm text-[var(--color-error)]">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-end">
            <Link
              href={`/products/${productId}`}
              className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--color-border-light)] px-6 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>정기 주문 시작</>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
