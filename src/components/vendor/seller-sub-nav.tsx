"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Stethoscope } from "lucide-react";

import { NotificationPopover } from "./notification-popover";

/**
 * 파트너센터 (셀러센터) 글로벌 nav.
 *
 * 디자인 기준 (CatalogTopNav + CatalogNav 패턴 결합):
 *  - 좌: 로고 + "파트너센터" 라벨
 *  - 중: 4개 텍스트 탭. active 는 `border-b-2 border-accent` + accent 텍스트
 *  - 우: 알림 아이콘
 */

const ITEMS: Array<{
  href: string;
  label: string;
  matchPrefix?: string;
}> = [
  { href: "/seller/products", label: "상품" },
  { href: "/seller/orders", label: "주문" },
  { href: "/seller/subscriptions", label: "구독" },
  { href: "/seller/groupbuys", label: "공동구매" },
  { href: "/seller/rfq", label: "견적" },
  { href: "/seller/disputes", label: "분쟁" },
  { href: "/seller/settlement", label: "정산" },
  { href: "/seller/udi-reports", label: "UDI" },
  { href: "/seller/analytics", label: "분석" },
  { href: "/seller/profile", label: "프로필" },
  { href: "/seller/staff", label: "팀원" },
];

export function SellerSubNav() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLLIElement | null>(null);

  // Phase ξ-1 — 모바일에서 활성 탭이 자동으로 가시 영역 중앙으로 스크롤
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-stretch justify-between px-6 md:px-12">
        {/* Left — 로고 */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
            <Stethoscope className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            MedPlace
          </span>
          <span
            aria-hidden
            className="ml-2 hidden h-3 w-px bg-[var(--color-border-light)] md:inline-block"
          />
          <span className="hidden text-xs font-medium text-[var(--color-text-tertiary)] md:inline">
            파트너센터
          </span>
        </Link>

        {/* Center — 탭 (border-b accent 언더라인 패턴) */}
        <nav
          aria-label="파트너센터 메뉴"
          className="hidden flex-1 items-stretch justify-center md:flex"
        >
          <ul className="flex items-stretch">
            {ITEMS.map((item) => {
              const active = pathname.startsWith(item.matchPrefix ?? item.href);
              return (
                <li key={item.href} className="flex items-stretch">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center border-b-2 px-5 text-sm transition-colors ${
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

        {/* Right — 알림 popover */}
        <div className="flex shrink-0 items-center gap-1">
          <NotificationPopover />
        </div>
      </div>

      {/* 모바일 — 가로 스크롤 탭 띠 (언더라인 패턴 유지) */}
      <nav
        aria-label="파트너센터 메뉴 (모바일)"
        className="relative border-t border-[var(--color-border-light)] md:hidden"
      >
        <ul className="mx-auto flex max-w-7xl items-stretch gap-0 overflow-x-auto px-2 [&::-webkit-scrollbar]:hidden">
          {ITEMS.map((item) => {
            const active = pathname.startsWith(item.matchPrefix ?? item.href);
            return (
              <li
                key={item.href}
                ref={active ? activeRef : null}
                className="shrink-0"
              >
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center border-b-2 px-4 py-2.5 text-sm transition-colors ${
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
        {/* Right fade gradient — 가로 스크롤 가능 시각 단서 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--color-bg-primary)] to-transparent"
        />
      </nav>
    </header>
  );
}
