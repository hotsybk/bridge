"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * 상품 등록·편집 공용 폼 모달.
 * Phase 2 백엔드 (trpc.vendor.products.create/update) 연결 전까지는
 * 1초 대기 후 onSubmit 콜백 호출 (시각적 피드백 유지).
 */

export type ProductFormValue = {
  name: string;
  category: string;
  deviceClass: "CLASS_1" | "CLASS_2" | "NON_DEVICE";
  price: number;
  unit: string;
  stock: number;
  subscribable: boolean;
  groupBuyable: boolean;
  visible: boolean;
};

const EMPTY: ProductFormValue = {
  name: "",
  category: "일회용 의료용품",
  deviceClass: "NON_DEVICE",
  price: 0,
  unit: "BOX",
  stock: 0,
  subscribable: false,
  groupBuyable: false,
  visible: true,
};

const CATEGORIES = [
  "일회용 의료용품",
  "진단기기",
  "모니터링 장비",
  "치과 재료",
  "한방 재료",
  "드레싱",
];

const UNITS = ["BOX", "EA", "KG", "L", "ML", "PACK", "SET", "ROLL"];

export function ProductFormDialog({
  mode,
  open,
  initial,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  open: boolean;
  initial?: Partial<ProductFormValue>;
  onClose: () => void;
  onSubmit: (value: ProductFormValue) => void;
}) {
  const [value, setValue] = useState<ProductFormValue>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  // 모달 열릴 때마다 초기값 리셋
  useEffect(() => {
    if (open) {
      setValue({ ...EMPTY, ...initial });
      setSubmitting(false);
    }
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    // mock 백엔드 호출
    await new Promise((r) => setTimeout(r, 800));
    onSubmit(value);
    setSubmitting(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-tight">
            {mode === "create" ? "새 상품 등록" : "상품 편집"}
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--color-text-secondary)]">
            {mode === "create"
              ? "카탈로그에 노출할 상품 정보를 입력합니다."
              : "기존 상품 정보를 수정합니다."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="상품명">
            <input
              required
              value={value.name}
              onChange={(e) => setValue({ ...value, name: e.target.value })}
              placeholder="예: 수술용 라텍스 장갑 (M) 100매"
              className="line-input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="카테고리">
              <select
                value={value.category}
                onChange={(e) => setValue({ ...value, category: e.target.value })}
                className="line-input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="의료기기 등급">
              <select
                value={value.deviceClass}
                onChange={(e) =>
                  setValue({
                    ...value,
                    deviceClass: e.target.value as ProductFormValue["deviceClass"],
                  })
                }
                className="line-input"
              >
                <option value="NON_DEVICE">비의료기기</option>
                <option value="CLASS_1">1등급</option>
                <option value="CLASS_2">2등급</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="단가 (₩)">
              <input
                type="number"
                min={0}
                required
                value={value.price || ""}
                onChange={(e) =>
                  setValue({ ...value, price: Number(e.target.value) })
                }
                placeholder="0"
                className="line-input tabular-nums"
              />
            </Field>
            <Field label="단위">
              <select
                value={value.unit}
                onChange={(e) => setValue({ ...value, unit: e.target.value })}
                className="line-input"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="재고">
              <input
                type="number"
                min={0}
                required
                value={value.stock || ""}
                onChange={(e) =>
                  setValue({ ...value, stock: Number(e.target.value) })
                }
                placeholder="0"
                className="line-input tabular-nums"
              />
            </Field>
          </div>

          <div className="space-y-2 pt-2">
            <ToggleField
              label="정기구독 가능"
              desc="병원이 매달 자동 발주할 수 있게 합니다"
              checked={value.subscribable}
              onChange={(checked) => setValue({ ...value, subscribable: checked })}
            />
            <ToggleField
              label="공동구매 가능"
              desc="여러 병원이 모이면 자동 할인 단가 적용"
              checked={value.groupBuyable}
              onChange={(checked) => setValue({ ...value, groupBuyable: checked })}
            />
            <ToggleField
              label="카탈로그 노출"
              desc="끄면 검색·목록에서 숨겨집니다"
              checked={value.visible}
              onChange={(checked) => setValue({ ...value, visible: checked })}
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border-light)] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === "create" ? "등록" : "저장"}
            </button>
          </div>
        </form>

        {/* line-input 헬퍼 클래스 — DialogContent 내부에 inline scoped style */}
        <style>{`
          .line-input {
            display: block;
            width: 100%;
            height: 2.25rem;
            background: transparent;
            border: 0;
            border-bottom: 1px solid var(--color-border-light);
            padding: 0 0.25rem;
            font-size: 0.875rem;
            outline: none;
            transition: border-color 120ms ease;
          }
          .line-input:focus {
            border-bottom-color: var(--color-accent);
          }
          .line-input::placeholder { color: var(--color-text-tertiary); }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ToggleField({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
          {desc}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked
            ? "bg-[var(--color-accent)]"
            : "bg-[var(--color-border-default)]/50"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
