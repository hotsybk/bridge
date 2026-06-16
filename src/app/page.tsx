import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Info,
  Mail,
  Package,
  Repeat,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
  Users,
} from "lucide-react";

import { AuthAwareCTA } from "@/components/marketing/auth-aware-cta";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { GlassCard } from "@/components/shared/glass-card";
import { Reveal } from "@/components/shared/reveal";

export const metadata: Metadata = {
  // 랜딩은 root metadata 의 default title (template 미적용) 을 그대로 사용.
  title: "MedPlace — 발주서 다시 쓰는 시간, 이제 0초",
  description:
    "한국 의료기관과 의료기기·소모품 공급업체를 직접 연결하는 멀티벤더 B2B 마켓플레이스. 정기구독 · 공동구매 · UDI 자동보고까지.",
  openGraph: {
    title: "MedPlace — 발주서 다시 쓰는 시간, 이제 0초",
    description:
      "한국 의료기관과 의료기기·소모품 공급업체를 직접 연결하는 멀티벤더 B2B 마켓플레이스.",
  },
};

// Server Component — 정적 prerender (AuthContext 는 layout.tsx 의 클라이언트 wrapper)
// 메인 리뉴얼 명세: docs/landing-design-renewal-plan.md + P0 시각 보강 4종

export default function LandingPage() {
  return (
    <>
      {/* 전역 radial gradient overlay — 화면 우상단·좌하단 미세 톤 */}
      <div className="landing-bg-overlay" aria-hidden />

      <div className="relative z-10 min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <MarketingNav
          active="home"
          showAuthCta
          customCtaSlot={<LandingExtraCtas />}
        />
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
// 랜딩 전용 추가 CTA — MarketingNav 의 customCtaSlot 으로 주입
// 데스크탑(md+) 에서만 노출. 모바일은 햄버거 dropdown 사용.
// ─────────────────────────────────────────────────────────────

function LandingExtraCtas() {
  // MarketingNav 의 NAV_ITEMS 와 동일 톤 — chip outline·아이콘 제거, plain text
  const cls =
    "relative inline-flex items-center px-3 py-2 text-[13px] tracking-tight text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]";
  return (
    <>
      <Link href="/search" className={cls}>
        쇼핑
      </Link>
      <Link href="/seller/products" className={cls}>
        파트너센터
      </Link>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero — 큰 타이포 + SVG mesh blob 배경 + 우측 카탈로그 mock-up
// ─────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 md:px-12 md:pt-28 md:pb-32">
      {/* Hero 영역 한정 SVG mesh blob (배경, 카드 뒤에) */}
      <HeroMeshBackground />

      <div className="relative grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
        {/* Left — 텍스트 + CTA */}
        <div className="text-center lg:text-left">
          <div className="landing-fade-up" style={{ animationDelay: "0ms" }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
              <Sparkles className="h-3.5 w-3.5" />
              베타 운영 중 — 무료 체험
            </span>
          </div>

          <h1
            className="landing-fade-up mt-6 break-keep text-5xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-6xl"
            style={{ animationDelay: "150ms" }}
          >
            발주서 다시
            <br />
            쓰는 시간,
            <br />
            이제{" "}
            <span
              className="landing-fade-up text-[var(--color-accent)]"
              style={{ animationDelay: "350ms", display: "inline-block" }}
            >
              0초.
            </span>
          </h1>

          <p
            className="landing-fade-up mx-auto mt-7 max-w-xl text-sm text-[var(--color-text-secondary)] lg:mx-0"
            style={{ animationDelay: "500ms" }}
          >
            여러 공급업체 가격을 한 화면에. 한 번 클릭, 매달 자동.
            시간은 환자에게.
          </p>

          <div
            className="landing-fade-up mt-10 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            style={{ animationDelay: "650ms" }}
          >
            <AuthAwareCTA
              className="landing-cta-glow inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-medium text-white active:scale-[0.98]"
              guestHref="/register"
              guestChildren={
                <>
                  지금 시작하기
                  <ArrowRight className="h-4 w-4" />
                </>
              }
              authedChildren={
                <>
                  내 작업공간으로
                  <ArrowRight className="h-4 w-4" />
                </>
              }
            />
            <Link
              href="#flow"
              className="inline-flex h-12 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
              어떻게 동작하나
            </Link>
          </div>

          <p
            className="landing-fade-up mt-6 text-xs text-[var(--color-text-tertiary)]"
            style={{ animationDelay: "800ms" }}
          >
            카드 없이 무료 가입 · 사업자등록증만 있으면 30초 완료.
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
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <svg
        viewBox="0 0 800 600"
        className="pointer-events-none absolute -right-20 -top-10 h-[600px] w-[800px] opacity-60"
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
            미리보기
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
            <li key={p.name}>
              <Link
                href={`/search?q=${encodeURIComponent(p.name)}`}
                className="group flex items-center gap-3 rounded-xl bg-[var(--color-bg-primary)]/60 p-3 backdrop-blur-sm transition-colors hover:bg-[var(--color-bg-primary)]/90"
              >
                {/* Thumb placeholder */}
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-accent-light)]">
                  <span
                    className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${
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
                    className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${BADGE_TONES[p.badge]}`}
                  >
                    {p.badge}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-light)] pt-3 text-[10px] text-[var(--color-text-tertiary)]">
          <span>정식 출시 예정</span>
          <Link
            href="/search"
            className="inline-flex items-center gap-1 text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover,var(--color-accent))] hover:underline"
          >
            전체 보기
            <ArrowUpRight className="h-3 w-3" />
          </Link>
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
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            어떻게 동작하나
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            4개월 기다리던 입금,
            <br />
            이제 3일.
          </h2>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            병원과 공급업체가 직접 만납니다. 마진 0, 입금 3일.
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
                기존 도매상 입금
              </p>
              <p className="mt-3 text-2xl font-semibold text-[var(--color-text-secondary)] md:text-3xl">
                4~6개월
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">유통 단계를 거치며 지연</p>
            </article>
          </Reveal>
          <Reveal delay={240}>
            <article className="rounded-2xl bg-[var(--color-accent)] p-6 text-center text-white">
              <p className="text-xs font-medium uppercase tracking-wider text-white/70">
                MedPlace 입금
              </p>
              <p className="mt-3 text-2xl font-semibold md:text-3xl">3일</p>
              <p className="mt-1 text-xs text-white/70">배송 완료 후 영업일 기준</p>
            </article>
          </Reveal>
          <Reveal delay={360}>
            <article className="rounded-2xl bg-[var(--color-bg-primary)] p-6 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                수수료
              </p>
              <p className="mt-3 text-2xl font-semibold md:text-3xl">
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
          여러 공급업체 가격을 비교한 뒤 바로 주문
        </p>
        <p className="text-center">
          <span className="font-semibold text-[var(--color-accent)]">자동화</span>{" "}
          식약처 의료기기 보고 · 세금계산서 · 정기 발주
        </p>
        <p className="md:text-right">
          <span className="font-semibold text-[var(--color-text-primary)]">공급업체 ←</span>{" "}
          영업일 3일 빠른 정산 · 직접 노출
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
    title: "숨은 마진 0원, 진짜 가격",
    desc: "같은 제품을 공급업체마다 다른 값에 사던 시대 끝. 동일 등급·동일 인증 제품의 진짜 도매가를 한 화면에서 비교하세요.",
  },
  {
    icon: Repeat,
    title: "한 번 설정, 매달 자동",
    desc: "매달 쓰는 품목, 한 번 설정으로 끝. 재고 떨어질 일도, 발주서 다시 쓸 일도 없습니다.",
  },
  {
    icon: Users,
    title: "병원이 모이면 단가가 내려갑니다",
    desc: "여러 병원이 한 번에 주문하면 단가가 한 단계 더 내려갑니다. 마감 시점에 자동 결제·발주로 일손도 들지 않습니다.",
  },
] as const;

function Features() {
  return (
    <section
      id="features"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-32 md:px-12 md:py-40"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          왜 MedPlace 인가
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          버튼 한 번으로 끝나는
          <br />
          발주와 정산.
        </h2>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          중간 도매상 없이 공급업체와 직접. 숨은 마진 없는 진짜 가격, 정산은 영업일 3일.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 120}>
            <article className="landing-tilt h-full rounded-3xl bg-[var(--color-bg-secondary)] p-8 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-sm font-semibold">{f.title}</h3>
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
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-32 md:px-12 md:py-40"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          누구를 위한 서비스인가
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          병원도, 공급업체도.
          <br />
          모두에게 시간을 돌려드립니다.
        </h2>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <Reveal delay={0}>
          <div className="landing-tilt h-full">
            <GlassCard hover intensity="sm" as="article" className="h-full p-10">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                <Stethoscope className="h-6 w-6" />
              </span>
              <h3 className="mt-6 text-2xl font-semibold tracking-tight md:text-3xl">병원·의원</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                의원부터 종합병원까지. 구매·승인·세금계산서가 한 화면에서 끝납니다.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <Bullet>여러 공급업체 가격을 한눈에 비교</Bullet>
                <Bullet>매달 쓰는 품목은 자동 주문, 재고 걱정 없음</Bullet>
                <Bullet>내부 승인 단계 + 세금계산서 자동 발행</Bullet>
                <Bullet>종합병원 맞춤 견적 + 식약처 의료기기 보고 자동화</Bullet>
              </ul>
              <AuthAwareCTA
                className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
                guestHref="/register"
                guestChildren={
                  <>
                    병원으로 가입하기
                    <ArrowRight className="h-4 w-4" />
                  </>
                }
                authedChildren={
                  <>
                    내 작업공간으로
                    <ArrowRight className="h-4 w-4" />
                  </>
                }
              />
            </GlassCard>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="landing-tilt h-full">
            <GlassCard hover intensity="sm" as="article" className="h-full p-10">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                <Building2 className="h-6 w-6" />
              </span>
              <h3 className="mt-6 text-2xl font-semibold tracking-tight md:text-3xl">공급업체</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                판매업·제조업·수입업. 중간 거래상 없이 병원과 직접 만납니다.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <Bullet>4~6개월 결제 지연 대신, 영업일 3일 입금</Bullet>
                <Bullet>주문·발송·입금 정리가 한 화면에서</Bullet>
                <Bullet>식약처 의료기기 보고 자동화로 행정 부담 절반</Bullet>
                <Bullet>전국 병원에 즉시 노출되는 내 상품 목록</Bullet>
              </ul>
              <AuthAwareCTA
                className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
                guestHref="/register"
                guestChildren={
                  <>
                    공급업체로 가입하기
                    <ArrowRight className="h-4 w-4" />
                  </>
                }
                authedChildren={
                  <>
                    내 작업공간으로
                    <ArrowRight className="h-4 w-4" />
                  </>
                }
              />
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
    title: "1. 30초 가입",
    desc: "이메일만 있으면 30초. 병원 또는 공급업체 중 역할을 골라주세요.",
  },
  {
    icon: ShieldCheck,
    title: "2. 사업자 자동 인증",
    desc: "사업자등록증 사진 한 장. 자동 글자 인식 + 국세청 자동 조회로 사람 손이 필요 없습니다.",
  },
  {
    icon: Sparkles,
    title: "3. 첫 주문",
    desc: "병원은 바로 검색·주문. 공급업체는 입점 심사 후 판매 관리 화면을 사용합니다.",
  },
] as const;

function Steps() {
  return (
    <section id="steps" className="bg-[var(--color-bg-secondary)] py-32 md:py-40">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            어떻게 시작하나
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            가입부터 첫 주문까지
            <br />
            30분이면 충분합니다.
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
                <h3 className="mt-5 text-sm font-semibold">{s.title}</h3>
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
    desc: "인증된 사업자 + 판매업 신고증 — 모두 확인합니다.",
  },
  {
    icon: TrendingDown,
    label: "투명",
    desc: "여러 공급업체의 가격을 한 화면에서 비교. 숨은 마진이나 변동가는 없습니다.",
  },
  {
    icon: Sparkles,
    label: "자동",
    desc: "정기 주문·UDI 보고·세금계산서 — 모두 자동.",
  },
] as const;

function BottomCTA() {
  return (
    <section className="relative overflow-hidden bg-[var(--color-accent)]">
      {/* 풀블리드 mesh background */}
      <CtaMeshBackground />

      <div className="relative mx-auto max-w-7xl px-6 py-32 text-center md:px-12 md:py-48">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
            지금 시작하기
          </p>
          <h2 className="mt-5 break-keep text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-white md:text-6xl">
            더 늦기 전에,
            <br />
            새로운 표준으로.
          </h2>
          <p className="mx-auto mt-7 max-w-xl text-sm text-white/80">
            가입은 무료, 인증은 자동, 첫 주문은 오늘.
          </p>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <AuthAwareCTA
              className="landing-cta-hero inline-flex h-14 items-center gap-2 rounded-full bg-white px-9 text-sm font-semibold text-[var(--color-accent)] active:scale-[0.98]"
              guestHref="/register"
              guestChildren={
                <>
                  무료로 시작하기
                  <ArrowRight className="h-5 w-5" />
                </>
              }
              authedChildren={
                <>
                  내 작업공간으로
                  <ArrowRight className="h-5 w-5" />
                </>
              }
            />
            <Link
              href="/about"
              className="inline-flex h-14 items-center rounded-full border-2 border-white/40 bg-white/10 px-9 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              회사 소개 보기
            </Link>
          </div>

          <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-white/60">
            <Info className="h-3 w-3" aria-hidden />
            베타 운영 중 — 결제·거래는 정식 출시 후 시작됩니다
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
        className="pointer-events-none absolute inset-0 h-full w-full"
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
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-10 md:px-12 md:pt-24">
        {/* 큰 워드마크 — Footer 의 visual anchor */}
        <div className="border-b border-[var(--color-border-light)] pb-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="landing-micro-spin grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent)] text-white">
              <Stethoscope className="h-6 w-6" />
            </span>
            <span className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
              MedPlace
            </span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-[var(--color-text-secondary)]">
            병원과 의료기기·소모품 공급업체를 바로 연결해주는 거래 플랫폼.
            <br />
            중간 거래상 없이, 가격은 투명하게, 입금은 영업일 3일.
          </p>
        </div>

        {/* 3-column grid — 운영(admin) 컬럼은 외부 노출 보안상 제거 */}
        <div className="grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-3">
          <FooterCol title="제품">
            <FooterLink href="/about">회사 소개</FooterLink>
            <FooterLink href="/pricing">수수료 정책</FooterLink>
            <FooterLink href="#features">기능</FooterLink>
            <FooterLink href="#flow">동작 방식</FooterLink>
            <FooterLink href="/support">고객 지원</FooterLink>
          </FooterCol>

          <FooterCol title="시작하기">
            <li>
              <AuthAwareCTA
                className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
                guestHref="/register"
                guestChildren={<>회원가입</>}
                authedChildren={<>내 작업공간</>}
              />
            </li>
            <li>
              <AuthAwareCTA
                className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
                guestHref="/login"
                guestChildren={<>로그인</>}
                authedChildren={<>내 작업공간</>}
              />
            </li>
            <FooterLink href="/onboarding/buyer">병원 가입 절차</FooterLink>
            <FooterLink href="/onboarding/vendor">공급업체 가입 절차</FooterLink>
          </FooterCol>

          <FooterCol title="법적">
            <FooterLink href="/legal/terms">이용약관</FooterLink>
            <FooterLink href="/legal/privacy">개인정보 처리방침</FooterLink>
            <FooterLink href="/legal/marketplace">통신판매중개 약관</FooterLink>
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
                서울특별시 (베타 운영 중)
              </p>
            </div>
            <div className="text-left md:text-right">
              <p>© 2026 MedPlace. 모든 권리 보유.</p>
              <p className="mt-1.5">
                현재 화면은 베타 운영 단계입니다.
                <br />
                결제·실 거래는 정식 출시 후 시작됩니다.
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

