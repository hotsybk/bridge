import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { trpcServer } from "@/lib/trpc/server";
import type { Product } from "@/lib/types";

import { ProductReviewPanel } from "../review-panel";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  PENDING_REVIEW: "심사 대기",
  REVISION_REQUESTED: "수정 요청",
  ACTIVE: "승인됨",
  REJECTED: "반려",
  PAUSED: "일시 중단",
  ARCHIVED: "종료",
};

const STATUS_TONE: Record<string, string> = {
  PENDING_REVIEW:
    "border-[var(--color-accent)] bg-[var(--color-accent)]/5 text-[var(--color-accent)]",
  REVISION_REQUESTED:
    "border-[var(--color-warning)] bg-[var(--color-warning)]/5 text-[var(--color-warning)]",
  ACTIVE:
    "border-[var(--color-success)] bg-[var(--color-success)]/5 text-[var(--color-success)]",
  REJECTED:
    "border-[var(--color-error)] bg-[var(--color-error)]/5 text-[var(--color-error)]",
  DRAFT:
    "border-[var(--color-border-default)] text-[var(--color-text-secondary)]",
  PAUSED:
    "border-[var(--color-border-default)] text-[var(--color-text-secondary)]",
  ARCHIVED:
    "border-[var(--color-border-default)] text-[var(--color-text-secondary)]",
};

const DEMO_PRODUCT: Product = {
  id: "p-001",
  vendorId: "v-001",
  vendorName: "(주)메디서플라이",
  categoryId: "surgical",
  categoryPath: ["수술 소모품", "장갑"],
  name: "수술용 라텍스 장갑 (M)",
  nameEn: "Surgical Latex Gloves M",
  brand: "MediGlove",
  manufacturer: "MediGlove Co., Ltd.",
  origin: "말레이시아",
  udiCode: "08801234567890",
  mfdsLicenseNo: "제2026-001호",
  deviceClass: "CLASS_2",
  images: [],
  thumbnail: "",
  basePrice: 28900,
  priceTiers: [
    { minQty: 1, price: 28900 },
    { minQty: 50, price: 27500 },
    { minQty: 100, price: 26000 },
  ],
  unit: "BOX",
  moq: 1,
  shippingFee: 0,
  description:
    "라텍스 알러지 free 옵션 보유. 의료용 그레이드 ISO 10993 인증.",
  status: "PENDING_REVIEW",
  subscribable: true,
  groupBuyable: false,
  viewCount: 0,
  orderCount: 0,
  reviewCount: 0,
  moderation: {
    status: "PENDING_REVIEW",
    submittedAt: { seconds: Math.floor(Date.now() / 1000) - 86400 } as never,
  },
  verification: {
    udiValid: true,
    licenseOcr: { number: "제2026-001호", confidence: 0.92 },
  },
  createdAt: { seconds: Math.floor(Date.now() / 1000) - 86400 } as never,
  updatedAt: { seconds: Math.floor(Date.now() / 1000) - 86400 } as never,
};

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  let product: Product | null = null;
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    product = await trpc.admin.product.getById({ productId });
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      product = { ...DEMO_PRODUCT, id: productId };
    }
  }

  if (!product) notFound();

  const moderation = product.moderation ?? { status: product.status };
  const tone =
    STATUS_TONE[moderation.status] ??
    "border-[var(--color-border-default)] text-[var(--color-text-secondary)]";

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-3 w-3" />
        모더레이션 큐로
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Product · 모더레이션
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            {product.name}
          </h1>
          <p className="mt-2 font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
            {product.id}
          </p>
        </div>
        <span
          className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium ${tone}`}
        >
          {STATUS_LABEL[moderation.status] ?? moderation.status}
        </span>
      </header>

      {isPreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          PREVIEW · 비로그인 상태입니다. 실제 데이터가 아닙니다.
        </p>
      )}

      <div className="mt-12">
        <ProductReviewPanel product={product} isPreview={isPreview} />
      </div>
    </div>
  );
}
