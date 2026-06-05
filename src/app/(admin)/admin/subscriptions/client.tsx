"use client";

// Wave Q3 — 운영자 정기구독 모니터링 client island.
//
// Server page 가 trpc.admin.subscription.list/counts/topByVendor 를 호출 후
// 직렬화된 데이터를 prop 으로 전달. 본 컴포넌트는 KPI + tab + table + dialog 만 책임.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";

export type SubscriptionRow = {
  id: string;
  hospitalId?: string;
  hospitalName?: string;
  vendorId?: string;
  vendorName?: string;
  productId?: string;
  productName?: string;
  status?: string;
  cadence?: string;
  nextRunAt?: { _seconds?: number; seconds?: number } | string | null;
  qty?: number;
  runCount?: number;
  totalRuns?: number;
  unitPrice?: number;
  totalAmount?: number;
  priceChangePercent?: number;
  pauseReason?: string;
};

export type SubscriptionCounts = {
  active: number;
  paused: number;
  next7Days: number;
  priceChangeAffected: number;
};

export type TopVendorEntry = {
  vendorId: string;
  vendorName: string;
  count: number;
};

type Tab = "ACTIVE" | "PAUSED" | "ENDED" | "PRICE_CHANGE";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "ACTIVE", label: "활성" },
  { value: "PAUSED", label: "일시정지" },
  { value: "ENDED", label: "종료" },
  { value: "PRICE_CHANGE", label: "가격 변동" },
];

const FILTERS = ["Hospital", "Vendor", "주기", "상품"] as const;

const CADENCE_LABEL: Record<string, string> = {
  WEEKLY: "7일",
  BIWEEKLY: "14일",
  MONTHLY: "30일",
  CUSTOM: "사용자",
};

function tsToMillis(v: SubscriptionRow["nextRunAt"]): number {
  if (!v) return 0;
  if (typeof v === "string") {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof v === "object") {
    const seconds = v._seconds ?? v.seconds;
    if (typeof seconds === "number") return seconds * 1000;
  }
  return 0;
}

function fmtDate(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AdminSubscriptionsClient({
  subscriptions,
  counts,
  topVendors,
  readOnly,
}: {
  subscriptions: SubscriptionRow[];
  counts: SubscriptionCounts;
  topVendors: TopVendorEntry[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ACTIVE");
  const [search, setSearch] = useState("");

  // dialog state
  const [pauseTarget, setPauseTarget] = useState<SubscriptionRow | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const forcePauseMutation = trpc.admin.subscription.forcePause.useMutation();
  const forceResumeMutation = trpc.admin.subscription.forceResume.useMutation();

  const filtered = useMemo(() => {
    const k = search.trim().toLowerCase();
    const bySearch = (r: SubscriptionRow) =>
      !k ||
      r.hospitalName?.toLowerCase().includes(k) ||
      r.vendorName?.toLowerCase().includes(k) ||
      r.productName?.toLowerCase().includes(k);
    return subscriptions.filter((r) => {
      if (!bySearch(r)) return false;
      if (tab === "ACTIVE") return r.status === "ACTIVE";
      if (tab === "PAUSED") return r.status === "PAUSED";
      if (tab === "ENDED") return r.status === "CANCELLED" || r.status === "EXPIRED";
      if (tab === "PRICE_CHANGE")
        return (
          typeof r.priceChangePercent === "number" &&
          Math.abs(r.priceChangePercent) >= 5
        );
      return true;
    });
  }, [subscriptions, search, tab]);

  const tabCounts = useMemo(
    () => ({
      ACTIVE: subscriptions.filter((r) => r.status === "ACTIVE").length,
      PAUSED: subscriptions.filter((r) => r.status === "PAUSED").length,
      ENDED: subscriptions.filter(
        (r) => r.status === "CANCELLED" || r.status === "EXPIRED",
      ).length,
      PRICE_CHANGE: subscriptions.filter(
        (r) =>
          typeof r.priceChangePercent === "number" &&
          Math.abs(r.priceChangePercent) >= 5,
      ).length,
    }),
    [subscriptions],
  );

  async function handlePause() {
    if (!pauseTarget) return;
    setSubmitError(null);
    if (!pauseReason.trim()) {
      setSubmitError("정지 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await forcePauseMutation.mutateAsync({
        subscriptionId: pauseTarget.id,
        reason: pauseReason.trim(),
      });
      setPauseTarget(null);
      setPauseReason("");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "정지 처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResume(row: SubscriptionRow) {
    if (readOnly) return;
    if (!confirm("이 구독을 재개하시겠습니까?")) return;
    try {
      await forceResumeMutation.mutateAsync({ subscriptionId: row.id });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "재개에 실패했습니다.");
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
        카탈로그 · 구독
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        정기구독 모니터링
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        병원 정기구독 자동발주 현황 및 가격 변동 영향 모니터링
      </p>

      {readOnly && (
        <div className="mt-6 border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
          미리보기 모드 — 실제 데이터가 없습니다. Firestore 시드 후 실 데이터로 전환됩니다.
        </div>
      )}

      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <KpiCell label="활성 구독" value={counts.active} unit="건" />
        <KpiCell
          label="일시정지"
          value={counts.paused}
          unit="건"
          deltaTone="warning"
          delta="재개 유도 대상"
        />
        <KpiCell
          label="다음 7일 자동발주"
          value={counts.next7Days}
          unit="건"
          deltaTone="accent"
          delta="실행 예정"
        />
        <KpiCell
          label="가격 변동 영향 (5%+)"
          value={counts.priceChangeAffected}
          unit="건"
          deltaTone="warning"
          delta="병원 동의 필요"
        />
      </dl>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_280px] lg:gap-16">
        <div className="min-w-0">
          <nav
            className="flex gap-1 border-b border-[var(--color-border-light)]"
            aria-label="구독 상태"
          >
            {TABS.map((t) => {
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  aria-pressed={active}
                  className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 text-xs tabular-nums text-[var(--color-text-tertiary)]">
                    {tabCounts[t.value]}
                  </span>
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 -bottom-px h-0.5 bg-[var(--color-accent)]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {FILTERS.map((label) => (
              <button
                key={label}
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-3 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]"
              >
                {label}
                <ChevronDown className="h-3 w-3" />
              </button>
            ))}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="병원/vendor/상품 검색…"
              className="ml-auto h-8 w-64 border-b border-[var(--color-border-light)] bg-transparent text-xs placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div className="mt-8 border-y border-[var(--color-border-light)]">
            <div className="grid grid-cols-[1fr_1fr_1.5fr_72px_110px_72px_72px_96px_96px] gap-3 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              <span>Hospital</span>
              <span>Vendor</span>
              <span>상품</span>
              <span>주기</span>
              <span>다음 발주</span>
              <span className="text-right">수량</span>
              <span className="text-right">누적</span>
              <span>상태</span>
              <span className="text-right">액션</span>
            </div>
            {filtered.length === 0 ? (
              <p className="px-2 py-12 text-center text-sm text-[var(--color-text-tertiary)]">
                조건에 맞는 구독이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border-light)]">
                {filtered.map((r) => {
                  const statusLabel =
                    r.status === "ACTIVE"
                      ? "활성"
                      : r.status === "PAUSED"
                        ? "일시정지"
                        : r.status === "CANCELLED"
                          ? "취소"
                          : r.status === "EXPIRED"
                            ? "만료"
                            : r.status ?? "—";
                  const statusColor =
                    r.status === "ACTIVE"
                      ? "text-[var(--color-success)]"
                      : r.status === "PAUSED"
                        ? "text-[var(--color-warning)]"
                        : "text-[var(--color-text-tertiary)]";
                  const cadence =
                    (r.cadence && CADENCE_LABEL[r.cadence]) ?? r.cadence ?? "—";
                  const nextRunMs = tsToMillis(r.nextRunAt ?? null);
                  return (
                    <li
                      key={r.id}
                      className="grid grid-cols-[1fr_1fr_1.5fr_72px_110px_72px_72px_96px_96px] items-center gap-3 px-2 py-3.5 text-sm"
                    >
                      <span className="truncate font-medium">
                        {r.hospitalName ?? "—"}
                      </span>
                      <span className="truncate text-xs text-[var(--color-text-secondary)]">
                        {r.vendorName ?? "—"}
                      </span>
                      <span className="truncate text-xs">{r.productName ?? "—"}</span>
                      <span className="inline-flex h-5 w-fit items-center rounded-full border border-[var(--color-border-light)] px-2 text-[10px] text-[var(--color-text-secondary)]">
                        {cadence}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                        {r.status === "PAUSED" ? "—" : fmtDate(nextRunMs)}
                      </span>
                      <span className="text-right font-mono tabular-nums">
                        {r.qty?.toLocaleString() ?? 0}
                      </span>
                      <span className="text-right font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                        {(r.runCount ?? r.totalRuns ?? 0).toLocaleString()}회
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                        {typeof r.priceChangePercent === "number" &&
                          Math.abs(r.priceChangePercent) >= 5 && (
                            <span className="font-mono text-[10px] tabular-nums text-[var(--color-warning)]">
                              {r.priceChangePercent > 0 ? "+" : ""}
                              {r.priceChangePercent}%
                            </span>
                          )}
                      </span>
                      <span className="flex justify-end">
                        {r.status === "ACTIVE" && (
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => {
                              setPauseTarget(r);
                              setPauseReason("");
                              setSubmitError(null);
                            }}
                            className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-3 text-[11px] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-warning)] hover:text-[var(--color-warning)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            일시 정지
                          </button>
                        )}
                        {r.status === "PAUSED" && (
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => handleResume(r)}
                            className="inline-flex h-7 items-center rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/5 px-3 text-[11px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            재개
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* sticky 상위 vendor 카드 */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            상위 vendor (활성)
          </p>
          <div className="mt-3 border-y border-[var(--color-border-light)]">
            {topVendors.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
                데이터 없음
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border-light)]">
                {topVendors.map((v, i) => (
                  <li
                    key={v.vendorId}
                    className="flex items-center justify-between gap-2 px-2 py-3"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] font-mono text-[10px] tabular-nums text-[var(--color-text-tertiary)]">
                        {i + 1}
                      </span>
                      <span className="truncate text-xs font-medium">
                        {v.vendorName}
                      </span>
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {v.count.toLocaleString()}
                      <span className="ml-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                        건
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <Dialog
        open={pauseTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPauseTarget(null);
            setPauseReason("");
            setSubmitError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>정기구독 일시 정지</DialogTitle>
            <DialogDescription>
              {pauseTarget?.hospitalName ?? "—"} 의{" "}
              <span className="text-[var(--color-text-primary)]">
                {pauseTarget?.productName ?? "—"}
              </span>{" "}
              구독을 즉시 정지합니다. 병원에 알림이 발송됩니다.
            </DialogDescription>
          </DialogHeader>
          <textarea
            rows={4}
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            placeholder="정지 사유 (필수, 병원에 그대로 전달됨)"
            className="mt-2 w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          {submitError && (
            <p className="mt-2 text-xs text-[var(--color-error)]">{submitError}</p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setPauseTarget(null)}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handlePause}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-warning)] bg-[var(--color-warning)]/5 px-4 text-sm font-medium text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10 disabled:opacity-50"
            >
              {submitting ? "처리 중" : "정지 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCell({
  label,
  value,
  unit,
  delta,
  deltaTone,
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: string;
  deltaTone?: "accent" | "warning" | "error" | "success";
}) {
  const deltaColor = {
    accent: "text-[var(--color-accent)]",
    warning: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
    success: "text-[var(--color-success)]",
  } as const;
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
        <CountUp value={value} integer />
        {unit && (
          <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
            {unit}
          </span>
        )}
      </p>
      {delta && (
        <p
          className={`mt-2 text-xs ${
            deltaTone ? deltaColor[deltaTone] : "text-[var(--color-text-tertiary)]"
          }`}
        >
          {delta}
        </p>
      )}
    </div>
  );
}
