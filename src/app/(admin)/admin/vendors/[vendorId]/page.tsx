import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

async function safeSignedUrl(downloadUrl: string | undefined): Promise<string | null> {
  if (!downloadUrl) return null;
  const path = extractStoragePath(downloadUrl);
  if (!path) return downloadUrl; // path 추출 실패 시 원본 사용
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

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 md:px-12 md:py-16">
      <Link
        href="/admin/vendors"
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        심사 큐로
      </Link>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Vendor {vendor.id}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {vendor.companyName}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {VENDOR_TYPE_LABEL[vendor.vendorType] ?? vendor.vendorType} ·{" "}
            <span className="font-mono">{vendor.bizRegNo}</span>
          </p>
        </div>
        <span className="inline-flex rounded-full bg-[var(--color-bg-secondary)] px-3 py-1 text-xs font-medium">
          현재 상태: {STATUS_LABEL[vendor.status] ?? vendor.status}
        </span>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 회사 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>회사 정보</CardTitle>
          </CardHeader>
          <CardContent>
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
              {(vendor.statusReason ?? null) && (
                <Row k="이전 사유" v={vendor.statusReason ?? ""} />
              )}
            </Dl>
          </CardContent>
        </Card>

        {/* 정산 계좌 */}
        <Card>
          <CardHeader>
            <CardTitle>정산 계좌</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Row k="은행 코드" v={vendor.payoutBankCode ?? ""} />
              <Row k="계좌번호" v={vendor.payoutBankAccount ?? ""} />
              <Row k="예금주" v={vendor.payoutAccountHolder ?? ""} />
              <Row
                k="기본 수수료율"
                v={`${(vendor.defaultCommissionRate * 100).toFixed(1)}%`}
              />
            </Dl>
          </CardContent>
        </Card>

        {/* 영업 카테고리 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>영업 카테고리</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(vendor.categories ?? []).map((c: string) => (
                <span
                  key={c}
                  className="rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs text-[var(--color-accent)]"
                >
                  {c}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 서류 미리보기 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>제출 서류</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DocLink label="사업자등록증" url={bizRegUrl} />
            {vendor.vendorType === "DISTRIBUTOR" && (
              <DocLink label="의료기기 판매업 신고증" url={salesLicenseUrl} />
            )}
            {(vendor.vendorType === "MANUFACTURER" ||
              vendor.vendorType === "IMPORTER") && (
              <DocLink label="제조·수입업 허가증" url={manufactureLicenseUrl} />
            )}
            <p className="pt-2 text-xs text-[var(--color-text-tertiary)]">
              ※ 서류 링크는 5분 후 만료됩니다.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 액션 — client component */}
      <div className="mt-8">
        <VendorActions vendorId={vendor.id} currentStatus={vendor.status} />
      </div>
    </main>
  );
}

function Dl({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">{children}</dl>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-[var(--color-text-secondary)]">{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

function DocLink({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-[var(--color-border-light)] p-3 text-sm text-[var(--color-text-tertiary)]">
        <span>{label}</span>
        <span className="text-xs">미제출 또는 URL 없음</span>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-xl border border-[var(--color-border-light)] p-3 text-sm transition-shadow hover:shadow-sm"
    >
      <span className="font-medium">{label}</span>
      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)]">
        새 탭에서 열기 <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}
