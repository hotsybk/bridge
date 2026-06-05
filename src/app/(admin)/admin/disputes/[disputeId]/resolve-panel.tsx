"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";

type Props = {
  disputeId: string;
  defaultAmount: number;
  hospitalName: string;
  vendorName: string;
  isPreview: boolean;
  resolved: boolean;
};

const REFUND_RATES = [0, 25, 50, 75, 100] as const;

/**
 * 운영자 — 중재 결정 panel (client island).
 *
 * - 환불 비율 dropdown → 자동 금액 계산
 * - 정산 조정 toggle
 * - 결정 사유 textarea
 * - 액션 buttons → Dialog 확인 → resolve / reject / requestEvidence mutation
 */
export function ResolvePanel({
  disputeId,
  defaultAmount,
  hospitalName,
  vendorName,
  isPreview,
  resolved,
}: Props) {
  const router = useRouter();
  const [rate, setRate] = useState<number>(50);
  const [refundAmount, setRefundAmount] = useState<number>(
    Math.round((defaultAmount * 50) / 100),
  );
  const [adjustSettle, setAdjustSettle] = useState(true);
  const [reason, setReason] = useState("");

  const [refundOpen, setRefundOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const [rejectReason, setRejectReason] = useState("");
  const [evidenceFrom, setEvidenceFrom] = useState<"BUYER" | "VENDOR">("BUYER");
  const [evidenceMessage, setEvidenceMessage] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const resolveMut = trpc.admin.dispute.resolve.useMutation();
  const rejectMut = trpc.admin.dispute.reject.useMutation();
  const evidenceMut = trpc.admin.dispute.requestEvidence.useMutation();

  function changeRate(next: number) {
    setRate(next);
    setRefundAmount(Math.round((defaultAmount * next) / 100));
  }

  function guard<T>(fn: () => Promise<T>): Promise<T | null> {
    setError(null);
    if (isPreview) {
      setError("PREVIEW 모드에서는 실제 처리되지 않습니다.");
      return Promise.resolve(null);
    }
    return fn().catch((err) => {
      const e2 = err as { message?: string };
      const msg = e2.message ?? "처리에 실패했습니다.";
      setError(msg);
      toast.error(msg);
      return null;
    });
  }

  async function confirmRefund() {
    if (!reason.trim()) {
      setError("결정 사유를 입력해주세요.");
      return;
    }
    const result = await guard(() =>
      resolveMut.mutateAsync({
        disputeId,
        refundPercent: rate,
        refundAmount,
        payoutAdjustment: adjustSettle ? refundAmount : 0,
        reason,
      }),
    );
    if (result) {
      setInfo("환불 결정이 완료되었습니다.");
      toast.success("환불 결정이 완료되었습니다");
      setRefundOpen(false);
      router.refresh();
    }
  }

  async function confirmReject() {
    if (!rejectReason.trim()) {
      setError("거부 사유를 입력해주세요.");
      return;
    }
    const result = await guard(() =>
      rejectMut.mutateAsync({
        disputeId,
        reason: rejectReason,
      }),
    );
    if (result) {
      setInfo("분쟁을 거부했습니다.");
      toast.success("분쟁을 거부했습니다");
      setRejectOpen(false);
      router.refresh();
    }
  }

  async function confirmEvidence() {
    if (!evidenceMessage.trim()) {
      setError("요청 내용을 입력해주세요.");
      return;
    }
    const result = await guard(() =>
      evidenceMut.mutateAsync({
        disputeId,
        from: evidenceFrom,
        message: evidenceMessage,
      }),
    );
    if (result) {
      setInfo("정보 요청을 전송했습니다.");
      toast.success("정보 요청을 전송했습니다");
      setRequestOpen(false);
      router.refresh();
    }
  }

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        중재 결정
      </p>
      <div className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        <LineDropdown
          label="환불 비율"
          value={rate}
          options={REFUND_RATES.map((r) => ({ label: `${r}%`, value: r }))}
          onChange={changeRate}
          disabled={resolved}
        />
        <LineInput
          label="환불 금액"
          value={refundAmount}
          onChange={setRefundAmount}
          unit="₩"
          disabled={resolved}
        />
        <LineToggle
          label="정산 조정"
          hint="Vendor 정산에서 차감"
          value={adjustSettle}
          onChange={setAdjustSettle}
          disabled={resolved}
        />
        <div className="px-2 py-3">
          <label className="block text-xs text-[var(--color-text-tertiary)]">
            결정 사유
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={resolved}
            placeholder="사용자에게 그대로 전달됩니다…"
            className="mt-1 w-full resize-none border-b border-[var(--color-border-light)] bg-transparent py-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-[var(--color-error)]">{error}</p>
      )}
      {info && (
        <p className="mt-3 text-xs text-[var(--color-success)]">{info}</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          disabled={resolved}
          onClick={() => setRefundOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          환불 결정
        </button>
        <button
          type="button"
          disabled={resolved}
          onClick={() => setRejectOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--color-error)] px-4 text-sm font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/5 disabled:opacity-50"
        >
          분쟁 거부
        </button>
        <button
          type="button"
          disabled={resolved}
          onClick={() => setRequestOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/5 disabled:opacity-50"
        >
          더 많은 정보 요청
        </button>
      </div>

      {resolved && (
        <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)]">
          이미 종결된 분쟁입니다.
        </p>
      )}

      {/* Dialog — 환불 결정 */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>환불 결정 확정</DialogTitle>
            <DialogDescription>
              결정 즉시 PortOne 환불이 호출되며 양 당사자에게 알림이
              발송됩니다.
            </DialogDescription>
          </DialogHeader>
          <dl className="mt-2 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <DialogRow label="환불 비율" value={`${rate}%`} mono />
            <DialogRow
              label="환불 금액"
              value={`₩${refundAmount.toLocaleString()}`}
              mono
            />
            <DialogRow
              label="정산 조정"
              value={adjustSettle ? "Vendor 정산 차감" : "차감 없음"}
            />
          </dl>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRefundOpen(false)}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmRefund}
              disabled={resolveMut.isPending}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {resolveMut.isPending ? "처리 중…" : "환불 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — 분쟁 거부 */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>분쟁 거부</DialogTitle>
            <DialogDescription>
              거부 사유는 양 당사자에게 알림으로 전송되며, 분쟁은 종결 상태로
              전환됩니다.
            </DialogDescription>
          </DialogHeader>
          <textarea
            rows={5}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="거부 사유 (필수)"
            className="mt-2 w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRejectOpen(false)}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmReject}
              disabled={rejectMut.isPending}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-error)] bg-[var(--color-error)]/5 px-4 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/10 disabled:opacity-50"
            >
              {rejectMut.isPending ? "처리 중…" : "거부 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — 더 많은 정보 요청 */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>정보 요청</DialogTitle>
            <DialogDescription>
              지정한 당사자에게만 알림이 전송됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <fieldset className="space-y-2">
              <legend className="text-xs text-[var(--color-text-tertiary)]">
                요청 대상
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="target"
                  checked={evidenceFrom === "BUYER"}
                  onChange={() => setEvidenceFrom("BUYER")}
                  className="accent-[var(--color-accent)]"
                />
                병원 ({hospitalName})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="target"
                  checked={evidenceFrom === "VENDOR"}
                  onChange={() => setEvidenceFrom("VENDOR")}
                  className="accent-[var(--color-accent)]"
                />
                Vendor ({vendorName})
              </label>
            </fieldset>
            <textarea
              rows={4}
              value={evidenceMessage}
              onChange={(e) => setEvidenceMessage(e.target.value)}
              placeholder="요청 내용 (예: 추가 사진 / 영수증 / 운송장 번호)"
              className="w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRequestOpen(false)}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmEvidence}
              disabled={evidenceMut.isPending}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/5 px-4 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:opacity-50"
            >
              {evidenceMut.isPending ? "전송 중…" : "요청 전송"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function DialogRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 px-2 py-2.5">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd
        className={`text-xs text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function LineDropdown({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  options: Array<{ label: string; value: number }>;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-2 py-2.5">
      <span className="text-xs text-[var(--color-text-tertiary)]">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 bg-transparent text-xs text-[var(--color-text-primary)] tabular-nums focus:outline-none disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LineInput({
  label,
  value,
  onChange,
  unit,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-2 py-2.5">
      <span className="text-xs text-[var(--color-text-tertiary)]">{label}</span>
      <div className="flex items-center gap-1">
        {unit && (
          <span className="font-mono text-xs text-[var(--color-text-tertiary)]">
            {unit}
          </span>
        )}
        <input
          type="number"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-7 w-28 bg-transparent text-right font-mono text-xs tabular-nums focus:outline-none disabled:opacity-50"
        />
      </div>
    </div>
  );
}

function LineToggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between px-2 py-2.5 ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <span className="flex flex-col">
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--color-accent)]"
      />
    </label>
  );
}
