import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CircleCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
} from "lucide-react";

export const metadata = {
  title: "MedPlace 소개 — 한국 의료 구매의 새로운 기준",
  description:
    "MedPlace 는 한국 의료기관과 의료기기·소모품 공급업체를 직접 연결하는 멀티벤더 B2B 마켓플레이스입니다.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <TopNav />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-16 text-center md:px-12 md:pt-32 md:pb-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
          <Sparkles className="h-3.5 w-3.5" />
          About MedPlace
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
          한국 의료의 구매를,
          <br />
          <span className="text-[var(--color-accent)]">다시 설계합니다.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-[var(--color-text-secondary)] md:text-lg">
          간납사 중심의 불투명한 거래에서, 병원과 공급업체가 직접 만나는 투명한 거래로.
        </p>
      </section>

      {/* 문제 정의 */}
      <section className="border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6 md:px-12">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                풀어내는 문제
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                지금의 의료 구매는,
                <br />
                너무 많은 손을 거칩니다.
              </h2>
            </div>
            <div className="space-y-5 text-[var(--color-text-secondary)]">
              <p>
                의원·중소병원은 매번 다른 도매상에 전화해 가격을 비교하고, 정기 주문을 직접 챙기고,
                세금계산서를 수기로 정리합니다.
              </p>
              <p>
                공급업체는 4~6개월씩 결제 지연을 견디며 간납사를 거쳐야 하고,
                서면 계약 없이 거래하며, UDI 보고를 수기로 처리합니다.
              </p>
              <p className="font-medium text-[var(--color-text-primary)]">
                이 모든 비효율은 결국 환자가 받는 의료의 질과 가격에 반영됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 우리의 접근 */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            우리의 접근
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            세 가지 가치로 다시 만듭니다.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          <ValueCard
            icon={TrendingDown}
            title="투명"
            desc="동일 등급·동일 인증의 제품 가격을 한 화면에서 비교합니다. 숨겨진 마진과 변동가 없음."
          />
          <ValueCard
            icon={Sparkles}
            title="자동"
            desc="정기구독 자동 발주, UDI 자동 보고, 세금계산서 자동 발행. 사람의 시간은 환자에게."
          />
          <ValueCard
            icon={Building2}
            title="직접"
            desc="간납사 없이 병원과 공급업체가 직접 연결됩니다. 정산은 D+3 빠르게."
          />
        </div>
      </section>

      {/* 운영 원칙 */}
      <section className="border-t border-[var(--color-border-light)] py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6 md:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              운영 원칙
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              우리가 매일 지키는 5가지.
            </h2>
          </div>

          <ol className="mx-auto mt-14 max-w-3xl space-y-12">
            <Principle
              num="01"
              title="안전이 가격보다 먼저입니다"
              desc="의료기기 판매업 신고증과 식약처 허가가 없는 제품은 노출하지 않습니다."
            />
            <Principle
              num="02"
              title="공급업체는 파트너입니다"
              desc="D+3 빠른 정산, 투명한 수수료 5%, 서면 계약. 갑을이 아닌 협업."
            />
            <Principle
              num="03"
              title="병원의 시간을 돌려드립니다"
              desc="정기 발주·UDI 보고·세금계산서. 반복 작업은 자동으로."
            />
            <Principle
              num="04"
              title="데이터는 사용자의 것입니다"
              desc="구매 이력·재고 데이터는 사용자가 언제든 내려받을 수 있습니다."
            />
            <Principle
              num="05"
              title="모르는 것은 모른다고 합니다"
              desc="베타 단계는 베타라고 표시합니다. 책임 회피는 없습니다."
            />
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-6 text-center md:px-12">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            지금 함께 시작하세요.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--color-text-secondary)] md:text-lg">
            가입은 무료, 인증은 자동, 시작은 30초.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
            >
              가입하기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
              수수료 보기
            </Link>
          </div>

          <p className="mt-10 text-xs text-[var(--color-text-tertiary)]">
            현재 Phase 1 베타 — 실 결제·실 거래는 진행되지 않습니다.
          </p>
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
            className="rounded-full px-4 py-2 font-medium text-[var(--color-text-primary)]"
          >
            소개
          </Link>
          <Link
            href="/pricing"
            className="rounded-full px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
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

function ValueCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof TrendingDown;
  title: string;
  desc: string;
}) {
  return (
    <article className="rounded-2xl bg-[var(--color-bg-secondary)] p-8 transition-shadow duration-300 hover:shadow-md">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {desc}
      </p>
    </article>
  );
}

function Principle({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <li className="grid grid-cols-[60px_1fr] gap-6 md:grid-cols-[80px_1fr]">
      <span className="text-3xl font-semibold tabular-nums text-[var(--color-accent)] md:text-4xl">
        {num}
      </span>
      <div>
        <h3 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] md:text-base">
          {desc}
        </p>
      </div>
    </li>
  );
}

// keep imports tree-shaken
void CircleCheck;
