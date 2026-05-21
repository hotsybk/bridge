import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Mail,
  Package,
  Repeat,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
  Users,
} from "lucide-react";

import { GlassCard } from "@/components/shared/glass-card";
import { Reveal } from "@/components/shared/reveal";

// Server Component — 정적 prerender (AuthContext 는 layout.tsx 의 클라이언트 wrapper)
// 메인 리뉴얼 명세: docs/landing-design-renewal-plan.md + P0 시각 보강 4종

export default function LandingPage() {
  return (
    <>
      {/* 전역 radial gradient overlay — 화면 우상단·좌하단 미세 톤 */}
      <div className="landing-bg-overlay" aria-hidden />

      <div className="relative z-10 min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <TopNav />
        <Hero />
        <Flow />
        <Features />
        <Audience />
        <Steps />
        <BottomCTA />
        <Footer />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// TopNav
// ─────────────────────────────────────────────────────────────

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/75 backdrop-blur-md">
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
            className="hidden rounded-full px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] md:inline-flex"
          >
            소개
          </Link>
          <Link
            href="/pricing"
            className="hidden rounded-full px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] md:inline-flex"
          >
            수수료
          </Link>
          <Link
            href="#flow"
            className="hidden rounded-full px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] md:inline-flex"
          >
            구조
          </Link>
          <Link
            href="/login"
            className="ml-2 rounded-full px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            로그인
          </Link>
          <Link
            href="/register"
            className="landing-cta-glow ml-1 inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white"
          >
            회원가입
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero — 큰 타이포 + SVG mesh blob 배경 + 우측 카탈로그 mock-up
// ─────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-24 md:px-12 md:pt-28 md:pb-32">
      {/* Hero 영역 한정 SVG mesh blob (배경, 카드 뒤에) */}
      <HeroMeshBackground />

      <div className="relative grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
        {/* Left — 텍스트 + CTA */}
        <div className="text-center lg:text-left">
          <div className="landing-fade-up" style={{ animationDelay: "0ms" }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
              <Sparkles className="h-3.5 w-3.5" />
              Phase 1 베타 — 무료 체험
            </span>
          </div>

          <h1
            className="landing-fade-up mt-6 text-5xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-7xl lg:text-8xl"
            style={{ animationDelay: "150ms" }}
          >
            병원 운영의
            <br />
            모든 것,{" "}
            <span
              className="landing-fade-up text-[var(--color-accent)]"
              style={{ animationDelay: "350ms", display: "inline-block" }}
            >
              한 곳에서.
            </span>
          </h1>

          <p
            className="landing-fade-up mx-auto mt-7 max-w-xl text-base text-[var(--color-text-secondary)] md:text-lg lg:mx-0"
            style={{ animationDelay: "500ms" }}
          >
            의료기기와 소모품을 가장 빠르게, 가장 투명하게.
            전국 공급업체와 바로 연결되는 거래 플랫폼.
          </p>

          <div
            className="landing-fade-up mt-10 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            style={{ animationDelay: "650ms" }}
          >
            <Link
              href="/register"
              className="landing-cta-glow inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-base font-medium text-white active:scale-[0.98]"
            >
              지금 시작하기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#flow"
              className="inline-flex h-12 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
              어떻게 동작하나
            </Link>
          </div>

          <p
            className="landing-fade-up mt-6 text-xs text-[var(--color-text-tertiary)]"
            style={{ animationDelay: "800ms" }}
          >
            사업자등록증만 있으면 30초 만에 시작할 수 있습니다.
          </p>
        </div>

        {/* Right — 카탈로그 mock-up */}
        <div
          className="landing-fade-up relative mt-4 lg:mt-0"
          style={{ animationDelay: "900ms" }}
        >
          <HeroCatalogMockup />
        </div>
      </div>
    </section>
  );
}

function HeroMeshBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
    >
      <svg
        viewBox="0 0 800 600"
        className="absolute -right-20 -top-10 h-[600px] w-[800px] opacity-60"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="meshA" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0066CC" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0066CC" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="meshB" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="500" cy="200" r="200" fill="url(#meshA)" className="landing-mesh-1" />
        <circle cx="650" cy="380" r="180" fill="url(#meshB)" className="landing-mesh-2" />
      </svg>
    </div>
  );
}

const MOCK_PRODUCTS = [
  {
    name: "수술용 라텍스 장갑",
    cat: "일회용 의료용품",
    price: "8,900",
    badge: "공동구매",
    grade: 1,
  },
  {
    name: "디지털 혈압계",
    cat: "진단기기",
    price: "127,000",
    badge: "정기구독",
    grade: 2,
  },
  {
    name: "소독용 알코올 솜",
    cat: "위생용품",
    price: "12,500",
    badge: "즉시배송",
    grade: 1,
  },
] as const;

const BADGE_TONES: Record<string, string> = {
  공동구매: "bg-[var(--color-accent-light)] text-[var(--color-accent)]",
  정기구독: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  즉시배송: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
};

function HeroCatalogMockup() {
  return (
    <div className="relative">
      <GlassCard intensity="md" className="overflow-hidden p-5 md:p-6">
        {/* Mock-up header */}
        <div className="flex items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
              <Package className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="text-xs font-semibold">카탈로그 미리보기</p>
          </div>
          <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-tertiary)]">
            PREVIEW
          </span>
        </div>

        {/* Mock search bar */}
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-primary)]/70 px-3 py-2 text-xs text-[var(--color-text-tertiary)] backdrop-blur-sm">
          <span className="inline-flex h-2 w-2 rounded-full bg-[var(--color-text-tertiary)]/40" />
          <span>장갑, 거즈, 소독제...</span>
        </div>

        {/* Mock product list */}
        <ul className="mt-4 space-y-2.5">
          {MOCK_PRODUCTS.map((p) => (
            <li
              key={p.name}
              className="group flex items-center gap-3 rounded-xl bg-[var(--color-bg-primary)]/60 p-3 backdrop-blur-sm transition-colors hover:bg-[var(--color-bg-primary)]/90"
            >
              {/* Thumb placeholder */}
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-accent-light)]">
                <span
                  className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${
                    p.grade === 1
                      ? "bg-[var(--color-class-1)]/20 text-[var(--color-class-1)]"
                      : "bg-[var(--color-class-2)]/20 text-[var(--color-class-2)]"
                  }`}
                >
                  {p.grade}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{p.name}</p>
                <p className="truncate text-[10px] text-[var(--color-text-tertiary)]">
                  {p.cat}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold tabular-nums">
                  {p.price}
                  <span className="ml-0.5 text-[10px] font-normal text-[var(--color-text-tertiary)]">원</span>
                </p>
                <span
                  className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${BADGE_TONES[p.badge]}`}
                >
                  {p.badge}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-light)] pt-3 text-[10px] text-[var(--color-text-tertiary)]">
          <span>Phase 2 출시 예정</span>
          <span className="inline-flex items-center gap-1 text-[var(--color-accent)]">
            전체 보기
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </GlassCard>

      {/* Floating tag — 우측 상단 */}
      <span className="absolute -right-3 -top-3 inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-3 py-1 text-[10px] font-semibold text-white shadow-lg">
        <Sparkles className="h-3 w-3" />
        실시간 가격
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Flow — 공급망 다이어그램 (신규)
// ─────────────────────────────────────────────────────────────

function Flow() {
  return (
    <section
      id="flow"
      className="border-y border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] py-24 md:py-32 scroll-mt-24"
    >
      <div className="mx-auto max-w-5xl px-6 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            어떻게 동작하나
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] md:text-5xl">
            중간 도매상 없이, 바로 거래.
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)] md:text-lg">
            병원과 공급업체가 직접 만납니다. 가격은 투명하게, 입금은 4~6개월에서 3일로.
          </p>
        </div>

        <Reveal>
          <FlowDiagram />
        </Reveal>

        {/* 절감 효과 비교 */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Reveal delay={120}>
            <article className="rounded-2xl bg-[var(--color-bg-primary)] p-6 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                기존 입금
              </p>
              <p className="mt-3 text-2xl font-semibold text-[var(--color-text-secondary)]">
                4~6개월
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">중간 도매상을 거치며 지연</p>
            </article>
          </Reveal>
          <Reveal delay={240}>
            <article className="rounded-2xl bg-[var(--color-accent)] p-6 text-center text-white">
              <p className="text-xs font-medium uppercase tracking-wider text-white/70">
                MedPlace 입금
              </p>
              <p className="mt-3 text-2xl font-semibold">3일</p>
              <p className="mt-1 text-xs text-white/70">배송 완료 후 영업일 기준</p>
            </article>
          </Reveal>
          <Reveal delay={360}>
            <article className="rounded-2xl bg-[var(--color-bg-primary)] p-6 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                수수료
              </p>
              <p className="mt-3 text-2xl font-semibold">
                <span className="text-[var(--color-accent)]">5</span>
                <span className="text-[var(--color-text-secondary)]">%</span>
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">기본 요율 · 거래량별 할인</p>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FlowDiagram() {
  return (
    <div className="relative mt-14 overflow-hidden rounded-3xl bg-[var(--color-bg-primary)] p-8 md:p-12">
      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {/* Node — 병원 */}
        <FlowNode
          icon={Stethoscope}
          label="병원·의원"
          sub="구매·결재·세금계산서"
          tone="primary"
        />
        <FlowConnector />
        {/* Node — MedPlace */}
        <FlowNode
          icon={Sparkles}
          label="MedPlace"
          sub="투명한 직거래 마켓플레이스"
          tone="accent"
        />
        <FlowConnector />
        {/* Node — 공급업체 */}
        <FlowNode
          icon={Building2}
          label="공급업체"
          sub="판매·제조·수입업"
          tone="primary"
        />
      </div>

      {/* 흐름 설명 — 모바일 가독성 */}
      <div className="mt-8 grid gap-3 text-xs text-[var(--color-text-secondary)] md:grid-cols-3">
        <p>
          <span className="font-semibold text-[var(--color-text-primary)]">병원 →</span>{" "}
          여러 공급업체 가격 비교 후 직접 주문
        </p>
        <p className="text-center">
          <span className="font-semibold text-[var(--color-accent)]">자동화</span>{" "}
          UDI 보고 · 세금계산서 · 정기 발주
        </p>
        <p className="md:text-right">
          <span className="font-semibold text-[var(--color-text-primary)]">공급업체 ←</span>{" "}
          D+3 빠른 정산 · 직접 노출
        </p>
      </div>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  label,
  sub,
  tone,
}: {
  icon: typeof Stethoscope;
  label: string;
  sub: string;
  tone: "primary" | "accent";
}) {
  const isAccent = tone === "accent";
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={`grid h-16 w-16 place-items-center rounded-2xl ${
          isAccent
            ? "bg-[var(--color-accent)] text-white shadow-lg"
            : "bg-[var(--color-bg-secondary)] text-[var(--color-accent)]"
        }`}
      >
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{sub}</p>
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="hidden h-px w-full bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent md:block" />
  );
}

// ─────────────────────────────────────────────────────────────
// Features — Reveal stagger + 3D tilt
// ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: TrendingDown,
    title: "투명한 가격 비교",
    desc: "공급업체마다 가격이 다른 의료시장. 같은 제품·같은 등급의 가격을 한눈에 비교하고, 견적은 평균 1영업일 안에 받습니다.",
  },
  {
    icon: Repeat,
    title: "매달 쓰는 품목, 자동 주문",
    desc: "장갑·거즈·소독제처럼 매달 쓰는 품목은 한 번만 설정하면 자동으로 주문됩니다. 재고가 떨어질 일이 없습니다.",
  },
  {
    icon: Users,
    title: "공동구매로 더 낮은 가격",
    desc: "여러 병원이 모이면 가격이 내려갑니다. 공동구매가 마감되면 자동으로 결제·주문이 진행됩니다.",
  },
] as const;

function Features() {
  return (
    <section
      id="features"
      className="mx-auto max-w-6xl scroll-mt-24 px-6 py-32 md:px-12 md:py-40"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          왜 MedPlace 인가
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] md:text-5xl">
          구매도, 정산도, 자동으로.
        </h2>
        <p className="mt-3 text-[var(--color-text-secondary)] md:text-lg">
          간납사 없이 공급업체와 직접. 가격은 투명하게, 정산은 빠르게.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 120}>
            <article className="landing-tilt h-full rounded-3xl bg-[var(--color-bg-secondary)] p-8 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {f.desc}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Audience — 글래스 카드 + tilt
// ─────────────────────────────────────────────────────────────

function Audience() {
  return (
    <section
      id="audience"
      className="mx-auto max-w-6xl scroll-mt-24 px-6 py-32 md:px-12 md:py-40"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          누구를 위한 서비스인가
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] md:text-5xl">
          병원도, 공급업체도.
        </h2>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <Reveal delay={0}>
          <div className="landing-tilt h-full">
            <GlassCard hover intensity="sm" as="article" className="h-full p-10">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                <Stethoscope className="h-6 w-6" />
              </span>
              <h3 className="mt-6 text-2xl font-semibold tracking-tight">병원·의원</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                의원부터 종합병원까지. 구매·결재·세금계산서 한 흐름.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <Bullet>여러 공급업체 가격을 한 화면에서 비교</Bullet>
                <Bullet>매달 쓰는 품목은 자동 주문 — 재고 걱정 없음</Bullet>
                <Bullet>단계별 결재 승인 + 세금계산서 자동 발행</Bullet>
                <Bullet>대형 병원용 견적 요청 + 의료기기 사용 보고 자동화</Bullet>
              </ul>
              <Link
                href="/register"
                className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                병원으로 가입하기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </GlassCard>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="landing-tilt h-full">
            <GlassCard hover intensity="sm" as="article" className="h-full p-10">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                <Building2 className="h-6 w-6" />
              </span>
              <h3 className="mt-6 text-2xl font-semibold tracking-tight">공급업체</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                판매업·제조업·수입업. 중간 도매상 없는 직거래.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <Bullet>4~6개월 결제 지연 대신 3일 만에 입금</Bullet>
                <Bullet>주문·발송·입금 정리가 한 화면에서</Bullet>
                <Bullet>의료기기 사용 보고 자동화로 행정 부담 절감</Bullet>
                <Bullet>전국 병원에 바로 노출되는 상품 목록</Bullet>
              </ul>
              <Link
                href="/register"
                className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                공급업체로 가입하기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </GlassCard>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
      />
      <span className="text-[var(--color-text-secondary)]">{children}</span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Steps — connector dot + tilt
// ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: Mail,
    title: "1. 계정 만들기",
    desc: "이메일로 30초. 병원 또는 공급업체 중 한 가지 역할을 선택합니다.",
  },
  {
    icon: ShieldCheck,
    title: "2. 사업자 인증",
    desc: "사업자등록증 사진을 올리면 자동 글자 인식 + 국세청 조회로 빠르게 검증합니다.",
  },
  {
    icon: Sparkles,
    title: "3. 사용 시작",
    desc: "병원은 바로 검색·주문, 공급업체는 입점 심사 후 판매 관리 화면을 사용합니다.",
  },
] as const;

function Steps() {
  return (
    <section id="steps" className="bg-[var(--color-bg-secondary)] py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            어떻게 시작하나
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] md:text-5xl">
            세 단계면 충분합니다.
          </h2>
        </div>

        <ol className="mt-16 grid gap-6 md:grid-cols-3 md:gap-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 120}>
              <li className="landing-tilt relative h-full rounded-2xl bg-[var(--color-bg-primary)] p-8 shadow-sm">
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute -right-3 top-1/2 hidden h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--color-accent)] md:block"
                  />
                )}
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {s.desc}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Bottom CTA — 풀블리드 mesh + 큰 타이포 + 신뢰 mini stats
// ─────────────────────────────────────────────────────────────

const TRUST_STATS = [
  {
    icon: ShieldCheck,
    label: "안전",
    desc: "사업자 인증과 의료기기 판매업 신고증 확인 후 입점",
  },
  {
    icon: TrendingDown,
    label: "투명",
    desc: "공급업체 가격을 한 화면에서 비교, 숨겨진 마진 없음",
  },
  {
    icon: Sparkles,
    label: "자동",
    desc: "정기 주문, 의료기기 사용 보고, 세금계산서 모두 자동",
  },
] as const;

function BottomCTA() {
  return (
    <section className="relative overflow-hidden bg-[var(--color-accent)]">
      {/* 풀블리드 mesh background */}
      <CtaMeshBackground />

      <div className="relative mx-auto max-w-6xl px-6 py-32 text-center md:px-12 md:py-48">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
            지금 시작하기
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white md:text-7xl lg:text-8xl">
            의료기기 구매의
            <br />
            새로운 기준.
          </h2>
          <p className="mx-auto mt-7 max-w-xl text-base text-white/80 md:text-lg">
            가입은 무료, 인증은 자동, 시작은 지금입니다.
          </p>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="landing-cta-hero inline-flex h-14 items-center gap-2 rounded-full bg-white px-9 text-base font-semibold text-[var(--color-accent)] active:scale-[0.98]"
            >
              무료로 시작하기
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/about"
              className="inline-flex h-14 items-center rounded-full border-2 border-white/40 bg-white/10 px-9 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              회사 소개 보기
            </Link>
          </div>

          <p className="mt-8 text-xs text-white/60">
            ⓘ 현재 Phase 1 베타 — 실 결제·실 거래는 진행되지 않습니다
          </p>
        </Reveal>

        {/* 신뢰 mini stats 3개 */}
        <div className="mt-20 grid gap-5 md:grid-cols-3">
          {TRUST_STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 150}>
              <article className="h-full rounded-3xl border border-white/20 bg-white/10 p-7 text-left backdrop-blur-md">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/20 text-white">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-5 text-sm font-semibold uppercase tracking-wider text-white/90">
                  {s.label}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/75">
                  {s.desc}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaMeshBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 1200 800"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="ctaMesh1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ctaMesh2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ctaMesh3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="320" fill="url(#ctaMesh1)" className="landing-cta-mesh-1" />
        <circle cx="1000" cy="600" r="380" fill="url(#ctaMesh2)" className="landing-cta-mesh-2" />
        <circle cx="700" cy="300" r="260" fill="url(#ctaMesh3)" className="landing-cta-mesh-1" />
      </svg>
      {/* 미세 grid 텍스처 — 깊이감 */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Footer — 4-column 정돈 + 큰 워드마크
// ─────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="relative bg-[var(--color-bg-secondary)]">
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-10 md:px-12 md:pt-24">
        {/* 큰 워드마크 — Footer 의 visual anchor */}
        <div className="border-b border-[var(--color-border-light)] pb-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="landing-micro-spin grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent)] text-white">
              <Stethoscope className="h-6 w-6" />
            </span>
            <span className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
              MedPlace
            </span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-[var(--color-text-secondary)]">
            병원과 의료기기·소모품 공급업체를 바로 연결해주는 거래 플랫폼.
            <br />
            중간 도매상 없이, 가격은 투명하게, 입금은 3일 만에.
          </p>
        </div>

        {/* 4-column grid */}
        <div className="grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
          <FooterCol title="제품">
            <FooterLink href="/about">회사 소개</FooterLink>
            <FooterLink href="/pricing">수수료 정책</FooterLink>
            <FooterLink href="#features">기능</FooterLink>
            <FooterLink href="#flow">동작 방식</FooterLink>
          </FooterCol>

          <FooterCol title="시작하기">
            <FooterLink href="/register">회원가입</FooterLink>
            <FooterLink href="/login">로그인</FooterLink>
            <FooterLink href="/onboarding/buyer">병원 온보딩</FooterLink>
            <FooterLink href="/onboarding/vendor">공급업체 온보딩</FooterLink>
          </FooterCol>

          <FooterCol title="운영">
            <FooterLink href="/admin/vendors">입점 심사</FooterLink>
            <FooterLink href="/admin/debug/snapshot">실시간 디버그</FooterLink>
          </FooterCol>

          <FooterCol title="법적">
            <FooterLinkPending>이용약관 (준비 중)</FooterLinkPending>
            <FooterLinkPending>개인정보 처리방침 (준비 중)</FooterLinkPending>
            <FooterLinkPending>통신판매업 신고 (준비 중)</FooterLinkPending>
          </FooterCol>
        </div>

        {/* 사업자 정보 + copyright */}
        <div className="border-t border-[var(--color-border-light)] pt-8">
          <div className="grid gap-4 text-xs text-[var(--color-text-tertiary)] md:grid-cols-[1fr_auto] md:gap-8">
            <div className="space-y-1.5">
              <p>
                <span className="text-[var(--color-text-secondary)]">사업자등록번호</span>{" "}
                ··· 진행 중
              </p>
              <p>
                <span className="text-[var(--color-text-secondary)]">통신판매업 신고</span>{" "}
                ··· 예정
              </p>
              <p>
                <span className="text-[var(--color-text-secondary)]">대표 이메일</span>{" "}
                support@medplace.example.com
              </p>
              <p>
                <span className="text-[var(--color-text-secondary)]">주소</span>{" "}
                서울특별시 (Phase 1 베타 단계)
              </p>
            </div>
            <div className="text-left md:text-right">
              <p>© 2026 MedPlace. All rights reserved.</p>
              <p className="mt-1.5">
                본 화면은 Phase 1 개발 단계입니다.
                <br />
                실 결제·실 거래는 진행되지 않습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {title}
      </p>
      <ul className="mt-5 space-y-3 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
      >
        {children}
      </Link>
    </li>
  );
}

function FooterLinkPending({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <span
        className="cursor-not-allowed text-[var(--color-text-tertiary)]"
        title="Phase 1 후반에 추가 예정"
      >
        {children}
      </span>
    </li>
  );
}
