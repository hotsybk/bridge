"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Package, Search, ShoppingBag, User } from "lucide-react";

/**
 * Phase ξ-1 — 구매자 모바일 글로벌 탭 바.
 *
 * - 5탭: 탐색 · 장바구니 · 주문 · 알림 · 계정
 * - md 이상 숨김 (데스크탑은 CatalogTopNav 등 상단 nav 사용)
 * - safe-area-inset-bottom 보정
 * - 체크아웃 경로에서는 숨김 (구매 완료 동선 방해 방지)
 */

const TABS = [
  { href: "/search", label: "탐색", icon: Search },
  { href: "/cart", label: "장바구니", icon: ShoppingBag },
  { href: "/orders", label: "주문", icon: Package },
  { href: "/notifications", label: "알림", icon: Bell },
  { href: "/account", label: "계정", icon: User },
];

export function MobileBottomTabBar() {
  const pathname = usePathname() ?? "/";

  // 체크아웃·결제 결과 경로에서는 숨김
  if (pathname.startsWith("/checkout")) return null;

  return (
    <nav
      aria-label="모바일 메뉴"
      className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                  active
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text-tertiary)]"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
