"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, ArrowRight, RefreshCw, Stethoscope } from "lucide-react";

/**
 * 전역 error boundary. Next.js App Router 패턴 — error.tsx + reset().
 * Phase ν-2 — Sentry capture + mobile safe-area.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GlobalError:", error);
    // Sentry — DSN 미설정 환경에서는 init skip 되어 no-op.
    void import("@sentry/nextjs")
      .then(({ captureException }) => {
        try {
          captureException(error);
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // sentry not installed or build artifact missing — silent
      });
  }, [error]);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <header className="mx-auto max-w-6xl px-6 pt-10 md:px-12">
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
        <span className="landing-fade-up inline-flex items-center gap-2 rounded-full bg-[var(--color-error)]/12 px-3 py-1 text-xs font-medium text-[var(--color-error)]">
          <AlertTriangle className="h-3.5 w-3.5" />
          예상치 못한 오류
        </span>

        <h1
          className="landing-fade-up mt-6 break-keep text-3xl font-semibold leading-[1.1] tracking-[-0.035em] md:text-5xl"
          style={{ animationDelay: "120ms" }}
        >
          잠시{" "}
          <span className="text-[var(--color-accent)]">문제가 생겼습니다.</span>
        </h1>

        <p
          className="landing-fade-up mt-6 max-w-md break-keep text-sm leading-relaxed text-[var(--color-text-secondary)] md:mt-7"
          style={{ animationDelay: "260ms" }}
        >
          페이지를 불러오는 중 오류가 발생했습니다.
          다시 시도하거나 홈에서 이어가 주세요.
        </p>

        {error.digest && (
          <p
            className="landing-fade-up mt-4 font-mono text-xs text-[var(--color-text-tertiary)]"
            style={{ animationDelay: "320ms" }}
          >
            오류 코드: {error.digest}
          </p>
        )}

        <div
          className="landing-fade-up mt-10 flex w-full max-w-sm flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center"
          style={{ animationDelay: "400ms" }}
        >
          <button
            type="button"
            onClick={reset}
            className="landing-cta-glow inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-medium text-white"
          >
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            홈으로
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
