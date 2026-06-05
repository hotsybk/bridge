"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  Clock,
  Star,
  TrendingDown,
} from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { CountUp } from "@/components/shared/count-up";

/**
 * /rfq/[rfqId] — 견적 요청 상세 (Phase 5 mock).
 *
 * 디자인 DNA:
 *  - 박스 0개. 견적 비교는 큰 표 + 라인 divider.
 *  - 최저가/최고가 표시 + 평균 vs 카탈로그가 비교.
 *  - 견적 카드는 vendor별 1행 라인 list.
 *  - 채택 CTA (체크 후 일괄 진행 가능).
 */

type RfqStatus = "OPEN" | "RESPONSES" | "AWARDED" | "EXPIRED";

type Quote = {
  id: string;
  vendorName: string;
  vendorRating: number;
  unitPrice: number;
  totalPrice: number;
  leadTime: string;
  validUntil: string;
  note: string;
  awarded?: boolean;
};

type RfqDetail = {
  id: string;
  title: string;
  status: RfqStatus;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedCatalogPrice: number;
  deadline: string;
  createdAt: string;
  buyerHospital: string;
  quotes: Quote[];
  requirements: Array<{ label: string; value: string }>;
};

const UNIT_LABEL: Record<string, string> = {
  BOX: "박스",
  EA: "개",
};

function unit(u: string): string {
  return UNIT_LABEL[u] ?? u;
}

function mockRfq(id: string): RfqDetail {
  return {
    id,
    title: "수술용 멸균 장갑 (L) 월 500BOX",
    status: "RESPONSES",
    description:
      "정형외과 수술실 운영 확장에 따른 월간 정기 공급선 모색입니다. 라텍스 알러지 free 옵션 보유 업체 우대.",
    category: "수술 소모품 / 장갑",
    quantity: 500,
    unit: "BOX",
    estimatedCatalogPrice: 9400,
    deadline: "2026-05-28 18:00",
    createdAt: "2026-05-22",
    buyerHospital: "서울메디컬의원",
    requirements: [
      { label: "사양", value: "라텍스 / 파우더 free / L 사이즈" },
      { label: "수량", value: "500 BOX × 12개월 = 6,000 BOX" },
      { label: "배송", value: "월 1회 정기 발송 · 자재실 지정 배송" },
      { label: "결제", value: "월 말 정산 · 전자세금계산서 필수" },
      { label: "인증", value: "식약처 의료기기 신고 + KFDA 2등급" },
    ],
    quotes: [
      {
        id: "q-1",
        vendorName: "더미 의료기기 유한회사",
        vendorRating: 4.8,
        unitPrice: 7800,
        totalPrice: 7800 * 500,
        leadTime: "주문 후 영업일 3일",
        validUntil: "2026-06-30",
        note: "장기 계약 시 추가 3% 인하 가능 · 무료 샘플 5BOX 동봉.",
      },
      {
        id: "q-2",
        vendorName: "한빛메디칼(주)",
        vendorRating: 4.6,
        unitPrice: 8200,
        totalPrice: 8200 * 500,
        leadTime: "주문 후 영업일 5일",
        validUntil: "2026-07-15",
        note: "재고 충분. 12개월 정기 계약 시 6개월 무이자 분납.",
      },
      {
        id: "q-3",
        vendorName: "케어스토어",
        vendorRating: 4.4,
        unitPrice: 8900,
        totalPrice: 8900 * 500,
        leadTime: "주문 후 영업일 2일",
        validUntil: "2026-06-15",
        note: "긴급 대응 가능. 자체 물류망 운영.",
      },
      {
        id: "q-4",
        vendorName: "GS메디칼",
        vendorRating: 4.9,
        unitPrice: 9400,
        totalPrice: 9400 * 500,
        leadTime: "주문 후 영업일 7일",
        validUntil: "2026-08-01",
        note: "프리미엄 라인 · 라텍스 free 100% 보장 · KFDA 2등급 인증서 첨부.",
      },
    ],
  };
}

const STATUS_META: Record<RfqStatus, { label: string; tone: string; dot: string }> = {
  OPEN: {
    label: "응답 대기",
    tone: "border-[var(--color-status-pending)] text-[var(--color-status-pending)] bg-[var(--color-status-pending)]/10",
    dot: "bg-[var(--color-status-pending)]",
  },
  RESPONSES: {
    label: "응답 도착",
    tone: "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-light)]/60",
    dot: "bg-[var(--color-accent)]",
  },
  AWARDED: {
    label: "채택 완료",
    tone: "border-[var(--color-success)] text-[var(--color-success)] bg-[var(--color-success)]/10",
    dot: "bg-[var(--color-success)]",
  },
  EXPIRED: {
    label: "마감",
    tone: "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]",
    dot: "bg-[var(--color-text-tertiary)]",
  },
};

export default function RfqDetailPage({
  params,
}: {
  params: Promise<{ rfqId: string }>;
}) {
  void params;
  const [rfq] = useState<RfqDetail>(() => mockRfq("rfq-detail"));
  const [awardedId, setAwardedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const prices = rfq.quotes.map((q) => q.unitPrice);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
      saving: rfq.estimatedCatalogPrice - Math.min(...prices),
      savingPercent:
        ((rfq.estimatedCatalogPrice - Math.min(...prices)) /
          rfq.estimatedCatalogPrice) *
        100,
    };
  }, [rfq]);

  const statusMeta = STATUS_META[rfq.status];

  const awardedQuote = awardedId
    ? rfq.quotes.find((q) => q.id === awardedId)
    : null;

  return (
    <>
      <CatalogTopNav />
      <main className="mx-auto max-w-6xl px-6 py-12 pb-32 md:px-12 md:py-20 md:pb-20">
        <Link
          href="/rfq"
          className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          견적 요청 목록
        </Link>

        {/* 헤더 */}
        <header className="mt-8 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
              RFQ Detail
            </p>
            <h1 className="mt-3 break-keep text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
              {rfq.title}
            </h1>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              {rfq.category}
              <span className="mx-2 text-[var(--color-border-default)]">·</span>
              {rfq.buyerHospital}
              <span className="mx-2 text-[var(--color-border-default)]">·</span>
              요청일 {rfq.createdAt}
            </p>
          </div>
          <span
            className={`inline-flex h-8 items-center gap-2 rounded-full border px-4 text-xs font-medium ${statusMeta.tone}`}
          >
            <span
              aria-hidden
              className={`status-pulse-dot h-2 w-2 rounded-full ${statusMeta.dot}`}
            />
            {statusMeta.label} · {rfq.quotes.length}건
          </span>
        </header>

        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {rfq.description}
        </p>

        {/* 견적 통계 — 큰 숫자 */}
        <div className="mt-16 grid gap-12 border-y border-[var(--color-border-light)] py-12 md:grid-cols-4 md:gap-6">
          <StatCell label="최저 단가" accent>
            <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
              ₩
              <CountUp value={stats.min} duration={800} />
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              / {unit(rfq.unit)}
            </p>
          </StatCell>
          <StatCell label="평균 단가">
            <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
              ₩
              <CountUp value={stats.avg} duration={800} />
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              / {unit(rfq.unit)}
            </p>
          </StatCell>
          <StatCell label="카탈로그 대비">
            <p className="flex items-baseline gap-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-[var(--color-accent)] md:text-3xl">
              <TrendingDown className="h-6 w-6" strokeWidth={2.5} />
              <CountUp
                value={Math.round(stats.savingPercent)}
                duration={800}
                suffix="%"
              />
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              ₩{stats.saving.toLocaleString()} 절감 / {unit(rfq.unit)}
            </p>
          </StatCell>
          <StatCell label="마감까지">
            <p className="flex items-baseline gap-1 text-sm font-semibold">
              <Clock className="h-4 w-4 text-[var(--color-warning)]" />
              {rfq.deadline}
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              마감 후 추가 견적 불가
            </p>
          </StatCell>
        </div>

        {/* 견적 비교 표 */}
        <section className="mt-20">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              받은 견적 ({rfq.quotes.length}건)
            </p>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              단가 오름차순
            </p>
          </div>

          <div className="mt-6">
            {/* table header */}
            <div className="hidden grid-cols-[1.5fr_auto_120px_140px_140px_120px] gap-4 border-b border-[var(--color-border-light)] pb-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] md:grid">
              <span>공급업체</span>
              <span>평점</span>
              <span className="text-right">단가</span>
              <span className="text-right">월 합계</span>
              <span className="text-right">납기</span>
              <span className="text-right">채택</span>
            </div>

            <ul className="divide-y divide-[var(--color-border-light)]">
              {[...rfq.quotes]
                .sort((a, b) => a.unitPrice - b.unitPrice)
                .map((q, i) => {
                  const isLowest = q.unitPrice === stats.min;
                  const isAwarded = awardedId === q.id;
                  return (
                    <li
                      key={q.id}
                      className="row-fade-in"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="grid grid-cols-1 gap-3 py-6 md:grid-cols-[1.5fr_auto_120px_140px_140px_120px] md:items-center md:gap-4">
                        {/* Vendor */}
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
                              isLowest
                                ? "bg-[var(--color-accent)] text-white"
                                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"
                            }`}
                          >
                            <Building2 className="h-4 w-4" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate text-sm font-medium">
                              {q.vendorName}
                              {isLowest && (
                                <span className="inline-flex h-5 items-center rounded-full bg-[var(--color-accent-light)] px-2 text-[11px] font-semibold text-[var(--color-accent)]">
                                  최저가
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">
                              {q.note}
                            </p>
                          </div>
                        </div>
                        {/* Rating */}
                        <div className="flex items-center gap-1 text-xs">
                          <Star
                            className="h-3.5 w-3.5 fill-[var(--color-warning)] text-[var(--color-warning)]"
                            aria-hidden
                          />
                          <span className="font-medium tabular-nums">
                            {q.vendorRating.toFixed(1)}
                          </span>
                        </div>
                        {/* Unit */}
                        <p className="font-mono text-sm tabular-nums md:text-right">
                          ₩{q.unitPrice.toLocaleString()}
                        </p>
                        {/* Total */}
                        <p
                          className={`text-sm font-semibold tabular-nums md:text-right ${
                            isLowest ? "text-[var(--color-accent)]" : ""
                          }`}
                        >
                          ₩{q.totalPrice.toLocaleString()}
                        </p>
                        {/* Lead */}
                        <p className="text-xs text-[var(--color-text-secondary)] md:text-right">
                          {q.leadTime}
                        </p>
                        {/* CTA */}
                        <div className="md:text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setAwardedId(isAwarded ? null : q.id)
                            }
                            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium transition-all ${
                              isAwarded
                                ? "bg-[var(--color-accent)] text-white"
                                : "border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                            }`}
                          >
                            {isAwarded && (
                              <Check className="h-3 w-3" strokeWidth={3} />
                            )}
                            {isAwarded ? "선택됨" : "선택"}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        </section>

        {/* 요청 사양 */}
        <section className="mt-20">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            요청 사양
          </p>
          <dl className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {rfq.requirements.map((r) => (
              <div
                key={r.label}
                className="flex items-baseline justify-between gap-6 py-3.5"
              >
                <dt className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                  {r.label}
                </dt>
                <dd className="text-right text-sm text-[var(--color-text-primary)]">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 채택 CTA */}
        <section className="mt-20 border-y border-[var(--color-border-light)] py-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                선택한 견적
              </p>
              {awardedId ? (
                <div className="mt-3">
                  <p className="text-2xl font-semibold tracking-tight md:text-3xl">
                    {rfq.quotes.find((q) => q.id === awardedId)?.vendorName}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    월 ₩
                    {rfq.quotes
                      .find((q) => q.id === awardedId)
                      ?.totalPrice.toLocaleString()}{" "}
                    · 12개월 정기 계약
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--color-text-tertiary)]">
                  견적 표에서 채택할 공급업체를 선택해주세요.
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!awardedId}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-12 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-40"
            >
              채택 후 계약 진행
            </button>
          </div>
        </section>

        {/* 안내 */}
        <section className="mt-20">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            RFQ 진행 안내
          </p>
          <ul className="mt-5 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <NoticeRow
              num="01"
              label="견적 비교 후 1곳을 채택합니다"
              hint="가격 외 평점·납기·서비스를 종합 고려 권장"
            />
            <NoticeRow
              num="02"
              label="채택 시 정식 계약 단계로 진행"
              hint="공급업체와 1:1 메시지 · 계약서 작성 · 첫 발주"
            />
            <NoticeRow
              num="03"
              label="모든 견적은 마감 일까지 유효합니다"
              hint="마감 후에는 신규 RFQ를 다시 생성해주세요"
            />
          </ul>
        </section>
      </main>

      {/* Phase ξ-1 — 모바일 sticky 채택 CTA (bottom tab bar 위) */}
      <div
        className="fixed inset-x-0 bottom-14 z-20 border-t border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              {awardedQuote ? "채택" : "선택 대기"}
            </p>
            <p className="truncate text-sm font-semibold tracking-tight">
              {awardedQuote
                ? `${awardedQuote.vendorName} · ₩${awardedQuote.totalPrice.toLocaleString()}`
                : "공급업체를 선택해주세요"}
            </p>
          </div>
          <button
            type="button"
            disabled={!awardedId}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
          >
            채택하기
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function StatCell({
  label,
  accent = false,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={`text-[11px] font-medium uppercase tracking-[0.18em] ${
          accent
            ? "text-[var(--color-accent)]"
            : "text-[var(--color-text-tertiary)]"
        }`}
      >
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function NoticeRow({
  num,
  label,
  hint,
}: {
  num: string;
  label: string;
  hint: string;
}) {
  return (
    <li className="flex items-center gap-4 py-4">
      <span className="text-xs font-medium tabular-nums text-[var(--color-text-tertiary)]">
        {num}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
          {hint}
        </p>
      </div>
    </li>
  );
}
