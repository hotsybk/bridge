"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc/client";

const VENDOR_TYPE_LABEL: Record<string, string> = {
  DISTRIBUTOR: "판매업자",
  MANUFACTURER: "제조업자",
  IMPORTER: "수입업자",
};

export type BulkVendorRow = {
  id: string;
  companyName: string;
  vendorType: string;
  bizRegNo: string;
  ceoName: string;
  createdAt: unknown;
};

/**
 * Server component에서 vendor list를 props로 받아
 * 체크박스 선택 + 일괄 승인 액션을 처리하는 client island.
 *
 * - PENDING_REVIEW status에서만 bulk approve 노출
 */
export function VendorBulkTable({
  vendors,
  enableBulk,
}: {
  vendors: BulkVendorRow[];
  enableBulk: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{
    succeeded: number;
    failed: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bulkApprove = trpc.admin.vendor.bulkApprove.useMutation();

  const allChecked = useMemo(
    () => vendors.length > 0 && vendors.every((v) => selected.has(v.id)),
    [vendors, selected],
  );
  const someChecked = selected.size > 0 && !allChecked;

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
      setSelected(new Set(vendors.map((v) => v.id)));
    }
  }

  function clearSelection() {
    setSelected(new Set());
    setResult(null);
  }

  async function confirmBulkApprove() {
    setError(null);
    try {
      const r = await bulkApprove.mutateAsync({
        vendorIds: Array.from(selected),
      });
      setResult({ succeeded: r.succeeded, failed: r.failed, total: r.total });
      setConfirmOpen(false);
      // 성공 시 새로고침
      router.refresh();
      setSelected(new Set());
    } catch (err) {
      const e2 = err as { message?: string };
      setError(e2.message ?? "일괄 승인에 실패했습니다.");
    }
  }

  return (
    <>
      {/* Bulk action bar — sticky */}
      {enableBulk && selected.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-accent)] bg-[var(--color-bg-primary)] px-5 py-3 shadow-sm">
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
              onClick={clearSelection}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-4 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="h-3 w-3" />
              선택 해제
            </button>
          </div>
        </div>
      )}

      {/* 결과 banner */}
      {result && (
        <div
          className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-5 py-3 text-sm"
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

      {/* Table */}
      <div className="mt-2">
        {/* Table headers — line only */}
        <div
          className={`hidden gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] md:grid ${
            enableBulk
              ? "grid-cols-[28px_2fr_1fr_1.2fr_0.8fr_1fr_auto]"
              : "grid-cols-[2fr_1fr_1.2fr_0.8fr_1fr_auto]"
          }`}
        >
          {enableBulk && (
            <span className="flex items-center">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={toggleAll}
                aria-label="전체 선택"
                className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
              />
            </span>
          )}
          <span>회사명</span>
          <span>구분</span>
          <span>사업자번호</span>
          <span>대표자</span>
          <span className="text-right">신청일</span>
          <span className="sr-only">상세</span>
        </div>

        <ul className="divide-y divide-[var(--color-border-light)]">
          {vendors.map((v, i) => {
            const isSelected = selected.has(v.id);
            return (
              <li
                key={v.id}
                className="row-fade-in"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div
                  className={`group grid grid-cols-1 gap-2 px-2 py-5 transition-colors md:items-center md:gap-4 ${
                    isSelected
                      ? "bg-[var(--color-accent-light)]/30"
                      : "hover:bg-[var(--color-bg-secondary)]/40"
                  } ${
                    enableBulk
                      ? "md:grid-cols-[28px_2fr_1fr_1.2fr_0.8fr_1fr_auto]"
                      : "md:grid-cols-[2fr_1fr_1.2fr_0.8fr_1fr_auto]"
                  }`}
                >
                  {enableBulk && (
                    <span className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(v.id)}
                        aria-label={`${v.companyName} 선택`}
                        className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                      />
                    </span>
                  )}
                  <Link
                    href={`/admin/vendors/${v.id}`}
                    className="contents"
                  >
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {v.companyName}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] md:text-sm">
                      {VENDOR_TYPE_LABEL[v.vendorType] ?? v.vendorType}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)] md:text-sm">
                      {v.bizRegNo}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] md:text-sm">
                      {v.ceoName}
                    </span>
                    <span className="text-xs tabular-nums text-[var(--color-text-tertiary)] md:text-right md:text-sm">
                      {formatDate(v.createdAt)}
                    </span>
                    <span className="hidden text-[var(--color-text-tertiary)] transition-colors group-hover:text-[var(--color-accent)] md:inline">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>일괄 승인</DialogTitle>
            <DialogDescription>
              선택한 {selected.size}건의 입점 신청을 모두 승인합니다.
              승인 즉시 셀러센터 접근이 허용되고 알림톡이 발송됩니다.
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
              onClick={confirmBulkApprove}
              disabled={bulkApprove.isPending}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
            >
              {bulkApprove.isPending ? "처리 중…" : `${selected.size}건 승인`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// formatDate 는 @/lib/format 에서 import 합니다 — Phase ν-4.
