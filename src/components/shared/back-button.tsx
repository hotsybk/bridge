"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * 공용 뒤로가기 버튼 — Phase ν-4.
 *
 * 동작:
 *  - 페이지 진입 history 가 있으면 router.back()
 *  - 없으면 fallbackHref 로 push (직접 진입 / 새 탭 케이스)
 *
 * 디자인: 12px text-tertiary · hover text-primary · 좌측 화살표.
 */
export function BackButton({
  fallbackHref,
  label = "뒤로",
  className = "",
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:text-[var(--color-text-primary)] focus-visible:outline-none ${className}`}
    >
      <ArrowLeft className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}

/**
 * Server Component 친화적 fallback — JS off / hydrate 전에도 동작.
 * Link 형태로만 표시.
 */
export function BackLink({
  href,
  label = "뒤로",
  className = "",
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:text-[var(--color-text-primary)] focus-visible:outline-none ${className}`}
    >
      <ArrowLeft className="h-3 w-3" aria-hidden />
      {label}
    </Link>
  );
}
