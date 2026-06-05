"use client";

// Wave I — 공동구매 운영 client island.
//
// 입력: trpcServer().admin.groupbuy.list/counts() 결과.
// Tab 4 (진행/목표 달성/완료/미달) + Table + 강제 마감/취소 Dialog.
// mutation 후 router.refresh() 로 재패치.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { AdminKpiCell } from "@/components/admin/admin-kpi-cell";
import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import type { GroupBuy } from "@/lib/types";

export type GroupBuyCounts = {
  open: number;
  targetMet: number;
  fulfilled: number;
  failed: number;
  closingSoon: number;
};

type Tab = "OPEN" | "TARGET_MET" | "FULFILLED" | "FAILED";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "OPEN", label: "진행" },
  { value: "TARGET_MET", label: "목표 도달" },
  { value: "FULFILLED", label: "발주 완료" },
  { value: "FAILED", label: "미달 종료" },
];

const FILTERS = ["Vendor", "카테고리", "마감 임박"] as const;

function tsToMillis(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "object" && v !== null) {
    const obj = v as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof obj.toMillis === "function") return obj.toMillis();
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
    if (typeof obj._seconds === "number") return obj._seconds * 1000;
  }
  const t = new Date(v as string | number | Date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function fmtCloses(v: unknown): string {
  const ms = tsToMillis(v);
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GroupBuysClient({
  initialGroupBuys,
  initialCounts,
  readOnly = false,
}: {
  initialGroupBuys: GroupBuy[];
  initialCounts: GroupBuyCounts;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("OPEN");
  const [forceCloseTarget, setForceCloseTarget] = useState<GroupBuy | null>(null);
  const [forceCancelTarget, setForceCancelTarget] = useState<GroupBuy | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const forceCloseMutation = trpc.admin.groupbuy.forceClose.useMutation();
  const forceCancelMutation = trpc.admin.groupbuy.forceCancel.useMutation();

  const filtered = useMemo(
    () => initialGroupBuys.filter((g) => g.status === tab),
    [initialGroupBuys, tab],
  );

  async function handleForceClose() {
    if (!forceCloseTarget) return;
    setSubmitError(null);
    if (!closeReason.trim()) {
      setSubmitError("마감 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await forceCloseMutation.mutateAsync({
        groupBuyId: forceCloseTarget.id,
        reason: closeReason.trim(),
      });
      setForceCloseTarget(null);
      setCloseReason("");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "마감 처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForceCancel() {
    if (!forceCancelTarget) return;
    setSubmitError(null);
    if (!cancelReason.trim()) {
      setSubmitError("취소 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await forceCancelMutation.mutateAsync({
        groupBuyId: forceCancelTarget.id,
        reason: cancelReason.trim(),
      });
      setForceCancelTarget(null);
      setCancelReason("");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "취소 처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <PageHeader
        label="카탈로그 · 공동구매"
        title="공동구매 운영"
        description="진행 캠페인 모니터링 · 강제 마감 / 취소"
      />

      {readOnly && (
        <div className="mt-6 border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
          미리보기 모드 — 실제 데이터가 없습니다. Firestore 시드 후 실 데이터로 전환됩니다.
        </div>
      )}

      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <AdminKpiCell
          label="진행 중"
          value={<CountUp value={initialCounts.open} integer />}
          sub="건"
        />
        <AdminKpiCell
          label="목표 도달"
          value={<CountUp value={initialCounts.targetMet} integer />}
          sub="건"
          delta="capture 대기"
          deltaColor="success"
        />
        <AdminKpiCell
          label="마감 임박 (24h)"
          value={<CountUp value={initialCounts.closingSoon} integer />}
          sub="건"
          delta="모니터링"
          deltaColor="warning"
        />
        <AdminKpiCell
          label="미달 종료"
          value={<CountUp value={initialCounts.failed} integer />}
          sub="건"
          deltaColor="error"
        />
      </dl>

      <nav
        className="mt-10 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="공동구매 상태"
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          const tabCount = {
            OPEN: initialCounts.open,
            TARGET_MET: initialCounts.targetMet,
            FULFILLED: initialCounts.fulfilled,
            FAILED: initialCounts.failed,
          }[t.value];
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
                {tabCount}
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
      </div>

      <div className="mt-8 border-y border-[var(--color-border-light)]">
        <div className="grid grid-cols-[1.5fr_1fr_1.5fr_140px_80px_180px] gap-3 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>캠페인</span>
          <span>Vendor</span>
          <span>진행률</span>
          <span>마감</span>
          <span className="text-right">참여</span>
          <span className="text-right">액션</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-2 py-12 text-center text-sm text-[var(--color-text-tertiary)]">
            해당 상태의 공동구매가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)]">
            {filtered.map((g) => {
              const current = g.currentQty ?? 0;
              const target = g.targetQty ?? 1;
              const pct = Math.round((current / target) * 100);
              const pctClamped = Math.min(pct, 100);
              const barTone =
                pct >= 100
                  ? "bg-[var(--color-success)]"
                  : pct >= 70
                    ? "bg-[var(--color-accent)]"
                    : "bg-[var(--color-warning)]";
              return (
                <li
                  key={g.id}
                  className="grid grid-cols-[1.5fr_1fr_1.5fr_140px_80px_180px] items-center gap-3 px-2 py-3.5 text-sm"
                >
                  <Link
                    href={`/admin/groupbuys/${g.id}`}
                    className="truncate font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                  >
                    {g.productName}
                  </Link>
                  <span className="truncate text-xs text-[var(--color-text-secondary)]">
                    {g.vendorName}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-xs tabular-nums">
                        {current.toLocaleString()} / {target.toLocaleString()}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden bg-[var(--color-border-light)]">
                      <div className={`h-full ${barTone}`} style={{ width: `${pctClamped}%` }} />
                    </div>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                    {fmtCloses(g.endsAt)}
                  </span>
                  <span className="text-right font-mono tabular-nums">{g.participationCount}</span>
                  <div className="flex justify-end gap-1.5">
                    {(g.status === "OPEN" || g.status === "TARGET_MET") && (
                      <>
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            setForceCloseTarget(g);
                            setCloseReason("");
                            setSubmitError(null);
                          }}
                          className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          강제 마감
                        </button>
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            setForceCancelTarget(g);
                            setCancelReason("");
                            setSubmitError(null);
                          }}
                          className="inline-flex h-7 items-center rounded-full border border-[var(--color-error)] px-2.5 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          취소
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dialog — 강제 마감 */}
      <Dialog
        open={forceCloseTarget !== null}
        onOpenChange={(open) => !open && setForceCloseTarget(null)}
      >
        <DialogTrigger asChild>
          <button type="button" hidden aria-hidden />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공동구매 강제 마감</DialogTitle>
            <DialogDescription>
              endsAt 을 즉시 조정합니다. 다음 cron tick (1분 이내) 에서 자동 마감 처리됩니다.
            </DialogDescription>
          </DialogHeader>
          {forceCloseTarget && (
            <div className="mt-2 space-y-3">
              <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <DialogRow label="캠페인" value={forceCloseTarget.productName} />
                <DialogRow
                  label="진행률"
                  value={`${Math.round(((forceCloseTarget.currentQty ?? 0) / (forceCloseTarget.targetQty || 1)) * 100)}%`}
                  mono
                />
                <DialogRow label="참여 병원" value={`${forceCloseTarget.participationCount}곳`} mono />
              </dl>
              <textarea
                rows={3}
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="마감 사유 (필수)"
                className="w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              {submitError && (
                <p className="text-xs text-[var(--color-error)]">{submitError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setForceCloseTarget(null)}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleForceClose}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "처리 중" : "마감 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — 강제 취소 */}
      <Dialog
        open={forceCancelTarget !== null}
        onOpenChange={(open) => !open && setForceCancelTarget(null)}
      >
        <DialogTrigger asChild>
          <button type="button" hidden aria-hidden />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공동구매 강제 취소</DialogTitle>
            <DialogDescription>
              취소 즉시 모든 참여 병원의 결제 hold 가 void 되며 알림톡이 발송됩니다.
            </DialogDescription>
          </DialogHeader>
          {forceCancelTarget && (
            <div className="mt-2 space-y-3">
              <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <DialogRow label="캠페인" value={forceCancelTarget.productName} />
                <DialogRow label="참여 병원" value={`${forceCancelTarget.participationCount}곳`} mono />
                <DialogRow label="환불 처리" value="자동 void (PortOne)" />
              </dl>
              <textarea
                rows={4}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="취소 사유 (필수, 병원에 그대로 전달됨)"
                className="w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              {submitError && (
                <p className="text-xs text-[var(--color-error)]">{submitError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setForceCancelTarget(null)}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleForceCancel}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-error)] bg-[var(--color-error)]/5 px-4 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/10 disabled:opacity-50"
            >
              {submitting ? "처리 중" : "취소 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DialogRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-2 py-3">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd className={`text-sm text-[var(--color-text-primary)] ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
