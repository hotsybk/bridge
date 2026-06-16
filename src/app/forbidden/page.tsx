import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Lock, Stethoscope } from "lucide-react";

import { ForbiddenReasonHint } from "./reason-hint";

export const metadata: Metadata = {
  title: "권한 없음",
  description: "현재 계정으로는 이 페이지에 접근할 수 없습니다.",
  robots: { index: false, follow: false },
};

/**
 * Phase ν-2 — /forbidden 페이지.
 *
 * proxy.ts 의 role mismatch · 권한 부족 시 redirect 대상.
 *  - ?reason=role  — 역할 가드 실패 (need=ADMIN 등 추가 안내)
 *  - ?reason=auth  — 인증 필요 (비로그인 보호 페이지)
 *  - ?reason=expired — 세션 만료
 *
 * 디자인: 라인 only, error.tsx 톤 (메쉬·아이콘·CTA).
 */
export default function ForbiddenPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      {/* 미세 메쉬 배경 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <svg
          viewBox="0 0 800 600"
          className="pointer-events-none absolute -right-32 -top-20 hidden h-[600px] w-[800px] opacity-50 md:block"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="fb-mesh-a" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0066CC" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0066CC" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="500" cy="200" r="220" fill="url(#fb-mesh-a)" />
        </svg>
      </div>

      <header className="mx-auto max-w-7xl px-6 pt-10 md:px-12">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">MedPlace</span>
        </Link>
      </header>

      <section
        className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-20 text-center md:px-12 md:pt-32"
        style={{ paddingBottom: "max(6rem, env(safe-area-inset-bottom))" }}
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-warning)]/12 px-3 py-1 text-xs font-medium text-[var(--color-warning)]">
          <Lock className="h-3.5 w-3.5" />
          접근 권한 부족
        </span>

        <h1 className="mt-6 break-keep text-4xl font-semibold leading-[1.1] tracking-[-0.035em] md:text-5xl">
          이 페이지에는
          <br />
          <span className="text-[var(--color-accent)]">접근할 수 없습니다.</span>
        </h1>

        <Suspense fallback={null}>
          <ForbiddenReasonHint />
        </Suspense>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            홈으로
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-full border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-7 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            다른 계정으로 로그인
          </Link>
        </div>
      </section>
    </main>
  );
}
