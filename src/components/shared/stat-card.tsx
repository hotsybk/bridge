import type { ComponentType } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

/**
 * 대시보드 통계 카드 — Stripe / Linear 스타일.
 *
 *   <StatCard
 *     label="대기 중"
 *     value={12}
 *     unit="건"
 *     delta={{ value: 2, direction: "up", baselineLabel: "어제 대비" }}
 *     icon={Inbox}
 *   />
 *
 * 색상만으로 상태 표현 금지 — 항상 아이콘 + 텍스트 병행 (DESIGN_SYSTEM.md §2.3 접근성).
 */
export function StatCard({
  label,
  value,
  unit,
  delta,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  /** 큰 메인 숫자. string 도 허용 (예: "18시간"). */
  value: number | string;
  /** 단위 suffix (예: "건", "원", "%"). value 옆에 작게 표시. */
  unit?: string;
  /** 전기 대비 변동. direction up = 증가, down = 감소, flat = 변화 없음 */
  delta?: {
    value: number;
    direction: "up" | "down" | "flat";
    /** "어제 대비", "지난주 대비" 등 한 줄 컨텍스트 */
    baselineLabel?: string;
  };
  /** 좌측 작은 아이콘 (선택). */
  icon?: ComponentType<{ className?: string }>;
  /** delta 의 색상 의미. 일반적으로 증가가 좋은 의미면 "positive-up". */
  tone?: "neutral" | "positive-up" | "positive-down";
}) {
  const deltaColor =
    delta &&
    (() => {
      if (delta.direction === "flat") return "text-[var(--color-text-tertiary)]";
      const isPositive =
        (tone === "positive-up" && delta.direction === "up") ||
        (tone === "positive-down" && delta.direction === "down");
      const isNegative =
        (tone === "positive-up" && delta.direction === "down") ||
        (tone === "positive-down" && delta.direction === "up");
      if (isPositive) return "text-[var(--color-success)]";
      if (isNegative) return "text-[var(--color-error)]";
      return "text-[var(--color-text-secondary)]";
    })();

  return (
    <article className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-6 transition-shadow duration-300 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          {label}
        </p>
        {Icon && (
          <Icon className="h-4 w-4 text-[var(--color-text-tertiary)]" aria-hidden />
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tabular-nums tracking-tight">
          {value}
        </span>
        {unit && (
          <span className="text-base text-[var(--color-text-secondary)]">
            {unit}
          </span>
        )}
      </div>

      {delta && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {delta.direction === "up" && (
            <ArrowUp className={`h-3 w-3 ${deltaColor}`} aria-hidden />
          )}
          {delta.direction === "down" && (
            <ArrowDown className={`h-3 w-3 ${deltaColor}`} aria-hidden />
          )}
          <span className={`tabular-nums font-medium ${deltaColor}`}>
            {delta.direction === "flat"
              ? "변화 없음"
              : `${delta.value}${unit && unit !== "%" ? unit : delta.direction === "flat" ? "" : ""}`}
          </span>
          {delta.baselineLabel && (
            <span className="text-[var(--color-text-tertiary)]">
              {delta.baselineLabel}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
