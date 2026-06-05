"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Package, Terminal, Wallet } from "lucide-react";
import type { ComponentType } from "react";

/**
 * 운영자 콘솔 공통 서브 nav.
 */

const ITEMS: Array<{
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  matchPrefix?: string;
}> = [
  { href: "/admin/vendors", label: "입점 심사", icon: Building2 },
  { href: "/admin/products", label: "상품 관리", icon: Package },
  { href: "/admin/settlement", label: "정산 관리", icon: Wallet },
  { href: "/admin/debug/snapshot", label: "디버그", icon: Terminal },
];

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="운영자 메뉴"
      className="sticky top-0 z-20 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-6 py-2 md:px-12 [&::-webkit-scrollbar]:hidden">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.matchPrefix ?? item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm transition-colors ${
                active
                  ? "bg-[var(--color-text-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
