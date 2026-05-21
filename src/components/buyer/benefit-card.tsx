import Link from "next/link";
import {
  ArrowRight,
  Plus,
  Repeat,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";

const BENEFITS = [
  {
    eyebrow: "결제",
    title: "5% 단일 수수료",
    desc: "거래 규모 커지면 더 낮아집니다. 가입비·약정 없음.",
    icon: TrendingDown,
    tone: "from-[var(--color-accent-light)] to-transparent",
  },
  {
    eyebrow: "정산",
    title: "3일 만에 입금",
    desc: "기존 도매상 4~6개월 → 배송 완료 후 영업일 3일.",
    icon: Wallet,
    tone: "from-[var(--color-success)]/15 to-transparent",
  },
  {
    eyebrow: "자동",
    title: "매달 자동 주문",
    desc: "장갑·거즈·소독제. 한 번 설정, 자동 발주.",
    icon: Repeat,
    tone: "from-[var(--color-warning)]/15 to-transparent",
  },
  {
    eyebrow: "공동구매",
    title: "모이면 단가가 ↓",
    desc: "여러 병원이 함께 주문. 마감 시 자동 결제·발주.",
    icon: Users,
    tone: "from-[var(--color-info)]/15 to-transparent",
  },
] as const;

export function BenefitSection() {
  return (
    <section className="bg-[var(--color-bg-secondary)] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        {/* 헤드라인 + 보기 링크 */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-5xl">
            MedPlace 에서 주문하면
            <br />
            가장 좋은 이유.
          </h2>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline md:text-base"
          >
            전체 둘러보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 4개 카드 — 데스크탑 grid / 모바일 가로 스크롤 */}
        <div className="mt-12 -mx-6 overflow-x-auto px-6 [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0">
          <div className="grid grid-flow-col auto-cols-[85%] gap-4 sm:auto-cols-[60%] md:grid-flow-row md:auto-cols-auto md:grid-cols-4 md:gap-5">
            {BENEFITS.map((b) => (
              <BenefitCard key={b.title} {...b} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BenefitCard({
  eyebrow,
  title,
  desc,
  icon: Icon,
  tone,
}: (typeof BENEFITS)[number]) {
  return (
    <article className="relative flex h-[440px] flex-col overflow-hidden rounded-3xl bg-[var(--color-bg-primary)] p-7 md:h-[460px] md:p-8">
      {/* [+] floating */}
      <button
        type="button"
        aria-label={`${title} 상세 보기`}
        className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-black/8 text-[var(--color-text-primary)] transition-colors hover:bg-black/15"
      >
        <Plus className="h-4 w-4" />
      </button>

      {/* 텍스트 */}
      <div className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          {eyebrow}
        </p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)] md:text-base">
          {desc}
        </p>
      </div>

      {/* 아이콘 영역 (이미지 대체) */}
      <div
        className={`relative -mx-7 -mb-7 mt-6 flex h-48 items-end justify-center overflow-hidden rounded-b-3xl bg-gradient-to-b ${tone} md:-mx-8 md:-mb-8`}
      >
        <Icon className="absolute h-32 w-32 text-[var(--color-accent)]/35 md:h-36 md:w-36" aria-hidden />
      </div>
    </article>
  );
}
