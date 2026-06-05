"use client";

// Wave M — /admin/settlement client island.
// 서버 컴포넌트에서 fetch 한 tab/settlements/counts 를 받아 KPI + Tab nav + table + Dialog 렌더.

import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ChevronDown} from "lucide-react";
import {toast} from "sonner";

import {CountUp} from "@/components/shared/count-up";
import {SettlementExportCsvButton} from "./export-csv-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {trpc} from "@/lib/trpc/client";
import type {Settlement} from "@/lib/types";
import {formatDate, formatDateTime} from "@/lib/utils/firestore-time";

type DeltaTone = "accent" | "warning" | "error" | "success";

type TabKey = "fast" | "scheduled" | "held" | "completed";

type TabDef = {value: TabKey; label: string; href: string};

const TABS: TabDef[] = [
  {value: "fast", label: "빠른정산", href: "/admin/settlement?tab=fast"},
  {value: "scheduled", label: "정기정산 D+7", href: "/admin/settlement?tab=scheduled"},
  {value: "held", label: "보류", href: "/admin/settlement?tab=held"},
  {value: "completed", label: "완료", href: "/admin/settlement?tab=completed"},
];

type Counts = {
  thisWeekScheduled: number;
  fastPending: number;
  held: number;
  monthlyCommission: number;
};

export function SettlementClient({
  tab,
  settlements,
  counts,
  isPreview,
}: {
  tab: TabKey;
  settlements: Settlement[];
  counts: Counts;
  isPreview: boolean;
}) {
  const router = useRouter();
  const [approveTarget, setApproveTarget] = useState<Settlement | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Settlement | null>(null);
  const [holdTarget, setHoldTarget] = useState<Settlement | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<Settlement | null>(null);
  const [paidTarget, setPaidTarget] = useState<Settlement | null>(null);

  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [payoutRef, setPayoutRef] = useState("");
  const [error, setError] = useState<string | null>(null);

  const approve = trpc.admin.settlement.approveFast.useMutation();
  const reject = trpc.admin.settlement.rejectFast.useMutation();
  const hold = trpc.admin.settlement.hold.useMutation();
  const release = trpc.admin.settlement.release.useMutation();
  const markPaid = trpc.admin.settlement.markPaid.useMutation();

  function closeAll() {
    setApproveTarget(null);
    setRejectTarget(null);
    setHoldTarget(null);
    setReleaseTarget(null);
    setPaidTarget(null);
    setNote("");
    setReason("");
    setPayoutRef("");
    setError(null);
  }

  function fail(err: unknown, fallback = "처리에 실패했습니다.") {
    const msg = (err as {message?: string}).message ?? fallback;
    setError(msg);
    toast.error(msg);
  }

  async function onApproveConfirm() {
    if (!approveTarget) return;
    setError(null);
    try {
      await approve.mutateAsync({
        settlementId: approveTarget.id,
        note: note || undefined,
      });
      toast.success("빠른정산을 승인했습니다");
      closeAll();
      router.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function onRejectConfirm() {
    if (!rejectTarget) return;
    if (!reason.trim()) {
      setError("반려 사유는 필수입니다.");
      return;
    }
    setError(null);
    try {
      await reject.mutateAsync({
        settlementId: rejectTarget.id,
        reason,
      });
      toast.success("빠른정산을 반려했습니다");
      closeAll();
      router.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function onHoldConfirm() {
    if (!holdTarget) return;
    if (!reason.trim()) {
      setError("보류 사유는 필수입니다.");
      return;
    }
    setError(null);
    try {
      await hold.mutateAsync({
        settlementId: holdTarget.id,
        reason,
      });
      toast.success("정산을 보류했습니다");
      closeAll();
      router.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function onReleaseConfirm() {
    if (!releaseTarget) return;
    setError(null);
    try {
      await release.mutateAsync({settlementId: releaseTarget.id});
      toast.success("보류를 해제했습니다");
      closeAll();
      router.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function onPaidConfirm() {
    if (!paidTarget) return;
    if (!payoutRef.trim()) {
      setError("이체 ref 는 필수입니다.");
      return;
    }
    setError(null);
    try {
      await markPaid.mutateAsync({
        settlementId: paidTarget.id,
        payoutRef,
        method: "MANUAL_BANK",
      });
      toast.success("이체 완료로 처리했습니다");
      closeAll();
      router.refresh();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
        정산·재무 · 운영
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        정산 운영
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        PortOne 정산 캘린더 + 빠른정산 신청 승인.
        {isPreview && (
          <span className="ml-2 text-[11px] text-[var(--color-warning)]">
            (PREVIEW — 로그인 후 실 데이터 노출)
          </span>
        )}
      </p>

      {/* KPI 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <KpiCell
          label="이번주 정산 예정"
          value={counts.thisWeekScheduled}
          unit="원"
          mono
          delta="향후 7일"
        />
        <KpiCell
          label="빠른정산 신청 대기"
          value={counts.fastPending}
          unit="건"
          deltaTone="accent"
          delta={counts.fastPending > 0 ? "승인 필요" : "없음"}
        />
        <KpiCell
          label="보류금 (분쟁 중)"
          value={counts.held}
          unit="원"
          mono
          deltaTone={counts.held > 0 ? "error" : undefined}
          delta={counts.held > 0 ? "검토 필요" : "없음"}
        />
        <KpiCell
          label="이번달 수수료 수익"
          value={counts.monthlyCommission}
          unit="원"
          mono
          deltaTone="success"
        />
      </dl>

      {/* Segment Tabs — 링크 기반 (Server Component) */}
      <nav
        className="mt-10 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="정산 상태 필터"
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <Link
              key={t.value}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-0.5 bg-[var(--color-accent)]"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Filter Chip Row */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {(["Vendor", "기간", "금액 범위"] as const).map((label) => (
          <button
            key={label}
            type="button"
            disabled
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-3 text-xs text-[var(--color-text-tertiary)] opacity-50"
            title="Phase 3+ 활성"
          >
            {label}
            <ChevronDown className="h-3 w-3" />
          </button>
        ))}
        <SettlementExportCsvButton
          status={
            tab === "fast"
              ? "REQUESTED"
              : tab === "scheduled"
                ? "PENDING"
                : tab === "held"
                  ? "HOLD"
                  : tab === "completed"
                    ? "PAID"
                    : undefined
          }
        />
      </div>

      {/* Tab Tables */}
      <div className="mt-8">
        {settlements.length === 0 ? (
          <div className="border-y border-[var(--color-border-light)] py-16 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">
              해당 상태의 정산이 없습니다
            </p>
          </div>
        ) : (
          <>
            {tab === "fast" && (
              <FastTable
                rows={settlements}
                onApprove={setApproveTarget}
                onReject={setRejectTarget}
              />
            )}
            {tab === "scheduled" && (
              <ScheduledTable
                rows={settlements}
                onHold={setHoldTarget}
                onPaid={setPaidTarget}
              />
            )}
            {tab === "held" && (
              <HeldTable rows={settlements} onRelease={setReleaseTarget} />
            )}
            {tab === "completed" && <CompletedTable rows={settlements} />}
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--color-text-tertiary)]">
        총 {settlements.length}건
      </p>

      {/* Dialog — 승인 */}
      <Dialog
        open={approveTarget !== null}
        onOpenChange={(open) => !open && closeAll()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>빠른정산 승인</DialogTitle>
            <DialogDescription>
              승인 즉시 vendor 에게 알림이 발송되고, 영업일 내 이체가 진행됩니다.
            </DialogDescription>
          </DialogHeader>
          {approveTarget && (
            <div className="mt-2 space-y-3">
              <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <Row label="Vendor" value={approveTarget.vendorName} />
                <Row
                  label="매출"
                  value={`₩${(approveTarget.grossAmount ?? 0).toLocaleString()}`}
                  mono
                />
                <Row
                  label={`빠른정산 수수료 (D ${approveTarget.fastSettlementDays ?? 3}일)`}
                  value={`−₩${(approveTarget.fastSettlementFee ?? 0).toLocaleString()}`}
                  mono
                />
                <Row
                  label="실수령 금액"
                  value={`₩${(approveTarget.finalPayout ?? 0).toLocaleString()}`}
                  mono
                />
              </dl>
              <textarea
                rows={3}
                placeholder="메모 (선택)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              {error && (
                <p className="text-xs text-[var(--color-error)]">{error}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={closeAll}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onApproveConfirm}
              disabled={approve.isPending}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {approve.isPending ? "처리 중…" : "승인 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — 반려 */}
      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && closeAll()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>빠른정산 반려</DialogTitle>
            <DialogDescription>
              반려 시 D+7 정기정산으로 회귀하며, 사유는 vendor 에게 알림으로
              발송됩니다.
            </DialogDescription>
          </DialogHeader>
          {rejectTarget && (
            <div className="mt-2 space-y-3">
              <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <Row label="Vendor" value={rejectTarget.vendorName} />
                <Row
                  label="신청 금액"
                  value={`₩${(rejectTarget.finalPayout ?? 0).toLocaleString()}`}
                  mono
                />
              </dl>
              <textarea
                rows={4}
                placeholder="반려 사유 (필수)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              {error && (
                <p className="text-xs text-[var(--color-error)]">{error}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={closeAll}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onRejectConfirm}
              disabled={reject.isPending}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-error)] bg-[var(--color-error)]/5 px-4 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/10 disabled:opacity-50"
            >
              {reject.isPending ? "처리 중…" : "반려 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — 보류 */}
      <Dialog
        open={holdTarget !== null}
        onOpenChange={(open) => !open && closeAll()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>정산 보류</DialogTitle>
            <DialogDescription>
              사유와 함께 status=HOLD 로 변경됩니다. 모든 변경은 감사 로그에
              기록됩니다.
            </DialogDescription>
          </DialogHeader>
          {holdTarget && (
            <div className="mt-2 space-y-3">
              <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <Row label="Vendor" value={holdTarget.vendorName} />
                <Row
                  label="금액"
                  value={`₩${(holdTarget.finalPayout ?? 0).toLocaleString()}`}
                  mono
                />
              </dl>
              <textarea
                rows={4}
                placeholder="보류 사유 (필수)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              {error && (
                <p className="text-xs text-[var(--color-error)]">{error}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={closeAll}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onHoldConfirm}
              disabled={hold.isPending}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-warning)] bg-[var(--color-warning)]/5 px-4 text-sm font-medium text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10 disabled:opacity-50"
            >
              {hold.isPending ? "처리 중…" : "보류 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — 보류 해제 */}
      <Dialog
        open={releaseTarget !== null}
        onOpenChange={(open) => !open && closeAll()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>보류 해제</DialogTitle>
            <DialogDescription>
              status=PENDING 으로 회귀합니다. 다음 정산 사이클에 처리됩니다.
            </DialogDescription>
          </DialogHeader>
          {releaseTarget && (
            <dl className="mt-2 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              <Row label="Vendor" value={releaseTarget.vendorName} />
              <Row
                label="보류 금액"
                value={`₩${(releaseTarget.finalPayout ?? 0).toLocaleString()}`}
                mono
              />
              {releaseTarget.statusReason && (
                <Row label="기존 사유" value={releaseTarget.statusReason} />
              )}
            </dl>
          )}
          {error && (
            <p className="mt-2 text-xs text-[var(--color-error)]">{error}</p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={closeAll}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onReleaseConfirm}
              disabled={release.isPending}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {release.isPending ? "처리 중…" : "해제 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — 이체 완료 처리 */}
      <Dialog
        open={paidTarget !== null}
        onOpenChange={(open) => !open && closeAll()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이체 완료 처리</DialogTitle>
            <DialogDescription>
              실 송금 후 이체 ref 를 입력하세요. /payouts 신규 doc 생성 +
              status=PAID 로 변경됩니다.
            </DialogDescription>
          </DialogHeader>
          {paidTarget && (
            <div className="mt-2 space-y-3">
              <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <Row label="Vendor" value={paidTarget.vendorName} />
                <Row
                  label="이체 금액"
                  value={`₩${(paidTarget.finalPayout ?? 0).toLocaleString()}`}
                  mono
                />
              </dl>
              <input
                type="text"
                placeholder="이체 ref (예: TR-2026-06-01-0042)"
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                className="h-9 w-full border border-[var(--color-border-light)] bg-transparent px-3 text-sm font-mono placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              {error && (
                <p className="text-xs text-[var(--color-error)]">{error}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={closeAll}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onPaidConfirm}
              disabled={markPaid.isPending}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {markPaid.isPending ? "처리 중…" : "이체 완료"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tables
// ─────────────────────────────────────────────────────────────

function FastTable({
  rows,
  onApprove,
  onReject,
}: {
  rows: Settlement[];
  onApprove: (r: Settlement) => void;
  onReject: (r: Settlement) => void;
}) {
  return (
    <div className="border-y border-[var(--color-border-light)]">
      <div className="hidden md:grid grid-cols-[1fr_140px_120px_100px_120px_100px_160px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        <span>Vendor</span>
        <span>신청일</span>
        <span className="text-right">매출</span>
        <span className="text-right">수수료</span>
        <span className="text-right">정산금</span>
        <span>예정일</span>
        <span className="text-right">액션</span>
      </div>
      <ul className="divide-y divide-[var(--color-border-light)]">
        {rows.map((r) => (
          <li key={r.id}>
            {/* Desktop */}
            <div className="hidden md:grid grid-cols-[1fr_140px_120px_100px_120px_100px_160px] items-center gap-4 px-2 py-4 text-sm">
              <Link
                href={`/admin/payouts/${r.vendorId}`}
                className="truncate font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
              >
                {r.vendorName}
              </Link>
              <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                {formatDateTime(r.createdAt)}
              </span>
              <span className="text-right font-mono tabular-nums">
                ₩{(r.grossAmount ?? 0).toLocaleString()}
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                <span className="block">
                  −₩{(r.fastSettlementFee ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px]">
                  D {r.fastSettlementDays ?? 3}일 · 0.012%
                </span>
              </span>
              <span className="text-right font-mono font-semibold tabular-nums">
                ₩{(r.finalPayout ?? 0).toLocaleString()}
              </span>
              <span className="font-mono text-xs tabular-nums text-[var(--color-accent)]">
                {formatDate(r.scheduledPayoutAt)}
              </span>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => onApprove(r)}
                  className="inline-flex h-7 items-center rounded-full bg-[var(--color-accent)] px-3 text-xs font-medium text-white transition-colors hover:opacity-90"
                >
                  승인
                </button>
                <button
                  type="button"
                  onClick={() => onReject(r)}
                  className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/5"
                >
                  반려
                </button>
              </div>
            </div>
            {/* Mobile */}
            <div className="flex flex-col gap-2 px-3 py-4 md:hidden">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/admin/payouts/${r.vendorId}`}
                  className="truncate text-sm font-medium hover:text-[var(--color-accent)]"
                >
                  {r.vendorName}
                </Link>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                  ₩{(r.finalPayout ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                <span className="font-mono tabular-nums">
                  신청 {formatDateTime(r.createdAt)}
                </span>
                <span className="font-mono tabular-nums text-[var(--color-accent)]">
                  예정 {formatDate(r.scheduledPayoutAt)}
                </span>
              </div>
              <p className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                매출 ₩{(r.grossAmount ?? 0).toLocaleString()} · 수수료 −₩
                {(r.fastSettlementFee ?? 0).toLocaleString()} (D {r.fastSettlementDays ?? 3}일)
              </p>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => onApprove(r)}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-[var(--color-accent)] px-3 text-xs font-medium text-white transition-colors hover:opacity-90"
                >
                  승인
                </button>
                <button
                  type="button"
                  onClick={() => onReject(r)}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/5"
                >
                  반려
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScheduledTable({
  rows,
  onHold,
  onPaid,
}: {
  rows: Settlement[];
  onHold: (r: Settlement) => void;
  onPaid: (r: Settlement) => void;
}) {
  return (
    <div className="border-y border-[var(--color-border-light)]">
      <div className="hidden md:grid grid-cols-[1fr_140px_140px_120px_140px_180px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        <span>Vendor</span>
        <span>정산 예정일</span>
        <span className="text-right">매출</span>
        <span className="text-right">수수료</span>
        <span className="text-right">정산금</span>
        <span className="text-right">액션</span>
      </div>
      <ul className="divide-y divide-[var(--color-border-light)]">
        {rows.map((r) => (
          <li key={r.id}>
            {/* Desktop */}
            <div className="hidden md:grid grid-cols-[1fr_140px_140px_120px_140px_180px] items-center gap-4 px-2 py-4 text-sm">
              <Link
                href={`/admin/payouts/${r.vendorId}`}
                className="truncate font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
              >
                {r.vendorName}
              </Link>
              <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                D+7 · {formatDate(r.scheduledPayoutAt)}
              </span>
              <span className="text-right font-mono tabular-nums">
                ₩{(r.grossAmount ?? 0).toLocaleString()}
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                −₩
                {(
                  (r.commissionAmount ?? 0) + (r.paymentFeeAmount ?? 0)
                ).toLocaleString()}
              </span>
              <span className="text-right font-mono font-semibold tabular-nums">
                ₩{(r.finalPayout ?? 0).toLocaleString()}
              </span>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => onPaid(r)}
                  className="inline-flex h-7 items-center rounded-full bg-[var(--color-accent)] px-3 text-xs font-medium text-white transition-colors hover:opacity-90"
                >
                  이체 완료
                </button>
                <button
                  type="button"
                  onClick={() => onHold(r)}
                  className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/5"
                >
                  보류
                </button>
              </div>
            </div>
            {/* Mobile */}
            <div className="flex flex-col gap-2 px-3 py-4 md:hidden">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/admin/payouts/${r.vendorId}`}
                  className="truncate text-sm font-medium hover:text-[var(--color-accent)]"
                >
                  {r.vendorName}
                </Link>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                  ₩{(r.finalPayout ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                <span className="font-mono tabular-nums">
                  D+7 · {formatDate(r.scheduledPayoutAt)}
                </span>
                <span className="font-mono tabular-nums">
                  매출 ₩{(r.grossAmount ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => onPaid(r)}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-[var(--color-accent)] px-3 text-xs font-medium text-white transition-colors hover:opacity-90"
                >
                  이체 완료
                </button>
                <button
                  type="button"
                  onClick={() => onHold(r)}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/5"
                >
                  보류
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="px-2 py-4 text-xs text-[var(--color-text-tertiary)]">
        매일 03:00 KST settlement-daily Cloud Function 이 자동 생성합니다.
      </p>
    </div>
  );
}

function HeldTable({
  rows,
  onRelease,
}: {
  rows: Settlement[];
  onRelease: (r: Settlement) => void;
}) {
  return (
    <div className="border-y border-[var(--color-border-light)]">
      <div className="hidden md:grid grid-cols-[1fr_140px_140px_1fr_120px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        <span>Vendor</span>
        <span>보류 시작</span>
        <span className="text-right">보류 금액</span>
        <span>사유</span>
        <span className="text-right">액션</span>
      </div>
      <ul className="divide-y divide-[var(--color-border-light)]">
        {rows.map((r) => (
          <li key={r.id}>
            {/* Desktop */}
            <div className="hidden md:grid grid-cols-[1fr_140px_140px_1fr_120px] items-center gap-4 px-2 py-4 text-sm">
              <Link
                href={`/admin/payouts/${r.vendorId}`}
                className="truncate font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
              >
                {r.vendorName}
              </Link>
              <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                {formatDate(r.updatedAt)}
              </span>
              <span className="text-right font-mono font-semibold tabular-nums text-[var(--color-error)]">
                ₩{(r.finalPayout ?? 0).toLocaleString()}
              </span>
              <span className="truncate text-xs text-[var(--color-text-secondary)]">
                {r.statusReason ?? "—"}
              </span>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => onRelease(r)}
                  className="inline-flex h-7 items-center rounded-full bg-[var(--color-accent)] px-3 text-xs font-medium text-white transition-colors hover:opacity-90"
                >
                  해제
                </button>
              </div>
            </div>
            {/* Mobile */}
            <div className="flex flex-col gap-2 border-l-2 border-l-[var(--color-error)] px-3 py-4 md:hidden">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/admin/payouts/${r.vendorId}`}
                  className="truncate text-sm font-medium hover:text-[var(--color-accent)]"
                >
                  {r.vendorName}
                </Link>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[var(--color-error)]">
                  ₩{(r.finalPayout ?? 0).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                보류 시작{" "}
                <span className="font-mono tabular-nums">
                  {formatDate(r.updatedAt)}
                </span>
              </p>
              {r.statusReason && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {r.statusReason}
                </p>
              )}
              <button
                type="button"
                onClick={() => onRelease(r)}
                className="mt-1 inline-flex h-9 w-full items-center justify-center rounded-full bg-[var(--color-accent)] px-3 text-xs font-medium text-white transition-colors hover:opacity-90"
              >
                보류 해제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompletedTable({rows}: {rows: Settlement[]}) {
  return (
    <div className="border-y border-[var(--color-border-light)]">
      <div className="hidden md:grid grid-cols-[1fr_140px_140px_120px_140px_180px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        <span>Vendor</span>
        <span>이체일</span>
        <span className="text-right">매출</span>
        <span className="text-right">수수료</span>
        <span className="text-right">정산금</span>
        <span>payout id</span>
      </div>
      <ul className="divide-y divide-[var(--color-border-light)]">
        {rows.map((r) => (
          <li key={r.id}>
            {/* Desktop */}
            <div className="hidden md:grid grid-cols-[1fr_140px_140px_120px_140px_180px] items-center gap-4 px-2 py-4 text-sm">
              <Link
                href={`/admin/payouts/${r.vendorId}`}
                className="truncate font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
              >
                {r.vendorName}
              </Link>
              <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                {formatDate(r.paidAt)}
              </span>
              <span className="text-right font-mono tabular-nums">
                ₩{(r.grossAmount ?? 0).toLocaleString()}
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                −₩
                {(
                  (r.commissionAmount ?? 0) + (r.paymentFeeAmount ?? 0)
                ).toLocaleString()}
              </span>
              <span className="text-right font-mono font-semibold tabular-nums">
                ₩{(r.finalPayout ?? 0).toLocaleString()}
              </span>
              <span className="font-mono text-xs tabular-nums text-[var(--color-accent)]">
                {r.payoutId ?? "—"}
              </span>
            </div>
            {/* Mobile */}
            <div className="flex flex-col gap-2 px-3 py-4 md:hidden">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/admin/payouts/${r.vendorId}`}
                  className="truncate text-sm font-medium hover:text-[var(--color-accent)]"
                >
                  {r.vendorName}
                </Link>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                  ₩{(r.finalPayout ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                <span className="font-mono tabular-nums">
                  이체 {formatDate(r.paidAt)}
                </span>
                <span className="font-mono tabular-nums">
                  매출 ₩{(r.grossAmount ?? 0).toLocaleString()}
                </span>
              </div>
              {r.payoutId && (
                <p className="truncate font-mono text-[11px] tabular-nums text-[var(--color-accent)]">
                  payout {r.payoutId}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────

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
  deltaTone?: DeltaTone;
  mono?: boolean;
}) {
  const deltaColor: Record<DeltaTone, string> = {
    accent: "text-[var(--color-accent)]",
    warning: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
    success: "text-[var(--color-success)]",
  };
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl ${
          mono ? "font-mono" : ""
        }`}
      >
        <CountUp value={value} />
        {unit && (
          <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
            {unit}
          </span>
        )}
      </p>
      {delta && (
        <p
          className={`mt-2 text-xs ${
            deltaTone
              ? deltaColor[deltaTone]
              : "text-[var(--color-text-tertiary)]"
          }`}
        >
          {delta}
        </p>
      )}
    </div>
  );
}

function Row({
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
      <dd
        className={`text-sm text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
