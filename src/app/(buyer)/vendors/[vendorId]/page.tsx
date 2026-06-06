import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Factory,
  MapPin,
  Package,
  ShieldCheck,
  Sparkles,
  Tags,
} from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { ProductCard } from "@/components/buyer/product-card";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { trpcServer } from "@/lib/trpc/server";
import { TRPCError } from "@trpc/server";

export const dynamic = "force-dynamic";

const VENDOR_TYPE_LABEL: Record<string, string> = {
  DISTRIBUTOR: "유통/판매업자",
  MANUFACTURER: "제조업자",
  IMPORTER: "수입업자",
};

const CATEGORY_LABEL: Record<string, string> = {
  MED_DEVICE: "의료기기",
  MED_SUPPLY: "의료소모품",
  ORIENTAL: "한방",
  DENTAL: "치과",
  EMERGENCY: "응급/구급",
  OFFICE: "사무/청구",
};

const GRADE_LABEL: Record<string, string> = {
  DIRECT: "DIRECT",
  PREMIUM: "PREMIUM",
  PLUS: "PLUS",
  STANDARD: "STANDARD",
};

const GRADE_TONE: Record<string, string> = {
  DIRECT: "bg-[var(--color-accent)] text-white",
  PREMIUM: "bg-[var(--color-text-primary)] text-white",
  PLUS: "bg-[var(--color-accent-light)] text-[var(--color-accent)]",
  STANDARD: "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]",
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  APPROVED: {
    label: "정식 입점",
    tone: "bg-[var(--color-success)]/12 text-[var(--color-success)]",
  },
  PENDING_REVIEW: {
    label: "심사 중",
    tone: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  },
  PENDING_DOCS: {
    label: "서류 보완 중",
    tone: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  },
  SUSPENDED: {
    label: "거래 정지",
    tone: "bg-[var(--color-danger)]/12 text-[var(--color-danger)]",
  },
  REJECTED: {
    label: "입점 반려",
    tone: "bg-[var(--color-danger)]/12 text-[var(--color-danger)]",
  },
};

function formatCreatedAt(seconds: number | null): string {
  if (!seconds) return "—";
  const d = new Date(seconds * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}.${m} 가입`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}): Promise<Metadata> {
  const { vendorId } = await params;
  try {
    const trpc = await trpcServer();
    const v = await trpc.vendor.publicProfile.getById({ vendorId });
    return {
      title: `${v.companyName} 공급업체 프로필`,
      description: `${v.companyName} — ${VENDOR_TYPE_LABEL[v.vendorType] ?? ""} · MedPlace 공급업체. 취급 카테고리·신뢰 신호·상품 카탈로그.`,
    };
  } catch {
    return { title: "공급업체 프로필" };
  }
}

export default async function VendorPublicProfilePage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const trpc = await trpcServer();

  let vendor;
  try {
    vendor = await trpc.vendor.publicProfile.getById({ vendorId });
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  // 해당 vendor 의 ACTIVE 상품 12개 (썸네일 + cap)
  const productList = await trpc.product.list({
    vendorId,
    limit: 12,
    sort: "latest",
  });
  const products = productList.items;
  const hasMore = Boolean(productList.nextCursor) || products.length >= 12;

  const statusMeta = STATUS_LABEL[vendor.status] ?? STATUS_LABEL.PENDING_REVIEW;
  const grade = vendor.grade ?? "STANDARD";
  const gradeTone = GRADE_TONE[grade] ?? GRADE_TONE.STANDARD;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "카탈로그", href: "/search" },
            { label: "공급업체" },
            { label: vendor.companyName },
          ]}
        />

        {/* Hero — 라인 only, 박스 없음 */}
        <header className="mt-6 grid gap-6 border-b border-[var(--color-border-light)] pb-10 md:grid-cols-[1fr_auto] md:items-end md:gap-10 md:pb-14">
          <div className="min-w-0">
            <PageHeader
              label="공급업체 프로필"
              title={vendor.companyName}
            />

            {/* 메타 라인 */}
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex h-6 items-center rounded-full px-2.5 font-semibold ${gradeTone}`}>
                <Sparkles className="mr-1 h-3 w-3" />
                {GRADE_LABEL[grade]}
              </span>
              <span className={`inline-flex h-6 items-center rounded-full px-2.5 font-semibold ${statusMeta.tone}`}>
                {statusMeta.label}
              </span>
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[var(--color-bg-tertiary)] px-2.5 font-medium text-[var(--color-text-secondary)]">
                <Factory className="h-3 w-3" />
                {VENDOR_TYPE_LABEL[vendor.vendorType] ?? vendor.vendorType}
              </span>
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[var(--color-bg-tertiary)] px-2.5 font-medium text-[var(--color-text-secondary)]">
                <CalendarDays className="h-3 w-3" />
                {formatCreatedAt(vendor.createdAtSeconds)}
              </span>
            </div>

            {/* 소재지·카테고리 한 줄 */}
            <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-2 text-sm text-[var(--color-text-secondary)]">
              {vendor.address && (
                <span className="inline-flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
                  <span className="break-keep">{vendor.address}</span>
                </span>
              )}
              {vendor.categories.length > 0 && (
                <span className="inline-flex flex-wrap items-start gap-1.5">
                  <Tags className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
                  <span className="break-keep">
                    {vendor.categories
                      .map((c) => CATEGORY_LABEL[c] ?? c)
                      .join(" · ")}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* 우측 CTA */}
          <div className="flex flex-col items-stretch gap-2 md:items-end">
            <Link
              href={`/search?vendorId=${vendor.id}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              전체 상품 보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {/* KPI grid — 라인 only, 박스 없음 */}
        <section
          aria-label="공급업체 신뢰 신호"
          className="grid grid-cols-2 divide-y divide-[var(--color-border-light)] border-b border-[var(--color-border-light)] md:grid-cols-4 md:divide-x md:divide-y-0"
        >
          <KpiCell
            icon={Package}
            value={vendor.productCount.toLocaleString()}
            label="등록 상품"
            sub="MedPlace 카탈로그"
          />
          <KpiCell
            icon={ShieldCheck}
            value={vendor.hasSalesLicense ? "보유" : "—"}
            label="판매업 신고증"
            sub="의료기기법 §31"
            tone={vendor.hasSalesLicense ? "success" : "muted"}
          />
          <KpiCell
            icon={Factory}
            value={vendor.hasManufactureLicense ? "보유" : "—"}
            label="제조·수입 인증"
            sub="해당 vendor"
            tone={vendor.hasManufactureLicense ? "success" : "muted"}
          />
          <KpiCell
            icon={BadgeCheck}
            value={
              vendor.rating !== undefined
                ? vendor.rating.toFixed(1)
                : "—"
            }
            label="평점"
            sub={
              vendor.reviewCount > 0
                ? `${vendor.reviewCount.toLocaleString()}건`
                : "리뷰 누적 전"
            }
            tone={vendor.rating !== undefined ? "accent" : "muted"}
          />
        </section>

        {/* 상품 grid */}
        <section className="mt-14">
          <header className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
                취급 상품
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {vendor.companyName} 가 MedPlace 에 등록한 ACTIVE 상품 카탈로그.
              </p>
            </div>
            {products.length > 0 && (
              <Link
                href={`/search?vendorId=${vendor.id}`}
                className="hidden text-xs font-semibold text-[var(--color-accent)] hover:underline md:inline-flex md:items-center md:gap-1"
              >
                전체 보기
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </header>

          {products.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={Package}
                title="아직 등록된 상품이 없어요"
                description="이 공급업체는 카탈로그를 준비 중입니다. 잠시 후 다시 확인해주세요."
              />
            </div>
          ) : (
            <>
              <ul className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
                {products.map((p) => (
                  <li key={p.id}>
                    <ProductCard product={p} />
                  </li>
                ))}
              </ul>
              {hasMore && (
                <div className="mt-10 flex justify-center">
                  <Link
                    href={`/search?vendorId=${vendor.id}`}
                    className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-6 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-tertiary)]"
                  >
                    전체 상품 보기
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </>
          )}
        </section>

        {/* 신뢰 안내 — 라인 only */}
        <section className="mt-20 border-t border-[var(--color-border-light)] pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
            MedPlace 의 약속
          </p>
          <ul className="mt-6 grid gap-4 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
              <span>판매업 신고증 검증 완료 공급업체만 노출.</span>
            </li>
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
              <span>결제·정산은 MedPlace 가 중개 · 영업일 3일 자동 정산.</span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function KpiCell({
  icon: Icon,
  value,
  label,
  sub,
  tone = "neutral",
}: {
  icon: typeof Package;
  value: string;
  label: string;
  sub: string;
  tone?: "accent" | "success" | "neutral" | "muted";
}) {
  const iconTone =
    tone === "accent"
      ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
      : tone === "success"
        ? "bg-[var(--color-success)]/12 text-[var(--color-success)]"
        : tone === "muted"
          ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
          : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]";
  const valueTone =
    tone === "muted" ? "text-[var(--color-text-tertiary)]" : "text-[var(--color-text-primary)]";
  return (
    <article className="flex items-start gap-3 py-8 md:px-8">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconTone}`}>
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className={`text-2xl font-semibold tracking-tight tabular-nums md:text-3xl ${valueTone}`}>
          {value}
        </p>
        <p className="mt-0.5 text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">{sub}</p>
      </div>
    </article>
  );
}
