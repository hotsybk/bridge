"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  FileText,
  ShieldCheck,
} from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { calculateShippingTotal } from "@/lib/constants/shipping";
import { trackCheckoutStart } from "@/lib/posthog/events";
import { trpc } from "@/lib/trpc/client";

/**
 * /checkout — Wave Q1 + Phase β-1.
 *
 * 두 가지 흐름 자동 분기 — NEXT_PUBLIC_PORTONE_STORE_ID 환경변수 존재 여부로 결정.
 *
 * [Mock 모드] PORTONE_STORE_ID 미설정 (dev / preview)
 *  - cart.get → 사용자 입력 → order.createOrder → 자동 PAID → /checkout/complete
 *
 * [실결제 모드] PORTONE_STORE_ID 설정 시 (production / 통합 테스트)
 *  - cart.get → 사용자 입력
 *  - 결제하기 → order.prepareOrder (paymentId 발급 + draft order PENDING_PAYMENT)
 *  - PortOne.requestPayment(SDK) → 결제창
 *  - 결제 완료 → order.confirmOrder (서버측 getPayment 검증 → PAID 전환)
 *  - 실패 시 /checkout/fail?code=...&message=...
 */

type CartItem = {
  productId: string;
  vendorId: string;
  vendorName: string;
  productName: string;
  unitPrice: number;
  qty: number;
  amount: number;
  unit: string;
};

const PAY_METHODS = [
  {
    id: "CARD" as const,
    icon: CreditCard,
    label: "신용·체크카드",
    desc: "삼성·국민·신한 등 모든 카드",
  },
  {
    id: "BANK_TRANSFER" as const,
    icon: FileText,
    label: "세금계산서 (계좌 입금)",
    desc: "발행 즉시 가상계좌 발급",
  },
] as const;
type PayMethodId = (typeof PAY_METHODS)[number]["id"];

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

// 실 PortOne 활성화 여부 — NEXT_PUBLIC_PORTONE_STORE_ID 존재 시 SDK 흐름.
const PORTONE_STORE_ID =
  process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "";
const PORTONE_CHANNEL_KEY =
  process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAO ??
  process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSS ??
  "";
const USE_REAL_PORTONE = !!(PORTONE_STORE_ID && PORTONE_CHANNEL_KEY);

export default function CheckoutPage() {
  const router = useRouter();
  const cartQuery = trpc.cart.get.useQuery(undefined, { retry: false });

  const [payMethod, setPayMethod] = useState<PayMethodId>("CARD");
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [buyerNote, setBuyerNote] = useState("");
  const [invoiceRequested, setInvoiceRequested] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [portoneLoading, setPortoneLoading] = useState(false);

  const createOrderMutation = trpc.order.createOrder.useMutation({
    onSuccess: (data) => {
      router.push(
        `/checkout/complete?orderId=${data.orderId}&orderNo=${encodeURIComponent(data.orderNo)}`,
      );
    },
    onError: (err) => {
      setSubmitError(err.message);
    },
  });

  const prepareOrderMutation = trpc.order.prepareOrder.useMutation();
  const confirmOrderMutation = trpc.order.confirmOrder.useMutation();

  const items: CartItem[] = (cartQuery.data?.items as CartItem[]) ?? [];
  const isEmpty = items.length === 0;
  const couponCode = cartQuery.data?.couponCode ?? null;

  // Phase ν-2 — PostHog checkout_start (한 번만, 카트 로드 후).
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    if (isEmpty || !cartQuery.data) return;
    trackedRef.current = true;
    const vendors = new Set(items.map((i) => i.vendorId));
    trackCheckoutStart({
      itemCount: items.length,
      itemsTotal: items.reduce((s, i) => s + i.amount, 0),
      vendorCount: vendors.size,
    });
  }, [cartQuery.data, isEmpty, items]);

  // vendor 별 그룹
  const vendorOrders = (() => {
    const byVendor = new Map<string, { vendorName: string; items: CartItem[] }>();
    for (const item of items) {
      const existing = byVendor.get(item.vendorId);
      if (existing) existing.items.push(item);
      else byVendor.set(item.vendorId, { vendorName: item.vendorName, items: [item] });
    }
    return Array.from(byVendor.values()).map((g) => ({
      vendorName: g.vendorName,
      items: g.items,
      subtotal: g.items.reduce((s, i) => s + i.amount, 0),
    }));
  })();

  const itemsTotal = items.reduce((s, i) => s + i.amount, 0);
  const shippingTotal = calculateShippingTotal(items.map((i) => i.vendorId));
  const grandTotal = itemsTotal + shippingTotal;

  const formValid =
    recipient.trim().length > 0 &&
    phone.trim().length > 0 &&
    zipcode.trim().length > 0 &&
    address.trim().length > 0;

  async function handleSubmit() {
    setSubmitError(null);
    if (!formValid) {
      setSubmitError("배송지 정보를 모두 입력해주세요.");
      return;
    }
    if (isEmpty) {
      setSubmitError("카트가 비어있습니다.");
      return;
    }

    const shippingAddress = {
      name: recipient.trim(),
      phone: phone.trim(),
      zipcode: zipcode.trim(),
      address: address.trim(),
      addressDetail: addressDetail.trim() || undefined,
    };

    // [Mock 모드] PortOne 환경변수 없으면 기존 createOrder 흐름
    if (!USE_REAL_PORTONE) {
      await createOrderMutation.mutateAsync({
        shippingAddress,
        paymentMethod: payMethod,
        buyerNote: buyerNote.trim() || undefined,
        invoiceRequested,
      });
      return;
    }

    // [실결제 모드] prepareOrder → PortOne SDK → confirmOrder
    setPortoneLoading(true);
    try {
      // 1) 서버에서 paymentId / orderId 발급 + draft order 생성
      const prep = await prepareOrderMutation.mutateAsync({
        shippingAddress,
        paymentMethod: payMethod,
        buyerNote: buyerNote.trim() || undefined,
        invoiceRequested,
      });

      // 2) PortOne 브라우저 SDK 호출
      const PortOne = await import("@portone/browser-sdk/v2");
      const portoneResponse = await PortOne.requestPayment({
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY,
        paymentId: prep.paymentId,
        orderName: prep.orderName,
        totalAmount: prep.finalAmount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: {
          fullName: prep.buyerName,
          phoneNumber: phone.trim(),
        },
      });

      // 3) 결제 실패 또는 사용자 취소
      if (portoneResponse && "code" in portoneResponse && portoneResponse.code !== undefined) {
        router.push(
          `/checkout/fail?code=${encodeURIComponent(String(portoneResponse.code))}&message=${encodeURIComponent(portoneResponse.message ?? "")}&orderId=${prep.orderId}`,
        );
        return;
      }

      // 4) 서버측 confirm (위변조 검증 + PAID 전환)
      const conf = await confirmOrderMutation.mutateAsync({
        paymentId: prep.paymentId,
        orderId: prep.orderId,
      });

      router.push(
        `/checkout/complete?orderId=${conf.orderId}&orderNo=${encodeURIComponent(conf.orderNo)}`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "결제 처리 중 오류가 발생했습니다.";
      setSubmitError(message);
    } finally {
      setPortoneLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main className="mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-24">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          장바구니로
        </Link>

        <div className="mt-6 border-b border-[var(--color-border-light)] pb-10">
          <PageHeader label="주문 · 결제" title="결제" />
        </div>

        <CheckoutSteps current={2} />

        {cartQuery.isLoading ? (
          <CheckoutSkeleton />
        ) : isEmpty ? (
          <EmptyCheckout />
        ) : (
          <div className="mt-16 grid gap-16 lg:grid-cols-[1fr_340px] lg:gap-20">
            {/* Left */}
            <div className="space-y-16">
              {/* 1. 배송지 입력 */}
              <Section num="01" title="배송지">
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <LabeledInput
                      label="받는 사람"
                      value={recipient}
                      onChange={setRecipient}
                      placeholder="홍길동"
                      autoComplete="name"
                      required
                    />
                    <LabeledInput
                      label="연락처"
                      value={phone}
                      onChange={setPhone}
                      placeholder="010-0000-0000"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                    <LabeledInput
                      label="우편번호"
                      value={zipcode}
                      onChange={setZipcode}
                      placeholder="06234"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      required
                    />
                    <LabeledInput
                      label="주소"
                      value={address}
                      onChange={setAddress}
                      placeholder="서울특별시 강남구 테헤란로 123"
                      autoComplete="street-address"
                      required
                    />
                  </div>
                  <LabeledInput
                    label="상세 주소 (선택)"
                    value={addressDetail}
                    onChange={setAddressDetail}
                    placeholder="5층, OO병원"
                    autoComplete="address-line2"
                  />
                  <LabeledInput
                    label="배송 메모 (선택)"
                    value={buyerNote}
                    onChange={setBuyerNote}
                    placeholder="문 앞에 두고 벨 눌러주세요"
                  />
                </div>
                <p className="mt-5 inline-flex items-center gap-2 text-xs text-[var(--color-accent)]">
                  <span className="inline-block h-1 w-1 rounded-full bg-[var(--color-accent)]" />
                  자동 분할 배송 · 공급업체별로 분할 발송 (도착일 다를 수 있음)
                </p>
              </Section>

              {/* 2. 결제수단 */}
              <Section num="02" title="결제수단">
                <div className="grid gap-3 sm:grid-cols-2">
                  {PAY_METHODS.map((m) => {
                    const selected = payMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPayMethod(m.id)}
                        className={`group flex items-start gap-3 rounded-2xl border-2 p-5 text-left transition-all ${
                          selected
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/30"
                            : "border-[var(--color-border-light)] hover:border-[var(--color-text-secondary)]/40"
                        }`}
                      >
                        <m.icon
                          className={`mt-0.5 h-5 w-5 shrink-0 ${
                            selected
                              ? "text-[var(--color-accent)]"
                              : "text-[var(--color-text-tertiary)]"
                          }`}
                          strokeWidth={1.75}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-semibold ${
                              selected ? "text-[var(--color-accent)]" : ""
                            }`}
                          >
                            {m.label}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            {m.desc}
                          </p>
                        </div>
                        <span
                          aria-hidden
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                            selected
                              ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                              : "border-[var(--color-border-default)] bg-[var(--color-bg-primary)]"
                          }`}
                        >
                          {selected && (
                            <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 세금계산서 — 결제수단과 독립적인 옵션 (Phase δ-6) */}
                <label className="mt-6 flex cursor-pointer items-start gap-3 border-t border-[var(--color-border-light)] pt-5">
                  <input
                    type="checkbox"
                    checked={invoiceRequested}
                    onChange={(e) => setInvoiceRequested(e.target.checked)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      세금계산서 발행 (사업자등록증 필요)
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      결제 수단 무관 발행. 배송 완료 후 영업일 3일.
                    </p>
                  </div>
                </label>
              </Section>

              {/* 3. 주문 상품 */}
              <Section num="03" title="주문 상품">
                <ul className="space-y-12">
                  {vendorOrders.map((v) => (
                    <li key={v.vendorName}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
                        <p className="text-sm font-semibold tracking-tight">
                          {v.vendorName}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-tertiary)]">
                          {v.items.length}개 상품
                        </p>
                      </div>

                      <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                        {v.items.map((it) => (
                          <li
                            key={it.productId}
                            className="flex items-baseline justify-between gap-3 py-3.5 text-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-[var(--color-text-primary)]">
                                {it.productName}
                              </span>
                              <span className="ml-2 text-xs text-[var(--color-text-tertiary)] tabular-nums">
                                × {it.qty}
                                {unit(it.unit)}
                              </span>
                            </div>
                            <span className="font-semibold tabular-nums">
                              ₩{it.amount.toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <p className="mt-3 flex items-baseline justify-between text-xs text-[var(--color-text-tertiary)]">
                        <span>소계</span>
                        <span className="tabular-nums">
                          ₩{v.subtotal.toLocaleString()}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>

              {submitError && (
                <p
                  className="border-t border-[var(--color-error)]/20 pt-4 text-sm text-[var(--color-error)]"
                  role="alert"
                >
                  {submitError}
                </p>
              )}

              <p className="border-t border-[var(--color-border-light)] pt-8 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
                결제 진행 시{" "}
                <a
                  className="text-[var(--color-text-primary)] underline hover:text-[var(--color-accent)]"
                  href="/legal/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  이용약관
                </a>
                {" · "}
                <a
                  className="text-[var(--color-text-primary)] underline hover:text-[var(--color-accent)]"
                  href="/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  개인정보 수집·이용
                </a>
                {" · "}
                <a
                  className="text-[var(--color-text-primary)] underline hover:text-[var(--color-accent)]"
                  href="/legal/marketplace"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  전자결제 약관
                </a>
                에 동의하신 것으로 간주됩니다.
              </p>
            </div>

            {/* Right — sticky 결제 패널 (md+) */}
            <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
              <PayPanel
                itemsTotal={itemsTotal}
                shippingTotal={shippingTotal}
                grandTotal={grandTotal}
                payMethod={payMethod}
                couponCode={couponCode}
                disabled={
                  !formValid ||
                  createOrderMutation.isPending ||
                  portoneLoading
                }
                loading={createOrderMutation.isPending || portoneLoading}
                useRealPortone={USE_REAL_PORTONE}
                onSubmit={handleSubmit}
              />
            </aside>

            {/* 모바일/태블릿 — inline 결제 패널 (lg- 만 노출) */}
            <aside className="lg:hidden">
              <PayPanel
                itemsTotal={itemsTotal}
                shippingTotal={shippingTotal}
                grandTotal={grandTotal}
                payMethod={payMethod}
                couponCode={couponCode}
                disabled={
                  !formValid ||
                  createOrderMutation.isPending ||
                  portoneLoading
                }
                loading={createOrderMutation.isPending || portoneLoading}
                useRealPortone={USE_REAL_PORTONE}
                onSubmit={handleSubmit}
              />
            </aside>
          </div>
        )}

        {/* 하단 여백 — 모바일 sticky CTA 가 가리지 않게 */}
        <div className="h-32 md:h-32 lg:h-24" />
      </main>

      {/* Phase ν-2 — 모바일 sticky bottom CTA (lg- 만) */}
      {!isEmpty && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/95 backdrop-blur lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                최종 결제 금액
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums tracking-[-0.02em]">
                ₩{grandTotal.toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                !formValid ||
                createOrderMutation.isPending ||
                portoneLoading
              }
              className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
            >
              {createOrderMutation.isPending || portoneLoading
                ? "처리 중..."
                : "결제하기"}
              {!(createOrderMutation.isPending || portoneLoading) && (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────

function Section({
  num,
  title,
  action,
  children,
}: {
  num: string;
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex items-baseline justify-between gap-3 pb-5">
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-semibold tabular-nums tracking-[0.18em] text-[var(--color-accent)]">
            {num}
          </span>
          <h2 className="text-xl font-semibold tracking-tight">
            {title}
          </h2>
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            {action.label}
          </button>
        )}
      </header>
      <div>{children}</div>
    </section>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "tel" | "email";
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
        {required && <span className="ml-1 text-[var(--color-error)]">*</span>}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-xl border border-[var(--color-border-light)] bg-transparent px-4 py-3 text-base focus:border-[var(--color-accent)] focus:outline-none md:text-sm"
      />
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// PayPanel
// ─────────────────────────────────────────────────────────────

function PayPanel({
  itemsTotal,
  shippingTotal,
  grandTotal,
  payMethod,
  couponCode,
  disabled,
  loading,
  useRealPortone,
  onSubmit,
}: {
  itemsTotal: number;
  shippingTotal: number;
  grandTotal: number;
  payMethod: PayMethodId;
  couponCode: string | null;
  disabled: boolean;
  loading: boolean;
  useRealPortone: boolean;
  onSubmit: () => void;
}) {
  const methodLabel = PAY_METHODS.find((m) => m.id === payMethod)?.label;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        결제 요약
      </p>

      <dl className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        <Row label="상품 합계" value={itemsTotal} />
        <Row label="배송비 합계" value={shippingTotal} />
      </dl>

      {couponCode && (
        <p className="mt-5 flex items-baseline justify-between text-xs">
          <span className="text-[var(--color-text-tertiary)]">쿠폰</span>
          <span className="font-mono font-semibold tracking-tight text-[var(--color-accent)]">
            {couponCode}
          </span>
        </p>
      )}

      {methodLabel && (
        <p className="mt-3 flex items-baseline justify-between text-xs">
          <span className="text-[var(--color-text-tertiary)]">결제 수단</span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {methodLabel}
          </span>
        </p>
      )}

      <div className="mt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          최종 결제 금액
        </p>
        <p className="mt-3 text-4xl font-semibold tracking-[-0.04em] tabular-nums md:text-5xl">
          ₩<CountUp value={grandTotal} duration={500} />
        </p>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="mt-10 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "처리 중..." : "결제하기"}
        {!loading && <ArrowRight className="h-5 w-5" />}
      </button>

      <div className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
        <ShieldCheck
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-success)]"
          strokeWidth={2}
        />
        {useRealPortone ? (
          <p>
            PortOne 안전결제 — 카드사 인증 후 결제가 처리됩니다
            <br />
            결제 정보는 PortOne / PG 사를 통해서만 처리됩니다
          </p>
        ) : (
          <p>
            베타 운영 중 — 결제는 테스트 모드로 처리됩니다
            <br />
            주문은 자동 PAID 상태로 생성됩니다
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3.5 text-sm">
      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="font-medium tabular-nums text-[var(--color-text-primary)]">
        ₩<CountUp value={value} duration={500} />
      </dd>
    </div>
  );
}

function EmptyCheckout() {
  return (
    <div className="mt-24 flex flex-col items-center text-center">
      <h2 className="text-xl font-semibold tracking-tight">
        카트가 비어있습니다
      </h2>
      <p className="mt-3 max-w-sm text-sm text-[var(--color-text-secondary)]">
        결제할 상품이 없습니다. 카탈로그에서 상품을 골라 담아주세요.
      </p>
      <Link
        href="/search"
        className="mt-8 inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
      >
        카탈로그 둘러보기
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mt-16 grid gap-16 lg:grid-cols-[1fr_340px] lg:gap-20">
      <div className="space-y-12">
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="h-32 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" />
        </div>
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Checkout step indicator
// ─────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "장바구니" },
  { num: 2, label: "배송지·결제" },
  { num: 3, label: "주문 확인" },
] as const;

function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol
      aria-label="결제 단계"
      className="mt-10 flex items-center gap-2 overflow-x-auto text-xs md:gap-4 md:text-sm"
    >
      {STEPS.map((s, i) => {
        const done = s.num < current;
        const active = s.num === current;
        return (
          <li
            key={s.num}
            className="flex min-w-0 flex-1 items-center gap-2 md:gap-3"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors md:h-8 md:w-8 md:text-xs ${
                done
                  ? "bg-[var(--color-accent)] text-white"
                  : active
                    ? "border-2 border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border border-[var(--color-border-light)] text-[var(--color-text-tertiary)]"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.num}
            </span>
            <span
              className={`whitespace-nowrap font-medium ${
                done || active
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)]"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="ml-1 hidden h-px flex-1 bg-[var(--color-border-light)] md:block"
              >
                <span
                  className={`block h-full origin-left transition-transform duration-500 ${
                    done ? "scale-x-100" : "scale-x-0"
                  } bg-[var(--color-accent)]`}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
