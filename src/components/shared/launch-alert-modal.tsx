"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Bell, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { useAuth } from "@/lib/firebase/auth-context";

/**
 * Phase ν-5 작업2 — 출시 알림 신청 modal.
 *
 * /groupbuys, /rfq, /subscriptions 등 "출시 알림 받기" 버튼이 띄우는 공용 modal.
 * 로그인 사용자는 이메일이 prefill.
 *
 * 디자인 DNA:
 *  - 라인 only, 박스 둥근 모서리 최소
 *  - 모바일 풀스크린, 데스크탑 centered card
 *  - body scroll lock + ESC close
 */

type SubscriptionType =
  | "GROUPBUY_LAUNCH"
  | "RFQ_LAUNCH"
  | "SUBSCRIPTION_LAUNCH"
  | "GENERAL";

interface Props {
  open: boolean;
  onClose: () => void;
  type: SubscriptionType;
  title: string;
  description: string;
}

export function LaunchAlertModal({
  open,
  onClose,
  type,
  title,
  description,
}: Props) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const subscribe = trpc.marketingSubscription.subscribe.useMutation();

  // prefill email when user logs in
  useEffect(() => {
    if (open && user?.email) setEmail(user.email);
  }, [open, user]);

  // body scroll lock + ESC
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("올바른 이메일 형식이 아닙니다.");
      return;
    }
    if (!consent) {
      setError("마케팅 정보 수신 동의가 필요합니다.");
      return;
    }
    try {
      const res = await subscribe.mutateAsync({
        type,
        email: email.trim(),
        consentToMarketing: true as const,
      });
      if (res.alreadySubscribed) {
        toast.success("이미 신청된 이메일이에요.", {
          description: "출시되면 가장 먼저 알려드릴게요.",
        });
      } else {
        toast.success("알림 신청이 완료되었어요.", {
          description: "출시되는 순간 등록하신 이메일로 안내드릴게요.",
        });
      }
      // 잠시 후 닫기
      setTimeout(() => {
        subscribe.reset();
        onClose();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "신청에 실패했습니다.");
    }
  }

  const isSuccess = subscribe.isSuccess;

  return (
    <div
      role="dialog"
      aria-label={title}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md border-t border-[var(--color-border-light)] bg-[var(--color-bg-primary)] p-7 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.2)] md:rounded-3xl md:border md:p-10 md:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.25)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
              <Bell className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                출시 알림
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="-mr-2 -mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {description}
        </p>

        {/* Form / Success */}
        {isSuccess ? (
          <div className="mt-8 flex items-start gap-3 border-t border-[var(--color-border-light)] pt-8">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-success)]/12 text-[var(--color-success)]">
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-sm font-semibold">알림 신청 완료</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {email}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-7" noValidate>
            <label className="block">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                이메일
                <span className="ml-1 text-[var(--color-accent)]">*</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="you@hospital.kr"
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                disabled={subscribe.isPending}
              />
            </label>

            <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                disabled={subscribe.isPending}
              />
              <span>
                마케팅 정보 수신 동의 (필수) — 출시 안내 1회 발송 후 보관 1년,
                동의 철회는 메일 하단 링크로 즉시 가능.
              </span>
            </label>

            {error && (
              <p className="mt-4 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
                {error}
              </p>
            )}

            <div className="mt-7 flex items-center gap-3">
              <button
                type="submit"
                disabled={subscribe.isPending}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-opacity disabled:opacity-60 active:scale-[0.98]"
              >
                {subscribe.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    신청 중...
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4" />
                    알림 받기
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={subscribe.isPending}
                className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-60"
              >
                닫기
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * 트리거 버튼 + modal 을 묶은 self-contained 클라이언트 컴포넌트.
 * 페이지에서 <LaunchAlertButton type=... /> 한 줄로 사용.
 */
export function LaunchAlertButton({
  type,
  title,
  description,
  buttonClassName,
  buttonLabel = "출시 알림 받기",
}: {
  type: SubscriptionType;
  title: string;
  description: string;
  buttonClassName: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        <Bell className="h-4 w-4" />
        {buttonLabel}
      </button>
      <LaunchAlertModal
        open={open}
        onClose={() => setOpen(false)}
        type={type}
        title={title}
        description={description}
      />
    </>
  );
}
