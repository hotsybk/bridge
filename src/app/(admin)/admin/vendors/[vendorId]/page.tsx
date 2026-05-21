import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  Eye,
  FileText,
} from "lucide-react";

import { extractStoragePath, getStorageSignedUrl } from "@/server/firebase/admin";
import { trpcServer } from "@/lib/trpc/server";

import { VendorActions } from "./actions";

export const dynamic = "force-dynamic";

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
  PENDING_DOCS: "bg-[var(--color-warning)]/12 text-[var(--color-warning)]",
  PENDING_REVIEW: "bg-[var(--color-accent-light)] text-[var(--color-accent)]",
  APPROVED: "bg-[var(--color-success)]/12 text-[var(--color-success)]",
  SUSPENDED: "bg-[var(--color-warning)]/12 text-[var(--color-warning)]",
  REJECTED: "bg-[var(--color-error)]/12 text-[var(--color-error)]",
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
  const trpc = await trpcServer();
  const vendor = await trpc.admin.vendor.getById({ vendorId });
  if (!vendor) notFound();

  const [bizRegUrl, salesLicenseUrl, manufactureLicenseUrl] = await Promise.all([
    safeSignedUrl(vendor.bizRegImageUrl),
    safeSignedUrl(vendor.salesLicenseImageUrl),
    safeSignedUrl(vendor.manufactureLicenseUrl),
  ]);

  const statusTone = STATUS_TONE[vendor.status] ?? "bg-[var(--color-bg-secondary)]";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:px-12 md:py-14">
      <Link
        href="/admin/vendors"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        심사 큐로
      </Link>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Vendor {vendor.id}
          </p>
          <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight md:text-4xl">
            {vendor.companyName}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {VENDOR_TYPE_LABEL[vendor.vendorType] ?? vendor.vendorType} ·{" "}
            <span className="font-mono">{vendor.bizRegNo}</span>
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${statusTone}`}
        >
          {STATUS_LABEL[vendor.status] ?? vendor.status}
        </span>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Left — 상세 정보 */}
        <div className="space-y-6 min-w-0">
          <Section title="회사 정보">
            <Dl>
              <Row k="대표자" v={vendor.ceoName} />
              <Row k="전화" v={vendor.phone} />
              <Row k="이메일" v={vendor.email} />
              <Row
                k="주소"
                v={`(${vendor.zipcode}) ${vendor.address}${vendor.addressDetail ? ` ${vendor.addressDetail}` : ""}`}
              />
              {vendor.salesLicenseNo && (
                <Row k="판매업 신고번호" v={vendor.salesLicenseNo} />
              )}
            </Dl>
          </Section>

          <Section title="정산 계좌">
            <Dl>
              <Row k="은행 코드" v={vendor.payoutBankCode ?? "—"} />
              <Row k="계좌번호" v={vendor.payoutBankAccount ?? "—"} />
              <Row k="예금주" v={vendor.payoutAccountHolder ?? "—"} />
              <Row
                k="기본 수수료율"
                v={`${(vendor.defaultCommissionRate * 100).toFixed(1)}%`}
              />
            </Dl>
          </Section>

          <Section title="영업 카테고리">
            <div className="flex flex-wrap gap-2">
              {(vendor.categories ?? []).map((c: string) => (
                <span
                  key={c}
                  className="rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs text-[var(--color-accent)]"
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
          </Section>

          <Section
            title="제출 서류"
            footer="서류 링크는 5분 후 만료됩니다."
          >
            <div className="space-y-3">
              <DocCard
                label="사업자등록증"
                url={bizRegUrl}
                kind="biz-reg"
              />
              {vendor.vendorType === "DISTRIBUTOR" && (
                <DocCard
                  label="의료기기 판매업 신고증"
                  url={salesLicenseUrl}
                  kind="sales-license"
                />
              )}
              {(vendor.vendorType === "MANUFACTURER" ||
                vendor.vendorType === "IMPORTER") && (
                <DocCard
                  label="제조·수입업 허가증"
                  url={manufactureLicenseUrl}
                  kind="manufacture-license"
                />
              )}
            </div>
          </Section>
        </div>

        {/* Right — sticky 액션 패널 */}
        <aside className="lg:sticky lg:top-8 lg:self-start space-y-5">
          <VendorActions vendorId={vendor.id} currentStatus={vendor.status} />

          <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              메타 정보
            </p>
            <dl className="mt-4 space-y-3 text-xs">
              <div>
                <dt className="text-[var(--color-text-tertiary)]">Vendor ID</dt>
                <dd className="mt-0.5 break-all font-mono text-[var(--color-text-secondary)]">
                  {vendor.id}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-tertiary)]">현재 상태</dt>
                <dd className="mt-0.5 font-mono">{vendor.status}</dd>
              </div>
              {(vendor as { statusReason?: string }).statusReason && (
                <div>
                  <dt className="text-[var(--color-text-tertiary)]">이전 사유</dt>
                  <dd className="mt-0.5 text-[var(--color-text-secondary)]">
                    {(vendor as { statusReason?: string }).statusReason}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-2xl border border-dashed border-[var(--color-border-light)] p-5 text-xs text-[var(--color-text-tertiary)]">
            <p className="font-medium text-[var(--color-text-secondary)]">
              심사 이력
            </p>
            <p className="mt-2">
              Phase 2 백로그 — 상태 변경 이력은 추후 별도 패널에서 제공됩니다.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────────────────────

function Section({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
      {footer && (
        <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">{footer}</p>
      )}
    </section>
  );
}

function Dl({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
      {children}
    </dl>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-[var(--color-text-secondary)]">{k}</dt>
      <dd className="break-all">{v}</dd>
    </>
  );
}

function DocCard({
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
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--color-border-light)] p-3 text-sm text-[var(--color-text-tertiary)]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-bg-secondary)]">
          <FileText className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="text-xs">미제출 또는 URL 없음</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border-light)] p-3 transition-shadow hover:shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-accent-light)] text-[var(--color-accent)]">
        <FileText className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {kind} · 5분 만료 signed URL
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-3 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-accent-light)]"
      >
        <Eye className="h-3 w-3" />새 탭
      </a>
    </div>
  );
}

// Building2 used in dl/dt above potentially (no current usage) — keep import to avoid unused warning is unneeded since we use it nowhere; tree-shaken.
void Building2;
