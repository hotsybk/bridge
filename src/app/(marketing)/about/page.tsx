import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Clock,
  Heart,
  Sparkles,
  Stethoscope,
  TrendingDown,
  Users,
  Zap,
} from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { GlassCard } from "@/components/shared/glass-card";
import { Reveal } from "@/components/shared/reveal";

export const metadata = {
  title: "MedPlace 소개 — 한국 의료 구매의 새로운 기준",
  description:
    "MedPlace 는 한국 의료기관과 의료기기·소모품 공급업체를 직접 연결하는 멀티벤더 B2B 마켓플레이스입니다.",
};

/**
 * /about — 풀 리디자인 (2026-06).
 *
 * 디자인 컨셉:
 *  - Hero: 큰 타이포 + 메쉬 글로우 배경 + 우측 비주얼
 *  - Stats: 4개 카운트업 — 정량적 약속
 *  - Problem: 좌측 인포그래픽 (도매상 체인 → MedPlace 직거래)
 *  - Values: 글래스 카드 3개 + tilt
 *  - Principles: 큰 워터마크 번호 + 텍스트
 *  - Roadmap: 시각적 timeline (Phase 1~6)
 *  - CTA: 풀블리드 mesh + 큰 타이포
 */

export default function AboutPage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <HeroSection />
      <StatsBar />
      <ProblemSection />
      <ValuesSection />
      <PrinciplesSection />
      <RoadmapSection />
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
      {/* 메쉬 글로우 배경 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <svg
          viewBox="0 0 1200 700"
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="about-mesh-a" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0066CC" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0066CC" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="about-mesh-b" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="900"
            cy="180"
            r="340"
            fill="url(#about-mesh-a)"
            className="landing-mesh-1"
          />
          <circle
            cx="220"
            cy="540"
            r="280"
            fill="url(#about-mesh-b)"
            className="landing-mesh-2"
          />
        </svg>
      </div>

      <div className="mx-auto max-w-6xl px-6 pt-32 pb-32 md:px-12 md:pt-48 md:pb-48">
        <div className="grid items-center gap-16 lg:grid-cols-[1.15fr_1fr]">
          {/* Left — 텍스트 */}
          <div>
            <span
              className="landing-fade-up inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]"
              style={{ animationDelay: "0ms" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              MedPlace 소개
            </span>
            <h1
              className="landing-fade-up mt-6 break-keep text-5xl font-semibold leading-[1.04] tracking-[-0.04em] md:text-6xl"
              style={{ animationDelay: "150ms" }}
            >
              의료 구매의
              <br />
              <span
                className="landing-fade-up text-[var(--color-accent)]"
                style={{ animationDelay: "350ms", display: "inline-block" }}
              >
                시간을 가져갑니다.
              </span>
            </h1>
            <p
              className="landing-fade-up mt-7 max-w-xl text-sm text-[var(--color-text-secondary)]"
              style={{ animationDelay: "500ms" }}
            >
              도매상 중심의 불투명한 거래에서, 병원과 공급업체가 직접 만나는
              투명한 거래로. 의료 현장이 환자에게 시간을 쓸 수 있도록.
            </p>
            <div
              className="landing-fade-up mt-10 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "650ms" }}
            >
              <Link
                href="/register"
                className="landing-cta-glow inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-medium text-white active:scale-[0.98]"
              >
                지금 시작하기
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#problem"
                className="inline-flex h-12 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
                우리 이야기
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right — 비주얼 카드 (의료+데이터 결합) */}
          <div
            className="landing-fade-up relative"
            style={{ animationDelay: "800ms" }}
          >
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <GlassCard intensity="md" className="relative overflow-hidden p-8 md:p-10">
        {/* 큰 펄스 원 — 환자 중심 */}
        <div className="relative mx-auto mb-6 grid h-24 w-24 place-items-center md:h-28 md:w-28">
          <span className="absolute inset-0 rounded-full bg-[var(--color-accent)]/10" />
          <span className="absolute inset-3 rounded-full bg-[var(--color-accent)]/20" />
          <span className="absolute inset-6 rounded-full bg-[var(--color-accent)]" />
          <Heart
            className="relative z-10 h-7 w-7 text-white"
            fill="currentColor"
            strokeWidth={0}
          />
        </div>

        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          우리가 지키는 한 가지
        </p>
        <p className="mt-3 text-center text-2xl font-semibold tracking-tight md:text-3xl">
          환자에게 시간을.
        </p>

        {/* 하단 미니 데이터 줄 */}
        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-[var(--color-border-light)] pt-6 text-center">
          <MiniStat label="입금 단축" value="98%" />
          <MiniStat label="가격 비교 시간" value="-87%" />
          <MiniStat label="발주 자동화" value="100%" />
        </div>
      </GlassCard>

      {/* 떠다니는 미니 카드 — 좌상단 */}
      <span className="absolute -left-3 -top-3 inline-flex items-center gap-1 rounded-full bg-[var(--color-text-primary)] px-3 py-1 text-[10px] font-semibold text-white shadow-lg">
        <Sparkles className="h-3 w-3" />
        한국 의료 B2B
      </span>
      {/* 우하단 */}
      <span className="absolute -bottom-3 -right-3 inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-3 py-1 text-[10px] font-semibold text-white shadow-lg">
        <Zap className="h-3 w-3" />
        2026 베타 운영
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums text-[var(--color-accent)] md:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">
        {label}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stats bar — 큰 숫자 4개 (CountUp)
// ─────────────────────────────────────────────────────────────

function StatsBar() {
  return (
    <section className="border-y border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/40">
      <div className="mx-auto max-w-6xl px-6 py-20 md:px-12 md:py-24">
        <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:gap-y-0">
          <StatColumn value={3} prefix="" suffix="일" label="평균 정산" hint="기존 4~6개월 → MedPlace" />
          <StatColumn value={5} prefix="" suffix="%" label="플랫폼 수수료" hint="기존 도매상 평균 15~30%" />
          <StatColumn value={30} prefix="" suffix="초" label="가입 완료" hint="사업자등록증 1장이면" />
          <StatColumn value={0} prefix="₩" suffix="" label="가입비·약정" hint="언제든 해지 가능" />
        </div>
      </div>
    </section>
  );
}

function StatColumn({
  value,
  prefix,
  suffix,
  label,
  hint,
}: {
  value: number;
  prefix: string;
  suffix: string;
  label: string;
  hint: string;
}) {
  return (
    <Reveal>
      <div className="md:border-l md:border-[var(--color-border-light)] md:px-6 md:first:border-l-0 md:first:pl-0">
        <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
          <CountUp value={value} prefix={prefix} suffix={suffix} duration={1400} />
        </p>
        <p className="mt-3 text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{hint}</p>
      </div>
    </Reveal>
  );
}

// ─────────────────────────────────────────────────────────────
// Problem section — 인포그래픽
// ─────────────────────────────────────────────────────────────

function ProblemSection() {
  return (
    <section
      id="problem"
      className="mx-auto max-w-6xl px-6 py-32 md:px-12 md:py-48"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          해결하는 문제
        </p>
        <h2 className="mt-4 text-2xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-3xl">
          지금의 의료 구매,
          <br />
          너무 많은 손을 거칩니다.
        </h2>
      </div>

      <Reveal>
        <ChainCompare />
      </Reveal>

      <Reveal delay={200}>
        <StakeholderSplit />
      </Reveal>

      <Reveal delay={320}>
        <p className="mx-auto mt-20 max-w-2xl text-center text-sm font-semibold leading-relaxed tracking-tight text-[var(--color-text-primary)]">
          이 모든 비효율은 결국{" "}
          <span className="text-[var(--color-accent)]">환자가 받는 의료의 질과 가격</span>
          에 반영됩니다.
        </p>
      </Reveal>
    </section>
  );
}

/**
 * Before / After 가로 dot 다이어그램 — 박스 컨테이너 없음.
 * 좌우 split 으로 두 흐름을 한 번에 비교.
 */
function ChainCompare() {
  return (
    <div className="mt-20 grid gap-12 md:grid-cols-2 md:gap-16">
      {/* Before */}
      <div className="text-center md:text-left">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
          기존 거래
        </p>
        <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-secondary)] md:text-3xl">
          5<span className="text-2xl md:text-3xl">단계</span>{" "}
          <span className="text-2xl text-[var(--color-text-tertiary)] md:text-3xl">·</span>{" "}
          4<span className="text-2xl md:text-3xl">개월</span>
        </p>

        {/* 가로 dot 다이어그램 — 5단계 */}
        <DotChain count={5} muted />

        <ol className="mt-6 space-y-1.5 text-xs leading-relaxed text-[var(--color-text-tertiary)] md:text-sm">
          <li>병원이 도매상 여러 곳에 전화</li>
          <li>도매상이 다시 유통업체에 발주</li>
          <li>유통업체가 제조사에 발주</li>
          <li>제조사 → 유통업체 → 도매상 → 병원</li>
          <li>4~6개월 뒤 공급업체에 입금</li>
        </ol>
      </div>

      {/* After */}
      <div className="text-center md:text-left">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]">
          MedPlace 직거래
        </p>
        <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-accent)] md:text-3xl">
          2<span className="text-2xl md:text-3xl">단계</span>{" "}
          <span className="text-2xl text-[var(--color-accent)]/40 md:text-3xl">·</span>{" "}
          3<span className="text-2xl md:text-3xl">일</span>
        </p>

        {/* 가로 dot 다이어그램 — 2단계 */}
        <DotChain count={2} />

        <ol className="mt-6 space-y-1.5 text-xs leading-relaxed text-[var(--color-text-primary)] md:text-sm">
          <li>병원이 한 화면에서 여러 공급업체 가격 비교</li>
          <li>공급업체가 직접 배송 + 영업일 3일 자동 입금</li>
        </ol>
      </div>
    </div>
  );
}

/**
 * 가로 dot chain — `●━━●━━●` 식. 박스 없이 line + dot 만.
 */
function DotChain({ count, muted = false }: { count: number; muted?: boolean }) {
  const color = muted
    ? "bg-[var(--color-text-tertiary)]/35"
    : "bg-[var(--color-accent)]";
  const lineColor = muted
    ? "bg-[var(--color-text-tertiary)]/25"
    : "bg-[var(--color-accent)]/40";
  return (
    <div
      aria-hidden
      className="mt-6 flex w-full max-w-sm items-center md:max-w-md"
    >
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="flex flex-1 items-center last:flex-initial">
          <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
          {i < count - 1 && <span className={`h-px flex-1 ${lineColor}`} />}
        </span>
      ))}
    </div>
  );
}

/**
 * 병원 / 공급업체 입장 — 박스 없이 좌·우 split + 가운데 vertical divider.
 */
function StakeholderSplit() {
  return (
    <div className="mx-auto mt-24 max-w-5xl">
      <div className="grid gap-12 md:grid-cols-2 md:gap-0">
        <StakeholderCol
          icon={Building2}
          label="병원 입장"
          body="의원·중소병원은 매번 다른 도매상에 전화해 가격을 비교하고, 정기 주문을 직접 챙기고, 세금계산서를 손으로 일일이 정리합니다."
        />
        <div className="md:border-l md:border-[var(--color-border-light)] md:pl-12">
          <StakeholderCol
            icon={Stethoscope}
            label="공급업체 입장"
            body="공급업체는 4~6개월씩 결제 지연을 견디며 중간 거래상을 거쳐야 하고, 서면 계약 없이 거래하며, 식약처 의료기기 보고도 일일이 손으로 처리합니다."
            noBorder
          />
        </div>
      </div>
    </div>
  );
}

function StakeholderCol({
  icon: Icon,
  label,
  body,
  noBorder,
}: {
  icon: typeof Building2;
  label: string;
  body: string;
  noBorder?: boolean;
}) {
  return (
    <div className={noBorder ? "" : "md:pr-12"}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--color-accent)]" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-primary)]">
          {label}
        </p>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {body}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Values
// ─────────────────────────────────────────────────────────────

type ValueGraphicKind = "transparent" | "auto" | "direct";

const VALUES: Array<{
  num: string;
  title: string;
  desc: string;
  graphic: ValueGraphicKind;
}> = [
  {
    num: "01",
    title: "투명",
    desc: "같은 등급·같은 인증 제품의 가격을 한 화면에서 비교합니다. 숨은 마진과 변동가 없음.",
    graphic: "transparent",
  },
  {
    num: "02",
    title: "자동",
    desc: "정기 발주, 식약처 의료기기 보고, 세금계산서 발행이 모두 자동. 사람의 시간은 환자에게.",
    graphic: "auto",
  },
  {
    num: "03",
    title: "직접",
    desc: "중간 거래상 없이 병원과 공급업체가 직접 연결됩니다. 정산은 영업일 3일.",
    graphic: "direct",
  },
];

function ValuesSection() {
  return (
    <section className="border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/30">
      <div className="mx-auto max-w-6xl px-6 py-32 md:px-12 md:py-48">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            우리의 접근
          </p>
          <h2 className="mt-4 text-2xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-3xl">
            세 가지 가치로
            <br />
            다시 만듭니다.
          </h2>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 120}>
              <article className="group h-full overflow-hidden rounded-3xl bg-[var(--color-bg-primary)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(0,102,204,0.25)]">
                {/* 상단 일러스트 영역 — gradient + 큰 비주얼 */}
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[var(--color-accent-light)] via-[var(--color-bg-primary)] to-[var(--color-bg-primary)] md:h-52">
                  {/* 그래픽 별 비주얼 */}
                  <ValueGraphic kind={v.graphic} />

                  {/* 우상단 번호 */}
                  <span className="absolute right-5 top-5 text-xs font-semibold tabular-nums tracking-[0.18em] text-[var(--color-accent)]">
                    {v.num}
                  </span>
                </div>

                {/* 하단 텍스트 */}
                <div className="border-t border-[var(--color-border-light)] p-7 md:p-8">
                  <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
                    {v.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {v.desc}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * 가치별 그래픽 일러스트 — 각 가치의 의미를 시각화.
 *  - 투명: 가격 막대 3개 비교 + 체크
 *  - 자동: 무한 회전 화살표
 *  - 직접: 두 점 직선 연결
 */
function ValueGraphic({ kind }: { kind: ValueGraphicKind }) {
  if (kind === "transparent") {
    // 가격 비교 막대 그래픽
    return (
      <div
        aria-hidden
        className="absolute inset-0 flex items-end justify-center gap-3 pb-12"
      >
        {[55, 80, 35].map((h, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <span
              className={`w-9 rounded-t-md transition-all duration-700 group-hover:scale-y-110 ${
                i === 2
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-accent)]/25"
              }`}
              style={{ height: `${h}px`, transformOrigin: "bottom" }}
            />
            <span className="h-1 w-9 rounded-full bg-[var(--color-accent)]/15" />
          </div>
        ))}
      </div>
    );
  }

  if (kind === "auto") {
    // 회전하는 무한 원 + 중앙 Zap
    return (
      <div aria-hidden className="absolute inset-0 grid place-items-center">
        <div className="relative h-32 w-32">
          {/* 외곽 회전 dashed 원 */}
          <svg
            viewBox="0 0 128 128"
            className="absolute inset-0 h-full w-full animate-[spin_18s_linear_infinite]"
          >
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="rgb(0 102 204 / 0.35)"
              strokeWidth="1.5"
              strokeDasharray="6 10"
            />
          </svg>
          {/* 내부 작은 dot 3개 */}
          {[0, 120, 240].map((deg) => (
            <span
              key={deg}
              className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[var(--color-accent)]/40"
              style={{
                transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-46px)`,
              }}
            />
          ))}
          {/* 중앙 메인 아이콘 */}
          <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/30">
            <Zap className="h-7 w-7" fill="currentColor" strokeWidth={0} />
          </span>
        </div>
      </div>
    );
  }

  // direct — 좌·우 두 노드를 직선으로 연결
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex items-center justify-center px-8"
    >
      <div className="flex w-full max-w-[240px] items-center">
        {/* 좌측 노드 */}
        <div className="flex flex-col items-center gap-2">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
            <Building2 className="h-6 w-6" />
          </span>
          <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">
            병원
          </span>
        </div>

        {/* 연결선 + dot */}
        <div className="relative flex-1 px-2">
          <div className="h-px bg-[var(--color-accent)]/30" />
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)]" />
        </div>

        {/* 우측 노드 */}
        <div className="flex flex-col items-center gap-2">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
            <Stethoscope className="h-6 w-6" />
          </span>
          <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">
            공급업체
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Principles
// ─────────────────────────────────────────────────────────────

const PRINCIPLES = [
  {
    title: "안전이 가격보다 먼저입니다",
    desc: "의료기기 판매업 신고증과 식약처 허가가 없는 제품은 노출하지 않습니다.",
  },
  {
    title: "공급업체는 파트너입니다",
    desc: "영업일 3일 빠른 정산, 숨김 없는 수수료 5%, 서면 계약. 갑을이 아닌 협업.",
  },
  {
    title: "병원의 시간을 돌려드립니다",
    desc: "정기 발주·식약처 의료기기 보고·세금계산서. 반복 작업은 자동으로.",
  },
  {
    title: "데이터는 사용자의 것입니다",
    desc: "구매 이력·재고 데이터는 사용자가 언제든 내려받을 수 있습니다.",
  },
  {
    title: "모르는 것은 모른다고 합니다",
    desc: "베타 단계는 베타라고 표시합니다. 책임 회피는 없습니다.",
  },
];

function PrinciplesSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-32 md:px-12 md:py-48">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          운영 원칙
        </p>
        <h2 className="mt-4 text-2xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-3xl">
          매일 지키는 다섯 가지.
        </h2>
      </div>

      <ol className="mx-auto mt-20 max-w-4xl">
        {PRINCIPLES.map((p, i) => (
          <Reveal key={p.title} delay={i * 80}>
            <li className="group relative grid gap-6 border-t border-[var(--color-border-light)] py-10 last:border-b md:grid-cols-[120px_1fr] md:gap-10 md:py-12">
              {/* 큰 번호 */}
              <span className="text-5xl font-semibold tabular-nums tracking-[-0.04em] text-[var(--color-accent)] md:text-6xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {p.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {p.desc}
                </p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Roadmap
// ─────────────────────────────────────────────────────────────

type RoadmapStatus = "current" | "next" | "future";

const ROADMAP: Array<{
  phase: string;
  title: string;
  body: string;
  period: string;
  status: RoadmapStatus;
}> = [
  {
    phase: "01",
    title: "가입·인증·카탈로그",
    body: "30초 만에 가입하고, 사업자등록증 한 장으로 자동 인증. 전국 공급업체 카탈로그를 둘러봅니다.",
    period: "2026 — 베타 운영 중",
    status: "current",
  },
  {
    phase: "02",
    title: "장바구니·결제·정산",
    body: "여러 공급업체 주문을 한 번에 결제. 배송 완료 후 영업일 3일 자동 정산.",
    period: "다음 출시 예정",
    status: "next",
  },
  {
    phase: "03",
    title: "정기 주문 자동화",
    body: "매달 쓰는 품목은 한 번만 설정. 재고 떨어질 일도, 발주서 다시 쓸 일도 없음.",
    period: "이후 출시",
    status: "future",
  },
  {
    phase: "04",
    title: "공동구매",
    body: "여러 병원이 모이면 단가가 한 단계 더 내려갑니다. 마감 시점에 자동 결제·발주.",
    period: "이후 출시",
    status: "future",
  },
  {
    phase: "05",
    title: "RFQ — 맞춤 견적",
    body: "종합병원을 위한 맞춤 견적 요청. 여러 공급업체의 제안을 한 화면에서.",
    period: "이후 출시",
    status: "future",
  },
  {
    phase: "06",
    title: "식약처 자동 보고·분석",
    body: "배송 완료 시 식약처 의료기기통합정보시스템에 자동 보고. 매출·고객·재고 분석.",
    period: "이후 출시",
    status: "future",
  },
];

function RoadmapSection() {
  const currentIdx = ROADMAP.findIndex((r) => r.status === "current");
  const progressPct = ((currentIdx + 1) / ROADMAP.length) * 100;

  return (
    <section className="border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/30">
      <div className="mx-auto max-w-6xl px-6 py-32 md:px-12 md:py-48">
        {/* 헤더 */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            로드맵
          </p>
          <h2 className="mt-4 text-2xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-3xl">
            우리가 가는 길.
          </h2>
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            지금 1단계 — 베타 운영 중. 곧 더 빠른 결제·정산이 이어집니다.
          </p>
        </div>

        {/* 상단 진행률 바 */}
        <div className="mx-auto mt-12 max-w-2xl">
          <div className="mb-3 flex items-baseline justify-between text-xs">
            <span className="font-semibold text-[var(--color-accent)]">
              <CountUp value={currentIdx + 1} duration={900} />
              <span className="text-[var(--color-text-tertiary)] font-normal">
                {" "}
                / {ROADMAP.length} 단계 진행 중
              </span>
            </span>
            <span className="tabular-nums text-[var(--color-text-tertiary)]">
              <CountUp value={Math.round(progressPct)} duration={900} suffix="%" />
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border-light)]">
            <div
              className="progress-bar-fill h-full rounded-full bg-[var(--color-accent)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* 세로 timeline */}
        <ol className="mx-auto mt-24 max-w-4xl">
          {ROADMAP.map((r, i) => (
            <Reveal key={r.phase} delay={i * 80}>
              <RoadmapRow {...r} isLast={i === ROADMAP.length - 1} />
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function RoadmapRow({
  phase,
  title,
  body,
  period,
  status,
  isLast,
}: {
  phase: string;
  title: string;
  body: string;
  period: string;
  status: RoadmapStatus;
  isLast: boolean;
}) {
  const isCurrent = status === "current";
  const isNext = status === "next";
  const isFuture = status === "future";

  return (
    <li className="relative grid grid-cols-[40px_1fr] gap-5 pb-10 md:grid-cols-[56px_1fr] md:gap-8 md:pb-14">
      {/* 좌측 — vertical line + 점 */}
      <div className="relative flex flex-col items-center">
        <span
          className={`relative z-10 grid h-8 w-8 place-items-center rounded-full transition-all md:h-10 md:w-10 ${
            isCurrent
              ? "bg-[var(--color-accent)] shadow-[0_0_0_6px_var(--color-accent-light)]"
              : isNext
                ? "border-2 border-[var(--color-accent)] bg-[var(--color-bg-primary)]"
                : "border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]"
          }`}
        >
          {isCurrent ? (
            <span className="status-pulse-dot h-2 w-2 rounded-full bg-white" />
          ) : isNext ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          ) : null}
        </span>
        {/* 연결선 */}
        {!isLast && (
          <span
            aria-hidden
            className={`absolute top-8 bottom-[-2.5rem] w-px md:top-10 md:bottom-[-3.5rem] ${
              isCurrent || isNext
                ? "bg-gradient-to-b from-[var(--color-accent)]/60 to-[var(--color-border-light)]"
                : "bg-[var(--color-border-light)]"
            }`}
          />
        )}
      </div>

      {/* 우측 — 콘텐츠 */}
      <div className={isFuture ? "pt-1.5 md:pt-2" : "pt-0 md:pt-1"}>
        {/* 헤더 라인 — phase 번호 + 상태 배지 + period */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={`text-xs font-semibold tabular-nums tracking-[0.18em] ${
              isCurrent
                ? "text-[var(--color-accent)]"
                : isNext
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)]"
            }`}
          >
            {phase}
          </span>

          {isCurrent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
              <span className="status-pulse-dot h-1 w-1 rounded-full bg-white" />
              진행 중
            </span>
          )}
          {isNext && (
            <span className="inline-flex items-center rounded-full border border-[var(--color-accent)]/40 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
              다음
            </span>
          )}

          <span
            className={`text-[11px] ${
              isCurrent || isNext
                ? "text-[var(--color-text-tertiary)]"
                : "text-[var(--color-text-tertiary)]/70"
            }`}
          >
            · {period}
          </span>
        </div>

        {/* 제목 */}
        <h3
          className={`mt-2 tracking-tight ${
            isCurrent
              ? "text-2xl font-semibold text-[var(--color-text-primary)] md:text-3xl"
              : isNext
                ? "text-2xl font-semibold text-[var(--color-text-primary)] md:text-3xl"
                : "text-sm font-medium text-[var(--color-text-secondary)]"
          }`}
        >
          {title}
        </h3>

        {/* 설명 — current / next 만 노출 */}
        {(isCurrent || isNext) && (
          <p
            className={`mt-3 max-w-xl text-sm leading-relaxed ${
              isCurrent
                ? "text-[var(--color-text-secondary)]"
                : "text-[var(--color-text-secondary)]/85"
            }`}
          >
            {body}
          </p>
        )}
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// CTA
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
            <radialGradient id="cta-about-1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="cta-about-2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="220"
            cy="180"
            r="320"
            fill="url(#cta-about-1)"
            className="landing-cta-mesh-1"
          />
          <circle
            cx="980"
            cy="460"
            r="360"
            fill="url(#cta-about-2)"
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
            함께 시작하기
          </p>
          <h2 className="mt-6 break-keep text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-white md:text-6xl">
            한 번만 가입하면,
            <br />
            발주는 매달 자동입니다.
          </h2>
          <p className="mx-auto mt-7 max-w-xl text-sm text-white/85">
            가입 무료, 인증 자동, 시작은 30초.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="landing-cta-hero inline-flex h-14 items-center gap-2 rounded-full bg-white px-9 text-sm font-semibold text-[var(--color-accent)] active:scale-[0.98]"
            >
              가입하기
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-14 items-center rounded-full border-2 border-white/40 bg-white/10 px-9 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              수수료 보기
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <p className="mt-10 text-xs text-white/60">
            <Clock className="mr-1 inline h-3 w-3" />
            베타 운영 중 — 결제·거래는 정식 출시 후 시작됩니다.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

