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
  orderId: string;
  defaultAmount: number;
  isPreview: boolean;
};

const DISPUTE_TYPES = [
  { value: "REFUND", label: "환불" },
  { value: "RETURN", label: "반품" },
  { value: "NOT_DELIVERED", label: "미수령" },
  { value: "QUALITY", label: "품질" },
  { value: "OTHER", label: "기타" },
] as const;

type DisputeType = (typeof DISPUTE_TYPES)[number]["value"];

/**
 * 주문 상세 우측 sticky panel 의 client island.
 *
 * - 강제 환불 (Dialog: amount + reason + adjustPayout)
 * - 결제 재시도 (mutation, stub)
 * - 분쟁 생성 (Phase γ-1: 실 mutation 연결)
 * - 메모 입력
 */
export function OrderAdminActions({ orderId, defaultAmount, isPreview }: Props) {
  const router = useRouter();
  const [refundOpen, setRefundOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [memo, setMemo] = useState("");

  const [refundAmount, setRefundAmount] = useState<string>(
    String(defaultAmount ?? 0),
  );
  const [refundReason, setRefundReason] = useState("");
  const [adjustPayout, setAdjustPayout] = useState(true);

  // 분쟁 생성 dialog state
  const [disputeType, setDisputeType] = useState<DisputeType>("REFUND");
  const [disputeReason, setDisputeReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const forceRefund = trpc.admin.order.forceRefund.useMutation();
  const retryPayment = trpc.admin.order.retryPayment.useMutation();
  const addMemo = trpc.admin.order.addMemo.useMutation();
  const openDispute = trpc.admin.dispute.openOnBehalf.useMutation();

  function withGuard<T>(fn: () => Promise<T>) {
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
    const amountNum = Number(refundAmount.replace(/[^0-9]/g, ""));
    if (!refundReason.trim()) {
      setError("환불 사유를 입력해주세요.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setError("환불 금액을 확인해주세요.");
      return;
    }
    const result = await withGuard(() =>
      forceRefund.mutateAsync({
        orderId,
        amount: amountNum,
        reason: refundReason,
        adjustPayout,
      }),
    );
    if (result) {
      toast.success("강제 환불을 처리했습니다");
      setRefundOpen(false);
      setRefundReason("");
      router.refresh();
    }
  }

  async function confirmRetry() {
    const result = await withGuard(() =>
      retryPayment.mutateAsync({ orderId }),
    );
    if (result) {
      setInfo("결제 재시도 요청을 기록했습니다.");
      toast.success("결제 재시도 요청을 기록했습니다");
      router.refresh();
    }
  }

  async function confirmMemo() {
    if (!memo.trim()) return;
    const result = await withGuard(() =>
      addMemo.mutateAsync({ orderId, body: memo }),
    );
    if (result) {
      toast.success("메모를 추가했습니다");
      setMemo("");
      router.refresh();
    }
  }

  async function confirmDispute() {
    if (disputeReason.trim().length < 10) {
      setError("분쟁 사유를 10자 이상 입력해주세요.");
      return;
    }
    const result = await withGuard(() =>
      openDispute.mutateAsync({
        orderId,
        type: disputeType,
        reason: disputeReason.trim(),
      }),
    );
    if (result) {
      toast.success("분쟁을 개설했습니다");
      setDisputeOpen(false);
      setDisputeReason("");
      router.push(`/admin/disputes/${result.disputeId}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setRefundOpen(true)}
          className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/5"
        >
          강제 환불
        </button>
        <button
          type="button"
          onClick={() => setDisputeOpen(true)}
          className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-border-default)] px-4 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
        >
          분쟁 생성
        </button>
        <button
          type="button"
          onClick={confirmRetry}
          disabled={retryPayment.isPending}
          className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/5 disabled:opacity-60"
        >
          {retryPayment.isPending ? "처리 중…" : "결제 재시도 트리거"}
        </button>
      </div>

      {info && (
        <p className="text-xs text-[var(--color-accent)]">{info}</p>
      )}
      {error && (
        <p className="text-xs text-[var(--color-error)]">{error}</p>
      )}

      {/* 메모 입력 */}
      <div className="pt-4 border-t border-[var(--color-border-light)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          새 메모
        </p>
        <textarea
          rows={3}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 입력…"
          className="mt-2 w-full resize-none border-b border-[var(--color-border-light)] bg-transparent py-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={confirmMemo}
            disabled={!memo.trim() || addMemo.isPending}
            className="inline-flex h-8 items-center rounded-full border border-[var(--color-border-light)] px-3.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
          >
            {addMemo.isPending ? "저장 중…" : "메모 추가"}
          </button>
        </div>
      </div>

      {/* 강제 환불 모달 */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>강제 환불</DialogTitle>
            <DialogDescription>
              PortOne 결제 취소를 호출하고 주문 상태를 REFUNDED 로 전환합니다.
              vendor 정산 조정 옵션을 함께 진행할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <label className="block text-xs text-[var(--color-text-tertiary)]">
              환불 금액
              <input
                type="text"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="mt-1 block h-9 w-full border-b border-[var(--color-border-light)] bg-transparent px-1 text-sm font-mono tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={adjustPayout}
                onChange={(e) => setAdjustPayout(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              Vendor 정산 조정 동시 진행
            </label>
            <textarea
              rows={4}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="환불 사유"
              className="w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            {error && (
              <p className="text-xs text-[var(--color-error)]">{error}</p>
            )}
          </div>
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
              disabled={forceRefund.isPending}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-error)] bg-[var(--color-error)]/5 px-4 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/10 disabled:opacity-60"
            >
              {forceRefund.isPending ? "처리 중…" : "환불 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 분쟁 생성 모달 — Phase γ-1 실 mutation */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>분쟁 생성</DialogTitle>
            <DialogDescription>
              병원과 vendor 양측에 알림이 발송되며 48시간 응답 SLA 가 시작됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-tertiary)]">
                분쟁 유형
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DISPUTE_TYPES.map((t) => {
                  const active = disputeType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setDisputeType(t.value)}
                      className={`inline-flex h-8 items-center rounded-full border px-4 text-xs font-medium transition-colors ${
                        active
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                          : "border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-tertiary)]">
                분쟁 사유 (10자 이상)
              </label>
              <textarea
                rows={5}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="병원·vendor 양측에 전달됩니다. 사실관계와 운영자 판단을 명확히 적어주세요."
                className="mt-2 w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                {disputeReason.length} / 2000
              </p>
            </div>

            {error && (
              <p className="text-xs text-[var(--color-error)]">{error}</p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setDisputeOpen(false)}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmDispute}
              disabled={
                openDispute.isPending || disputeReason.trim().length < 10
              }
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {openDispute.isPending ? "처리 중…" : "분쟁 생성"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
