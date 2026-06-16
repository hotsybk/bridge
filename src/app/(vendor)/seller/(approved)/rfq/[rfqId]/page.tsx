"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, X } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { trpc } from "@/lib/trpc/client";

// Wave Q2 — RFQ 상세 + 견적 제출 form.

export const dynamic = "force-dynamic";

function tsToMillis(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "object" && v !== null) {
    const o = v as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === "function") return o.toMillis();
    if (typeof o.seconds === "number") return o.seconds * 1000;
  }
  return 0;
}

function tsToDateStr(v: unknown): string {
  const ms = tsToMillis(v);
  return ms ? new Date(ms).toISOString().slice(0, 10) : "—";
}

const futureISO = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export default function SellerRfqDetailPage() {
  const params = useParams<{ rfqId: string }>();
  const rfqId = params.rfqId;

  const detailQuery = trpc.vendor.rfq.getById.useQuery(
    { rfqId },
    { enabled: !rfqId.startsWith("demo-") && !rfqId.startsWith("preview-") },
  );

  const utils = trpc.useUtils();
  const submitMutation = trpc.vendor.rfq.submitQuote.useMutation({
    onSuccess: (res) => {
      void utils.vendor.rfq.getById.invalidate({ rfqId });
      void utils.vendor.rfq.list.invalidate();
      showToast(res.isNew ? "견적이 제출되었습니다" : "견적이 갱신되었습니다");
    },
    onError: (err) => setError(err.message),
  });

  const usePreview =
    rfqId.startsWith("demo-") ||
    rfqId.startsWith("preview-") ||
    (!detailQuery.isPending &&
      (detailQuery.error !== null || !detailQuery.data));

  const PREVIEW_DATA = {
    id: rfqId,
    title: "치과용 임플란트 식립 키트 200세트",
    description:
      "분기 정기 구매. SLA 활성처리(Class 2). 인증서 동봉, KGMP 필수.",
    category: "치과 재료",
    spec: "스테인레스 스틸 · 일회용 · 멸균 포장 · KFDA 인증 필수",
    qty: 200,
    unit: "SET",
    deadline: { seconds: Math.floor((Date.now() + 10 * 86400000) / 1000) },
    hospitalName: "서울 명동 가정의학과",
    quoteCount: 3,
    status: "OPEN" as const,
    myQuote: null,
  };

  const data = usePreview ? PREVIEW_DATA : detailQuery.data;

  const [unitPrice, setUnitPrice] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(futureISO(14));
  const [validUntil, setValidUntil] = useState(futureISO(30));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 기존 견적 prefill
  useEffect(() => {
    const myQuote = (data as { myQuote?: Record<string, unknown> })?.myQuote;
    if (myQuote && !unitPrice) {
      setUnitPrice(String(myQuote.unitPrice ?? ""));
      const d = tsToDateStr(myQuote.deliveryDate);
      if (d !== "—") setDeliveryDate(d);
      const v = tsToDateStr(myQuote.validUntil);
      if (v !== "—") setValidUntil(v);
      setNote(String(myQuote.note ?? ""));
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  const totalPrice = useMemo(() => {
    const u = Number(unitPrice);
    const q = (data as { qty?: number })?.qty ?? 0;
    return u > 0 && q > 0 ? u * q : 0;
  }, [unitPrice, data]);

  const canSubmit =
    Number(unitPrice) > 0 &&
    totalPrice > 0 &&
    !!deliveryDate &&
    !!validUntil &&
    !usePreview &&
    data?.status === "OPEN";

  async function onSubmit() {
    setError(null);
    try {
      await submitMutation.mutateAsync({
        rfqId,
        unitPrice: Number(unitPrice),
        totalPrice,
        deliveryDate,
        validUntil,
        note: note.trim() || undefined,
      });
    } catch {
      // onError 에서 처리
    }
  }

  if (detailQuery.isPending && !usePreview) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-6">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-text-tertiary)]" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-16">
        <PageHeader
          label="파트너센터 · 견적 요청"
          title="견적 요청을 찾을 수 없습니다"
        />
        <Link
          href="/seller/rfq"
          className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          요청 목록으로
        </Link>
      </main>
    );
  }

  const deadlineMs = tsToMillis(data.deadline);
  const daysLeft = deadlineMs
    ? Math.ceil((deadlineMs - Date.now()) / 86400000)
    : 0;
  const hasMyQuote = !!(data as { myQuote?: unknown }).myQuote;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
      <Link
        href="/seller/rfq"
        className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
      >
        <ArrowLeft className="h-3 w-3" />
        요청 목록
      </Link>

      <PageHeader
        label={`파트너센터 · 견적 요청 · ${data.status === "OPEN" ? `D−${Math.max(0, daysLeft)}` : data.status}`}
        title={data.title ?? "—"}
        description={(data as { description?: string }).description}
      />

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_360px]">
        {/* 좌측 — RFQ 정보 */}
        <section className="space-y-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              요청 정보
            </p>
            <dl className="mt-4 divide-y divide-[var(--color-border-light)] text-sm">
              <RowDef
                term="병원"
                def={(data as { hospitalName?: string }).hospitalName ?? "—"}
              />
              <RowDef
                term="카테고리"
                def={(data as { category?: string }).category ?? "—"}
              />
              <RowDef
                term="수량"
                def={`${((data as { qty?: number }).qty ?? 0).toLocaleString()} ${(data as { unit?: string }).unit ?? "EA"}`}
              />
              <RowDef term="마감일" def={tsToDateStr(data.deadline)} />
              <RowDef
                term="경쟁 견적"
                def={`${(data as { quoteCount?: number }).quoteCount ?? 0}건`}
              />
            </dl>
          </div>

          {(data as { spec?: string }).spec && (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                상품 스펙
              </p>
              <p className="mt-3 whitespace-pre-line text-sm text-[var(--color-text-secondary)]">
                {(data as { spec?: string }).spec}
              </p>
            </div>
          )}
        </section>

        {/* 우측 — 견적 제출 */}
        <aside className="space-y-6 border-l border-[var(--color-border-light)] pl-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {hasMyQuote ? "내 견적 (수정)" : "견적 제출"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
              {hasMyQuote ? "기존 견적 갱신" : "새 견적 작성"}
            </h2>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) void onSubmit();
            }}
          >
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                단가 (원)
              </label>
              <input
                type="number"
                min={1}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0"
                className="mt-2 h-10 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between border-y border-[var(--color-border-light)] py-3">
              <span className="text-xs text-[var(--color-text-secondary)]">
                총액 ({((data as { qty?: number }).qty ?? 0).toLocaleString()}{" "}
                {(data as { unit?: string }).unit ?? "EA"})
              </span>
              <span className="text-base font-semibold tabular-nums">
                ₩{totalPrice.toLocaleString()}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                납기 예정일
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="mt-2 h-10 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                견적 유효 기한
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-2 h-10 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                비고 <span className="normal-case text-[var(--color-text-tertiary)]">(선택)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="배송 조건·할인·특이사항"
                className="mt-2 w-full resize-none border-b border-[var(--color-border-light)] bg-transparent p-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>

            {error && (
              <div
                className="error-slide-down flex items-start gap-2 border-l-2 border-[var(--color-error)] pl-3 text-xs text-[var(--color-error)]"
                role="alert"
              >
                <X className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {usePreview && (
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                ※ 미리보기 데이터에는 견적을 제출할 수 없습니다.
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitMutation.isPending}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-text-tertiary)]"
            >
              {submitMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {hasMyQuote ? "견적 갱신" : "견적 제출"}
            </button>
          </form>
        </aside>
      </div>

      {toast && (
        <div
          role="status"
          className="toast-slide-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-text-primary)] px-5 py-3 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </main>
  );
}

function RowDef({ term, def }: { term: string; def: string }) {
  return (
    <div className="flex justify-between py-2.5">
      <dt className="text-[var(--color-text-secondary)]">{term}</dt>
      <dd className="font-medium">{def}</dd>
    </div>
  );
}
