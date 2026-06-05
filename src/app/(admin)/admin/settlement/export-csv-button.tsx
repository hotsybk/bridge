"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { app } from "@/lib/firebase/client";

/**
 * Phase γ-2 — 운영자 settlement CSV export 버튼.
 *
 * Cloud Function `exportSettlements` 를 HTTPS Callable 로 호출.
 * 응답 csv 문자열을 Blob 으로 변환 → a tag 클릭으로 다운로드.
 */
export function SettlementExportCsvButton({
  status,
}: {
  status?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const { getFunctions, httpsCallable } = await import(
        "firebase/functions"
      );
      const functions = getFunctions(app, "asia-northeast3");
      const fn = httpsCallable<
        {
          fromDate?: string;
          toDate?: string;
          status?: string;
          vendorId?: string;
        },
        { csv: string; count: number }
      >(functions, "exportSettlements");
      const { data } = await fn({ status });

      // Blob 다운로드
      const blob = new Blob([data.csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `settlements_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${data.count}건의 정산 데이터를 내보냈습니다.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`CSV 내보내기 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="ml-auto inline-flex h-8 items-center gap-2 rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Download className="h-3 w-3" />
      )}
      {loading ? "내보내는 중…" : "CSV 내보내기"}
    </button>
  );
}
