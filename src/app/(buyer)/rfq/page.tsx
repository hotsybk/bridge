import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileText,
  Plus,
  Quote,
  Send,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { LaunchAlertButton } from "@/components/shared/launch-alert-modal";

export const dynamic = "force-dynamic";

/**
 * RFQ — Request For Quotation. Phase 5 출시 예정.
 *
 * 카탈로그에 없는 / 대형 병원 단가 협상 / 비표준 사양에 사용.
 * 견적 요청 → 복수 공급업체 응답 → 비교 후 채택 흐름.
 */

const RECENT_RFQS = [
  {
    id: "rfq-001",
    title: "수술용 멸균 장갑 (L) 월 500BOX",
    status: "RESPONSES",
    responseCount: 4,
    deadline: "2026-05-28",
    quoteRange: { min: 7800, max: 9400 },
  },
  {
    id: "rfq-002",
    title: "CT 조영제 OEM 공급",
    status: "OPEN",
    responseCount: 1,
    deadline: "2026-06-04",
    quoteRange: null,
  },
  {
    id: "rfq-003",
    title: "응급 진료실 모니터링 장비 일괄 견적",
    status: "AWARDED",
    responseCount: 6,
    deadline: "2026-05-12",
    quoteRange: { min: 18500000, max: 24200000 },
  },
] as const;

const STATUS_META: Record<
  string,
  { label: string; tone: string; bg: string }
> = {
  OPEN: {
    label: "응답 대기",
    tone: "text-[var(--color-status-pending)]",
    bg: "bg-[var(--color-status-pending)]/12",
  },
  RESPONSES: {
    label: "응답 도착",
    tone: "text-[var(--color-status-paid)]",
    bg: "bg-[var(--color-status-paid)]/12",
  },
  AWARDED: {
    label: "채택 완료",
    tone: "text-[var(--color-status-delivered)]",
    bg: "bg-[var(--color-status-delivered)]/12",
  },
};

export default function RfqPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
              견적 요청 · 곧 시작
            </p>
            <h1 className="mt-3 break-keep text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
              한 번의 요청,
              <br />
              여러 공급업체.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-[var(--color-text-secondary)]">
              카탈로그에 없는 품목·대량 단가·비표준 사양. 한 번의 요청으로 여러
              공급업체의 견적을 받아보세요.
            </p>
          </div>

          <LaunchAlertButton
            type="RFQ_LAUNCH"
            title="RFQ 출시 알림"
            description="견적 요청(RFQ) 정식 출시 시점을 가장 먼저 알려드려요. 베타 테스터 모집 시 우선 안내도 함께 받아보실 수 있습니다."
            buttonClassName="inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-text-primary)] px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
            buttonLabel="출시 알림 받기"
          />
        </header>

        {/* Flow diagram — 라인 패턴 */}
        <section className="mt-12 border-y border-[var(--color-border-light)] py-12 md:py-14">
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            진행 순서
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3 md:gap-3">
            <FlowStep
              num={1}
              icon={FileText}
              title="요청서 작성"
              desc="품목·수량·납기·사양 입력. 정형 양식이라 1분이면 작성 완료"
            />
            <FlowConnector />
            <FlowStep
              num={2}
              icon={Send}
              title="공급업체 자동 매칭"
              desc="카테고리·인증 기준으로 적격 공급업체에 동시 발송"
            />
            <FlowConnector />
            <FlowStep
              num={3}
              icon={Quote}
              title="견적 비교·채택"
              desc="도착 견적을 한 화면에서 비교. 채택 시 주문 자동 생성"
            />
          </ol>
        </section>

        {/* 최근 견적 */}
        <section className="mt-16">
          <header className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
              최근 견적 요청
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              아래는 디자인 미리보기 — 정식 출시 후 실제 등록 가능
            </p>
          </header>

          <ul className="mt-8 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {RECENT_RFQS.map((r) => {
              const meta = STATUS_META[r.status];
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-5 py-6"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                    <FileText className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold tracking-tight">
                        {r.title}
                      </h3>
                      <span
                        className={`inline-flex h-6 items-center rounded-full px-2.5 text-[10px] font-semibold ${meta.bg} ${meta.tone}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
                      마감 {r.deadline} · 응답 {r.responseCount}건
                      {r.quoteRange && (
                        <>
                          {" · "}
                          <span className="text-[var(--color-text-secondary)]">
                            ₩{r.quoteRange.min.toLocaleString()} ~ ₩
                            {r.quoteRange.max.toLocaleString()}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <Link
                    href={`/rfq/${r.id}`}
                    className="inline-flex h-9 items-center gap-1 rounded-full bg-[var(--color-bg-primary)] px-4 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)]"
                  >
                    상세
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Use case — 라인 패턴 */}
        <section className="mt-16 grid grid-cols-1 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-2 md:divide-x md:divide-y-0">
          <article className="py-10 md:px-10">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
              <Stethoscope className="h-5 w-5" />
            </span>
            <h3 className="mt-5 text-sm font-semibold tracking-tight">
              종합병원·중대형 클리닉
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              월 사용량 기준 단가 협상이 필요한 대량 발주. 표준 카탈로그
              가격보다 평균 12~18% 추가 인하 가능.
            </p>
          </article>
          <article className="py-10 md:px-10">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
              <Building2 className="h-5 w-5" />
            </span>
            <h3 className="mt-5 text-sm font-semibold tracking-tight">
              비표준 사양·맞춤 제작
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              사이즈·재질·라벨링 등 카탈로그에 없는 사양. 제조업체와 직접
              소통할 수 있는 RFQ 전용 채널.
            </p>
          </article>
        </section>

        {/* CTA — 라인 패턴 (accent 블럭 유지하되 박스 둥근 모서리 제거) */}
        <section className="mt-16 bg-[var(--color-accent)] px-10 py-14 text-center text-white md:px-14 md:py-16">
          <Sparkles className="mx-auto h-7 w-7 opacity-80" />
          <h2 className="mt-5 break-keep text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            한 번의 요청, 여러 공급업체.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/80">
            출시 알림을 신청하시면 가장 먼저 알려드립니다.
          </p>
          <div className="mt-8 flex justify-center">
            <LaunchAlertButton
              type="RFQ_LAUNCH"
              title="RFQ 출시 알림"
              description="견적 요청(RFQ) 정식 출시 시점을 가장 먼저 알려드려요. 베타 테스터 모집 시 우선 안내도 함께 받아보실 수 있습니다."
              buttonClassName="inline-flex h-12 items-center gap-1.5 rounded-full bg-white px-7 text-sm font-semibold text-[var(--color-accent)] transition-opacity hover:opacity-90 active:scale-[0.98]"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function FlowStep({
  num,
  icon: Icon,
  title,
  desc,
}: {
  num: number;
  icon: typeof FileText;
  title: string;
  desc: string;
}) {
  return (
    <li className="relative px-6 text-center md:px-2 md:text-left">
      <span className="absolute right-2 top-0 text-2xl font-semibold text-[var(--color-accent-light)] md:right-0 md:text-3xl">
        {num}
      </span>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-accent)] text-white md:mb-0">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {desc}
      </p>
    </li>
  );
}

function FlowConnector() {
  return (
    <span
      className="hidden self-center justify-self-center text-[var(--color-accent)] md:block"
      aria-hidden
    >
      <ArrowRight className="h-5 w-5" />
    </span>
  );
}
