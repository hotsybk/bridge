"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, X } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { trpc } from "@/lib/trpc/client";

// Wave Q2 — 새 공동구매 캠페인 등록 form.

export const dynamic = "force-dynamic";

type TierRow = { minQty: string; price: string };

const todayISO = () => new Date().toISOString().slice(0, 10);
const futureISO = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export default function SellerGroupbuyNewPage() {
  const router = useRouter();
  const productsQuery = trpc.vendor.product.list.useQuery({
    pageSize: 50,
    status: "ACTIVE",
  });

  const [productId, setProductId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState(todayISO());
  const [endsAt, setEndsAt] = useState(futureISO(14));
  const [targetQty, setTargetQty] = useState("100");
  const [tiers, setTiers] = useState<TierRow[]>([
    { minQty: "100", price: "" },
    { minQty: "300", price: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const createMutation = trpc.vendor.groupbuy.create.useMutation({
    onSuccess: (res) => {
      showToast("캠페인이 생성되었습니다");
      setTimeout(() => router.push(`/seller/groupbuys/${res.groupBuyId}`), 600);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function addTier() {
    if (tiers.length >= 5) return;
    setTiers([...tiers, { minQty: "", price: "" }]);
  }

  function removeTier(index: number) {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== index));
  }

  function updateTier(index: number, key: keyof TierRow, val: string) {
    setTiers(tiers.map((t, i) => (i === index ? { ...t, [key]: val } : t)));
  }

  const products = productsQuery.data?.products ?? [];

  const canSubmit = useMemo(() => {
    if (!productId || !title.trim()) return false;
    if (!targetQty || Number(targetQty) <= 0) return false;
    if (new Date(endsAt) <= new Date(startsAt)) return false;
    const validTiers = tiers.filter(
      (t) => Number(t.minQty) > 0 && Number(t.price) > 0,
    );
    return validTiers.length >= 1;
  }, [productId, title, targetQty, startsAt, endsAt, tiers]);

  async function onSubmit() {
    setError(null);
    const validTiers = tiers
      .filter((t) => Number(t.minQty) > 0 && Number(t.price) > 0)
      .map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) }));
    if (validTiers.length === 0) {
      setError("가격 티어를 1개 이상 입력해주세요.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        productId,
        title: title.trim(),
        description: description.trim() || undefined,
        startsAt,
        endsAt,
        targetQty: Number(targetQty),
        tierPricing: validTiers,
      });
    } catch {
      // onError 에서 처리
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-16">
      <PageHeader
        label="파트너센터 · 공동구매"
        title="새 캠페인 만들기"
        description="목표 수량과 가격 티어를 정하면 마감 시각에 자동 결제됩니다."
      />

      <form
        className="mt-12 space-y-10"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void onSubmit();
        }}
      >
        {/* 상품 선택 */}
        <section className="space-y-3">
          <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            상품
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-11 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="">노출 중인 상품을 선택하세요</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · ₩{p.basePrice.toLocaleString()}/{p.unit}
              </option>
            ))}
          </select>
          {productsQuery.isPending && (
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              상품 목록을 불러오는 중…
            </p>
          )}
          {!productsQuery.isPending && products.length === 0 && (
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              노출 중(ACTIVE)인 상품이 없습니다. 먼저 상품을 등록·승인받으세요.
            </p>
          )}
        </section>

        {/* 제목 */}
        <section className="space-y-3">
          <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            캠페인 제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="예) 6월 라텍스 장갑 대량 공동구매"
            className="h-11 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </section>

        {/* 설명 */}
        <section className="space-y-3">
          <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            설명 <span className="normal-case text-[var(--color-text-tertiary)]">(선택)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="병원에게 안내할 캠페인 정보"
            className="w-full resize-none border-b border-[var(--color-border-light)] bg-transparent p-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </section>

        {/* 기간 + 목표 */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              시작일
            </label>
            <input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="h-11 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              마감일
            </label>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="h-11 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              목표 수량
            </label>
            <input
              type="number"
              min={1}
              value={targetQty}
              onChange={(e) => setTargetQty(e.target.value)}
              className="h-11 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
        </section>

        {/* 가격 티어 */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              가격 티어 (수량별 단가)
            </label>
            <button
              type="button"
              onClick={addTier}
              disabled={tiers.length >= 5}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline disabled:text-[var(--color-text-tertiary)] disabled:no-underline"
            >
              <Plus className="h-3 w-3" />
              티어 추가 ({tiers.length}/5)
            </button>
          </div>
          <div className="space-y-3">
            {tiers.map((t, i) => (
              <div
                key={i}
                className="flex items-end gap-3 border-b border-[var(--color-border-light)] pb-3 last:border-0"
              >
                <div className="flex-1">
                  <label className="block text-[10px] text-[var(--color-text-tertiary)]">
                    최소 수량
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={t.minQty}
                    onChange={(e) => updateTier(i, "minQty", e.target.value)}
                    placeholder="100"
                    className="mt-1 h-9 w-full border-0 bg-transparent text-sm tabular-nums focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-[var(--color-text-tertiary)]">
                    단가 (원)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={t.price}
                    onChange={(e) => updateTier(i, "price", e.target.value)}
                    placeholder="8000"
                    className="mt-1 h-9 w-full border-0 bg-transparent text-sm tabular-nums focus:outline-none"
                  />
                </div>
                {tiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTier(i)}
                    aria-label="티어 삭제"
                    className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-error)]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            예) 100개 ₩8,500 / 300개 ₩7,800 / 500개 ₩7,200. 수량이 많을수록 단가
            낮게 설정.
          </p>
        </section>

        {/* 에러 */}
        {error && (
          <div
            className="error-slide-down flex items-start gap-2 border-l-2 border-[var(--color-error)] pl-3 text-sm text-[var(--color-error)]"
            role="alert"
          >
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 액션 */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border-light)] pt-8">
          <button
            type="button"
            onClick={() => router.push("/seller/groupbuys")}
            className="h-10 rounded-full px-5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!canSubmit || createMutation.isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-text-tertiary)]"
          >
            {createMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            캠페인 생성
          </button>
        </div>
      </form>

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
