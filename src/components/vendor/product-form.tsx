"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

import { storage } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/auth-context";
import { trpc } from "@/lib/trpc/client";

/**
 * Wave P1 — vendor 상품 등록·편집 공용 폼.
 *
 * 디자인 정책:
 *  - 라인 only · 박스 없음 · DASHBOARD 프로파일 (T2/T3/T4/T5)
 *  - 섹션 구분: 작은 라벨 + h2 + divider
 *  - input 은 border-b 1px (.line-input) 만
 *  - 액션 footer 은 sticky 하지 않고 페이지 끝에 정착
 */

export type ProductFormMode = "create" | "edit";

export type ProductFormInitial = {
  productId?: string;

  name?: string;
  nameEn?: string;
  categoryId?: string;
  brand?: string;
  manufacturer?: string;
  origin?: string;

  udiCode?: string;
  mfdsLicenseNo?: string;
  deviceClass?: "CLASS_1" | "CLASS_2" | "CLASS_3" | "CLASS_4" | "NON_DEVICE";
  certificateUrl?: string;

  images?: string[];
  thumbnail?: string;

  basePrice?: number;
  priceTiers?: Array<{ minQty: number; price: number }>;
  moq?: number;
  unit?: "EA" | "BOX" | "CASE" | "SET" | "KG" | "L" | "ML" | "PACK" | "ROLL";

  stock?: number | null;
  shippingMethod?: "SELF" | "COURIER" | "DIRECT";
  shippingFee?: number;

  description?: string;
  usage?: string;
  precaution?: string;
  expiryPolicy?: string;

  subscribable?: boolean;
  groupBuyable?: boolean;

  // 편집 모드 — 상태 readonly 표시
  status?: string;
  revisionReason?: string;
  revisionFields?: string[];
};

type FormState = {
  name: string;
  nameEn: string;
  categoryId: string;
  brand: string;
  manufacturer: string;
  origin: string;

  udiCode: string;
  mfdsLicenseNo: string;
  deviceClass: NonNullable<ProductFormInitial["deviceClass"]>;
  certificateUrl: string;

  images: string[];

  basePrice: string; // string 으로 보관 — 빈 input 허용
  priceTiers: Array<{ minQty: string; price: string }>;
  moq: string;
  unit: NonNullable<ProductFormInitial["unit"]>;

  stock: string; // 빈 문자열 = null (무제한)
  shippingMethod: NonNullable<ProductFormInitial["shippingMethod"]>;
  shippingFee: string;

  description: string;
  usage: string;
  precaution: string;
  expiryPolicy: string;

  subscribable: boolean;
  groupBuyable: boolean;
};

const EMPTY: FormState = {
  name: "",
  nameEn: "",
  categoryId: "",
  brand: "",
  manufacturer: "",
  origin: "",
  udiCode: "",
  mfdsLicenseNo: "",
  deviceClass: "NON_DEVICE",
  certificateUrl: "",
  images: [],
  basePrice: "",
  priceTiers: [],
  moq: "1",
  unit: "BOX",
  stock: "",
  shippingMethod: "COURIER",
  shippingFee: "0",
  description: "",
  usage: "",
  precaution: "",
  expiryPolicy: "",
  subscribable: false,
  groupBuyable: false,
};

const UNITS: Array<{ value: FormState["unit"]; label: string }> = [
  { value: "BOX", label: "박스" },
  { value: "EA", label: "개" },
  { value: "CASE", label: "케이스" },
  { value: "SET", label: "세트" },
  { value: "PACK", label: "팩" },
  { value: "KG", label: "kg" },
  { value: "L", label: "L" },
  { value: "ML", label: "ml" },
  { value: "ROLL", label: "롤" },
];

const DEVICE_CLASS_OPTIONS: Array<{
  value: FormState["deviceClass"];
  label: string;
  desc: string;
}> = [
  { value: "NON_DEVICE", label: "비의료기기", desc: "일반 소모품 · 식약처 허가 불필요" },
  { value: "CLASS_1", label: "1등급", desc: "잠재적 위해성이 거의 없음" },
  { value: "CLASS_2", label: "2등급", desc: "잠재적 위해성이 낮음" },
  { value: "CLASS_3", label: "3등급", desc: "중증도의 위해성" },
  { value: "CLASS_4", label: "4등급", desc: "고도의 위해성" },
];

export function ProductForm({
  mode,
  initial,
}: {
  mode: ProductFormMode;
  initial?: ProductFormInitial;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>(() => mergeInitial(initial));
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileImageRef = useRef<HTMLInputElement | null>(null);
  const fileCertRef = useRef<HTMLInputElement | null>(null);

  const createMutation = trpc.vendor.product.create.useMutation();
  const updateMutation = trpc.vendor.product.update.useMutation();
  const submitMutation = trpc.vendor.product.submitForReview.useMutation();

  const categoriesQuery = trpc.admin.category.tree.useQuery();
  const categories = categoriesQuery.data ?? [];
  const leafCategories = useMemo(
    () => categories.filter((c) => c.depth === Math.max(...categories.map((x) => x.depth ?? 1), 1) || true),
    [categories],
  );

  useEffect(() => {
    setForm(mergeInitial(initial));
  }, [initial]);

  const isReadonly =
    mode === "edit" &&
    initial?.status !== undefined &&
    initial.status !== "DRAFT" &&
    initial.status !== "REVISION_REQUESTED";

  const submitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    submitMutation.isPending ||
    uploadingImage ||
    uploadingCertificate;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function uploadFile(file: File, kind: "image" | "certificate"): Promise<string> {
    if (!user) throw new Error("로그인이 필요합니다.");
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const rand = Math.random().toString(36).slice(2, 8);
    const path =
      kind === "image"
        ? `products/${user.uid}/${Date.now()}-${rand}.${ext}`
        : `vendor-docs/${user.uid}/products/${Date.now()}-${rand}.${ext}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file, { contentType: file.type });
    return getDownloadURL(ref);
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setUploadingImage(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        if (form.images.length + urls.length >= 10) break;
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} — 5MB 이하만 업로드 가능합니다.`);
        }
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} — 이미지 파일만 허용됩니다.`);
        }
        const url = await uploadFile(file, "image");
        urls.push(url);
      }
      setForm((s) => ({ ...s, images: [...s.images, ...urls].slice(0, 10) }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingImage(false);
      if (fileImageRef.current) fileImageRef.current.value = "";
    }
  }

  async function handleCertPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingCertificate(true);
    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("인증서는 10MB 이하만 업로드 가능합니다.");
      }
      const url = await uploadFile(file, "certificate");
      set("certificateUrl", url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingCertificate(false);
      if (fileCertRef.current) fileCertRef.current.value = "";
    }
  }

  function removeImage(idx: number) {
    setForm((s) => ({ ...s, images: s.images.filter((_, i) => i !== idx) }));
  }

  function addPriceTier() {
    setForm((s) => ({
      ...s,
      priceTiers: [...s.priceTiers, { minQty: "", price: "" }].slice(0, 5),
    }));
  }
  function removePriceTier(idx: number) {
    setForm((s) => ({
      ...s,
      priceTiers: s.priceTiers.filter((_, i) => i !== idx),
    }));
  }
  function updatePriceTier(
    idx: number,
    key: "minQty" | "price",
    value: string,
  ) {
    setForm((s) => ({
      ...s,
      priceTiers: s.priceTiers.map((t, i) =>
        i === idx ? { ...t, [key]: value } : t,
      ),
    }));
  }

  function buildPayload() {
    const basePriceNum = Number(form.basePrice);
    if (!form.name.trim()) throw new Error("상품명을 입력해주세요.");
    if (!form.categoryId) throw new Error("카테고리를 선택해주세요.");
    if (!basePriceNum || basePriceNum <= 0)
      throw new Error("단가를 입력해주세요.");
    const moq = Number(form.moq) || 1;
    const shippingFee = Number(form.shippingFee) || 0;
    const stock = form.stock.trim() === "" ? undefined : Number(form.stock);

    const priceTiers = form.priceTiers
      .filter((t) => t.minQty && t.price)
      .map((t) => ({
        minQty: Number(t.minQty),
        price: Number(t.price),
      }))
      .filter((t) => t.minQty > 0 && t.price > 0);

    return {
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || undefined,
      categoryId: form.categoryId,
      brand: form.brand.trim() || undefined,
      manufacturer: form.manufacturer.trim() || undefined,
      origin: form.origin.trim() || undefined,
      udiCode: form.udiCode.trim() || undefined,
      mfdsLicenseNo: form.mfdsLicenseNo.trim() || undefined,
      deviceClass: form.deviceClass,
      certificateUrl: form.certificateUrl || undefined,
      images: form.images,
      thumbnail: form.images[0],
      basePrice: basePriceNum,
      priceTiers,
      moq,
      unit: form.unit,
      stock,
      shippingMethod: form.shippingMethod,
      shippingFee,
      description: form.description.trim() || undefined,
      usage: form.usage.trim() || undefined,
      precaution: form.precaution.trim() || undefined,
      expiryPolicy: form.expiryPolicy.trim() || undefined,
      subscribable: form.subscribable,
      groupBuyable: form.groupBuyable,
    };
  }

  async function handleSave(submitForReview: boolean) {
    setError(null);
    try {
      const payload = buildPayload();
      let productId = initial?.productId;
      if (mode === "create") {
        const r = await createMutation.mutateAsync(payload);
        productId = r.productId;
      } else if (productId) {
        // update — patch 만
        await updateMutation.mutateAsync({
          productId,
          patch: payload,
        });
      } else {
        throw new Error("상품 ID를 찾을 수 없습니다.");
      }
      if (submitForReview && productId) {
        await submitMutation.mutateAsync({ productId });
      }
      router.push("/seller/products");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {/* Header */}
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          파트너센터 · 카탈로그
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {mode === "create" ? "새 상품 등록" : "상품 편집"}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {mode === "create"
            ? "초안으로 저장하거나 바로 운영자 심사에 제출할 수 있습니다."
            : "수정 후 다시 심사에 제출하면 운영자 검토를 거쳐 노출됩니다."}
        </p>
      </header>

      {/* Revision banner */}
      {mode === "edit" && initial?.status === "REVISION_REQUESTED" && (
        <section className="mt-8 border-y border-[var(--color-warning)]/30 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-warning)]">
            운영자 수정 요청
          </p>
          <p className="mt-1 text-sm">
            {initial.revisionReason ?? "수정 요청 사유가 등록되어 있지 않습니다."}
          </p>
          {initial.revisionFields && initial.revisionFields.length > 0 && (
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              수정 필요 필드: {initial.revisionFields.join(" · ")}
            </p>
          )}
        </section>
      )}

      {/* Readonly notice */}
      {isReadonly && (
        <section className="mt-8 border-y border-[var(--color-border-light)] py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            읽기 전용
          </p>
          <p className="mt-1 text-sm">
            현재 상태({initial?.status})에서는 직접 수정이 불가능합니다. 노출
            중인 상품은 일시 중단 후 운영자에게 문의해주세요.
          </p>
        </section>
      )}

      <fieldset disabled={isReadonly} className="contents">
        {/* Section: 기본 정보 */}
        <Section index="01" title="기본 정보">
          <Field label="상품명" required>
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="예: 수술용 라텍스 장갑 (M) 100매"
              className="line-input"
            />
          </Field>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <Field label="영문명">
              <input
                value={form.nameEn}
                onChange={(e) => set("nameEn", e.target.value)}
                placeholder="Surgical Latex Gloves M 100ct"
                className="line-input"
              />
            </Field>
            <Field label="카테고리" required>
              <select
                required
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className="line-input"
              >
                <option value="">카테고리를 선택해주세요</option>
                {leafCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.path ?? [c.name]).join(" › ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="브랜드">
              <input
                value={form.brand}
                onChange={(e) => set("brand", e.target.value)}
                placeholder="예: 3M"
                className="line-input"
              />
            </Field>
            <Field label="제조사">
              <input
                value={form.manufacturer}
                onChange={(e) => set("manufacturer", e.target.value)}
                placeholder="예: ㈜한국메디칼"
                className="line-input"
              />
            </Field>
            <Field label="원산지">
              <input
                value={form.origin}
                onChange={(e) => set("origin", e.target.value)}
                placeholder="예: 대한민국"
                className="line-input"
              />
            </Field>
          </div>
        </Section>

        {/* Section: 인증 정보 (의료기기) */}
        <Section index="02" title="인증 정보">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <Field label="UDI 코드">
              <input
                value={form.udiCode}
                onChange={(e) => set("udiCode", e.target.value)}
                placeholder="(01)08801234567890"
                className="line-input"
              />
            </Field>
            <Field label="식약처 허가/신고번호">
              <input
                value={form.mfdsLicenseNo}
                onChange={(e) => set("mfdsLicenseNo", e.target.value)}
                placeholder="제허 2024-1234호"
                className="line-input"
              />
            </Field>
          </div>

          <Field label="의료기기 등급" required>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {DEVICE_CLASS_OPTIONS.map((opt) => {
                const active = form.deviceClass === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("deviceClass", opt.value)}
                    aria-pressed={active}
                    className={`flex flex-col items-start gap-0.5 border-b-2 px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="인증서 (PDF)">
            <div className="flex items-center gap-3">
              <input
                ref={fileCertRef}
                type="file"
                accept="application/pdf,image/*"
                capture="environment"
                onChange={handleCertPick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileCertRef.current?.click()}
                disabled={uploadingCertificate}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] px-4 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
              >
                {uploadingCertificate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {form.certificateUrl ? "다시 업로드" : "PDF 업로드"}
              </button>
              {form.certificateUrl && (
                <a
                  href={form.certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  업로드된 파일 보기
                </a>
              )}
            </div>
          </Field>
        </Section>

        {/* Section: 이미지 */}
        <Section index="03" title="상품 이미지" subtitle="첫 번째 이미지가 썸네일로 사용됩니다. 최대 10장 · 5MB.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {form.images.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="relative aspect-square border border-[var(--color-border-light)]"
              >
                <Image
                  src={url}
                  alt={`상품 이미지 ${i + 1}`}
                  fill
                  sizes="(min-width: 768px) 20vw, 50vw"
                  className="object-cover"
                />
                {i === 0 && (
                  <span className="absolute left-1 top-1 bg-[var(--color-text-primary)] px-1.5 py-0.5 text-[11px] font-medium text-white">
                    대표
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label={`이미지 ${i + 1} 제거`}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[var(--color-text-secondary)] shadow-sm transition-colors hover:bg-white hover:text-[var(--color-error)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {form.images.length < 10 && (
              <button
                type="button"
                onClick={() => fileImageRef.current?.click()}
                disabled={uploadingImage}
                className="grid aspect-square place-items-center border border-dashed border-[var(--color-border-default)] text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-60"
              >
                {uploadingImage ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-[11px]">
                    <ImagePlus className="h-5 w-5" />
                    이미지 추가
                  </span>
                )}
              </button>
            )}
          </div>
          <input
            ref={fileImageRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleImagePick}
            className="hidden"
          />
        </Section>

        {/* Section: 가격 정책 */}
        <Section index="04" title="가격 정책" subtitle="기본 단가 + 수량 구간별 추가 단가 (최대 5단계).">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
            <Field label="기본 단가 (₩)" required>
              <input
                required
                type="number"
                min={0}
                value={form.basePrice}
                onChange={(e) => set("basePrice", e.target.value)}
                placeholder="0"
                className="line-input tabular-nums"
              />
            </Field>
            <Field label="단위">
              <select
                value={form.unit}
                onChange={(e) => set("unit", e.target.value as FormState["unit"])}
                className="line-input"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="최소 주문량 (MOQ)">
              <input
                type="number"
                min={1}
                value={form.moq}
                onChange={(e) => set("moq", e.target.value)}
                placeholder="1"
                className="line-input tabular-nums"
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                수량 구간별 단가
              </p>
              {form.priceTiers.length < 5 && (
                <button
                  type="button"
                  onClick={addPriceTier}
                  className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  + 구간 추가
                </button>
              )}
            </div>
            {form.priceTiers.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                구간이 없으면 항상 기본 단가가 적용됩니다.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--color-border-light)]">
                {form.priceTiers.map((t, i) => (
                  <li key={i} className="flex items-end gap-3 py-3">
                    <Field label={`구간 ${i + 1} · 최소 수량`}>
                      <input
                        type="number"
                        min={1}
                        value={t.minQty}
                        onChange={(e) =>
                          updatePriceTier(i, "minQty", e.target.value)
                        }
                        placeholder="50"
                        className="line-input tabular-nums"
                      />
                    </Field>
                    <Field label="단가 (₩)">
                      <input
                        type="number"
                        min={0}
                        value={t.price}
                        onChange={(e) =>
                          updatePriceTier(i, "price", e.target.value)
                        }
                        placeholder="0"
                        className="line-input tabular-nums"
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => removePriceTier(i)}
                      aria-label={`구간 ${i + 1} 제거`}
                      className="mb-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-error)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        {/* Section: 재고·배송 */}
        <Section index="05" title="재고와 배송">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
            <Field
              label="재고 수량"
              hint="비워두면 무제한 — 재고 관리를 하지 않습니다"
            >
              <input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => set("stock", e.target.value)}
                placeholder="무제한"
                className="line-input tabular-nums"
              />
            </Field>
            <Field label="배송 방식">
              <select
                value={form.shippingMethod}
                onChange={(e) =>
                  set("shippingMethod", e.target.value as FormState["shippingMethod"])
                }
                className="line-input"
              >
                <option value="COURIER">택배</option>
                <option value="DIRECT">직접 배송</option>
                <option value="SELF">자체 수령</option>
              </select>
            </Field>
            <Field label="배송비 (₩)" hint="0 입력 시 무료 배송">
              <input
                type="number"
                min={0}
                value={form.shippingFee}
                onChange={(e) => set("shippingFee", e.target.value)}
                placeholder="0"
                className="line-input tabular-nums"
              />
            </Field>
          </div>
        </Section>

        {/* Section: 상세 설명 */}
        <Section index="06" title="상세 설명">
          <Field label="상품 설명">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={5}
              placeholder="제품 특징, 적용 용도, 구성품 등을 자유롭게 작성해주세요."
              className="line-textarea"
            />
          </Field>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <Field label="사용 방법">
              <textarea
                value={form.usage}
                onChange={(e) => set("usage", e.target.value)}
                rows={3}
                placeholder="시술 전 손을 세척하고…"
                className="line-textarea"
              />
            </Field>
            <Field label="주의 사항">
              <textarea
                value={form.precaution}
                onChange={(e) => set("precaution", e.target.value)}
                rows={3}
                placeholder="라텍스 알러지 환자에게는 사용을 피해주세요."
                className="line-textarea"
              />
            </Field>
          </div>
          <Field label="유통기한 정책">
            <input
              value={form.expiryPolicy}
              onChange={(e) => set("expiryPolicy", e.target.value)}
              placeholder="제조일로부터 36개월"
              className="line-input"
            />
          </Field>
        </Section>

        {/* Section: 판매 옵션 */}
        <Section index="07" title="판매 옵션">
          <Toggle
            label="정기구독 가능"
            desc="병원이 매달 자동 발주할 수 있게 합니다."
            checked={form.subscribable}
            onChange={(v) => set("subscribable", v)}
          />
          <Toggle
            label="공동구매 가능"
            desc="여러 병원이 모이면 자동 할인 단가가 적용됩니다."
            checked={form.groupBuyable}
            onChange={(v) => set("groupBuyable", v)}
          />
        </Section>
      </fieldset>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mt-8 border-y border-[var(--color-error)]/30 py-3 text-sm text-[var(--color-error)]"
        >
          {error}
        </div>
      )}

      {/* Action footer */}
      <footer className="mt-12 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border-light)] pt-6">
        <button
          type="button"
          onClick={() => router.push("/seller/products")}
          disabled={submitting}
          className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
        >
          취소
        </button>
        {!isReadonly && (
          <>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={submitting}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] px-5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-60"
            >
              {(createMutation.isPending || updateMutation.isPending) &&
                !submitMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
              초안 저장
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={submitting}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {submitMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              심사 제출
            </button>
          </>
        )}
      </footer>

      {/* Scoped styles — 라인 input/textarea */}
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
        .line-input::placeholder {
          color: var(--color-text-tertiary);
        }
        .line-textarea {
          display: block;
          width: 100%;
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--color-border-light);
          padding: 0.5rem 0.25rem;
          font-size: 0.875rem;
          line-height: 1.5;
          outline: none;
          resize: vertical;
          transition: border-color 120ms ease;
        }
        .line-textarea:focus {
          border-bottom-color: var(--color-accent);
        }
        .line-textarea::placeholder {
          color: var(--color-text-tertiary);
        }
      `}</style>
    </main>
  );
}

function mergeInitial(initial?: ProductFormInitial): FormState {
  if (!initial) return EMPTY;
  return {
    name: initial.name ?? "",
    nameEn: initial.nameEn ?? "",
    categoryId: initial.categoryId ?? "",
    brand: initial.brand ?? "",
    manufacturer: initial.manufacturer ?? "",
    origin: initial.origin ?? "",
    udiCode: initial.udiCode ?? "",
    mfdsLicenseNo: initial.mfdsLicenseNo ?? "",
    deviceClass: initial.deviceClass ?? "NON_DEVICE",
    certificateUrl: initial.certificateUrl ?? "",
    images: initial.images ?? [],
    basePrice: initial.basePrice ? String(initial.basePrice) : "",
    priceTiers: (initial.priceTiers ?? []).map((t) => ({
      minQty: String(t.minQty),
      price: String(t.price),
    })),
    moq: initial.moq ? String(initial.moq) : "1",
    unit: initial.unit ?? "BOX",
    stock:
      initial.stock === undefined || initial.stock === null
        ? ""
        : String(initial.stock),
    shippingMethod: initial.shippingMethod ?? "COURIER",
    shippingFee: initial.shippingFee !== undefined ? String(initial.shippingFee) : "0",
    description: initial.description ?? "",
    usage: initial.usage ?? "",
    precaution: initial.precaution ?? "",
    expiryPolicy: initial.expiryPolicy ?? "",
    subscribable: initial.subscribable ?? false,
    groupBuyable: initial.groupBuyable ?? false,
  };
}

function Section({
  index,
  title,
  subtitle,
  children,
}: {
  index: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-[var(--color-border-light)] pt-8">
      <div className="flex items-baseline gap-4">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          {index}
        </span>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      {subtitle && (
        <p className="mt-1 ml-10 text-xs text-[var(--color-text-tertiary)]">
          {subtitle}
        </p>
      )}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
        {required && (
          <span className="ml-1 text-[var(--color-accent)]">*</span>
        )}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
          {hint}
        </p>
      )}
    </label>
  );
}

function Toggle({
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
    <label className="flex items-start justify-between gap-3 border-b border-[var(--color-border-light)] py-3 last:border-0">
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
