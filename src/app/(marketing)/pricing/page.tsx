"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Calculator,
  Check,
  ChevronDown,
  Minus,
  Sparkles,
} from "lucide-react";

// 사용 중: ArrowRight ArrowUpRight Calculator Check ChevronDown Minus Sparkles

import { CountUp } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";

/**
 * /pricing — 풀 리디자인 (2026-06).
 *
 * 구조:
 *  1. Hero — 메쉬 배경 + 거대한 5% 타이포
 *  2. Big Pricing Card — 5% 원형 + 거래 규모별 라인 차트
 *  3. Savings Calculator — 슬라이더로 거래액 → 절감액 실시간 계산
 *  4. Comparison — 기존 도매상 vs MedPlace 인포그래픽
 *  5. Included / Not Included — 박스 없는 좌우 split
 *  6. FAQ — 박스 없는 accordion
 *  7. CTA — 풀블리드 mesh
 */

const TIERS = [
  { range: "월 1,000만원 이하", monthlyMax: 10_000_000, rate: 5.0, note: "기본 요율" },
  { range: "월 1,000만 ~ 1억원", monthlyMax: 100_000_000, rate: 4.5, note: "0.5%p 할인" },
  { range: "월 1억 ~ 5억원", monthlyMax: 500_000_000, rate: 4.0, note: "1.0%p 할인" },
  { range: "월 5억 ~ 10억원", monthlyMax: 1_000_000_000, rate: 3.5, note: "1.5%p 할인" },
  { range: "월 10억원 이상", monthlyMax: Infinity, rate: 3.5, note: "별도 협의" },
] as const;

const INCLUDED = [
  "결제 처리 (카드·간편결제·계좌이체)",
  "정산 시스템 + 영업일 3일 빠른 정산",
  "셀러센터 + 주문 관리 도구",
  "전자 세금계산서 자동 발행",
  "고객지원 (영업시간 내 1영업일 응답)",
  "분쟁 조정 + 운영자 중재",
];

const NOT_INCLUDED = [
  "결제대행 수수료 (PortOne 카드 약 2.9%)",
  "정기 발주 자동화 (3단계 정식 출시 후 무료 제공)",
  "공동구매 운영 (4단계 정식 출시 후 무료 제공)",
  "식약처 의료기기 자동 보고 (6단계 정식 출시 후 무료 제공)",
];

const FAQ = [
  {
    q: "수수료는 언제 빠져나가나요?",
    a: "주문 결제가 끝나면 정산일에 자동으로 차감됩니다. 별도 청구서나 송장 발행이 없습니다.",
  },
  {
    q: "정산은 얼마나 빠른가요?",
    a: "주문이 '배송 완료' 상태가 되고 영업일 3일이면 입금됩니다. 기존 도매상 평균 4~6개월보다 빠릅니다.",
  },
  {
    q: "결제대행 수수료는 따로 내야 하나요?",
    a: "PortOne 의 카드사 수수료 (약 2.9% 내외) 는 따로 부과됩니다. 카카오페이·네이버페이 등 간편결제는 채널마다 요율이 다릅니다.",
  },
  {
    q: "최소 거래액이나 가입비가 있나요?",
    a: "없습니다. 가입은 완전 무료이며 최소 거래액 제한도 없습니다. 거래가 생길 때만 수수료가 빠집니다.",
  },
  {
    q: "의무 약정 기간이 있나요?",
    a: "없습니다. 언제든 해지할 수 있습니다. 다만 진행 중인 주문이나 정산이 있으면 완료된 후 정리됩니다.",
  },
  {
    q: "기존 도매상과 비교하면 얼마나 절감되나요?",
    a: "기존 도매상의 평균 마진은 15~30% 수준입니다. MedPlace 기본 5%와 비교하면 거래액의 10~25% 가 공급업체에게 더 돌아갑니다.",
  },
];

export default function PricingPage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <HeroSection />
      <BigPricingSection />
      <SavingsCalculatorSection />
      <ComparisonSection />
      <IncludedSection />
      <FaqSection />
      <CtaSection />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* 메쉬 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <svg
          viewBox="0 0 1200 700"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="pr-mesh-a" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0066CC" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0066CC" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pr-mesh-b" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="220"
            cy="160"
            r="320"
            fill="url(#pr-mesh-a)"
            className="landing-mesh-1"
          />
          <circle
            cx="980"
            cy="520"
            r="280"
            fill="url(#pr-mesh-b)"
            className="landing-mesh-2"
          />
        </svg>
      </div>

      <div className="mx-auto max-w-5xl px-6 pt-32 pb-32 text-center md:px-12 md:pt-48 md:pb-48">
        <span
          className="landing-fade-up inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]"
          style={{ animationDelay: "0ms" }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          숨김 없는 수수료
        </span>
        <h1
          className="landing-fade-up mt-6 break-keep text-5xl font-semibold leading-[1.04] tracking-[-0.04em] md:text-6xl"
          style={{ animationDelay: "150ms" }}
        >
          거래액의{" "}
          <span
            className="landing-fade-up text-[var(--color-accent)]"
            style={{ animationDelay: "350ms", display: "inline-block" }}
          >
            단 5%.
          </span>
          <br />
          그게 전부입니다.
        </h1>
        <p
          className="landing-fade-up mx-auto mt-7 max-w-2xl text-sm text-[var(--color-text-secondary)]"
          style={{ animationDelay: "500ms" }}
        >
          거래액이 커질수록 3.5%까지 내려갑니다.
          <br className="hidden md:block" />
          가입비·약정·최소거래 0원.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Big Pricing — 원형 게이지 + 5단계 스텝드 막대
// ─────────────────────────────────────────────────────────────

function BigPricingSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-32 md:px-12 md:pt-24 md:pb-48">
      <Reveal>
        <div className="grid gap-16 lg:grid-cols-[1fr_1.3fr] lg:gap-24">
          {/* Left — narrative */}
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              거래 규모별 요율
            </p>
            <h2 className="mt-5 text-2xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-3xl">
              많이 팔수록
              <br />
              <span className="text-[var(--color-accent)]">더 저렴해집니다.</span>
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-[var(--color-text-secondary)]">
              월 거래액이 커질수록 수수료가 단계적으로 내려갑니다.
              요율은 정산 시점의 직전 30일 누적 거래액 기준으로 자동 적용됩니다.
            </p>

            {/* 큰 단일 수치 강조 */}
            <div className="mt-12 flex items-baseline gap-2 border-t border-[var(--color-border-light)] pt-8">
              <span className="text-5xl font-semibold tabular-nums tracking-[-0.04em] text-[var(--color-accent)] md:text-6xl">
                <CountUp value={3.5} duration={1400} integer={false} />
              </span>
              <span className="text-2xl font-semibold text-[var(--color-accent)] md:text-3xl">
                %
              </span>
              <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">
                최대 할인 요율
              </span>
            </div>
          </div>

          {/* Right — minimalist table */}
          <div>
            <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              {TIERS.map((t, i) => (
                <TierRow key={t.range} tier={t} index={i} />
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function TierRow({
  tier,
  index,
}: {
  tier: (typeof TIERS)[number];
  index: number;
}) {
  const isSpecial = index === 4;
  return (
    <li
      className="group grid grid-cols-[1fr_auto] items-baseline gap-6 py-6 transition-colors hover:bg-[var(--color-bg-secondary)]/30 md:py-7"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div>
        <p className="text-sm font-semibold tracking-tight">
          {tier.range}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          {tier.note}
        </p>
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-[-0.02em] text-[var(--color-accent)] transition-transform group-hover:scale-105 md:text-3xl">
        {isSpecial ? "협의" : `${tier.rate}%`}
      </p>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Savings Calculator — 슬라이더로 절감액 시뮬레이션
// ─────────────────────────────────────────────────────────────

const COMPETITOR_MARGIN = 0.22; // 도매상 평균 마진 22%

function SavingsCalculatorSection() {
  const [monthlyWon, setMonthlyWon] = useState(50_000_000);

  const rate = useMemo(() => {
    for (const t of TIERS) {
      if (monthlyWon <= t.monthlyMax) return t.rate / 100;
    }
    return 0.035;
  }, [monthlyWon]);

  const competitorFee = Math.round(monthlyWon * COMPETITOR_MARGIN);
  const medplaceFee = Math.round(monthlyWon * rate);
  const savings = competitorFee - medplaceFee;
  const yearlySavings = savings * 12;
  const savingsRate = COMPETITOR_MARGIN - rate; // 17.5%p 식

  return (
    <section className="border-y border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/40">
      <div className="mx-auto max-w-6xl px-6 py-32 md:px-12 md:py-48">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-accent)]">
            <Calculator className="mr-1.5 inline h-3.5 w-3.5" />
            절감 시뮬레이터
          </p>
          <h2 className="mt-4 text-2xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-3xl">
            얼마나 더 남는지,
            <br />
            직접 계산해보세요.
          </h2>
        </div>

        {/* 메인 영역 — 좌측 input, 우측 result */}
        <div className="mt-24 grid items-center gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          {/* Left — Input */}
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              월 거래액
            </p>
            <p className="mt-4 text-2xl font-semibold tabular-nums tracking-[-0.03em] md:text-3xl">
              ₩<span className="tabular-nums">{monthlyWon.toLocaleString()}</span>
            </p>

            {/* 슬라이더 */}
            <div className="mt-10">
              <input
                type="range"
                min={1_000_000}
                max={1_000_000_000}
                step={1_000_000}
                value={monthlyWon}
                onChange={(e) => setMonthlyWon(Number(e.target.value))}
                className="w-full cursor-pointer accent-[var(--color-accent)]"
                aria-label="월 거래액"
              />
              <div className="mt-2 flex justify-between text-[11px] text-[var(--color-text-tertiary)] tabular-nums">
                <span>₩100만</span>
                <span>₩5억</span>
                <span>₩10억</span>
              </div>
            </div>

            {/* Quick presets */}
            <div className="mt-8 flex flex-wrap gap-2">
              {[
                { label: "월 1천만", v: 10_000_000 },
                { label: "월 5천만", v: 50_000_000 },
                { label: "월 1억", v: 100_000_000 },
                { label: "월 5억", v: 500_000_000 },
              ].map((p) => {
                const active = monthlyWon === p.v;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setMonthlyWon(p.v)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                        : "border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right — Result hero (절감액 강조) */}
          <div className="lg:border-l lg:border-[var(--color-border-light)] lg:pl-20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              매달 더 받는 금액
            </p>

            <p className="mt-5 text-5xl font-semibold leading-none tabular-nums tracking-[-0.045em] text-[var(--color-accent)] md:text-6xl">
              ₩{savings.toLocaleString()}
            </p>

            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              1년 누적{" "}
              <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
                ₩{yearlySavings.toLocaleString()}
              </span>
            </p>

            {/* 미니 비교 — 한 줄 흐름 */}
            <div className="mt-12 border-t border-[var(--color-border-light)] pt-8">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                같은 거래액일 때
              </p>
              <dl className="mt-5 space-y-4">
                <CompareLine
                  label="기존 도매상"
                  amount={competitorFee}
                  strike
                />
                <CompareLine
                  label="MedPlace"
                  amount={medplaceFee}
                  emphasize
                />
              </dl>
            </div>
          </div>
        </div>

        <p className="mt-16 text-center text-xs text-[var(--color-text-tertiary)]">
          움직이면 실시간 계산 · 업계 평균 22% 기준
        </p>
      </div>
    </section>
  );
}

function CompareLine({
  label,
  amount,
  strike,
  emphasize,
}: {
  label: string;
  amount: number;
  strike?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
      <dd
        className={`text-2xl font-semibold tabular-nums tracking-tight md:text-3xl ${
          emphasize
            ? "text-[var(--color-accent)]"
            : "text-[var(--color-text-tertiary)]"
        } ${
          strike ? "line-through decoration-[var(--color-text-tertiary)]/50" : ""
        }`}
      >
        ₩{amount.toLocaleString()}
      </dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Comparison — 인포그래픽
// ─────────────────────────────────────────────────────────────

function ComparisonSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-32 md:px-12 md:py-48">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          업계 비교
        </p>
        <h2 className="mt-4 text-2xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-3xl">
          기존 도매상의{" "}
          <span className="text-[var(--color-accent)]">1/4 가격.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-sm text-[var(--color-text-secondary)]">
          도매상 22% → MedPlace 5%. 차액 17%는 공급업체에.
        </p>
      </div>

      <Reveal>
        {/* 한 줄 비교 — 도넛 → 도넛 = 도넛 */}
        <div className="mt-24 grid items-center gap-10 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-4">
          <DonutCompare
            label="기존 도매상"
            sublabel="평균 마진"
            percent={22}
            tone="muted"
            narrative="도매상 마진으로 빠집니다."
          />

          {/* Connector 1 — 화살표 */}
          <Connector kind="arrow" />

          <DonutCompare
            label="MedPlace"
            sublabel="기본 요율"
            percent={5}
            tone="accent"
            narrative="플랫폼 수수료로."
            winner
          />

          {/* Connector 2 — 등호 */}
          <Connector kind="equals" />

          <DonutCompare
            label="공급업체에 더 돌아감"
            sublabel="한 거래마다"
            percent={17}
            tone="success"
            narrative="다시 공급업체에게."
          />
        </div>
      </Reveal>
    </section>
  );
}

/**
 * 도넛 사이 연결자 — 화살표 / 등호.
 */
function Connector({ kind }: { kind: "arrow" | "equals" }) {
  return (
    <div className="flex items-center justify-center md:flex-col">
      {kind === "arrow" ? (
        <span className="text-2xl font-light text-[var(--color-text-tertiary)] md:text-3xl">
          →
        </span>
      ) : (
        <span className="text-2xl font-light text-[var(--color-text-tertiary)] md:text-3xl">
          =
        </span>
      )}
    </div>
  );
}

/**
 * 도넛 차트 비교 — SVG 호로 percent 만큼 채움.
 */
function DonutCompare({
  label,
  sublabel,
  percent,
  tone,
  narrative,
  winner,
}: {
  label: string;
  sublabel: string;
  percent: number;
  tone: "muted" | "accent" | "success";
  narrative: string;
  winner?: boolean;
}) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  const palette = {
    muted: {
      stroke: "rgb(110, 110, 115)",
      track: "rgb(0 0 0 / 0.06)",
      text: "text-[var(--color-text-secondary)]",
    },
    accent: {
      stroke: "#0066CC",
      track: "rgb(0 102 204 / 0.08)",
      text: "text-[var(--color-accent)]",
    },
    success: {
      stroke: "rgb(0 168 107)",
      track: "rgb(0 168 107 / 0.08)",
      text: "text-[var(--color-success)]",
    },
  }[tone];

  return (
    <div className="flex flex-col items-center text-center">
      {/* 라벨 */}
      <div className="flex items-center gap-2">
        <p
          className={`text-sm font-semibold tracking-tight ${
            tone === "success" ? "text-[var(--color-success)]" : ""
          }`}
        >
          {label}
        </p>
        {winner && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-light)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-accent)]">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
            우리
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
        {sublabel}
      </p>

      {/* 도넛 */}
      <div className="relative mt-5 h-[180px] w-[180px] md:h-[200px] md:w-[200px]">
        <svg
          viewBox="0 0 200 200"
          className="absolute inset-0 h-full w-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={palette.track}
            strokeWidth="14"
          />
          <circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={palette.stroke}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{
              transition:
                "stroke-dashoffset 1.6s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          />
        </svg>
        {/* 중앙 숫자 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <p className={`flex items-baseline ${palette.text}`}>
            <span className="text-5xl font-semibold tabular-nums tracking-[-0.04em] md:text-6xl">
              <CountUp value={percent} duration={1400} />
            </span>
            <span className="ml-0.5 text-2xl font-semibold md:text-3xl">%</span>
          </p>
        </div>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {narrative}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Included / Not Included — 박스 없는 좌우 split
// ─────────────────────────────────────────────────────────────

function IncludedSection() {
  return (
    <section className="border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/30">
      <div className="mx-auto max-w-6xl px-6 py-32 md:px-12 md:py-48">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            수수료에 포함된 것 / 별도
          </p>
          <h2 className="mt-4 text-2xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-3xl">
            명확하게 구분합니다.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm text-[var(--color-text-secondary)]">
            5% 안에 핵심 운영 기능 모두 포함. 별도 항목은 처음부터 공개.
          </p>
        </div>

        <div className="mx-auto mt-24 grid max-w-5xl gap-16 md:grid-cols-2 md:gap-0">
          {/* 포함됨 */}
          <Reveal>
            <FeatureColumn
              tone="accent"
              icon={Check}
              count={INCLUDED.length}
              title="포함됨"
              subtitle="기본 수수료 안에서 모두 제공"
              items={INCLUDED}
            />
          </Reveal>

          {/* 별도 */}
          <Reveal delay={120}>
            <div className="md:border-l md:border-[var(--color-border-light)] md:pl-12 lg:pl-16">
              <FeatureColumn
                tone="muted"
                icon={Minus}
                count={NOT_INCLUDED.length}
                title="별도"
                subtitle="계약상 따로 부과 또는 단계별 출시"
                items={NOT_INCLUDED}
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FeatureColumn({
  tone,
  icon: Icon,
  count,
  title,
  subtitle,
  items,
}: {
  tone: "accent" | "muted";
  icon: typeof Check;
  count: number;
  title: string;
  subtitle: string;
  items: ReadonlyArray<string>;
}) {
  const isAccent = tone === "accent";
  const iconBg = isAccent
    ? "bg-[var(--color-accent-light)]"
    : "bg-[var(--color-bg-secondary)]";
  const iconColor = isAccent
    ? "text-[var(--color-accent)]"
    : "text-[var(--color-text-tertiary)]";
  const numberColor = isAccent
    ? "text-[var(--color-accent)]"
    : "text-[var(--color-text-tertiary)]";
  const titleColor = isAccent
    ? "text-[var(--color-text-primary)]"
    : "text-[var(--color-text-secondary)]";
  const itemColor = isAccent
    ? "text-[var(--color-text-primary)]"
    : "text-[var(--color-text-secondary)]";
  const itemDot = isAccent
    ? "bg-[var(--color-accent)]"
    : "bg-[var(--color-text-tertiary)]/40";

  return (
    <div className={isAccent ? "md:pr-12 lg:pr-16" : ""}>
      {/* 큰 아이콘 */}
      <div
        className={`grid h-20 w-20 place-items-center rounded-3xl ${iconBg} ${iconColor}`}
      >
        <Icon className="h-9 w-9" strokeWidth={isAccent ? 2.5 : 2} />
      </div>

      {/* 카운트 */}
      <p
        className={`mt-8 flex items-baseline gap-2 tabular-nums ${numberColor}`}
      >
        <span className="text-5xl font-semibold tracking-[-0.04em] md:text-6xl">
          <CountUp value={count} duration={1200} />
        </span>
        <span className="text-2xl font-semibold md:text-3xl">가지</span>
      </p>

      {/* 타이틀 + 부제 */}
      <p className={`mt-4 text-2xl font-semibold tracking-tight md:text-3xl ${titleColor}`}>
        {title}
      </p>
      <p className="mt-1.5 text-sm text-[var(--color-text-tertiary)]">
        {subtitle}
      </p>

      {/* 항목 리스트 — 박스 없이 divider 만 */}
      <ul className="mt-10 divide-y divide-[var(--color-border-light)]">
        {items.map((item) => (
          <li
            key={item}
            className={`flex items-start gap-3 py-4 text-sm leading-relaxed ${itemColor}`}
          >
            <span
              aria-hidden
              className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${itemDot}`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FAQ — 박스 없는 깔끔 accordion
// ─────────────────────────────────────────────────────────────

function FaqSection() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-32 md:px-12 md:py-48">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          자주 묻는 질문
        </p>
        <h2 className="mt-4 text-2xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-3xl">
          궁금한 점이 있나요?
        </h2>
      </div>

      <div className="mt-16 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        {FAQ.map((f) => (
          <details
            key={f.q}
            className="group [&[open]_summary_.faq-chevron]:rotate-180"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-left text-sm font-medium transition-colors hover:text-[var(--color-accent)]">
              <span>{f.q}</span>
              <span
                aria-hidden
                className="faq-chevron grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--color-text-tertiary)] transition-transform duration-300"
              >
                <ChevronDown className="h-4 w-4" />
              </span>
            </summary>
            <p className="pb-6 pr-12 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// CTA — 풀블리드 mesh
// ─────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--color-accent)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          viewBox="0 0 1200 600"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="pr-cta-1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pr-cta-2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="180"
            cy="180"
            r="320"
            fill="url(#pr-cta-1)"
            className="landing-cta-mesh-1"
          />
          <circle
            cx="1040"
            cy="460"
            r="380"
            fill="url(#pr-cta-2)"
            className="landing-cta-mesh-2"
          />
        </svg>
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-32 text-center md:px-12 md:py-56">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
            공급업체로 시작하기
          </p>
          <h2 className="mt-6 break-keep text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-white md:text-6xl">
            기본 5%,
            <br />
            영업일 3일 입금.
          </h2>
          <p className="mx-auto mt-7 max-w-xl text-sm text-white/85">
            가입 30초 · 사업자등록증만 있으면 OK.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="landing-cta-hero inline-flex h-14 items-center gap-2 rounded-full bg-white px-9 text-sm font-semibold text-[var(--color-accent)] active:scale-[0.98]"
            >
              공급업체로 가입
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/about"
              className="inline-flex h-14 items-center rounded-full border-2 border-white/40 bg-white/10 px-9 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              회사 소개 보기
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

