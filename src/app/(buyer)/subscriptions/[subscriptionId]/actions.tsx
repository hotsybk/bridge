"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  SkipForward,
  XCircle,
} from "lucide-react";

import { trpc } from "@/lib/trpc/client";

type Props = {
  subscriptionId: string;
  status: string;
  qty: number;
  unit: string;
  isActive: boolean;
  isPaused: boolean;
};

export function SubscriptionDetailActions({
  subscriptionId,
  qty: initialQty,
  unit,
  isActive,
  isPaused,
}: Props) {
  const router = useRouter();
  const [qty, setQty] = useState(initialQty);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onMutate = () => {
    setError(null);
    setSuccess(null);
  };

  const refresh = () => {
    router.refresh();
  };

  const pauseM = trpc.subscription.pause.useMutation({
    onMutate,
    onSuccess: () => {
      setSuccess("구독을 일시정지했습니다.");
      refresh();
    },
    onError: (err) => setError(err.message),
  });
  const resumeM = trpc.subscription.resume.useMutation({
    onMutate,
    onSuccess: () => {
      setSuccess("구독을 재개했습니다.");
      refresh();
    },
    onError: (err) => setError(err.message),
  });
  const cancelM = trpc.subscription.cancel.useMutation({
    onMutate,
    onSuccess: () => {
      setSuccess("구독을 해지했습니다.");
      refresh();
    },
    onError: (err) => setError(err.message),
  });
  const skipM = trpc.subscription.skipNext.useMutation({
    onMutate,
    onSuccess: (data) => {
      setSuccess(`다음 발주를 ${data.newNextRunAt.slice(0, 10)} 로 이동했습니다.`);
      refresh();
    },
    onError: (err) => setError(err.message),
  });
  const updateQtyM = trpc.subscription.updateQty.useMutation({
    onMutate,
    onSuccess: (data) => {
      setSuccess(`수량을 변경했습니다. 적용 단가 ₩${data.unitPrice.toLocaleString()}.`);
      refresh();
    },
    onError: (err) => setError(err.message),
  });

  const pending =
    pauseM.isPending ||
    resumeM.isPending ||
    cancelM.isPending ||
    skipM.isPending ||
    updateQtyM.isPending;

  const onCancel = () => {
    if (!confirm("정기구독을 해지하시겠어요? 다시 시작하려면 새 구독을 만들어야 합니다.")) return;
    cancelM.mutate({ subscriptionId });
  };

  return (
    <section className="mt-10">
      <header className="border-b border-[var(--color-border-light)] pb-4">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">구독 관리</h2>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          일시정지·재개·1회 스킵·해지·수량 변경
        </p>
      </header>

      {/* Qty change */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-light)] pb-6">
        <div>
          <p className="text-sm font-semibold tracking-tight">회당 수량 변경</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            새 수량 기준으로 단가가 자동 재계산됩니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 items-center rounded-full border border-[var(--color-border-light)] bg-[var(--color-bg-primary)]">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              disabled={pending}
              className="grid h-11 w-11 place-items-center text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="number"
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))
              }
              className="w-16 bg-transparent text-center text-sm font-semibold tabular-nums focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              disabled={pending}
              className="grid h-11 w-11 place-items-center text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-sm text-[var(--color-text-secondary)]">{unit}</span>
          <button
            type="button"
            disabled={pending || qty === initialQty}
            onClick={() => updateQtyM.mutate({ subscriptionId, qty })}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--color-text-primary)] px-5 text-sm font-medium text-[var(--color-bg-primary)] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
          >
            {updateQtyM.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            변경 적용
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {isActive ? (
          <ActionBtn
            icon={<Pause className="h-4 w-4" />}
            label="일시정지"
            desc="다음 발주부터 보류됩니다"
            disabled={pending}
            onClick={() => pauseM.mutate({ subscriptionId })}
            loading={pauseM.isPending}
          />
        ) : isPaused ? (
          <ActionBtn
            icon={<Play className="h-4 w-4" />}
            label="재개"
            desc="다음 주기부터 자동 발주가 시작됩니다"
            disabled={pending}
            onClick={() => resumeM.mutate({ subscriptionId })}
            loading={resumeM.isPending}
            primary
          />
        ) : null}

        {isActive && (
          <ActionBtn
            icon={<SkipForward className="h-4 w-4" />}
            label="이번 회차 스킵"
            desc="다음 발주를 한 주기 미룹니다"
            disabled={pending}
            onClick={() => skipM.mutate({ subscriptionId })}
            loading={skipM.isPending}
          />
        )}

        <ActionBtn
          icon={<XCircle className="h-4 w-4" />}
          label="해지"
          desc="구독을 영구 종료합니다 (취소 불가)"
          disabled={pending}
          onClick={onCancel}
          loading={cancelM.isPending}
          danger
        />
      </div>

      {(error || success) && (
        <div
          className={`mt-6 flex items-start gap-2 rounded-xl border p-4 text-sm ${
            error
              ? "border-[var(--color-error)]/20 bg-[var(--color-error)]/5 text-[var(--color-error)]"
              : "border-[var(--color-success)]/20 bg-[var(--color-success)]/5 text-[var(--color-success)]"
          }`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error ?? success}</span>
        </div>
      )}
    </section>
  );
}

function ActionBtn({
  icon,
  label,
  desc,
  disabled,
  loading,
  onClick,
  primary,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const tone = primary
    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
    : danger
      ? "border-[var(--color-border-light)] bg-[var(--color-bg-primary)] text-[var(--color-error)] hover:bg-[var(--color-error)]/5"
      : "border-[var(--color-border-light)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-start gap-3 rounded-2xl border p-5 text-left transition-all disabled:opacity-50 ${tone}`}
    >
      <span className="mt-0.5">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight">{label}</p>
        <p className="mt-1 text-xs opacity-80">{desc}</p>
      </div>
    </button>
  );
}
