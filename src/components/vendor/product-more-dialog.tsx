"use client";

import { useEffect, useState } from "react";
import { Copy, EyeOff, Eye, XCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProductMoreDialog({
  open,
  productName,
  visible,
  onClose,
  onAction,
}: {
  open: boolean;
  productName: string;
  visible: boolean;
  onClose: () => void;
  onAction: (action: "duplicate" | "toggle-visible" | "discontinue") => void;
}) {
  // Phase ξ-4 — window.confirm 제거, 2단계 confirm view 로 전환.
  const [confirmingDiscontinue, setConfirmingDiscontinue] = useState(false);

  useEffect(() => {
    if (!open) setConfirmingDiscontinue(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xs">
        {confirmingDiscontinue ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold tracking-tight">
                단종 처리
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--color-text-secondary)]">
                &ldquo;{productName}&rdquo; 을(를) 단종 처리합니다. 진행 중인 주문은
                유지되지만 신규 주문이 차단됩니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setConfirmingDiscontinue(false)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onAction("discontinue");
                  onClose();
                }}
                className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-error)] px-4 text-sm font-semibold text-white transition-colors hover:opacity-90"
              >
                단종 처리
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold tracking-tight">
                상품 관리
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--color-text-secondary)]">
                {productName}
              </DialogDescription>
            </DialogHeader>

            <ul className="divide-y divide-[var(--color-border-light)]">
              <MenuItem
                icon={Copy}
                label="복제하여 등록"
                desc="동일한 상품 정보로 새 상품 생성"
                onClick={() => {
                  onAction("duplicate");
                  onClose();
                }}
              />
              <MenuItem
                icon={visible ? EyeOff : Eye}
                label={visible ? "카탈로그에서 숨김" : "카탈로그에 노출"}
                desc={
                  visible
                    ? "병원 검색·목록에서 즉시 사라집니다"
                    : "다시 검색·목록에 노출됩니다"
                }
                onClick={() => {
                  onAction("toggle-visible");
                  onClose();
                }}
              />
              <MenuItem
                icon={XCircle}
                label="단종 처리"
                desc="진행 중인 주문은 유지, 신규 주문만 차단"
                tone="error"
                onClick={() => setConfirmingDiscontinue(true)}
              />
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MenuItem({
  icon: Icon,
  label,
  desc,
  onClick,
  tone = "default",
}: {
  icon: typeof Copy;
  label: string;
  desc: string;
  onClick: () => void;
  tone?: "default" | "error";
}) {
  const colorClass =
    tone === "error"
      ? "text-[var(--color-error)]"
      : "text-[var(--color-text-primary)]";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:opacity-80"
      >
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${colorClass}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${colorClass}`}>{label}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
            {desc}
          </p>
        </div>
      </button>
    </li>
  );
}
