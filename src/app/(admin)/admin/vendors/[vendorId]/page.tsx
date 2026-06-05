import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, ExternalLink, FileText, AlertCircle } from "lucide-react";

import { extractStoragePath, getStorageSignedUrl } from "@/server/firebase/admin";
import { trpcServer } from "@/lib/trpc/server";

import { VendorActions, VendorMemoPanel } from "./actions";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * Phase α-7 — 계좌번호 마스킹 (admin UI 전용).
 * 마지막 4자리만 노출 — 전체 보기는 별도 reveal endpoint(SUPER_ADMIN) 필요.
 */
function maskBankAccount(account: string | undefined | null): string {
  if (!account) return "—";
  const s = String(account);
  if (s.length <= 4) return s;
  return s.slice(0, -4).replace(/[0-9]/g, "•") + s.slice(-4);
}

const VENDOR_TYPE_LABEL: Record<string, string> = {
  DISTRIBUTOR: "판매업자",
  MANUFACTURER: "제조업자",
  IMPORTER: "수입업자",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_DOCS: "서류 미제출",
  PENDING_REVIEW: "심사 대기",
  APPROVED: "승인",
  SUSPENDED: "일시 정지",
  REJECTED: "반려",
};

const STATUS_TONE: Record<string, string> = {
  PENDING_DOCS:
    "border-[var(--color-warning)] text-[var(--color-warning)] bg-[var(--color-warning)]/10",
  PENDING_REVIEW:
    "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-light)]/60",
  APPROVED:
    "border-[var(--color-success)] text-[var(--color-success)] bg-[var(--color-success)]/10",
  SUSPENDED:
    "border-[var(--color-warning)] text-[var(--color-warning)] bg-[var(--color-warning)]/10",
  REJECTED:
    "border-[var(--color-error)] text-[var(--color-error)] bg-[var(--color-error)]/10",
};

type BizRegOcr = {
  bizRegNo: string | null;
  companyName: string | null;
  ceoName: string | null;
  confidence: number;
};

type BizRegVerification = {
  isValid: boolean;
  taxType: string | null;
  startDate: string | null;
};

type VendorDoc = {
  id: string;
  companyName: string;
  vendorType: string;
  bizRegNo: string;
  ceoName: string;
  phone: string;
  email: string;
  zipcode: string;
  address: string;
  addressDetail?: string;
  salesLicenseNo?: string;
  payoutBankCode?: string;
  payoutBankAccount?: string;
  payoutAccountHolder?: string;
  defaultCommissionRate: number;
  categories?: string[];
  status: string;
  statusReason?: string;
  grade?: "STANDARD" | "PLUS" | "PREMIUM" | "DIRECT";
  bizRegImageUrl?: string;
  salesLicenseImageUrl?: string;
  manufactureLicenseUrl?: string;
  bizRegOcr?: BizRegOcr | null;
  bizRegVerification?: BizRegVerification | null;
};

const DEMO_VENDOR: VendorDoc = {
  id: "demo-v1",
  companyName: "(주)메디서플라이",
  vendorType: "DISTRIBUTOR",
  bizRegNo: "123-45-67890",
  ceoName: "김민수",
  phone: "02-1234-5678",
  email: "contact@medsupply.example.com",
  zipcode: "06236",
  address: "서울특별시 강남구 테헤란로 123",
  addressDetail: "5층 502호",
  salesLicenseNo: "제2026-서울강남-001호",
  payoutBankCode: "088",
  payoutBankAccount: "123-456-789012",
  payoutAccountHolder: "(주)메디서플라이",
  defaultCommissionRate: 0.05,
  categories: ["수술용 소모품", "감염 관리", "환자 모니터링"],
  status: "PENDING_REVIEW",
  bizRegOcr: {
    bizRegNo: "123-45-67890",
    companyName: "(주)메디서플라이",
    ceoName: "김민수",
    confidence: 0.94,
  },
  bizRegVerification: {
    isValid: true,
    taxType: "일반과세자",
    startDate: "2024-03-15",
  },
};

async function safeSignedUrl(downloadUrl: string | undefined): Promise<string | null> {
  if (!downloadUrl) return null;
  const path = extractStoragePath(downloadUrl);
  if (!path) return downloadUrl;
  try {
    return await getStorageSignedUrl(path, 300);
  } catch {
    return null;
  }
}

export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  let vendor: VendorDoc | null = null;

  try {
    const trpc = await trpcServer();
    vendor = (await trpc.admin.vendor.getById({ vendorId })) as VendorDoc;
  } catch {
    if (PREVIEW_MODE) {
      vendor = { ...DEMO_VENDOR, id: vendorId };
    }
  }

  if (!vendor) notFound();

  const [bizRegUrl, salesLicenseUrl, manufactureLicenseUrl] = await Promise.all([
    safeSignedUrl(vendor.bizRegImageUrl),
    safeSignedUrl(vendor.salesLicenseImageUrl),
    safeSignedUrl(vendor.manufactureLicenseUrl),
  ]);

  const statusTone =
    STATUS_TONE[vendor.status] ??
    "border-[var(--color-border-default)] text-[var(--color-text-secondary)]";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:px-12 md:py-16">
      <Link
        href="/admin/vendors"
        className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        심사 큐로
      </Link>

      <header className="mt-8 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Vendor Review
          </p>
          <h1 className="mt-3 truncate text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            {vendor.companyName}
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            {VENDOR_TYPE_LABEL[vendor.vendorType] ?? vendor.vendorType}
            <span className="mx-2 text-[var(--color-border-default)]">·</span>
            <span className="font-mono tabular-nums">{vendor.bizRegNo}</span>
          </p>
        </div>
        <span
          className={`inline-flex h-8 items-center rounded-full border px-4 text-xs font-medium ${statusTone}`}
        >
          {STATUS_LABEL[vendor.status] ?? vendor.status}
        </span>
      </header>

      <div className="mt-16 grid gap-16 lg:grid-cols-[1fr_320px]">
        {/* Left — details */}
        <div className="min-w-0 space-y-16">
          <LineSection title="회사 정보">
            <DlGrid>
              <DlRow k="대표자" v={vendor.ceoName} />
              <DlRow k="전화" v={vendor.phone} />
              <DlRow k="이메일" v={vendor.email} />
              <DlRow
                k="주소"
                v={`(${vendor.zipcode}) ${vendor.address}${
                  vendor.addressDetail ? ` ${vendor.addressDetail}` : ""
                }`}
              />
              {vendor.salesLicenseNo && (
                <DlRow k="판매업 신고번호" v={vendor.salesLicenseNo} />
              )}
            </DlGrid>
          </LineSection>

          <LineSection title="정산 계좌">
            <DlGrid>
              <DlRow k="은행 코드" v={vendor.payoutBankCode ?? "—"} />
              <DlRow
                k="계좌번호"
                v={maskBankAccount(vendor.payoutBankAccount)}
                mono
              />
              <DlRow k="예금주" v={vendor.payoutAccountHolder ?? "—"} />
              <DlRow
                k="기본 수수료율"
                v={`${(vendor.defaultCommissionRate * 100).toFixed(1)}%`}
              />
            </DlGrid>
          </LineSection>

          <LineSection title="영업 카테고리">
            <div className="flex flex-wrap gap-2">
              {(vendor.categories ?? []).map((c) => (
                <span
                  key={c}
                  className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-text-secondary)]"
                >
                  {c}
                </span>
              ))}
              {(vendor.categories ?? []).length === 0 && (
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  카테고리 미선택
                </span>
              )}
            </div>
          </LineSection>

          <LineSection title="제출 서류" hint="서류 링크는 5분 후 만료됩니다">
            <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              <DocLineRow label="사업자등록증" url={bizRegUrl} kind="biz-reg" />
              {vendor.vendorType === "DISTRIBUTOR" && (
                <DocLineRow
                  label="의료기기 판매업 신고증"
                  url={salesLicenseUrl}
                  kind="sales-license"
                />
              )}
              {(vendor.vendorType === "MANUFACTURER" ||
                vendor.vendorType === "IMPORTER") && (
                <DocLineRow
                  label="제조·수입업 허가증"
                  url={manufactureLicenseUrl}
                  kind="manufacture-license"
                />
              )}
            </ul>
          </LineSection>

          {vendor.bizRegOcr && (
            <LineSection
              title="사업자등록증 OCR 결과"
              hint={`신뢰도 ${(vendor.bizRegOcr.confidence * 100).toFixed(0)}%`}
            >
              <dl className="divide-y divide-[var(--color-border-light)]">
                <OcrCompareRow
                  k="사업자번호"
                  user={vendor.bizRegNo}
                  ocr={vendor.bizRegOcr.bizRegNo}
                  mono
                />
                <OcrCompareRow
                  k="상호"
                  user={vendor.companyName}
                  ocr={vendor.bizRegOcr.companyName}
                />
                <OcrCompareRow
                  k="대표자"
                  user={vendor.ceoName}
                  ocr={vendor.bizRegOcr.ceoName}
                />
              </dl>
            </LineSection>
          )}

          {vendor.bizRegVerification && (
            <LineSection title="사업자 진위확인" hint="국세청 OpenAPI">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {vendor.bizRegVerification.isValid ? (
                    <>
                      <CheckCircle2
                        className="h-5 w-5 text-[var(--color-success)]"
                        strokeWidth={2.2}
                      />
                      <span className="text-sm font-medium text-[var(--color-success)]">
                        유효 사업자
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle
                        className="h-5 w-5 text-[var(--color-error)]"
                        strokeWidth={2.2}
                      />
                      <span className="text-sm font-medium text-[var(--color-error)]">
                        휴·폐업 사업자
                      </span>
                    </>
                  )}
                </div>
                <dl className="divide-y divide-[var(--color-border-light)] border-t border-[var(--color-border-light)] pt-2">
                  <DlRow
                    k="과세 유형"
                    v={vendor.bizRegVerification.taxType ?? "—"}
                  />
                  <DlRow
                    k="개업일"
                    v={vendor.bizRegVerification.startDate ?? "—"}
                  />
                </dl>
              </div>
            </LineSection>
          )}
        </div>

        {/* Right — sticky action panel */}
        <aside className="space-y-10 lg:sticky lg:top-8 lg:self-start">
          <VendorActions
            vendorId={vendor.id}
            currentStatus={vendor.status}
            currentGrade={vendor.grade ?? null}
          />

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              메타 정보
            </p>
            <dl className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              <MetaRow label="Vendor ID" value={vendor.id} mono />
              <MetaRow label="현재 상태" value={vendor.status} mono />
              {vendor.statusReason && (
                <MetaRow label="이전 사유" value={vendor.statusReason} />
              )}
            </dl>
          </div>

          <VendorMemoPanel vendorId={vendor.id} />

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              심사 이력
            </p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
              상태 변경 이력은 추후 별도 패널에서 제공됩니다.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function LineSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-[var(--color-border-light)] pb-4">
        <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
        {hint && (
          <p className="text-[11px] text-[var(--color-text-tertiary)]">{hint}</p>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function DlGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="divide-y divide-[var(--color-border-light)]">{children}</dl>
  );
}

function DlRow({
  k,
  v,
  mono = false,
}: {
  k: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3.5">
      <dt className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {k}
      </dt>
      <dd
        className={`break-all text-right text-sm text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {v}
      </dd>
    </div>
  );
}

function DocLineRow({
  label,
  url,
  kind,
}: {
  label: string;
  url: string | null;
  kind: string;
}) {
  if (!url) {
    return (
      <li className="flex items-center gap-4 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-[var(--color-border-default)] text-[var(--color-text-tertiary)]">
          <FileText className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-text-tertiary)]">
            {label}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            미제출 또는 URL 없음
          </p>
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-4 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)]">
        <FileText className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {kind} · 5분 만료 signed URL
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[var(--color-border-default)] px-3 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
      >
        새 탭으로
        <ExternalLink className="h-3 w-3" />
      </a>
    </li>
  );
}

function OcrCompareRow({
  k,
  user,
  ocr,
  mono = false,
}: {
  k: string;
  user: string;
  ocr: string | null;
  mono?: boolean;
}) {
  const match =
    !!ocr && ocr.replace(/\s/g, "") === user.replace(/\s/g, "");
  return (
    <div className="grid grid-cols-[110px_1fr_1fr_28px] items-baseline gap-4 py-3.5">
      <dt className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {k}
      </dt>
      <dd
        className={`break-all text-sm text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        <span className="block text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          사용자 입력
        </span>
        <span className="mt-0.5 block">{user || "—"}</span>
      </dd>
      <dd
        className={`break-all text-sm ${
          match
            ? "text-[var(--color-text-primary)]"
            : "text-[var(--color-warning)]"
        } ${mono ? "font-mono tabular-nums" : ""}`}
      >
        <span className="block text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          OCR 추출
        </span>
        <span className="mt-0.5 block">{ocr ?? "—"}</span>
      </dd>
      <span aria-hidden className="flex justify-end self-center">
        {ocr ? (
          match ? (
            <CheckCircle2
              className="h-4 w-4 text-[var(--color-success)]"
              strokeWidth={2.4}
            />
          ) : (
            <AlertCircle
              className="h-4 w-4 text-[var(--color-warning)]"
              strokeWidth={2.4}
            />
          )
        ) : null}
      </span>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <dt className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd
        className={`break-all text-xs text-[var(--color-text-primary)] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
