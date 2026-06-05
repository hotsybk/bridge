"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";

type DisputeType = "REFUND" | "RETURN" | "NOT_DELIVERED" | "QUALITY" | "OTHER";

const TYPE_OPTIONS: Array<{ value: DisputeType; label: string }> = [
  { value: "REFUND", label: "환불 요청" },
  { value: "RETURN", label: "반품 요청" },
  { value: "NOT_DELIVERED", label: "미수령" },
  { value: "QUALITY", label: "품질 문제" },
  { value: "OTHER", label: "기타" },
];

type Props = {
  orderId: string;
  subOrderId?: string;
  isPreview?: boolean;
};

/**
 * 병원 사용자 — 분쟁 신청 진입 버튼.
 * 인라인 모달로 type + reason 입력 → dispute.open mutation.
 *
 * PREVIEW_MODE 에서는 mutation 호출 대신 alert.
 */
export function DisputeOpenButton({ orderId, subOrderId, isPreview }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DisputeType>("REFUND");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const openMut = trpc.dispute.open.useMutation();

  async function submit() {
    setError(null);
    if (!reason.trim() || reason.trim().length < 10) {
      setError("신청 사유를 10자 이상 입력해주세요.");
      return;
    }
    if (isPreview) {
      setSuccess("PREVIEW 모드 — 실제 신청되지 않습니다.");
      return;
    }
    try {
      const res = await openMut.mutateAsync({
        orderId,
        subOrderId,
        type,
        reason,
      });
      setSuccess("분쟁이 접수되었습니다. 상세 페이지로 이동합니다…");
      setReason("");
      setOpen(false);
      router.push(`/disputes/${res.disputeId}`);
    } catch (err) {
      const e2 = err as { message?: string };
      setError(e2.message ?? "분쟁 신청에 실패했습니다.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-error)]"
      >
        <AlertCircle className="h-3 w-3" />
        분쟁 신청
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>분쟁 신청</DialogTitle>
            <DialogDescription>
              주문 {orderId} 에 대한 분쟁을 신청합니다. 운영자가 48시간 내
              처리합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div>
              <label className="block text-xs text-[var(--color-text-tertiary)]">
                분쟁 유형
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DisputeType)}
                className="mt-1 h-9 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm focus:border-[var(--color-accent)] focus:outline-none"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-tertiary)]">
                신청 사유
              </label>
              <textarea
                rows={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="상황을 자세히 설명해주세요 (10자 이상)"
                className="mt-1 w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
            {error && (
              <p className="text-xs text-[var(--color-error)]">{error}</p>
            )}
            {success && (
              <p className="text-xs text-[var(--color-success)]">{success}</p>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={openMut.isPending}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {openMut.isPending ? "신청 중…" : "분쟁 신청"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
