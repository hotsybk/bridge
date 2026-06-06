"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { trpc } from "@/lib/trpc/client";

/**
 * Phase Φ-C 작업2 — buyer RFQ(견적 요청) 생성 폼 (/rfq/new).
 *
 * 제목 + 카테고리 + 품목 리스트(이름·수량·사양 동적 추가) + 마감일 + 희망납기 + 비고.
 * 제출 → rfq.create → /rfq/[id] 리다이렉트.
 *
 * 디자인 DNA: 박스 없음, 라인 only, inputMode/autoComplete (모바일).
 */

type ItemRow = { id: string; name: string; qty: string; spec: string };

let rowSeq = 0;
function newRow(): ItemRow {
  rowSeq += 1;
  return { id: `row-${rowSeq}`, name: "", qty: "1", spec: "" };
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function RfqNewPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [items, setItems] = useState<ItemRow[]>([newRow()]);
  const [deadline, setDeadline] = useState(todayPlus(7));
  const [deliveryDate, setDeliveryDate] = useState("");
  const [note, setNote] = useState("");

  // 카테고리 옵션 (대분류) — 있으면 표시, 없으면 입력 생략 가능.
  const { data: catData } = trpc.product.categories.useQuery(undefined, {
    retry: false,
  });

  const create = trpc.rfq.create.useMutation({
    onSuccess: (res) => {
      toast.success("견적 요청이 등록되었습니다.");
      router.push(`/rfq/${res.rfqId}`);
    },
    onError: (err) => {
      toast.error(err.message || "견적 요청 등록에 실패했습니다.");
    },
  });

  function updateItem(id: string, patch: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }
  function addItem() {
    setItems((prev) => [...prev, newRow()]);
  }
  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  const validItems = items.filter(
    (it) => it.name.trim().length > 0 && Number(it.qty) > 0,
  );
  const canSubmit =
    title.trim().length >= 2 && validItems.length >= 1 && deadline !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || create.isPending) return;
    create.mutate({
      title: title.trim(),
      categoryId: categoryId || undefined,
      items: validItems.map((it) => ({
        name: it.name.trim(),
        qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
        spec: it.spec.trim() || undefined,
      })),
      deadline,
      deliveryDate: deliveryDate || undefined,
      note: note.trim() || undefined,
    });
  }

  const categories = Array.isArray(catData)
    ? (catData as Array<{ id: string; name: string; depth?: number }>).filter(
        (c) => (c.depth ?? 1) === 1,
      )
    : [];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-16">
        <Link
          href="/rfq"
          className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          견적 요청 목록
        </Link>

        <header className="mt-8">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            New RFQ
          </p>
          <h1 className="mt-3 break-keep text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
            새 견적 요청
          </h1>
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            품목과 수량을 입력하면 적격 공급사에 동시 발송됩니다. 마감일까지 받은
            견적을 한 화면에서 비교할 수 있습니다.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-12 space-y-12">
          {/* 제목 */}
          <div>
            <label
              htmlFor="rfq-title"
              className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]"
            >
              제목 *
            </label>
            <input
              id="rfq-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 수술용 멸균 장갑 (L) 월 500BOX"
              maxLength={100}
              autoComplete="off"
              className="mt-3 h-12 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
            />
          </div>

          {/* 카테고리 (옵션) */}
          {categories.length > 0 && (
            <div>
              <label
                htmlFor="rfq-category"
                className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]"
              >
                카테고리
              </label>
              <select
                id="rfq-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-3 h-12 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              >
                <option value="">— 선택 안 함 —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">
                카테고리를 지정하면 해당 분야 공급사에게 알림이 전송됩니다.
              </p>
            </div>
          )}

          {/* 품목 리스트 */}
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                품목 *
              </p>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                품목 추가
              </button>
            </div>

            <ul className="mt-5 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              {items.map((it, idx) => (
                <li key={it.id} className="py-5">
                  <div className="grid gap-3 md:grid-cols-[1fr_120px_auto] md:items-end md:gap-4">
                    <div>
                      <label
                        htmlFor={`item-name-${it.id}`}
                        className="text-[11px] text-[var(--color-text-tertiary)]"
                      >
                        품목명 {idx + 1}
                      </label>
                      <input
                        id={`item-name-${it.id}`}
                        type="text"
                        value={it.name}
                        onChange={(e) =>
                          updateItem(it.id, { name: e.target.value })
                        }
                        placeholder="품목명"
                        autoComplete="off"
                        className="mt-1.5 h-11 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`item-qty-${it.id}`}
                        className="text-[11px] text-[var(--color-text-tertiary)]"
                      >
                        수량
                      </label>
                      <input
                        id={`item-qty-${it.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={it.qty}
                        onChange={(e) =>
                          updateItem(it.id, { qty: e.target.value })
                        }
                        className="mt-1.5 h-11 w-full border-b border-[var(--color-border-light)] bg-transparent text-right font-mono text-sm tabular-nums outline-none transition-colors focus:border-[var(--color-accent)]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      disabled={items.length <= 1}
                      aria-label="품목 삭제"
                      className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-error)] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={it.spec}
                    onChange={(e) =>
                      updateItem(it.id, { spec: e.target.value })
                    }
                    placeholder="사양 (선택) — 예: 라텍스 free / L 사이즈"
                    autoComplete="off"
                    className="mt-3 h-10 w-full border-b border-[var(--color-border-light)] bg-transparent text-xs outline-none transition-colors focus:border-[var(--color-accent)]"
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* 마감일 + 희망납기 */}
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <label
                htmlFor="rfq-deadline"
                className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]"
              >
                견적 마감일 *
              </label>
              <input
                id="rfq-deadline"
                type="date"
                value={deadline}
                min={todayPlus(1)}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-3 h-12 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label
                htmlFor="rfq-delivery"
                className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]"
              >
                희망 납기 (선택)
              </label>
              <input
                id="rfq-delivery"
                type="date"
                value={deliveryDate}
                min={todayPlus(1)}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="mt-3 h-12 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              />
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label
              htmlFor="rfq-note"
              className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]"
            >
              비고 (선택)
            </label>
            <textarea
              id="rfq-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="결제 조건·인증 요건·배송 방식 등 추가 요청 사항을 적어주세요."
              className="mt-3 w-full resize-none border-b border-[var(--color-border-light)] bg-transparent text-sm leading-relaxed outline-none transition-colors focus:border-[var(--color-accent)]"
            />
          </div>

          {/* 제출 */}
          <div className="flex flex-wrap items-center justify-end gap-4 border-t border-[var(--color-border-light)] pt-8">
            <Link
              href="/rfq"
              className="text-sm text-[var(--color-text-secondary)] underline-offset-4 hover:underline"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={!canSubmit || create.isPending}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {create.isPending ? "등록 중…" : "견적 요청 등록"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
