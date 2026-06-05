"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
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

/**
 * 상품 모더레이션 큐 — 일괄 승인 sticky bar.
 *
 * server 가 PENDING_REVIEW 상태일 때만 렌더링.
 * checkbox 는 별도 client 처리 없이 list 전체 선택만 제공.
 */
export function ProductBulkBar({ productIds }: { productIds: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{
    succeeded: number;
    failed: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bulkApprove = trpc.admin.product.bulkApprove.useMutation();

  const allChecked = useMemo(
    () =>
      productIds.length > 0 && productIds.every((id) => selected.has(id)),
    [productIds, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(productIds));
    }
  }

  function clear() {
    setSelected(new Set());
    setResult(null);
  }

  async function confirm() {
    setError(null);
    try {
      const r = await bulkApprove.mutateAsync({
        productIds: Array.from(selected),
      });
      setResult({ succeeded: r.succeeded, failed: r.failed, total: r.total });
      if (r.failed > 0) {
        toast.warning(`${r.succeeded}건 승인, ${r.failed}건 실패`);
      } else {
        toast.success(`상품 ${r.succeeded}건을 일괄 승인했습니다`);
      }
      setConfirmOpen(false);
      router.refresh();
      setSelected(new Set());
    } catch (err) {
      const e2 = err as { message?: string };
      const msg = e2.message ?? "일괄 승인에 실패했습니다.";
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border-light)] px-4 py-3 text-xs">
        <label className="inline-flex items-center gap-2 text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-accent)]"
          />
          전체 선택 ({productIds.length}건)
        </label>

        <div className="ml-auto flex items-center gap-2">
          {productIds.slice(0, 12).map((id) => (
            <label
              key={id}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]"
            >
              <input
                type="checkbox"
                checked={selected.has(id)}
                onChange={() => toggle(id)}
                aria-label={`${id} 선택`}
                className="h-3 w-3 cursor-pointer accent-[var(--color-accent)]"
              />
              <span className="font-mono tabular-nums">{id.slice(0, 6)}</span>
            </label>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-accent)] bg-[var(--color-bg-primary)] px-5 py-3 shadow-sm">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            <span className="tabular-nums text-[var(--color-accent)]">
              {selected.size}건
            </span>{" "}
            선택
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={bulkApprove.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 text-xs font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
              일괄 승인
            </button>
            <button
              type="button"
              onClick={clear}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-4 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="h-3 w-3" />
              선택 해제
            </button>
          </div>
        </div>
      )}

      {result && (
        <div
          className="flex items-center justify-between rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-5 py-3 text-sm"
          role="status"
        >
          <p>
            <span className="font-medium text-[var(--color-text-primary)]">
              {result.total}건 중 {result.succeeded}건 승인
            </span>
            {result.failed > 0 && (
              <span className="ml-2 text-[var(--color-error)]">
                · {result.failed}건 실패
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            닫기
          </button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>일괄 승인</DialogTitle>
            <DialogDescription>
              선택한 {selected.size}건의 상품을 모두 승인합니다. 즉시 카탈로그에
              노출되고 알림톡이 발송됩니다.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p
              className="error-slide-down border-l-2 border-[var(--color-error)] bg-[var(--color-error)]/5 px-3 py-2 text-sm text-[var(--color-error)]"
              role="alert"
            >
              {error}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={bulkApprove.isPending}
              className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={bulkApprove.isPending}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
            >
              {bulkApprove.isPending ? "처리 중…" : `${selected.size}건 승인`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
