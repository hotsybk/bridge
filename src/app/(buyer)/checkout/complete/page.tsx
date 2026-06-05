"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { ArrowRight, Check, Receipt, Truck } from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { trackOrderComplete } from "@/lib/posthog/events";
import { trpc } from "@/lib/trpc/client";

/**
 * /checkout/complete — 결제 완료 결과 화면 (Phase 2 mock).
 *
 * 디자인:
 *  - 박스 컨테이너 없음. accent glow halo + 큰 체크 + divider rows.
 *  - searchParams 에서 orderId / paymentId 수신. 없으면 데모값 fallback.
 *  - 토큰: T2 (H1) + T3 (총 금액) + T4 (본문) + T5/E (caption/eyebrow)
 */

const DEMO = {
  orderId: "demo-order-id",
  orderNo: "MP-2026-06-01-0042",
  paymentId: "mock_pay_demo",
  total: 469800,
  method: "신용카드 (mock)",
  paidAt: "2026-06-01 14:32:08",
  eta: "2026-06-04 ~ 2026-06-08",
};

const NEXT_STEPS: Array<{ num: string; label: string; hint: string; tag: string }> = [
  {
    num: "01",
    label: "공급업체별 송장 입력",
    hint: "SubOrder마다 운송장번호가 등록됩니다",
    tag: "영업일 1일",
  },
  {
    num: "02",
    label: "배송 진행 · 자동 알림톡",
    hint: "출고·집하·도착 단계마다 알림이 발송됩니다",
    tag: "영업일 3일",
  },
  {
    num: "03",
    label: "수령 확인 · 자동 정산",
    hint: "도착 직후 결제가 공급업체 정산으로 전환됩니다",
    tag: "도착 직후",
  },
];

export default function CheckoutCompletePage() {
  return (
    <Suspense fallback={null}>
      <CheckoutCompleteInner />
    </Suspense>
  );
}

function CheckoutCompleteInner() {
  const sp = useSearchParams();
  const orderId = sp.get("orderId");
  const orderNoParam = sp.get("orderNo");

  // 실 주문이 있으면 order.getMine 으로 정보 조회 (로그인된 buyer 만)
  const orderQuery = trpc.order.getMine.useQuery(
    { orderId: orderId ?? "" },
    { enabled: !!orderId, retry: false },
  );

  // Phase ν-2 — PostHog order_complete (한 번만, 주문 정보 로드 후).
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    if (!orderId) return;
    const order = orderQuery.data as
      | { orderNo?: string; totalAmount?: number; paymentMethod?: string }
      | undefined
      | null;
    if (!order && !orderNoParam) return;
    trackedRef.current = true;
    trackOrderComplete({
      orderId,
      orderNo: order?.orderNo ?? orderNoParam ?? "",
      amount: order?.totalAmount ?? 0,
      method: order?.paymentMethod ?? undefined,
    });
  }, [orderQuery.data, orderId, orderNoParam]);

  // 표시 데이터 — 우선순위: 실 주문 > URL searchParam > DEMO
  const data = useMemo(() => {
    const order = orderQuery.data as
      | {
          orderNo?: string;
          totalAmount?: number;
          paymentKey?: string;
          paymentMethod?: string;
        }
      | undefined
      | null;

    const orderNo = order?.orderNo ?? orderNoParam ?? DEMO.orderNo;
    const total = order?.totalAmount ?? DEMO.total;
    const paymentId = order?.paymentKey ?? DEMO.paymentId;
    const method = order?.paymentMethod
      ? methodLabel(order.paymentMethod)
      : DEMO.method;

    return {
      orderId: orderId ?? DEMO.orderId,
      orderNo,
      paymentId,
      total,
      method,
      paidAt: DEMO.paidAt,
      eta: DEMO.eta,
    };
  }, [orderQuery.data, orderId, orderNoParam]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main
        className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-24"
        style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
      >
        {/* ─── Hero ─── */}
        <section className="flex flex-col items-center text-center">
          <div className="relative">
            <span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-[var(--color-accent-light)] blur-3xl"
            />
            <span className="grid h-28 w-28 place-items-center rounded-full bg-[var(--color-accent)] text-white shadow-[0_0_0_16px_var(--color-accent-light)]">
              <Check className="h-12 w-12" strokeWidth={3} aria-hidden />
            </span>
          </div>

          <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Payment Complete
          </p>
          <h1 className="mt-3 break-keep text-3xl font-semibold tracking-[-0.035em] md:text-5xl">
            주문이 완료됐습니다
          </h1>
          <p className="mt-4 max-w-md text-sm text-[var(--color-text-secondary)]">
            확인 알림톡을 발송했습니다
            <br className="md:hidden" />
            <span className="hidden md:inline"> — </span>
            공급업체가 곧 발송을 시작합니다
          </p>
        </section>

        {/* ─── 주문 요약 — divider line ─── */}
        <section className="mt-16 md:mt-20">
          <header className="flex items-baseline justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              <Receipt className="mr-1 inline h-3 w-3" aria-hidden />
              주문 요약
            </p>
            <Link
              href={`/orders/${data.orderId}`}
              className="text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              주문 상세 →
            </Link>
          </header>

          <dl className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <SummaryRow label="주문번호" value={data.orderNo} mono />
            <div className="flex items-baseline justify-between gap-4 py-5">
              <dt className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                결제 금액
              </dt>
              <dd className="text-2xl font-semibold tabular-nums tracking-[-0.02em] md:text-3xl">
                ₩{data.total.toLocaleString()}
              </dd>
            </div>
            <SummaryRow label="결제 수단" value={data.method} />
            <SummaryRow label="결제 ID" value={data.paymentId} mono />
            <SummaryRow label="예상 배송" value={data.eta} mono />
          </dl>
        </section>

        {/* ─── 다음 액션 ─── */}
        <section className="mt-16 md:mt-20">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            <Truck className="mr-1 inline h-3 w-3" aria-hidden />
            다음 단계
          </p>
          <ol className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {NEXT_STEPS.map((s) => (
              <li
                key={s.num}
                className="flex items-center gap-5 py-6 md:py-7"
              >
                <span className="text-sm font-semibold tabular-nums text-[var(--color-accent)]">
                  {s.num}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                    {s.hint}
                  </p>
                </div>
                <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                  {s.tag}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* ─── CTA ─── */}
        <section className="mt-12 flex flex-col gap-3 md:mt-16">
          <Link
            href={`/orders/${data.orderId}`}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            주문 추적하기
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/search"
            className="inline-flex h-11 w-full items-center justify-center text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            계속 쇼핑하기 →
          </Link>
        </section>

        {/* ─── 푸터 hint ─── */}
        <footer className="mt-16 flex flex-col items-center gap-1.5 text-center md:mt-24">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            세금계산서는 익월 10일까지 자동 발행됩니다
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            주문 관련 문의 ·{" "}
            <a
              href="mailto:support@medplace.example.com"
              className="underline decoration-[var(--color-border-default)] underline-offset-4 hover:text-[var(--color-text-secondary)]"
            >
              support@medplace.example.com
            </a>
          </p>
        </footer>

        <div className="h-16" />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SummaryRow — label / value 한 줄
// ─────────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-4">
      <dt className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd
        className={`text-sm font-medium text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function methodLabel(method: string): string {
  switch (method) {
    case "CARD":
      return "신용·체크카드 (mock)";
    case "BANK_TRANSFER":
      return "세금계산서 · 계좌 입금 (mock)";
    case "NET_30":
      return "후불 결제 (Net 30, mock)";
    case "POINT":
      return "포인트 결제 (mock)";
    default:
      return method;
  }
}
