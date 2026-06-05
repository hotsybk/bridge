import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

/**
 * 혜택 카드 — v3 완전 리뉴얼 (2026-05-21).
 *
 * 컨셉: 대형 타이포그래피 히어로.
 *  - 추상 아이콘 / 그래픽 / 그라데이션 영역 전부 제거.
 *  - 각 카드의 핵심 가치 1개 단어/숫자를 거대한 활자로 표현.
 *  - 화이트 카드 + 강한 타이포만 + 작은 보조 텍스트.
 *  - 반응형: ~md 가로 스크롤, md 2-col, lg+ 4-col (호흡 확보).
 *
 * 히어로:
 *  · 결제   → "5%"   (수수료율)
 *  · 정산   → "3일"  (정산 일수)
 *  · 자동   → "매달" (자동 발주 주기)
 *  · 공동구매 → "↓"  (단가 하락 결과, 굵은 커스텀 SVG)
 */

type BenefitGraphic = "fee" | "settle" | "auto" | "group";

type Benefit = {
  eyebrow: string;
  title: string;
  desc: string;
  graphic: BenefitGraphic;
};

const BENEFITS: Benefit[] = [
  {
    eyebrow: "수수료",
    title: "딱 5%, 끝.",
    desc: "거래 키우면 더 저렴. 가입비·약정 0원.",
    graphic: "fee",
  },
  {
    eyebrow: "정산",
    title: "4개월 → 3일",
    desc: "배송 끝나는 즉시 입금이 시작됩니다.",
    graphic: "settle",
  },
  {
    eyebrow: "자동 발주",
    title: "한 번 설정, 매달 자동",
    desc: "장갑·거즈·소독제는 더 이상 발주서를 쓰지 마세요.",
    graphic: "auto",
  },
  {
    eyebrow: "공동구매",
    title: "모이면 더 저렴",
    desc: "여러 병원이 모이면 단가가 떨어집니다. 마감 시 자동 결제.",
    graphic: "group",
  },
];

export function BenefitSection() {
  return (
    <section className="bg-[var(--color-bg-secondary)] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
            도매상보다 빠른 이유,
            <br />
            네 가지로 끝.
          </h2>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            전체 둘러보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 모바일 가로 스크롤 / md 2-col / lg+ 4-col */}
        <div className="mt-12 -mx-6 overflow-x-auto px-6 [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0">
          <div className="grid grid-flow-col auto-cols-[85%] gap-4 sm:auto-cols-[60%] md:grid-flow-row md:auto-cols-auto md:grid-cols-2 md:gap-5 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <BenefitCard key={b.eyebrow} {...b} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BenefitCard({ eyebrow, title, desc, graphic }: Benefit) {
  return (
    <article className="group relative flex h-[400px] flex-col overflow-hidden rounded-3xl bg-[var(--color-bg-primary)] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.12)] md:h-[420px] md:p-8">
      {/* [+] floating */}
      <button
        type="button"
        aria-label={`${eyebrow} 상세 보기`}
        className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-[var(--color-text-primary)] transition-colors hover:bg-black/[0.12]"
      >
        <Plus className="h-4 w-4" />
      </button>

      {/* 상단: eyebrow */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {eyebrow}
      </p>

      {/* 중앙 (flex-1): 거대한 히어로 — 왼쪽 정렬 */}
      <div className="flex flex-1 items-end pt-8">
        <BenefitHero kind={graphic} />
      </div>

      {/* 하단: 타이틀 + 설명 — 설명은 항상 2줄 영역을 차지해 카드별 라인 정렬 보장 */}
      <div className="mt-6 border-t border-[var(--color-border-light)] pt-5">
        <h3 className="text-sm font-semibold tracking-tight">
          {title}
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-[3.25em] text-xs leading-relaxed text-[var(--color-text-secondary)] md:text-sm">
          {desc}
        </p>
      </div>
    </article>
  );
}

/**
 * 대형 타이포 / 굵은 SVG 히어로 — accent 색, 카드 좌측에서 시작.
 *
 * 사이즈·하단 라인 통일 규칙:
 *  - 메인 글자(5 / 3 / 매달) 모두 동일한 `text-[5.5rem] md:text-[6.5rem]` + `leading-none`
 *  - 화살표 SVG 도 동일 높이(`h-[5.5rem] md:h-[6.5rem]`)
 *  - 모든 항목이 부모 flex `items-end` 안에서 같은 베이스라인에 앉음
 */
function BenefitHero({ kind }: { kind: BenefitGraphic }) {
  const color = "text-[var(--color-accent)]";
  const heroText = "text-[5.5rem] md:text-[6.5rem]";
  const suffixText = "text-2xl md:text-3xl";

  if (kind === "fee") {
    // "5%" — 5 가 hero, % 는 작게
    return (
      <div
        className={`flex items-baseline leading-none tracking-[-0.07em] ${color}`}
      >
        <span className={`${heroText} font-black`}>5</span>
        <span className={`${suffixText} font-black`}>%</span>
      </div>
    );
  }

  if (kind === "settle") {
    // "3일" — 3 이 hero, 일 은 작게
    return (
      <div
        className={`flex items-baseline leading-none tracking-[-0.07em] ${color}`}
      >
        <span className={`${heroText} font-black`}>3</span>
        <span className={`ml-1 ${suffixText} font-black`}>일</span>
      </div>
    );
  }

  if (kind === "auto") {
    // "매달" — 한글 두 글자는 같은 font-size 라도 시각 높이가 더 크므로 한 단계 작게
    return (
      <span
        className={`text-[3.75rem] font-black leading-none tracking-[-0.08em] md:text-[4.5rem] ${color}`}
      >
        매달
      </span>
    );
  }

  // group — 굵은 다운 화살표. 텍스트 메인 글자와 동일한 높이.
  return (
    <svg
      viewBox="0 0 100 110"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-[5.5rem] w-[5rem] md:h-[6.5rem] md:w-[6rem] ${color}`}
      aria-hidden
      preserveAspectRatio="xMidYMax meet"
    >
      {/* 화살대 + 화살촉 */}
      <path d="M 34 14 L 34 80" strokeWidth="14" />
      <path d="M 10 60 L 34 88 L 58 60" strokeWidth="14" />
    </svg>
  );
}
