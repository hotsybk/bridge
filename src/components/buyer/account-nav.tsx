"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * /account 좌측 sub-nav (sticky, md+).
 *
 * 디자인 DNA:
 *  - 박스 없음. 라벨 list + active 시 좌측 vertical accent line(3px) + accent text
 *  - 비활성: secondary text · hover primary
 *  - 모바일: 가로 underline tab strip
 *  - 추후 항목(placeholder)은 muted + 우측 "예정" micro 라벨
 */

type Item = {
  href: string;
  label: string;
  exact?: boolean;
  soon?: boolean;
};

const ITEMS: Item[] = [
  { href: "/account", label: "프로필", exact: true },
  { href: "/account/addresses", label: "배송지" },
  { href: "/account/billing", label: "결제 수단" },
  { href: "/account/team", label: "팀원" },
  { href: "/account/approvals", label: "결재 대기" },
  { href: "/disputes", label: "분쟁" },
];

const PLACEHOLDER_ITEMS: Item[] = [
  { href: "#", label: "알림 설정", soon: true },
];

function isActive(pathname: string, item: Item): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AccountNav() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLLIElement | null>(null);

  // Phase ξ-4 — mobile horizontal tab strip의 active item을 자동 scroll into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [pathname]);

  return (
    <>
      {/* Desktop — 세로 라벨 list with left ink-bar */}
      <nav
        aria-label="계정 메뉴"
        className="hidden lg:block"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
          Account
        </p>
        <ul className="mt-6 space-y-0.5">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center py-2.5 pl-4 text-sm transition-colors ${
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-accent)]"
                    />
                  )}
                  <span className={active ? "font-medium" : ""}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
          Coming Soon
        </p>
        <ul className="mt-6 space-y-0.5">
          {PLACEHOLDER_ITEMS.map((item) => (
            <li key={item.label}>
              <span className="flex items-center justify-between py-2.5 pl-4 text-sm text-[var(--color-text-tertiary)]/70">
                <span>{item.label}</span>
                <span className="text-[11px] uppercase tracking-[0.15em]">
                  Phase 2+
                </span>
              </span>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile — 가로 underline tab strip */}
      <nav
        aria-label="계정 메뉴 (모바일)"
        className="lg:hidden -mx-6 border-y border-[var(--color-border-light)] md:-mx-12"
      >
        <ul className="flex items-stretch overflow-x-auto px-6 md:px-12 [&::-webkit-scrollbar]:hidden">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li
                key={item.href}
                ref={active ? activeRef : null}
                className="shrink-0"
              >
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center border-b-2 px-4 py-3 text-sm transition-colors ${
                    active
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
