"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { ArrowRight, Receipt, X } from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";

/**
 * /checkout/fail — 결제 실패 결과 화면 (Phase 2 mock).
 *
 * 디자인:
 *  - 박스 컨테이너 없음. error halo + 큰 X + divider rows.
 *  - searchParams 에서 code / message 수신. 없으면 데모값 fallback.
 *  - 토큰: T2 (H1) + T4 (본문) + T5/E (caption/eyebrow). 박스/그라데이션 금지.
 */

const DEMO = {
  code: "CARD_DECLINED",
  message: "발급사 거절 (한도 초과 또는 잔액 부족)",
  failedAt: "2026-06-01 14:32:08",
};

const RETRY_STEPS: Array<{ num: string; label: string; hint: string }> = [
  {
    num: "01",
    label: "카드 정보를 다시 확인",
    hint: "유효기간 · CVC · 카드 번호를 점검합니다",
  },
  {
    num: "02",
    label: "다른 결제 수단 시도",
    hint: "토스페이 · 카카오페이 · 계좌이체로 우회",
  },
  {
    num: "03",
    label: "한도 초과 시 카드사 문의",
    hint: "1일 결제 한도가 초과됐을 수 있습니다",
  },
  {
    num: "04",
    label: "문제가 계속되면 고객지원",
    hint: "오류 코드를 함께 알려주시면 더 빠릅니다",
  },
];

export default function CheckoutFailPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutFailInner />
    </Suspense>
  );
}

function CheckoutFailInner() {
  const sp = useSearchParams();
  const code = sp.get("code") ?? DEMO.code;
  const message = sp.get("message") ?? DEMO.message;

  const data = useMemo(
    () => ({
      code,
      message,
      failedAt: DEMO.failedAt,
    }),
    [code, message],
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main
        className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-24"
        style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
      >
        {/* ─── Hero — 에러 톤 ─── */}
        <section className="flex flex-col items-center text-center">
          <div className="relative">
            <span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-[var(--color-error)] opacity-20 blur-3xl"
            />
            <span
              className="grid h-28 w-28 place-items-center rounded-full bg-[var(--color-error)] text-white"
              style={{
                boxShadow: "0 0 0 16px rgba(220, 38, 38, 0.15)",
              }}
            >
              <X className="h-12 w-12" strokeWidth={3} aria-hidden />
            </span>
          </div>

          <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-error)]">
            Payment Failed
          </p>
          <h1 className="mt-3 break-keep text-3xl font-semibold tracking-[-0.035em] md:text-5xl">
            결제가 완료되지 않았습니다
          </h1>
          <p className="mt-4 max-w-md text-sm text-[var(--color-text-secondary)]">
            결제는 처리되지 않았으니, 카드 인출이 발생했더라도
            <br className="md:hidden" />
            <span className="hidden md:inline"> </span>
            자동으로 취소됩니다
          </p>
        </section>

        {/* ─── 실패 원인 ─── */}
        <section className="mt-16 md:mt-20">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            <Receipt className="mr-1 inline h-3 w-3" aria-hidden />
            실패 원인
          </p>

          <dl className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <SummaryRow label="오류 코드" value={data.code} mono />
            <div className="py-5">
              <dt className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                오류 메시지
              </dt>
              <dd className="mt-3 border-l-2 border-[var(--color-error)] bg-[var(--color-error)]/5 px-4 py-3 text-sm text-[var(--color-error)]">
                {data.message}
              </dd>
            </div>
            <SummaryRow label="발생 시각" value={data.failedAt} mono />
          </dl>
        </section>

        {/* ─── 재시도 가이드 ─── */}
        <section className="mt-16 md:mt-20">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            재시도 가이드
          </p>
          <ol className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {RETRY_STEPS.map((s) => (
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
              </li>
            ))}
          </ol>
        </section>

        {/* ─── CTA ─── */}
        <section className="mt-12 flex flex-col gap-3 md:mt-16">
          <Link
            href="/checkout"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            결제 다시 시도
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/cart"
            className="inline-flex h-11 w-full items-center justify-center text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            장바구니로 돌아가기 →
          </Link>
        </section>

        {/* ─── 푸터 hint ─── */}
        <footer className="mt-16 flex flex-col items-center gap-1.5 text-center md:mt-24">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            카드 hold이 발생했을 경우 영업일 3~5일 내 자동 환불됩니다
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            고객지원 ·{" "}
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
