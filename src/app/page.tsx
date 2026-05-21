import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Mail,
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
// 메인 리뉴얼 명세: docs/landing-design-renewal-plan.md

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* 전역 radial gradient overlay — 화면 우상단·좌하단 미세 톤 */}
      <div className="landing-bg-overlay" aria-hidden />

      <div className="relative z-10">
        <TopNav />
        <Hero />
        <Features />
        <Audience />
        <Steps />
        <BottomCTA />
        <Footer />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TopNav — 살짝 더 강한 글래스 효과
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
            href="#features"
            className="hidden rounded-full px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] md:inline-flex"
          >
            기능
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
// Hero — 큰 타이포 + stagger fade-up + 우측 글래스 floating card
// ─────────────────────────────────────────────────────────────

const HERO_HIGHLIGHTS = [
  {
    icon: TrendingDown,
    title: "투명한 가격",
    desc: "공급업체 가격을 한눈에 비교",
  },
  {
    icon: Repeat,
    title: "자동 발주",
    desc: "정기 품목은 자동으로",
  },
  {
    icon: Users,
    title: "공동구매",
    desc: "함께 모이면 가격이 내려갑니다",
  },
] as const;

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:px-12 md:pt-28 md:pb-32">
      <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
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
            병원 운영의 모든 것,
            <br />
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
            전국 공급업체와 곧바로 연결되는 B2B 마켓플레이스.
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
              href="#features"
              className="inline-flex h-12 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
              더 알아보기
            </Link>
          </div>

          <p
            className="landing-fade-up mt-6 text-xs text-[var(--color-text-tertiary)]"
            style={{ animationDelay: "800ms" }}
          >
            사업자등록증만 있으면 30초 만에 시작할 수 있습니다.
          </p>
        </div>

        {/* Right — 글래스 floating card (G1) */}
        <div
          className="landing-fade-up relative mt-4 lg:mt-0"
          style={{ animationDelay: "900ms" }}
        >
          <GlassCard intensity="md" className="p-7 md:p-8">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              MedPlace 가 제공하는 것
            </p>
            <ul className="mt-5 space-y-4">
              {HERO_HIGHLIGHTS.map((h) => (
                <li key={h.title} className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                    <h.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{h.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {h.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-[var(--color-border-light)] pt-4 text-xs text-[var(--color-text-tertiary)]">
              모두 가입 직후 무료로 사용
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Features — Reveal 로 stagger 등장
// ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: TrendingDown,
    title: "투명한 가격 비교",
    desc: "정가가 없는 의료시장. 동일 제품·동일 등급의 가격을 한눈에 비교하고, 견적은 평균 1영업일 안에 받습니다.",
  },
  {
    icon: Repeat,
    title: "정기 자동발주",
    desc: "장갑·거즈·소독제처럼 매달 쓰는 품목은 한 번만 설정하면 자동으로 발주합니다. 재고 떨어질 일이 없습니다.",
  },
  {
    icon: Users,
    title: "공동구매로 더 낮은 단가",
    desc: "여러 병원이 모이면 단가가 내려갑니다. 공동구매가 마감되면 자동으로 결제·발주가 진행됩니다.",
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
            <article className="h-full rounded-3xl bg-[var(--color-bg-secondary)] p-8 transition-shadow duration-300 hover:shadow-md">
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
// Audience — 글래스 카드 2개 (G3, G4)
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
          <GlassCard hover intensity="sm" as="article" className="h-full p-10">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)] transition-colors duration-300 group-hover:bg-[var(--color-accent)] group-hover:text-white">
              <Stethoscope className="h-6 w-6" />
            </span>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight">
              병원·의원
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              의원부터 종합병원까지. 구매·결재·세금계산서 한 흐름.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <Bullet>여러 공급업체 가격을 한 화면에서 비교</Bullet>
              <Bullet>정기구독 자동 발주로 재고 관리 부담 제거</Bullet>
              <Bullet>다단계 결재 워크플로우 + 자동 세금계산서</Bullet>
              <Bullet>대형 병원용 RFQ(견적 요청)와 UDI 자동 보고</Bullet>
            </ul>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              병원으로 가입하기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </GlassCard>
        </Reveal>

        <Reveal delay={120}>
          <GlassCard hover intensity="sm" as="article" className="h-full p-10">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
              <Building2 className="h-6 w-6" />
            </span>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight">공급업체</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              판매업·제조업·수입업. 간납사 없는 직접 거래.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <Bullet>4~6개월 결제 지연 없이 D+3 빠른 정산</Bullet>
              <Bullet>주문·발송·정산이 한 화면에서</Bullet>
              <Bullet>UDI 보고 자동화로 행정 부담 절감</Bullet>
              <Bullet>전국 의료기관에 즉시 노출되는 카탈로그</Bullet>
            </ul>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              공급업체로 가입하기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </GlassCard>
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
// Steps — connector dot + Reveal stagger
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
    desc: "사업자등록증 사진을 올리면 Naver Clova OCR과 국세청 진위확인으로 자동 검증합니다.",
  },
  {
    icon: Sparkles,
    title: "3. 사용 시작",
    desc: "병원은 바로 검색·주문, 공급업체는 운영자 입점 심사 후 셀러센터를 사용합니다.",
  },
] as const;

function Steps() {
  return (
    <section
      id="steps"
      className="bg-[var(--color-bg-secondary)] py-32 md:py-40"
    >
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
              <li className="relative h-full rounded-2xl bg-[var(--color-bg-primary)] p-8">
                {/* connector dot — 모바일에선 숨김 */}
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
// Bottom CTA — 큰 글래스 카드 (G2)
// ─────────────────────────────────────────────────────────────

function BottomCTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-32 md:px-12 md:py-40">
      <Reveal>
        <GlassCard intensity="md" className="px-8 py-16 text-center md:px-16 md:py-20">
          <h2 className="text-3xl font-semibold tracking-[-0.03em] md:text-6xl">
            의료기기 구매의 새로운 기준.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[var(--color-text-secondary)] md:text-lg">
            가입은 무료, 인증은 자동, 시작은 지금입니다.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="landing-cta-glow inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-base font-medium text-white active:scale-[0.98]"
            >
              무료로 시작하기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
              로그인
            </Link>
          </div>
        </GlassCard>
      </Reveal>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Footer — Stethoscope subtle rotation
// ─────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-[var(--color-border-light)] bg-[var(--color-bg-primary)]">
      <div className="mx-auto max-w-6xl px-6 py-14 md:px-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="landing-micro-spin grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
                <Stethoscope className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold tracking-tight">MedPlace</span>
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
              한국 의료기관과 의료기기·소모품 공급업체를 연결하는
              <br />
              멀티벤더 B2B 마켓플레이스.
            </p>
            <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
              사업자등록 진행 중 · 통신판매업 신고 예정 · Phase 1 베타
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              시작하기
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <FooterLink href="/register">회원가입</FooterLink>
              <FooterLink href="/login">로그인</FooterLink>
              <FooterLink href="/about">회사 소개</FooterLink>
              <FooterLink href="/pricing">수수료</FooterLink>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              운영
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <FooterLink href="/admin/vendors">입점 심사</FooterLink>
              <FooterLink href="/admin/debug/snapshot">실시간 디버그</FooterLink>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[var(--color-border-light)] pt-6 text-xs text-[var(--color-text-tertiary)] md:flex-row md:items-center">
          <span>© 2026 MedPlace. All rights reserved.</span>
          <span>
            본 화면은 Phase 1 개발 단계입니다. 실 결제·실 거래는 진행되지 않습니다.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        {children}
      </Link>
    </li>
  );
}
