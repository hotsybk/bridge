import Link from "next/link";
import { ShoppingBag, Stethoscope } from "lucide-react";

import { CatalogSearch } from "./catalog-search";

/**
 * Apple 글로벌 nav 패턴 — 좌측 워드마크 · 중앙 텍스트 메뉴 · 우측 검색·장바구니 아이콘.
 *
 * 큰 검색 input 제거, 텍스트 메뉴 위주 + 검색은 아이콘 클릭 시 펼침.
 */
export function CatalogTopNav({
  initialQ = "",
}: {
  initialQ?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 md:px-12">
        {/* Left — 워드마크 */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
            <Stethoscope className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            MedPlace
          </span>
        </Link>

        {/* Center — 텍스트 메뉴 (Apple 글로벌 nav 패턴) */}
        <nav
          aria-label="주요 메뉴"
          className="hidden flex-1 items-center justify-center md:flex"
        >
          <ul className="flex items-center">
            <NavLink href="/search">둘러보기</NavLink>
            <NavLink href="/about">소개</NavLink>
            <NavLink href="/pricing">수수료</NavLink>
            <NavLink href="/cart">장바구니</NavLink>
            <NavLink href="/orders">주문 이력</NavLink>
          </ul>
        </nav>

        {/* Right — 검색 + 카트 아이콘 */}
        <div className="flex shrink-0 items-center gap-1">
          <CatalogSearch initialQ={initialQ} />
          <Link
            href="/cart"
            aria-label="장바구니"
            className="grid h-10 w-10 place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <ShoppingBag className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* 모바일에서는 두 번째 줄 메뉴 제거 — 아래 CatalogNav (카테고리 가로 띠) 와
          중복되지 않도록. 사용자 메뉴 (소개·수수료·장바구니·주문 이력) 는 데스크탑 nav 에만. */}
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="inline-flex h-10 items-center rounded-full px-4 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        {children}
      </Link>
    </li>
  );
}

