import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * 공용 Breadcrumb — Phase ν-4.
 *
 * 디자인 DNA:
 *  - 박스 없음. inline · 12px (text-xs) · text-tertiary
 *  - 구분자: ChevronRight (h-3 w-3) text-tertiary/50
 *  - href 없는 마지막 항목은 `aria-current="page"` + text-secondary
 *  - 호버: text-primary
 *
 * 사용 예:
 *   <Breadcrumb items={[
 *     { label: "운영", href: "/admin" },
 *     { label: "분쟁", href: "/admin/disputes" },
 *     { label: "#abc12" },
 *   ]} />
 */
export type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
};

export function Breadcrumb({
  items,
  className = "",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <nav
      aria-label="현재 위치"
      className={`flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] ${className}`}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <ChevronRight
                aria-hidden
                className="h-3 w-3 shrink-0 text-[var(--color-text-tertiary)]/60"
              />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="rounded transition-colors hover:text-[var(--color-text-primary)] focus-visible:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={
                  isLast
                    ? "text-[var(--color-text-secondary)]"
                    : "text-[var(--color-text-tertiary)]"
                }
              >
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
