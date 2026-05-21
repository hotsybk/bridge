import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Stethoscope,
  XCircle,
} from "lucide-react";

export const metadata = {
  title: "수수료 — MedPlace",
  description:
    "기본 5%. 거래 규모에 따라 더 낮아집니다. 숨겨진 비용 없는 투명한 수수료 정책.",
};

const TIERS = [
  { range: "월 1,000만원 이하", rate: "5.0%", note: "기본 요율" },
  { range: "월 1,000만 ~ 1억원", rate: "4.5%", note: "0.5%p 할인" },
  { range: "월 1억 ~ 5억원", rate: "4.0%", note: "1.0%p 할인" },
  { range: "월 5억원 이상", rate: "협의", note: "별도 계약" },
] as const;

const INCLUDED = [
  "결제 처리 (카드·간편결제·계좌이체)",
  "정산 시스템 + D+3 빠른 정산",
  "셀러센터 + 주문 관리 도구",
  "전자 세금계산서 자동 발행",
  "고객지원 (영업시간 내 1영업일 응답)",
  "분쟁 조정 + 운영자 중재",
];

const NOT_INCLUDED = [
  "PG 수수료 (PortOne 기준 별도 부과 — 카드 2.9%)",
  "정기 발주 자동화 (Phase 3+ 무료 제공 예정)",
  "공동구매 운영 (Phase 4+ 무료 제공 예정)",
  "UDI 자동 보고 (Phase 6+ 무료 제공 예정)",
];

const FAQ = [
  {
    q: "수수료는 언제 차감되나요?",
    a: "주문 결제가 완료된 후, 정산일에 자동 차감됩니다. 별도 청구·송장 발행이 없습니다.",
  },
  {
    q: "정산은 얼마나 빠른가요?",
    a: "주문이 '배송 완료' 상태로 전환된 후 영업일 기준 D+3 정산입니다. 간납사 대비 평균 4~6개월 빠릅니다.",
  },
  {
    q: "PG 수수료는 어떻게 부과되나요?",
    a: "PortOne 의 카드사 수수료 (약 2.9% 내외)는 별도 부과됩니다. 카카오페이·네이버페이 등 간편결제 수수료는 채널별로 상이합니다.",
  },
  {
    q: "최소 거래액이나 가입비가 있나요?",
    a: "없습니다. 가입은 무료이며 최소 거래액 제한이 없습니다. 거래가 발생할 때만 수수료가 차감됩니다.",
  },
  {
    q: "약정 기간이 있나요?",
    a: "없습니다. 언제든 해지 가능합니다. 다만 진행 중인 주문·정산이 있으면 완료 후 처리됩니다.",
  },
  {
    q: "기존 간납사와 비교하면 얼마나 절감되나요?",
    a: "간납사 평균 수수료는 15~30% 수준입니다. MedPlace 의 기본 5% 와 비교하면 거래액의 10~25% 가 공급업체에게 더 돌아갑니다.",
  },
] as const;

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TopNav />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center md:px-12 md:pt-32">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
          <Sparkles className="h-3.5 w-3.5" />
          투명한 수수료
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
          기본 <span className="text-[var(--color-accent)]">5%.</span>
          <br />
          숨겨진 비용은 없습니다.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-[var(--color-text-secondary)] md:text-lg">
          거래 규모가 커지면 수수료는 더 낮아집니다. 가입비·약정·최소 거래액 모두 없음.
        </p>
      </section>

      {/* Big number + tiers */}
      <section className="mx-auto max-w-5xl px-6 pb-16 md:px-12">
        <div className="rounded-3xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] p-10 md:p-14">
          <div className="grid items-center gap-10 md:grid-cols-[1fr_1.2fr]">
            <div className="text-center md:text-left">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                기본 수수료
              </p>
              <p className="mt-3 flex items-baseline justify-center gap-1 md:justify-start">
                <span className="text-7xl font-semibold tabular-nums tracking-tight md:text-8xl">
                  5
                </span>
                <span className="text-3xl font-semibold text-[var(--color-accent)]">
                  %
                </span>
              </p>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                거래 한 건마다, 정산 시점에 자동 차감
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                거래 규모별 할인
              </p>
              <ul className="mt-3 divide-y divide-[var(--color-border-light)]">
                {TIERS.map((t) => (
                  <li
                    key={t.range}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <span className="text-[var(--color-text-secondary)]">{t.range}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {t.note}
                      </span>
                      <span className="font-semibold tabular-nums text-[var(--color-accent)]">
                        {t.rate}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 비교 */}
      <section className="mx-auto max-w-5xl px-6 pb-16 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            간납사 vs MedPlace
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            얼마나 절감되나요?
          </h2>
        </div>

        <div className="mx-auto mt-10 max-w-2xl space-y-4">
          <ComparisonBar label="기존 간납사 (평균)" percent={22} tone="negative" />
          <ComparisonBar label="MedPlace 기본 요율" percent={5} tone="positive" />
        </div>

        <p className="mx-auto mt-6 max-w-xl text-center text-xs text-[var(--color-text-tertiary)]">
          업계 평균 수수료 자료 기반 — 실제 거래마다 다를 수 있습니다.
        </p>
      </section>

      {/* 포함된 것 vs 별도 */}
      <section className="border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] py-24">
        <div className="mx-auto max-w-5xl px-6 md:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              수수료에 포함된 것 / 별도
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              명확하게 구분합니다.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-[var(--color-bg-primary)] p-7">
              <p className="text-sm font-semibold text-[var(--color-success)]">
                포함됨
              </p>
              <ul className="mt-4 space-y-3">
                {INCLUDED.map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]"
                      aria-hidden
                    />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-[var(--color-bg-primary)] p-7">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                별도
              </p>
              <ul className="mt-4 space-y-3">
                {NOT_INCLUDED.map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <XCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
                      aria-hidden
                    />
                    <span className="text-[var(--color-text-secondary)]">{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-24 md:px-12 md:py-32">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            자주 묻는 질문
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            FAQ
          </h2>
        </div>

        <div className="mt-12 divide-y divide-[var(--color-border-light)]">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-left text-base font-medium">
                <span>{f.q}</span>
                <span
                  aria-hidden
                  className="text-[var(--color-text-tertiary)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-6 text-center md:px-12">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            공급업체로 시작하기.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--color-text-secondary)] md:text-lg">
            기본 5% 수수료, D+3 빠른 정산. 가입 30초.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
            >
              공급업체로 가입
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex h-12 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
              회사 소개 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-12">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">MedPlace</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/about"
            className="rounded-full px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            소개
          </Link>
          <Link
            href="/pricing"
            className="rounded-full px-4 py-2 font-medium text-[var(--color-text-primary)]"
          >
            수수료
          </Link>
          <Link
            href="/login"
            className="ml-2 rounded-full px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            로그인
          </Link>
          <Link
            href="/register"
            className="ml-1 inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            회원가입
          </Link>
        </nav>
      </div>
    </header>
  );
}

function ComparisonBar({
  label,
  percent,
  tone,
}: {
  label: string;
  percent: number;
  tone: "positive" | "negative";
}) {
  const barColor =
    tone === "positive"
      ? "bg-[var(--color-accent)]"
      : "bg-[var(--color-error)]/70";
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(percent * 2.5, 100)}%` }}
        />
      </div>
    </div>
  );
}
