import type { ReactNode } from "react";

/**
 * Apple 식 큰 여백 섹션 wrapper. DESIGN_SYSTEM.md §4.2 패딩 적용.
 *
 *   <Section size="lg" tone="secondary">
 *     <Container>...</Container>
 *   </Section>
 */
export function Section({
  size = "md",
  tone = "primary",
  id,
  className = "",
  children,
}: {
  /** "sm" 64px / "md" 96px / "lg" 128px 상하 패딩. */
  size?: "sm" | "md" | "lg";
  /** primary = bg-primary, secondary = bg-secondary 그레이 강조 */
  tone?: "primary" | "secondary";
  /** anchor 스크롤용 id (e.g. #features) */
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const paddingClass = {
    sm: "py-16",
    md: "py-24",
    lg: "py-24 md:py-32",
  }[size];

  const toneClass =
    tone === "secondary"
      ? "bg-[var(--color-bg-secondary)]"
      : "bg-[var(--color-bg-primary)]";

  return (
    <section
      id={id}
      className={`${paddingClass} ${toneClass} scroll-mt-24 ${className}`.trim()}
    >
      {children}
    </section>
  );
}

/**
 * 페이지 내 최대 폭 컨테이너 — DESIGN_SYSTEM.md §4.1.
 *
 *   <Container size="wide">...</Container>
 */
export function Container({
  size = "wide",
  className = "",
  children,
}: {
  /** narrow=980 / wide=1280 / full=1440 */
  size?: "narrow" | "wide" | "full";
  className?: string;
  children: ReactNode;
}) {
  const maxClass = {
    narrow: "max-w-[980px]",
    wide: "max-w-6xl",
    full: "max-w-[1440px]",
  }[size];

  return (
    <div className={`mx-auto ${maxClass} px-6 md:px-12 ${className}`.trim()}>
      {children}
    </div>
  );
}
