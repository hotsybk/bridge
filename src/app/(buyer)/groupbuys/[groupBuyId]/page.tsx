"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Flame,
  Package,
  TrendingDown,
  Users,
} from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { CountUp } from "@/components/shared/count-up";
import { trackGroupbuyJoin } from "@/lib/posthog/events";
import { trpc } from "@/lib/trpc/client";

/**
 * /groupbuys/[groupBuyId] — 공동구매 상세 (Phase 4 mock).
 *
 * 디자인 DNA:
 *  - 박스 0개. 큰 가격 hero, 라인 progress, divider 가격 단계 stair.
 *  - 실시간 카운트다운 (남은 시간 mm:ss).
 *  - 참여 진행률 — 라인 progress + accent fill.
 *  - 가격 단계 stair (basePrice → currentPrice → targetPrice).
 *  - 참여 병원 익명 list.
 */

type GroupBuyStatus = "OPEN" | "CLOSING" | "REACHED";

type GroupBuyDetail = {
  id: string;
  productName: string;
  productCategory: string;
  vendorName: string;
  unit: string;
  basePrice: number;
  currentPrice: number;
  targetPrice: number;
  minPrice: number;
  participantsCount: number;
  targetCount: number;
  closesAt: Date;
  status: GroupBuyStatus;
  description: string;
  minOrderQty: number;
  shippingFee: number;
  participants: Array<{ initial: string; region: string; qty: number }>;
};

const UNIT_LABEL: Record<string, string> = {
  BOX: "박스",
  EA: "개",
  KG: "kg",
  L: "L",
};

function unit(u: string): string {
  return UNIT_LABEL[u] ?? u;
}

function mockGroupBuy(id: string): GroupBuyDetail {
  // 2일 12시간 후 마감 가정
  const closesAt = new Date(Date.now() + (2 * 24 + 12) * 3600 * 1000);
  return {
    id,
    productName: "수술용 라텍스 장갑 (M) 100매",
    productCategory: "감염 관리 · 일회용 소모품",
    vendorName: "더미 의료기기 유한회사",
    unit: "BOX",
    basePrice: 8900,
    currentPrice: 7600,
    targetPrice: 6900,
    minPrice: 6500,
    participantsCount: 23,
    targetCount: 30,
    closesAt,
    status: "OPEN",
    description:
      "300여 개 의원이 매주 사용하는 베스트셀러 장갑. 목표 인원이 모일수록 단가가 자동 인하되고, 마감 시 일괄 결제됩니다.",
    minOrderQty: 1,
    shippingFee: 0,
    participants: [
      { initial: "ㄱ", region: "서울 강남", qty: 3 },
      { initial: "ㅂ", region: "경기 분당", qty: 2 },
      { initial: "ㅈ", region: "서울 송파", qty: 5 },
      { initial: "ㅎ", region: "부산 해운대", qty: 4 },
      { initial: "ㄴ", region: "인천 남동", qty: 1 },
      { initial: "ㄷ", region: "대전 유성", qty: 2 },
      { initial: "ㅅ", region: "서울 성동", qty: 3 },
      { initial: "ㅇ", region: "경기 안양", qty: 3 },
    ],
  };
}

export default function GroupBuyDetailPage({
  params,
}: {
  params: Promise<{ groupBuyId: string }>;
}) {
  const { groupBuyId } = use(params);
  const [groupBuy] = useState<GroupBuyDetail>(() => mockGroupBuy(groupBuyId));

  const [qty, setQty] = useState(1);
  const [participating, setParticipating] = useState(false);
  const [participateError, setParticipateError] = useState<string | null>(null);
  const [participateSuccess, setParticipateSuccess] = useState<string | null>(null);

  const participateMutation = trpc.groupbuy.participate.useMutation();

  async function handleParticipate() {
    setParticipateError(null);
    setParticipateSuccess(null);
    setParticipating(true);
    try {
      const res = await participateMutation.mutateAsync({
        groupBuyId,
        qty,
      });
      setParticipateSuccess(
        `참여 완료 — ₩${res.totalAmount.toLocaleString()} 카드 hold (목표 미달 시 자동 취소)`,
      );
      // Phase ν-2 — PostHog groupbuy_join.
      // mock 데이터에는 productId 가 없으므로 groupBuyId 로 fallback.
      trackGroupbuyJoin({
        groupBuyId,
        productId: groupBuy.id,
        qty,
        amount: res.totalAmount,
      });
    } catch (err) {
      // mock 모드 / 미인증 등에서 실패 시 안내
      const msg = err instanceof Error ? err.message : "참여에 실패했습니다.";
      setParticipateError(msg);
    } finally {
      setParticipating(false);
    }
  }
  const [remaining, setRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // 카운트다운
  useEffect(() => {
    function tick() {
      const diff = Math.max(
        0,
        Math.floor((groupBuy.closesAt.getTime() - Date.now()) / 1000),
      );
      setRemaining({
        days: Math.floor(diff / 86400),
        hours: Math.floor((diff % 86400) / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
      });
    }
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [groupBuy.closesAt]);

  const progress = Math.min(
    100,
    (groupBuy.participantsCount / groupBuy.targetCount) * 100,
  );
  const overShoot = groupBuy.participantsCount > groupBuy.targetCount;

  const priceTiers = useMemo(
    () => [
      { count: 0, price: groupBuy.basePrice, label: "단독 구매" },
      {
        count: Math.floor(groupBuy.targetCount * 0.5),
        price: groupBuy.currentPrice,
        label: "1차 인하",
      },
      {
        count: groupBuy.targetCount,
        price: groupBuy.targetPrice,
        label: "목표 달성",
      },
      {
        count: Math.floor(groupBuy.targetCount * 1.5),
        price: groupBuy.minPrice,
        label: "최저가",
      },
    ],
    [groupBuy],
  );

  const total = groupBuy.currentPrice * qty + groupBuy.shippingFee;

  return (
    <>
      <CatalogTopNav />
      <main className="mx-auto max-w-7xl px-6 py-12 pb-32 md:px-12 md:py-20 md:pb-20">
        <Link
          href="/groupbuys"
          className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          공동구매 목록
        </Link>

        {/* 헤더 */}
        <header className="mt-8 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
              Group Buy · 진행 중
            </p>
            <h1 className="mt-3 break-keep text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
              {groupBuy.productName}
            </h1>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-[var(--color-text-secondary)]">
              <span>{groupBuy.productCategory}</span>
              <span aria-hidden className="text-[var(--color-border-default)]">·</span>
              <span>{groupBuy.vendorName}</span>
            </p>
          </div>
          <StatusChip status={groupBuy.status} />
        </header>

        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {groupBuy.description}
        </p>

        {/* Hero — 큰 가격 + 카운트다운 */}
        <div className="mt-16 grid gap-12 border-y border-[var(--color-border-light)] py-12 md:grid-cols-2 md:gap-20">
          {/* 가격 */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              지금 단가
            </p>
            <p className="mt-3 flex items-baseline gap-3">
              <span className="text-4xl font-semibold tracking-[-0.04em] tabular-nums md:text-5xl">
                ₩
                <CountUp
                  value={groupBuy.currentPrice}
                  duration={800}
                  integer={false}
                />
              </span>
              <span className="text-sm font-normal text-[var(--color-text-tertiary)]">
                / {unit(groupBuy.unit)}
              </span>
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-[var(--color-text-tertiary)] line-through">
                ₩{groupBuy.basePrice.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--color-accent)]">
                <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                {Math.round(
                  ((groupBuy.basePrice - groupBuy.currentPrice) /
                    groupBuy.basePrice) *
                    100,
                )}
                %
              </span>
            </p>
            <p className="mt-6 text-xs text-[var(--color-text-tertiary)]">
              목표 달성 시 ₩{groupBuy.targetPrice.toLocaleString()}까지 인하
            </p>
          </div>

          {/* 카운트다운 */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              마감까지
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <TimeCell value={remaining.days} label="일" />
              <TimeCell value={remaining.hours} label="시간" />
              <TimeCell value={remaining.minutes} label="분" />
              <TimeCell
                value={remaining.seconds}
                label="초"
                pulse={groupBuy.status === "CLOSING"}
              />
            </div>
            <p className="mt-6 flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
              <Clock className="h-3 w-3" aria-hidden />
              마감 시 자동으로 일괄 결제됩니다
            </p>
          </div>
        </div>

        {/* 참여 진행률 */}
        <section className="mt-20">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              참여 진행률
            </p>
            <p className="text-sm font-semibold tabular-nums">
              <CountUp value={groupBuy.participantsCount} />
              <span className="text-[var(--color-text-tertiary)]">
                {" "}
                / {groupBuy.targetCount}개 의원
              </span>
              {overShoot && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-accent)]">
                  <Flame className="h-3 w-3" />
                  목표 초과
                </span>
              )}
            </p>
          </div>
          {/* progress bar — 라인 only */}
          <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border-light)]">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[var(--color-accent)] transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
            남은 인원 {Math.max(0, groupBuy.targetCount - groupBuy.participantsCount)}곳
          </p>
        </section>

        {/* 가격 단계 stair */}
        <section className="mt-20">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            가격 인하 단계
          </p>
          <ul className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {priceTiers.map((tier, i) => {
              const achieved = groupBuy.participantsCount >= tier.count;
              const isCurrent =
                groupBuy.participantsCount >= tier.count &&
                (priceTiers[i + 1]?.count ?? Infinity) >
                  groupBuy.participantsCount;
              return (
                <li
                  key={tier.label}
                  className="flex items-center gap-6 py-5"
                >
                  <span
                    aria-hidden
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-all ${
                      achieved
                        ? "bg-[var(--color-accent)] text-white"
                        : "border border-[var(--color-border-default)] text-[var(--color-text-tertiary)]"
                    } ${isCurrent ? "shadow-[0_0_0_4px_var(--color-accent-light)]" : ""}`}
                  >
                    {achieved ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        achieved
                          ? "text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      {tier.label}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                      {tier.count}개 의원 참여 시
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      achieved
                        ? "text-[var(--color-accent)]"
                        : "text-[var(--color-text-tertiary)]"
                    }`}
                  >
                    ₩{tier.price.toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 참여 의원 */}
        <section className="mt-20">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              참여 의원
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              개인정보 보호를 위해 익명 표시
            </p>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {groupBuy.participants.map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-3 border-b border-[var(--color-border-light)] pb-3"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-bg-secondary)] text-sm font-semibold text-[var(--color-text-secondary)]">
                  {p.initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {p.initial}**의원
                  </p>
                  <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                    {p.region} · {p.qty}
                    {unit(groupBuy.unit)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 참여 CTA — sticky bar */}
        <section className="mt-20 border-y border-[var(--color-border-light)] py-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                지금 참여하기
              </p>
              <div className="mt-5 flex items-center gap-6">
                {/* 수량 입력 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                    수량
                  </span>
                  <div className="flex h-11 items-center rounded-full border border-[var(--color-border-default)] md:h-10">
                    <button
                      type="button"
                      onClick={() =>
                        setQty(Math.max(groupBuy.minOrderQty, qty - 1))
                      }
                      className="grid h-11 w-11 place-items-center text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] md:h-10 md:w-10"
                      aria-label="수량 감소"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(qty + 1)}
                      className="grid h-11 w-11 place-items-center text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] md:h-10 md:w-10"
                      aria-label="수량 증가"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {unit(groupBuy.unit)}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                    예상 결제
                  </span>
                  <span className="text-2xl font-semibold tabular-nums tracking-[-0.02em] md:text-3xl">
                    ₩{total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleParticipate}
              disabled={participating}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-12 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {participating ? "처리 중" : "공동구매 참여하기"}
              {!participating && <Users className="h-4 w-4" />}
            </button>
          </div>
          {participateError && (
            <p className="mt-4 text-[11px] text-[var(--color-error)]">
              {participateError}
            </p>
          )}
          {participateSuccess && (
            <p className="mt-4 text-[11px] text-[var(--color-success)]">
              {participateSuccess}
            </p>
          )}
          <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
            마감까지 결제 시 카드가 보류 상태로 잡히며, 목표 미달 시 자동 취소
            됩니다.
          </p>
        </section>

        {/* 안내 */}
        <section className="mt-20">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            공동구매 진행 안내
          </p>
          <ul className="mt-5 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <NoticeRow
              icon={Users}
              label="목표 인원이 모일 때만 결제됩니다"
              hint="미달 시 카드 보류는 자동 해제 · 추가 차감 없음"
            />
            <NoticeRow
              icon={Package}
              label="배송은 마감 후 영업일 3일 내"
              hint="전국 권역별 직배송 · 도서산간 추가"
            />
            <NoticeRow
              icon={TrendingDown}
              label="더 많이 모일수록 더 저렴해집니다"
              hint="실시간 단가 인하 · 마감 직전 알림톡 발송"
            />
          </ul>
        </section>
      </main>

      {/* Phase ξ-1 — 모바일 sticky 참여 CTA (bottom tab bar 위) */}
      <div
        className="fixed inset-x-0 bottom-14 z-20 border-t border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              예상 결제 · {qty}
              {unit(groupBuy.unit)}
            </p>
            <p className="text-base font-semibold tabular-nums tracking-tight">
              ₩{total.toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={handleParticipate}
            disabled={participating}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            {participating ? "처리 중" : "참여하기"}
            {!participating && <Users className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: GroupBuyStatus }) {
  const cfg = {
    OPEN: {
      label: "참여 가능",
      tone: "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-light)]/60",
      dot: "bg-[var(--color-accent)]",
    },
    CLOSING: {
      label: "마감 임박",
      tone: "border-[var(--color-warning)] text-[var(--color-warning)] bg-[var(--color-warning)]/10",
      dot: "bg-[var(--color-warning)]",
    },
    REACHED: {
      label: "목표 달성",
      tone: "border-[var(--color-success)] text-[var(--color-success)] bg-[var(--color-success)]/10",
      dot: "bg-[var(--color-success)]",
    },
  }[status];
  return (
    <span
      className={`inline-flex h-8 items-center gap-2 rounded-full border px-4 text-xs font-medium ${cfg.tone}`}
    >
      <span
        aria-hidden
        className={`status-pulse-dot h-2 w-2 rounded-full ${cfg.dot}`}
      />
      {cfg.label}
    </span>
  );
}

function TimeCell({
  value,
  label,
  pulse = false,
}: {
  value: number;
  label: string;
  pulse?: boolean;
}) {
  return (
    <div className="border-y border-[var(--color-border-light)] py-3 text-center">
      <p
        className={`text-2xl font-semibold tabular-nums tracking-tight md:text-3xl ${
          pulse ? "animate-pulse text-[var(--color-warning)]" : ""
        }`}
      >
        {String(value).padStart(2, "0")}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
    </div>
  );
}

function NoticeRow({
  icon: Icon,
  label,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  hint: string;
}) {
  return (
    <li className="flex items-center gap-4 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)]">
        <Icon className="h-4 w-4" strokeWidth={2.2} aria-hidden />
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
