import type { ReactNode } from "react";

/**
 * 글래스모피즘 카드 — 메인 페이지 리뉴얼 합의 명세 §4.2.
 *
 *   <GlassCard intensity="md" hover>
 *     ...
 *   </GlassCard>
 *
 * 헌법 §1.2 준수:
 * - backdrop-blur 강도 `sm` 또는 `md` 까지만 (`xl` 금지)
 * - 알파 채널 85% (가독성 우선)
 * - border + shadow 조합 강도 제한 (진한 그림자+테두리 동시 금지)
 */
export function GlassCard({
  intensity = "md",
  hover = false,
  className = "",
  children,
  as: As = "div",
}: {
  /** "sm" 8px blur / "md" 16px blur. xl 이상 금지 */
  intensity?: "sm" | "md";
  /** hover 시 미세 lift + shadow 증가 */
  hover?: boolean;
  className?: string;
  children: ReactNode;
  /** 태그 변경 (article/section 등) */
  as?: "div" | "article" | "section" | "aside";
}) {
  const blurClass = intensity === "sm" ? "backdrop-blur-sm" : "backdrop-blur-md";

  return (
    <As
      className={[
        "relative rounded-3xl border",
        blurClass,
        "border-[var(--color-glass-border)]",
        "bg-[var(--color-glass-bg-light)]",
        "shadow-[var(--shadow-glass)]",
        hover &&
          "transition-all duration-300 hover:shadow-[var(--shadow-glass-hover)] hover:-translate-y-0.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </As>
  );
}
