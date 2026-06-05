"use client";

import { useState, type FormEvent } from "react";
import { Banknote, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BANKS: Array<{ code: string; label: string }> = [
  { code: "004", label: "국민은행" },
  { code: "088", label: "신한은행" },
  { code: "020", label: "우리은행" },
  { code: "081", label: "하나은행" },
  { code: "011", label: "농협은행" },
  { code: "003", label: "기업은행" },
  { code: "090", label: "카카오뱅크" },
  { code: "092", label: "토스뱅크" },
  { code: "999", label: "기타" },
];

export function AccountChangeDialog({
  open,
  current,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  current: { bank: string; account: string; holder: string };
  isPending?: boolean;
  onClose: () => void;
  onSubmit: (next: {
    bankCode: string;
    bankLabel: string;
    bankAccount: string;
    accountHolder: string;
  }) => Promise<void> | void;
}) {
  const [bankCode, setBankCode] = useState(BANKS[0].code);
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const busy = submitting || !!isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !account.trim() || !holder.trim()) return;
    setSubmitting(true);
    try {
      const bankLabel =
        BANKS.find((b) => b.code === bankCode)?.label ?? bankCode;
      await onSubmit({
        bankCode,
        bankLabel,
        bankAccount: account.trim(),
        accountHolder: holder.trim(),
      });
      setAccount("");
      setHolder("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-tight">
            정산 계좌 변경 요청
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--color-text-secondary)]">
            계좌 변경은 운영자 본인 확인 후 영업일 1일 안에 적용됩니다.
          </DialogDescription>
        </DialogHeader>

        {/* 현재 계좌 */}
        <div className="rounded-lg border border-[var(--color-border-light)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            현재 계좌
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Banknote className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
            <p className="text-sm">
              {current.bank} · <span className="tabular-nums">{current.account}</span>
            </p>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
            예금주 {current.holder}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            변경할 계좌
          </p>

          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">은행</span>
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="mt-1 h-9 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm outline-none focus:border-[var(--color-accent)]"
            >
              {BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">계좌번호</span>
            <input
              required
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="숫자와 - 만 입력"
              pattern="[0-9-]+"
              inputMode="numeric"
              className="mt-1 h-9 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm tabular-nums placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">예금주</span>
            <input
              required
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="사업자등록증상 상호와 동일하게"
              className="mt-1 h-9 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          <p className="rounded-md bg-[var(--color-warning)]/8 px-3 py-2 text-[11px] leading-relaxed text-[var(--color-warning)]">
            예금주명이 사업자등록증의 상호와 다를 경우 변경이 거부될 수 있습니다.
          </p>

          <div className="flex justify-end gap-2 border-t border-[var(--color-border-light)] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy || !account.trim() || !holder.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              변경 요청
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
