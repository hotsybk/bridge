import type { ReactNode } from "react";

type DeltaColor = "accent" | "success" | "warning" | "error" | "neutral";

/**
 * Admin 페이지 KPI 단일 셀 — 라벨 + 큰 수치 + 보조 + 델타.
 *
 * Phase ω-1: 15+ admin 페이지에서 동일 패턴(`px-4 py-6 md:px-6 md:py-8` + 11px uppercase 라벨 +
 * 2xl/3xl tabular-nums)을 inline 으로 반복 선언하던 것을 한 컴포넌트로 통일.
 *
 *   <AdminKpiCell label="오늘 주문" value={<CountUp value={42} />} sub="건" />
 *   <AdminKpiCell label="GMV" value="₩48,200,000" delta="+12%" deltaColor="success" />
 *   <AdminKpiCell label="대기" value={12} onClick={...} active={status === "PENDING"} />
 *
 * 디자인:
 *  - 박스 보더 없음. 부모(`<dl>`)의 `divide-x` / `border-y` 라인으로 구분.
 *  - 색상 토큰만 사용. gradient·shadow 금지 (헌법 §1.2).
 */
export function AdminKpiCell({
  label,
  value,
  sub,
  delta,
  deltaColor = "accent",
  onClick,
  active = false,
  className = "",
}: {
  label: string;
  /** CountUp 컴포넌트, string, number 모두 허용. */
  value: ReactNode;
  /** 보조 텍스트 (단위 또는 부연). */
  sub?: ReactNode;
  /** +12%, -3%, "지난 7일" 등. sub 와 함께 같은 라인. */
  delta?: ReactNode;
  deltaColor?: DeltaColor;
  /** 지정 시 button 으로 렌더링 (필터 토글 등). */
  onClick?: () => void;
  /** 활성 표시 — accent ring + 라벨 색 강조. */
  active?: boolean;
  className?: string;
}) {
  const deltaClassMap: Record<DeltaColor, string> = {
    accent: "text-[var(--color-accent)]",
    success: "text-[var(--color-success)]",
    warning: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
    neutral: "text-[var(--color-text-tertiary)]",
  };

  const baseClass = `block w-full px-4 py-6 text-left md:px-6 md:py-8 ${
    active ? "ring-1 ring-inset ring-[var(--color-accent)]/30" : ""
  } ${className}`;

  const inner = (
    <>
      <p
        className={`text-[11px] font-medium uppercase tracking-[0.18em] transition-colors ${
          active
            ? "text-[var(--color-accent)]"
            : "text-[var(--color-text-tertiary)]"
        }`}
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-[-0.03em] md:text-3xl">
        {value}
      </p>
      {(sub || delta) && (
        <p className="mt-1 flex items-baseline gap-2 text-xs text-[var(--color-text-tertiary)]">
          {sub && <span>{sub}</span>}
          {delta && <span className={deltaClassMap[deltaColor]}>{delta}</span>}
        </p>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        {inner}
      </button>
    );
  }
  return <div className={baseClass}>{inner}</div>;
}
