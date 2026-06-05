"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldX, X, Send, Award } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import type { VendorGrade } from "@/lib/types";

type Action = "approve" | "reject" | "suspend";

const GRADE_OPTIONS: Array<{ value: VendorGrade; label: string; rate: string; desc: string }> = [
  { value: "STANDARD", label: "STANDARD", rate: "5.0%", desc: "기본 입점 등급" },
  { value: "PLUS", label: "PLUS", rate: "4.5%", desc: "활성 거래 vendor" },
  { value: "PREMIUM", label: "PREMIUM", rate: "4.0%", desc: "고매출 우수 vendor" },
  { value: "DIRECT", label: "DIRECT", rate: "3.5%", desc: "전략적 직거래 파트너" },
];

const ACTION_META: Record<
  Action,
  {
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    title: string;
    description: string;
    cta: string;
    requireReason: boolean;
    tone: "primary" | "destructive" | "warning";
  }
> = {
  approve: {
    label: "승인",
    icon: Check,
    title: "입점 승인",
    description:
      "이 공급업체의 입점을 승인합니다. 셀러센터 접근이 즉시 허용되고 알림톡이 발송됩니다.",
    cta: "승인하기",
    requireReason: false,
    tone: "primary",
  },
  reject: {
    label: "반려",
    icon: X,
    title: "입점 반려",
    description: "신청을 반려합니다. 입력한 사유는 사용자에게 그대로 전달됩니다.",
    cta: "반려하기",
    requireReason: true,
    tone: "destructive",
  },
  suspend: {
    label: "일시정지",
    icon: ShieldX,
    title: "이용 일시정지",
    description:
      "공급업체의 셀러센터 접근을 일시 정지합니다. 사유는 사용자에게 전달됩니다.",
    cta: "정지하기",
    requireReason: true,
    tone: "warning",
  },
};

export function VendorActions({
  vendorId,
  currentStatus,
  currentGrade,
}: {
  vendorId: string;
  currentStatus: string;
  currentGrade?: VendorGrade | null;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradeValue, setGradeValue] = useState<VendorGrade>(
    (currentGrade ?? "STANDARD") as VendorGrade,
  );
  const [gradeNote, setGradeNote] = useState("");
  const [gradeError, setGradeError] = useState<string | null>(null);

  const approve = trpc.admin.vendor.approve.useMutation();
  const reject = trpc.admin.vendor.reject.useMutation();
  const suspend = trpc.admin.vendor.suspend.useMutation();
  const updateGrade = trpc.admin.vendor.updateGrade.useMutation();

  function close() {
    setActive(null);
    setReason("");
    setNote("");
    setError(null);
  }

  async function confirm() {
    if (!active) return;
    setError(null);
    try {
      if (active === "approve") {
        await approve.mutateAsync({ vendorId, note: note || undefined });
        toast.success("공급업체를 승인했습니다");
      } else if (active === "reject") {
        await reject.mutateAsync({ vendorId, reason });
        toast.success("입점 신청을 반려했습니다");
      } else {
        await suspend.mutateAsync({ vendorId, reason });
        toast.success("공급업체를 일시정지했습니다");
      }
      close();
      router.refresh();
    } catch (err) {
      const e2 = err as { message?: string };
      const msg = e2.message ?? "처리에 실패했습니다.";
      setError(msg);
      toast.error(msg);
    }
  }

  const pending = approve.isPending || reject.isPending || suspend.isPending;
  const gradePending = updateGrade.isPending;

  const canApprove = currentStatus !== "APPROVED";
  const canReject =
    currentStatus === "PENDING_REVIEW" || currentStatus === "PENDING_DOCS";
  const canSuspend = currentStatus === "APPROVED";
  // 등급 변경은 APPROVED 또는 SUSPENDED vendor 대상.
  const canChangeGrade =
    currentStatus === "APPROVED" || currentStatus === "SUSPENDED";

  async function confirmGrade() {
    setGradeError(null);
    try {
      await updateGrade.mutateAsync({
        vendorId,
        grade: gradeValue,
        note: gradeNote.trim() || undefined,
      });
      toast.success(`등급을 ${gradeValue} 로 변경했습니다`);
      setGradeOpen(false);
      setGradeNote("");
      router.refresh();
    } catch (err) {
      const e2 = err as { message?: string };
      const msg = e2.message ?? "등급 변경에 실패했습니다.";
      setGradeError(msg);
      toast.error(msg);
    }
  }

  const showHint =
    currentStatus === "REJECTED"
      ? "반려된 신청입니다. 재신청은 vendor 측 새 가입으로 진행됩니다."
      : currentStatus === "SUSPENDED"
        ? "정지 상태입니다. 승인 버튼으로 해제할 수 있습니다."
        : null;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        심사 액션
      </p>
      {showHint && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {showHint}
        </p>
      )}

      <div className="mt-5 space-y-2">
        <ActionButton
          tone="primary"
          icon={Check}
          label="승인"
          disabled={!canApprove || pending}
          onClick={() => setActive("approve")}
        />
        <ActionButton
          tone="error"
          icon={X}
          label="반려"
          disabled={!canReject || pending}
          onClick={() => setActive("reject")}
        />
        <ActionButton
          tone="warning"
          icon={ShieldX}
          label="일시정지"
          disabled={!canSuspend || pending}
          onClick={() => setActive("suspend")}
        />
        <ActionButton
          tone="neutral"
          icon={Award}
          label={`등급 변경 · 현재 ${currentGrade ?? "STANDARD"}`}
          disabled={!canChangeGrade || gradePending}
          onClick={() => {
            setGradeValue((currentGrade ?? "STANDARD") as VendorGrade);
            setGradeNote("");
            setGradeError(null);
            setGradeOpen(true);
          }}
        />
      </div>

      {/* 등급 변경 Dialog */}
      <Dialog open={gradeOpen} onOpenChange={(open) => !open && setGradeOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>등급 변경</DialogTitle>
            <DialogDescription>
              등급에 따라 기본 수수료율이 자동 적용되고 vendor 에게 알림톡이 발송됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {GRADE_OPTIONS.map((opt) => {
                const selected = gradeValue === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGradeValue(opt.value)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                      selected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/40"
                        : "border-[var(--color-border-light)] hover:border-[var(--color-border-default)]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {opt.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        {opt.desc}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-sm tabular-nums ${
                        selected
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      {opt.rate}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label htmlFor="grade-note">사유 (선택)</Label>
              <Textarea
                id="grade-note"
                value={gradeNote}
                onChange={(e) => setGradeNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="등급 조정 사유 (알림톡에 함께 발송됩니다)"
              />
            </div>

            {gradeError && (
              <p
                className="error-slide-down border-l-2 border-[var(--color-error)] bg-[var(--color-error)]/5 px-3 py-2 text-sm text-[var(--color-error)]"
                role="alert"
              >
                {gradeError}
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setGradeOpen(false)}
              disabled={gradePending}
              className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmGrade}
              disabled={gradePending}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
            >
              {gradePending ? "처리 중…" : "등급 적용"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={active !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{ACTION_META[active].title}</DialogTitle>
                <DialogDescription>
                  {ACTION_META[active].description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {ACTION_META[active].requireReason ? (
                  <div className="space-y-2">
                    <Label htmlFor="reason">사유 (필수)</Label>
                    <Textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                      maxLength={500}
                      placeholder="사용자에게 그대로 전달됩니다."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="note">내부 메모 (선택)</Label>
                    <Textarea
                      id="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="운영자 간 공유용. 사용자에게 노출되지 않습니다."
                    />
                  </div>
                )}
                {error && (
                  <p
                    className="error-slide-down border-l-2 border-[var(--color-error)] bg-[var(--color-error)]/5 px-3 py-2 text-sm text-[var(--color-error)]"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
              </div>

              <DialogFooter>
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={
                    pending ||
                    (ACTION_META[active].requireReason &&
                      reason.trim().length === 0)
                  }
                  className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
                >
                  {pending ? "처리 중…" : ACTION_META[active].cta}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionButton({
  tone,
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  tone: "primary" | "error" | "warning" | "neutral";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "primary"
      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
      : tone === "error"
        ? "border-[var(--color-border-light)] text-[var(--color-error)] hover:border-[var(--color-error)] hover:bg-[var(--color-error)]/5"
        : tone === "warning"
          ? "border-[var(--color-border-light)] text-[var(--color-warning)] hover:border-[var(--color-warning)] hover:bg-[var(--color-warning)]/5"
          : "border-[var(--color-border-light)] text-[var(--color-text-primary)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-secondary)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 w-full items-center justify-between gap-2 rounded-full border px-5 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-40 ${toneClass}`}
    >
      <span>{label}</span>
      <Icon className="h-4 w-4" strokeWidth={2.4} aria-hidden />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// VendorMemoPanel — 운영자 메모 ledger
// ─────────────────────────────────────────────────────────────

export function VendorMemoPanel({ vendorId }: { vendorId: string }) {
  const [body, setBody] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listQuery = trpc.admin.vendor.listMemos.useQuery(
    { vendorId },
    { retry: false },
  );
  const addMutation = trpc.admin.vendor.addMemo.useMutation();

  async function submit() {
    setError(null);
    if (body.trim().length === 0) return;
    try {
      await addMutation.mutateAsync({ vendorId, body: body.trim() });
      toast.success("메모를 추가했습니다");
      setBody("");
      await listQuery.refetch();
    } catch (err) {
      const e2 = err as { message?: string };
      const msg = e2.message ?? "메모 저장에 실패했습니다.";
      setError(msg);
      toast.error(msg);
    }
  }

  const memos = listQuery.data ?? [];
  const visible = showAll ? memos : memos.slice(0, 5);
  const isPreview = listQuery.isError;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        운영자 메모
      </p>

      {/* 입력 */}
      <div className="mt-4 space-y-2">
        <Label htmlFor="vendor-memo" className="sr-only">
          메모 내용
        </Label>
        <Textarea
          id="vendor-memo"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="내부 공유용. 사용자에게 노출되지 않습니다."
          className="text-sm"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            {body.length} / 1000
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={
              addMutation.isPending || body.trim().length === 0
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 text-xs font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-40"
          >
            <Send className="h-3 w-3" strokeWidth={2.4} />
            {addMutation.isPending ? "저장 중…" : "메모 추가"}
          </button>
        </div>
        {error && (
          <p
            className="error-slide-down border-l-2 border-[var(--color-error)] bg-[var(--color-error)]/5 px-3 py-2 text-xs text-[var(--color-error)]"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      {/* 리스트 */}
      <ul className="mt-6 divide-y divide-[var(--color-border-light)] border-t border-[var(--color-border-light)]">
        {visible.length === 0 && !isPreview && !listQuery.isLoading && (
          <li className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">
            등록된 메모가 없습니다
          </li>
        )}
        {listQuery.isLoading && (
          <li className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">
            불러오는 중…
          </li>
        )}
        {isPreview && (
          <li className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">
            로그인이 필요합니다 (PREVIEW)
          </li>
        )}
        {visible.map((m) => (
          <li key={m.id} className="py-3">
            <p className="text-xs text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
              {m.body}
            </p>
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {formatMemoTime(m.createdAt)}
              <span className="mx-1.5">·</span>
              <span className="font-mono">{m.actorId.slice(0, 8)}</span>
            </p>
          </li>
        ))}
      </ul>
      {memos.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-[11px] font-medium text-[var(--color-accent)] hover:underline"
        >
          {showAll ? "접기" : `+ ${memos.length - 5}건 더보기`}
        </button>
      )}
    </div>
  );
}

function formatMemoTime(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "";
  const w1 = ts as { toDate?: () => Date };
  if (typeof w1.toDate === "function") {
    try {
      return w1.toDate().toLocaleString("ko-KR");
    } catch {
      /* fallthrough */
    }
  }
  const w2 = ts as { seconds?: number; _seconds?: number };
  const sec = w2.seconds ?? w2._seconds;
  if (typeof sec === "number") {
    return new Date(sec * 1000).toLocaleString("ko-KR");
  }
  return "";
}
