"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { trpc } from "@/lib/trpc/client";

// Wave Q2 — 파트너센터 공동구매 캠페인 list.

export const dynamic = "force-dynamic";

type GbStatus = "OPEN" | "TARGET_MET" | "FULFILLED" | "FAILED";

type GbRow = {
  id: string;
  title: string;
  productName: string;
  targetQty: number;
  currentQty: number;
  participationCount: number;
  endsAt: string;
  daysLeft: number;
  status: GbStatus;
};

const STATUS_META: Record<GbStatus, { label: string; color: string }> = {
  OPEN: { label: "진행 중", color: "text-[var(--color-accent)]" },
  TARGET_MET: { label: "목표 달성", color: "text-[var(--color-success)]" },
  FULFILLED: {
    label: "결제 완료",
    color: "text-[var(--color-status-delivered)]",
  },
  FAILED: { label: "미달/취소", color: "text-[var(--color-text-tertiary)]" },
};

function tsToMillis(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "object" && v !== null) {
    const o = v as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === "function") return o.toMillis();
    if (typeof o.seconds === "number") return o.seconds * 1000;
  }
  const t = new Date(v as string | number | Date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const PREVIEW_ROWS: GbRow[] = [
  {
    id: "preview-1",
    title: "5월 라텍스 장갑 공동구매",
    productName: "수술용 라텍스 장갑 (M) 100매",
    targetQty: 500,
    currentQty: 420,
    participationCount: 28,
    endsAt: "2026-06-10",
    daysLeft: 8,
    status: "OPEN",
  },
  {
    id: "preview-2",
    title: "KF94 마스크 대량 공구",
    productName: "일회용 마스크 KF94 50매",
    targetQty: 300,
    currentQty: 300,
    participationCount: 22,
    endsAt: "2026-06-05",
    daysLeft: 3,
    status: "TARGET_MET",
  },
  {
    id: "preview-3",
    title: "4월 수술가운 공동구매",
    productName: "수술용 가운 (멸균) 5매",
    targetQty: 200,
    currentQty: 210,
    participationCount: 18,
    endsAt: "2026-05-10",
    daysLeft: -20,
    status: "FULFILLED",
  },
];

const PREVIEW_COUNTS = {
  open: 1,
  targetMet: 1,
  fulfilled: 1,
  failed: 0,
  totalRevenue: 8400000,
};

export default function SellerGroupbuysPage() {
  const router = useRouter();

  // Phase γ-2 — cursor pagination
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulated, setAccumulated] = useState<GbRow[]>([]);

  const listQuery = trpc.vendor.groupbuy.list.useQuery({
    pageSize: 50,
    cursor,
  });
  const countsQuery = trpc.vendor.groupbuy.counts.useQuery();

  const usePreview =
    !listQuery.isPending &&
    (listQuery.error !== null ||
      (listQuery.data?.groupBuys.length ?? 0) === 0);

  const livePageRows: GbRow[] = useMemo(() => {
    return (listQuery.data?.groupBuys ?? []).map((g) => {
      const data = g as {
        id: string;
        title?: string;
        productName?: string;
        targetQty?: number;
        currentQty?: number;
        participationCount?: number;
        endsAt?: unknown;
        status?: string;
      };
      const endsMs = tsToMillis(data.endsAt);
      const daysLeft = endsMs
        ? Math.ceil((endsMs - Date.now()) / 86400000)
        : 0;
      return {
        id: data.id,
        title: data.title ?? "—",
        productName: data.productName ?? "—",
        targetQty: data.targetQty ?? 0,
        currentQty: data.currentQty ?? 0,
        participationCount: data.participationCount ?? 0,
        endsAt: endsMs ? new Date(endsMs).toISOString().slice(0, 10) : "—",
        daysLeft,
        status: (data.status as GbStatus) ?? "OPEN",
      };
    });
  }, [listQuery.data]);

  useEffect(() => {
    if (!listQuery.data) return;
    setAccumulated((prev) => {
      if (!cursor) return livePageRows;
      const seen = new Set(prev.map((r) => r.id));
      const merged = [...prev];
      for (const r of livePageRows) if (!seen.has(r.id)) merged.push(r);
      return merged;
    });
  }, [listQuery.data, cursor, livePageRows]);

  const rows: GbRow[] = usePreview ? PREVIEW_ROWS : accumulated;
  const nextCursor = listQuery.data?.nextCursor;

  function loadMore() {
    if (nextCursor) setCursor(nextCursor);
  }

  const counts = countsQuery.data ?? (usePreview ? PREVIEW_COUNTS : undefined);

  const KPIS = [
    {
      label: "진행 중",
      icon: Clock,
      value: counts?.open ?? 0,
      sub: "마감 임박 캠페인 우선 관리",
      tone: "accent" as const,
    },
    {
      label: "목표 달성",
      icon: CheckCircle2,
      value: counts?.targetMet ?? 0,
      sub: "결제 완료 대기",
      tone: "success" as const,
    },
    {
      label: "미달/취소",
      icon: XCircle,
      value: counts?.failed ?? 0,
      sub: "참여 환불 처리됨",
      tone: "tertiary" as const,
    },
    {
      label: "누적 매출",
      icon: TrendingUp,
      value: counts?.totalRevenue ?? 0,
      sub: "결제 완료 캠페인 합계",
      tone: "delivered" as const,
      isCurrency: true,
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
      <PageHeader
        label="파트너센터 · 공동구매"
        title="공동구매"
        description="목표 수량이 모이면 자동으로 결제됩니다. 마감 1시간 전부터 알림이 발송됩니다."
      >
        <button
          type="button"
          onClick={() => router.push("/seller/groupbuys/new")}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <Plus className="h-4 w-4" />새 캠페인
        </button>
      </PageHeader>

      {/* KPI 4 컬럼 */}
      <section className="mt-12 grid grid-cols-2 gap-y-8 border-y border-[var(--color-border-light)] py-8 lg:grid-cols-4 lg:gap-y-0">
        {KPIS.map((k, i) => (
          <KpiItem key={k.label} {...k} hasDivider={i > 0} />
        ))}
      </section>

      {usePreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          ※ 디자인 미리보기 데이터입니다. 실제 캠페인을 등록하면 자동으로
          교체됩니다.
        </p>
      )}

      {/* 캠페인 list */}
      <section className="mt-12">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              캠페인 목록
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              총 {rows.length}건
            </h2>
          </div>
        </header>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] text-left text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                <th className="py-3 pr-6 font-medium">캠페인</th>
                <th className="px-6 py-3 font-medium">상품</th>
                <th className="px-6 py-3 font-medium">진행률</th>
                <th className="px-6 py-3 text-right font-medium">참여</th>
                <th className="px-6 py-3 font-medium">마감까지</th>
                <th className="px-6 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isPending && !usePreview ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin text-[var(--color-text-tertiary)]" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-16 text-center text-sm text-[var(--color-text-tertiary)]"
                  >
                    아직 등록된 캠페인이 없습니다.
                    <Link
                      href="/seller/groupbuys/new"
                      className="ml-2 font-medium text-[var(--color-accent)] hover:underline"
                    >
                      첫 캠페인 만들기 →
                    </Link>
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const pct = Math.min(
                    100,
                    Math.round((r.currentQty / Math.max(1, r.targetQty)) * 100),
                  );
                  return (
                    <tr
                      key={r.id}
                      className="row-fade-in border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-bg-tertiary)]/60"
                      style={{
                        animationDelay: `${Math.min(i, 12) * 35}ms`,
                      }}
                    >
                      <td className="py-4 pr-6">
                        <Link
                          href={`/seller/groupbuys/${r.id}`}
                          className="font-medium hover:text-[var(--color-accent)]"
                          onClick={(e) => {
                            if (r.id.startsWith("preview-")) {
                              e.preventDefault();
                            }
                          }}
                        >
                          {r.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                        {r.productName}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--color-border-light)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium tabular-nums">
                            {pct}%
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)] tabular-nums">
                          {r.currentQty.toLocaleString()} /{" "}
                          {r.targetQty.toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
                          <Users className="h-3 w-3 text-[var(--color-text-tertiary)]" />
                          {r.participationCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                        {r.daysLeft > 0 ? (
                          <span className="tabular-nums">
                            D−{r.daysLeft} <span className="text-[10px] text-[var(--color-text-tertiary)]">({r.endsAt})</span>
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-tertiary)]">
                            마감 ({r.endsAt})
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold ${STATUS_META[r.status].color}`}
                        >
                          {STATUS_META[r.status].label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phase γ-2 — 더 보기 */}
        {!usePreview && nextCursor && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={listQuery.isFetching}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-5 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
            >
              {listQuery.isFetching
                ? "불러오는 중…"
                : `더 보기 (${rows.length}건 표시 중)`}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function KpiItem({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  isCurrency,
  hasDivider,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  sub: string;
  tone: "accent" | "success" | "tertiary" | "delivered";
  isCurrency?: boolean;
  hasDivider: boolean;
}) {
  const iconColor = {
    accent: "text-[var(--color-accent)]",
    success: "text-[var(--color-success)]",
    tertiary: "text-[var(--color-text-tertiary)]",
    delivered: "text-[var(--color-status-delivered)]",
  }[tone];
  return (
    <div
      className={`px-6 first:pl-0 lg:px-8 ${
        hasDivider ? "lg:border-l lg:border-[var(--color-border-light)]" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        <CountUp value={value} prefix={isCurrency ? "₩" : ""} />
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
        {sub}
      </p>
    </div>
  );
}
