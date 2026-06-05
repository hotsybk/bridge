import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Flame,
  Package,
  TrendingDown,
  Users,
} from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { LaunchAlertButton } from "@/components/shared/launch-alert-modal";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

/**
 * 공동구매 (Group Buy) — Phase 4 출시 예정.
 *
 * 마감 카운트다운 + 진행률 바 + 가격 인하 단계 표시.
 * Cloud Function (groupbuy-closer) 가 매분 실행되어 마감 처리.
 */

type GroupBuy = {
  id: string;
  productName: string;
  vendorName: string;
  basePrice: number;
  currentPrice: number;
  targetPrice: number;
  unit: string;
  participantsCount: number;
  targetCount: number;
  closesIn: string; // "2일 12시간 남음"
  status: "OPEN" | "REACHED" | "CLOSING";
};

const GROUPBUYS: GroupBuy[] = [
  {
    id: "gb-001",
    productName: "수술용 라텍스 장갑 (M) 100매",
    vendorName: "더미 의료기기 유한회사",
    basePrice: 8900,
    currentPrice: 7600,
    targetPrice: 6900,
    unit: "BOX",
    participantsCount: 23,
    targetCount: 30,
    closesIn: "2일 12시간",
    status: "OPEN",
  },
  {
    id: "gb-002",
    productName: "일회용 마스크 KF94 50매",
    vendorName: "더미 의료기기 유한회사",
    basePrice: 15000,
    currentPrice: 12000,
    targetPrice: 11000,
    unit: "BOX",
    participantsCount: 48,
    targetCount: 50,
    closesIn: "8시간",
    status: "CLOSING",
  },
  {
    id: "gb-003",
    productName: "살균 알코올 1L (12입)",
    vendorName: "더미 의료기기 유한회사",
    basePrice: 8500,
    currentPrice: 7800,
    targetPrice: 7000,
    unit: "EA",
    participantsCount: 67,
    targetCount: 50,
    closesIn: "1일 4시간",
    status: "REACHED",
  },
  {
    id: "gb-004",
    productName: "디지털 혈압계 (상완식)",
    vendorName: "더미 헬스케어",
    basePrice: 85000,
    currentPrice: 78000,
    targetPrice: 72000,
    unit: "EA",
    participantsCount: 12,
    targetCount: 25,
    closesIn: "5일",
    status: "OPEN",
  },
] as const;

export default function GroupBuysPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
        <PageHeader
          label="공동구매 · 곧 시작"
          title="지금 진행 중인 공동구매."
          description="병원이 모일수록 가격↓. 마감 시 자동 결제·발주."
        >
          <LaunchAlertButton
            type="GROUPBUY_LAUNCH"
            title="공동구매 출시 알림"
            description="공동구매 정식 출시 시점을 가장 먼저 알려드려요. 모집 시작 캠페인에 우선 참여할 수 있는 안내도 함께 보내드립니다."
            buttonClassName="inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-text-primary)] px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          />
        </PageHeader>

        {/* Stats banner — 라인 패턴 */}
        <section className="mt-10 grid grid-cols-1 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-3 md:divide-x md:divide-y-0">
          <StatCard
            icon={Flame}
            value="4"
            label="진행 중"
            sub="2건 마감 임박"
            tone="warning"
          />
          <StatCard
            icon={Users}
            value="150+"
            label="참여 병원"
            sub="이번 주 누적"
            tone="accent"
          />
          <StatCard
            icon={TrendingDown}
            value="평균 15%"
            label="할인율"
            sub="정가 대비"
            tone="success"
          />
        </section>

        {/* List */}
        <section className="mt-12 grid gap-5 md:grid-cols-2">
          {GROUPBUYS.map((g) => (
            <GroupBuyCard key={g.id} gb={g} />
          ))}
        </section>

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-[var(--color-text-tertiary)]">
          미리보기 — 정식 출시 시 즉시 참여 가능.
        </p>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  sub,
  tone,
}: {
  icon: typeof Flame;
  value: string;
  label: string;
  sub: string;
  tone: "warning" | "accent" | "success";
}) {
  const toneClass = {
    warning: "text-[var(--color-warning)] bg-[var(--color-warning)]/12",
    accent: "text-[var(--color-accent)] bg-[var(--color-accent-light)]",
    success: "text-[var(--color-success)] bg-[var(--color-success)]/12",
  }[tone];
  return (
    <article className="flex items-center gap-4 py-8 md:px-8">
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${toneClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
          {value}
        </p>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{sub}</p>
      </div>
    </article>
  );
}

function GroupBuyCard({ gb }: { gb: GroupBuy }) {
  const progress = Math.min(100, Math.round((gb.participantsCount / gb.targetCount) * 100));
  const discountPct = Math.round((1 - gb.currentPrice / gb.basePrice) * 100);

  const statusTone =
    gb.status === "REACHED"
      ? { bg: "bg-[var(--color-success)]/15", text: "text-[var(--color-success)]", label: "목표 달성" }
      : gb.status === "CLOSING"
        ? { bg: "bg-[var(--color-warning)]/15", text: "text-[var(--color-warning)]", label: "마감 임박" }
        : { bg: "bg-[var(--color-accent-light)]", text: "text-[var(--color-accent)]", label: "모집 중" };

  return (
    <article className="flex flex-col gap-5 border border-[var(--color-border-light)] p-6 transition-colors hover:border-[var(--color-text-tertiary)] md:p-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]">
            <Package className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">
              {gb.productName}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
              {gb.vendorName}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-semibold ${statusTone.bg} ${statusTone.text}`}
        >
          {statusTone.label}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-3">
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-[var(--color-accent)] md:text-3xl">
          ₩{gb.currentPrice.toLocaleString()}
        </p>
        <span className="text-sm font-medium text-[var(--color-accent)]">
          −{discountPct}%
        </span>
        <span className="text-xs text-[var(--color-text-tertiary)] line-through tabular-nums">
          ₩{gb.basePrice.toLocaleString()}
        </span>
        <span className="text-xs text-[var(--color-text-tertiary)]">/ {gb.unit}</span>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium">
            <span className="text-[var(--color-accent)]">{gb.participantsCount}</span>
            <span className="text-[var(--color-text-tertiary)]"> / {gb.targetCount}개 병원 참여</span>
          </span>
          <span className="text-[var(--color-text-tertiary)] tabular-nums">{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
          <div
            className="progress-bar-fill h-full rounded-full bg-[var(--color-accent)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        {gb.status === "REACHED" && (
          <p className="mt-2 text-[11px] text-[var(--color-success)]">
            목표 달성 — 추가 참여 시 가격 ₩{gb.targetPrice.toLocaleString()} 까지 인하
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--color-border-light)] pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          <Clock className="h-3.5 w-3.5" />
          {gb.closesIn} 남음
        </span>
        <Link
          href={`/groupbuys/${gb.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
        >
          참여하기
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </article>
  );
}
