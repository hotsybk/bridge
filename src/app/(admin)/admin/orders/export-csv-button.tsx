"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { app } from "@/lib/firebase/client";

/**
 * 운영자 — 주문 CSV export 버튼.
 *
 * Cloud Function `exportOrdersCsv` 를 HTTPS Callable 로 호출.
 * 응답 signed URL 로 즉시 navigate (브라우저가 다운로드 시작).
 *
 * PREVIEW_MODE (비로그인 dev) 에서는 functions 호출이 permission-denied 로 실패할 것이므로
 * try/catch 후 alert 만 띄움.
 */
export function ExportCsvButton({ status }: { status?: string }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      // 동적 import 로 client bundle 분할
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const functions = getFunctions(app, "asia-northeast3");
      const fn = httpsCallable<
        { status?: string },
        { url: string; filename: string; rowCount: number }
      >(functions, "exportOrdersCsv");
      const { data } = await fn({ status });
      // 다운로드 시작
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`CSV 내보내기 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-border-light)] px-4 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {loading ? "내보내는 중…" : "CSV 내보내기"}
    </button>
  );
}
