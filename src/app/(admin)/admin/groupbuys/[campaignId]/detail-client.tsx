"use client";

// Wave I — 공동구매 상세 client island.
//
// 입력: trpcServer().admin.groupbuy.getById/listParticipations() 결과.
// 강제 마감/취소 mutation + 참여 ledger 표시.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
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

export type ParticipationView = {
  id: string;
  hospitalName?: string;
  qty?: number;
  totalAmount?: number;
  preAuthPaymentId?: string;
  capturedAt?: unknown;
  voidedAt?: unknown;
  createdAt?: unknown;
};

const STATUS_LABEL: Record<GroupBuy["status"], string> = {
  OPEN: "진행 중",
  TARGET_MET: "목표 달성",
  FULFILLED: "완료",
  PARTIAL_FULFILLED: "부분 완료",
  FAILED: "미달 종료",
};

const STATUS_TONE: Record<GroupBuy["status"], { border: string; bg: string; text: string }> = {
  OPEN: {
    border: "border-[var(--color-accent)]",
    bg: "bg-[var(--color-accent)]/5",
    text: "text-[var(--color-accent)]",
  },
  TARGET_MET: {
    border: "border-[var(--color-success)]",
    bg: "bg-[var(--color-success)]/5",
    text: "text-[var(--color-success)]",
  },
  FULFILLED: {
    border: "border-[var(--color-text-secondary)]",
    bg: "bg-[var(--color-bg-secondary)]",
    text: "text-[var(--color-text-secondary)]",
  },
  PARTIAL_FULFILLED: {
    border: "border-[var(--color-warning)]",
    bg: "bg-[var(--color-warning)]/5",
    text: "text-[var(--color-warning)]",
  },
  FAILED: {
    border: "border-[var(--color-error)]",
    bg: "bg-[var(--color-error)]/5",
    text: "text-[var(--color-error)]",
  },
};

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

function fmtDateTime(v: unknown): string {
  const ms = tsToMillis(v);
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtRemaining(endsAt: unknown): string {
  const ms = tsToMillis(endsAt) - Date.now();
  if (ms <= 0) return "마감";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `마감 ${days}일 ${hours % 24}시간`;
  }
  return `마감 ${hours}시간 ${minutes}분`;
}

export function GroupBuyDetailClient({
  campaignId,
  groupBuy,
  participations,
  readOnly,
}: {
  campaignId: string;
  groupBuy: GroupBuy;
  participations: ParticipationView[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [forceCloseOpen, setForceCloseOpen] = useState(false);
  const [forceCancelOpen, setForceCancelOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const forceCloseMutation = trpc.admin.groupbuy.forceClose.useMutation();
  const forceCancelMutation = trpc.admin.groupbuy.forceCancel.useMutation();

  const current = groupBuy.currentQty ?? 0;
  const target = groupBuy.targetQty ?? 1;
  const pct = Math.round((current / target) * 100);

  // tier 단가 기반 예상 정산 (가장 적용 가능한 tier)
  const expectedTotal = useMemo(() => {
    const sortedTiers = [...(groupBuy.tierPricing ?? [])].sort(
      (a, b) => b.minQty - a.minQty,
    );
    const tier =
      sortedTiers.find((t) => current >= t.minQty) ??
      sortedTiers[sortedTiers.length - 1];
    return tier ? tier.price * current : 0;
  }, [groupBuy.tierPricing, current]);

  const tone = STATUS_TONE[groupBuy.status];
  const canAct = (groupBuy.status === "OPEN" || groupBuy.status === "TARGET_MET") && !readOnly;

  async function handleForceClose() {
    setSubmitError(null);
    if (!closeReason.trim()) {
      setSubmitError("마감 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await forceCloseMutation.mutateAsync({
        groupBuyId: campaignId,
        reason: closeReason.trim(),
      });
      setForceCloseOpen(false);
      setCloseReason("");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "마감 처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForceCancel() {
    setSubmitError(null);
    if (!cancelReason.trim()) {
      setSubmitError("취소 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await forceCancelMutation.mutateAsync({
        groupBuyId: campaignId,
        reason: cancelReason.trim(),
      });
      setForceCancelOpen(false);
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
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
        <Link
          href="/admin/groupbuys"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3 w-3" />
          공동구매 list
        </Link>
      </div>

      {readOnly && (
        <div className="mt-6 border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
          미리보기 모드 — 실제 데이터가 없습니다. Firestore 시드 후 실 데이터로 전환됩니다.
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Campaign · {campaignId}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            {groupBuy.productName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {(groupBuy.status === "OPEN" || groupBuy.status === "TARGET_MET") && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--color-warning)] bg-[var(--color-warning)]/5 px-3 font-mono text-xs tabular-nums text-[var(--color-warning)]">
              <span aria-hidden className="status-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />
              {fmtRemaining(groupBuy.endsAt)}
            </span>
          )}
          <span
            className={`inline-flex h-7 items-center rounded-full border ${tone.border} ${tone.bg} px-3 text-xs font-medium ${tone.text}`}
          >
            {STATUS_LABEL[groupBuy.status]}
          </span>
        </div>
      </div>

      {/* KPI 4 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <KpiCell label="참여 병원" value={groupBuy.participationCount ?? 0} unit="곳" />
        <KpiCell label="누적 수량" value={current} unit="개" />
        <KpiCell
          label="목표 달성률"
          value={pct}
          unit="%"
          deltaTone={pct >= 100 ? "success" : pct >= 70 ? "accent" : "warning"}
          delta={`목표 ${target.toLocaleString()}개`}
        />
        <KpiCell
          label="예상 정산액"
          value={expectedTotal}
          unit="원"
          mono
          deltaTone="accent"
          delta="vendor 정산"
        />
      </dl>

      {/* 2-col */}
      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
        <div className="min-w-0 space-y-12">
          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              캠페인 정보
            </p>
            <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              <InfoRow label="상품" value={groupBuy.productName} />
              <InfoRow label="Vendor" value={groupBuy.vendorName} />
              <InfoRow label="시작일" value={fmtDateTime(groupBuy.startsAt)} mono />
              <InfoRow label="마감일" value={fmtDateTime(groupBuy.endsAt)} mono />
              <InfoRow label="최소 목표" value={`${target.toLocaleString()}개`} mono />
              {(groupBuy.tierPricing ?? []).map((tier, i) => (
                <InfoRow
                  key={i}
                  label={`Tier ${i + 1} (≥${tier.minQty})`}
                  value={`₩${tier.price.toLocaleString()}`}
                  mono
                />
              ))}
              <InfoRow label="정산 트리거" value="목표 도달 시 자동 capture (cron, 매분)" />
            </dl>
          </section>

          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              참여 병원 ({participations.length})
            </p>
            <div className="mt-3 border-y border-[var(--color-border-light)]">
              <div className="grid grid-cols-[1fr_80px_120px_160px] gap-3 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                <span>병원</span>
                <span className="text-right">수량</span>
                <span>상태</span>
                <span>참여 시각</span>
              </div>
              {participations.length === 0 ? (
                <p className="px-2 py-12 text-center text-sm text-[var(--color-text-tertiary)]">
                  참여 내역이 없습니다.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-border-light)]">
                  {participations.map((p) => {
                    const status = p.voidedAt
                      ? { label: "취소", tone: "text-[var(--color-error)]" }
                      : p.capturedAt
                        ? { label: "결제 완료", tone: "text-[var(--color-success)]" }
                        : { label: "Hold 중", tone: "text-[var(--color-accent)]" };
                    return (
                      <li
                        key={p.id}
                        className="grid grid-cols-[1fr_80px_120px_160px] items-center gap-3 px-2 py-3 text-sm"
                      >
                        <span className="truncate font-medium">{p.hospitalName ?? "—"}</span>
                        <span className="text-right font-mono tabular-nums">
                          {p.qty?.toLocaleString() ?? 0}
                        </span>
                        <span className={`text-xs font-medium ${status.tone}`}>{status.label}</span>
                        <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                          {fmtDateTime(p.createdAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* sticky panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-10">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                운영자 액션
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={!canAct}
                  onClick={() => {
                    setForceCloseOpen(true);
                    setCloseReason("");
                    setSubmitError(null);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  강제 마감
                </button>
                <button
                  type="button"
                  disabled={!canAct}
                  onClick={() => {
                    setForceCancelOpen(true);
                    setCancelReason("");
                    setSubmitError(null);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--color-error)] px-4 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  강제 취소
                </button>
              </div>
              {!canAct && !readOnly && (
                <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)]">
                  종료된 캠페인은 액션을 수행할 수 없습니다.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Dialog — 강제 마감 */}
      <Dialog open={forceCloseOpen} onOpenChange={setForceCloseOpen}>
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
          <textarea
            rows={4}
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="마감 사유 (필수)"
            className="mt-2 w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          {submitError && (
            <p className="mt-2 text-xs text-[var(--color-error)]">{submitError}</p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setForceCloseOpen(false)}
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
      <Dialog open={forceCancelOpen} onOpenChange={setForceCancelOpen}>
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
          <textarea
            rows={4}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="취소 사유 (필수, 병원에 그대로 전달됨)"
            className="mt-2 w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          {submitError && (
            <p className="mt-2 text-xs text-[var(--color-error)]">{submitError}</p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setForceCancelOpen(false)}
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

function KpiCell({
  label,
  value,
  unit,
  delta,
  deltaTone,
  mono,
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: string;
  deltaTone?: "accent" | "warning" | "error" | "success";
  mono?: boolean;
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
      <p
        className={`mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl ${mono ? "font-mono" : ""}`}
      >
        <CountUp value={value} integer />
        {unit && (
          <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
            {unit}
          </span>
        )}
      </p>
      {delta && (
        <p className={`mt-2 text-xs ${deltaTone ? deltaColor[deltaTone] : "text-[var(--color-text-tertiary)]"}`}>
          {delta}
        </p>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 px-2 py-2.5">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd className={`text-sm text-[var(--color-text-primary)] ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
