import type { ReactNode } from "react";

/**
 * Phase 표기 배지 — 미공개 기능 페이지 상단/카드 코너에 사용.
 * DESIGN_SYSTEM.md §2 색 토큰만 사용.
 */
export function PhaseBadge({
  phase,
  children,
}: {
  /** "Phase 2" / "Phase 3" 등 */
  phase: string;
  /** 우측 보조 텍스트. e.g. "출시 예정" / "베타" */
  children?: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-[11px] font-medium text-[var(--color-accent)]">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
      {phase}
      {children && (
        <>
          <span className="text-[var(--color-accent)]/40">·</span>
          <span>{children}</span>
        </>
      )}
    </span>
  );
}
