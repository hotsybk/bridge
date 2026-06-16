"use client";

// Phase ν-1 — seller (approved) route group error boundary.
// SellerSubNav 는 상위 layout 에서 보존됨.

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";

export default function SellerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SellerError]", error);
    void import("@sentry/nextjs")
      .then(({ captureException }) => {
        try {
          captureException(error);
        } catch {
          // ignore
        }
      })
      .catch(() => undefined);
  }, [error]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-md text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-error)]/10 px-3 py-1 text-xs font-medium text-[var(--color-error)]">
          <AlertCircle className="h-3.5 w-3.5" />
          페이지 오류
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          페이지를 불러올 수 없습니다
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          셀러센터 데이터를 불러오는 중 오류가 발생했습니다.
          다시 시도하거나 셀러센터 홈으로 돌아가 주세요.
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-xs text-[var(--color-text-tertiary)]">
            오류 코드: {error.digest}
          </p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </button>
          <Link
            href="/seller/products"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            셀러센터 홈
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
