"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import { TopNavAuthArea } from "@/components/marketing/auth-aware-cta";

/**
 * 마케팅 페이지 공통 TopNav — Phase δ-1 / 리디자인 v2.
 *
 * 디자인 DNA (Stripe·Linear·Vercel 패턴):
 *  - 워드마크: 아이콘 박스 제거 → 텍스트만 + accent dot (brand identity 최소화)
 *  - 모든 nav item 단일 톤 (chip 배경·outline 제거) — plain text + hover 색 변화만
 *  - 회원가입만 단일 강조 (작은 filled, h-8)
 *  - sticky / backdrop-blur / 라인 only
 *  - 데스크탑: 가로 nav
 *  - 모바일(`md:` 이하): 햄버거 → 풀스크린 dropdown
 *
 * Props:
 *  - `showAuthCta`: 랜딩처럼 로그인 상태에 따라 "내 작업공간"으로 전환되는 CTA 표시
 *  - `customCtaSlot`: 랜딩 전용 추가 nav item (쇼핑·파트너센터 등)
 */

type Active = "home" | "about" | "pricing" | "support";

const NAV_ITEMS: Array<{ key: Active; href: string; label: string }> = [
  { key: "about", href: "/about", label: "소개" },
  { key: "pricing", href: "/pricing", label: "수수료" },
  { key: "support", href: "/support", label: "지원" },
];

// 일관된 nav item 스타일 — 모든 항목 동일 톤
const navItemBase =
  "relative inline-flex items-center px-3 py-2 text-[13px] tracking-tight transition-colors";
const navItemInactive =
  "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]";
const navItemActive = "text-[var(--color-text-primary)] font-medium";

export function MarketingNav({
  active,
  showAuthCta = false,
  customCtaSlot,
}: {
  active?: Active;
  /** true 면 우측에 AuthAware "로그인/회원가입 ↔ 로그아웃/내 작업공간" 전환 CTA 표시 (랜딩 전용) */
  showAuthCta?: boolean;
  /** 데스크탑 nav 안에 추가 nav item (쇼핑·파트너센터 등) — 랜딩 전용 */
  customCtaSlot?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // 모바일 메뉴 열림 상태에서 body scroll 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 isolate border-b border-[var(--color-border-light)]/70 bg-[var(--color-bg-primary)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 md:h-16 md:px-12">
          {/* 워드마크 — 아이콘 박스 제거, 텍스트 + accent dot */}
          <Link
            href="/"
            className="group inline-flex items-center gap-2"
            onClick={() => setOpen(false)}
            aria-label="MedPlace 홈"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] transition-transform group-hover:scale-125"
            />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">
              MedPlace
            </span>
          </Link>

          {/* 데스크탑 nav — 모든 항목 동일 톤 */}
          <nav
            aria-label="메인 메뉴"
            className="hidden items-center gap-0.5 md:flex"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`${navItemBase} ${
                  active === item.key ? navItemActive : navItemInactive
                }`}
              >
                {item.label}
                {active === item.key && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-1 left-3 right-3 h-px bg-[var(--color-accent)]"
                  />
                )}
              </Link>
            ))}
            {customCtaSlot}

            {/* divider — nav item ↔ auth area 시각 구분 */}
            <span
              aria-hidden
              className="mx-3 h-4 w-px bg-[var(--color-border-light)]"
            />

            {showAuthCta ? (
              <TopNavAuthArea
                ghostClassName={`${navItemBase} ${navItemInactive}`}
                primaryClassName="ml-1 inline-flex h-8 items-center rounded-full bg-[var(--color-text-primary)] px-4 text-[13px] font-medium text-[var(--color-bg-primary)] transition-opacity hover:opacity-90"
              />
            ) : (
              <>
                <Link
                  href="/login"
                  className={`${navItemBase} ${navItemInactive}`}
                >
                  로그인
                </Link>
                <Link
                  href="/register"
                  className="ml-1 inline-flex h-8 items-center rounded-full bg-[var(--color-text-primary)] px-4 text-[13px] font-medium text-[var(--color-bg-primary)] transition-opacity hover:opacity-90"
                >
                  시작하기
                </Link>
              </>
            )}
          </nav>

          {/* 모바일 햄버거 */}
          <button
            type="button"
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center -mr-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* 모바일 풀스크린 dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="모바일 메뉴"
          className="fixed inset-x-0 top-14 z-20 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)] md:hidden"
        >
          <nav
            aria-label="메인 메뉴 (모바일)"
            className="mx-auto flex max-w-7xl flex-col divide-y divide-[var(--color-border-light)] px-6"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between py-4 text-base transition-colors ${
                  active === item.key
                    ? "font-medium text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                <span>{item.label}</span>
                {active === item.key && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
                  />
                )}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="py-4 text-base text-[var(--color-text-secondary)]"
            >
              로그인
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="py-4 text-base font-medium text-[var(--color-text-primary)]"
            >
              시작하기 →
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
