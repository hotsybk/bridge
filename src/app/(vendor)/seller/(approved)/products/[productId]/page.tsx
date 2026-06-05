"use client";

import { use } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import {
  ProductForm,
  type ProductFormInitial,
} from "@/components/vendor/product-form";
import { trpc } from "@/lib/trpc/client";

/**
 * Wave P1 — vendor 본인 상품 편집 페이지.
 *
 * 동일한 ProductForm 컴포넌트를 mode="edit" 로 재사용. status 가
 * DRAFT/REVISION_REQUESTED 가 아니면 form 은 disabled 처리되고
 * 일시 중단/재개/아카이브 액션은 별도 (목록 페이지 또는 상세 상단) 에서 처리.
 *
 * Next.js 16 — params 는 Promise. React.use() 로 unwrap.
 */
export default function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const query = trpc.vendor.product.getById.useQuery({ productId });

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--color-text-tertiary)]" />
        <p className="mt-3 text-sm text-[var(--color-text-tertiary)]">
          상품 정보를 불러오는 중…
        </p>
      </main>
    );
  }

  if (query.error || !query.data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {query.error?.message ?? "상품을 찾을 수 없습니다."}
        </p>
        <Link
          href="/seller/products"
          className="mt-4 inline-block text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          상품 목록으로 돌아가기 →
        </Link>
      </main>
    );
  }

  const p = query.data;
  // moderation.status 가 있으면 그것을 우선, 없으면 legacy status
  const status =
    (p as { moderation?: { status?: string } }).moderation?.status ??
    (p as { status?: string }).status ??
    "DRAFT";
  const moderation = (p as {
    moderation?: { statusReason?: string; revisionFields?: string[] };
  }).moderation;

  const initial: ProductFormInitial = {
    productId: p.id,
    name: p.name,
    nameEn: p.nameEn ?? undefined,
    categoryId: p.categoryId,
    brand: p.brand ?? undefined,
    manufacturer: p.manufacturer ?? undefined,
    origin: p.origin ?? undefined,
    udiCode: p.udiCode ?? undefined,
    mfdsLicenseNo: p.mfdsLicenseNo ?? undefined,
    deviceClass: p.deviceClass,
    certificateUrl: p.certificateUrl ?? undefined,
    images: p.images ?? [],
    thumbnail: p.thumbnail ?? undefined,
    basePrice: p.basePrice,
    priceTiers: p.priceTiers ?? [],
    moq: p.moq,
    unit: (p.unit ?? "BOX") as ProductFormInitial["unit"],
    stock: p.stock ?? null,
    shippingMethod:
      (p as { shippingMethod?: ProductFormInitial["shippingMethod"] })
        .shippingMethod ?? "COURIER",
    shippingFee: p.shippingFee ?? 0,
    description: p.description ?? undefined,
    usage: p.usage ?? undefined,
    precaution: (p as { precaution?: string; caution?: string }).precaution ??
      (p as { caution?: string }).caution ?? undefined,
    expiryPolicy: (p as { expiryPolicy?: string }).expiryPolicy ?? undefined,
    subscribable: p.subscribable,
    groupBuyable: p.groupBuyable,
    status,
    revisionReason: moderation?.statusReason,
    revisionFields: moderation?.revisionFields,
  };

  return <ProductForm mode="edit" initial={initial} />;
}
