import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";

import { trpcServer } from "@/lib/trpc/server";

// 인증 컨텍스트 + 매 요청 데이터 fetch — 정적 prerender 불가.
export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { value: "PENDING_REVIEW", label: "심사 대기" },
  { value: "APPROVED", label: "승인됨" },
  { value: "REJECTED", label: "반려" },
  { value: "SUSPENDED", label: "정지" },
] as const;

type StatusValue = (typeof STATUS_TABS)[number]["value"];

const VENDOR_TYPE_LABEL: Record<string, string> = {
  DISTRIBUTOR: "판매업자",
  MANUFACTURER: "제조업자",
  IMPORTER: "수입업자",
};

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const requested = sp.status as StatusValue | undefined;
  const status: StatusValue =
    STATUS_TABS.find((t) => t.value === requested)?.value ?? "PENDING_REVIEW";

  const trpc = await trpcServer();
  const { vendors } = await trpc.admin.vendor.list({ status });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">입점 심사</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          공급업체 신청을 심사하고 승인·반려·정지를 결정합니다.
        </p>
      </header>

      {/* Status 필터 탭 */}
      <nav
        className="mb-6 flex gap-1 overflow-x-auto pb-1"
        aria-label="status 필터"
      >
        {STATUS_TABS.map((t) => {
          const active = status === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/vendors?status=${t.value}`}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-light)]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* 빈 상태 / 목록 */}
      {vendors.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--color-bg-secondary)] p-16 text-center">
          <Inbox className="h-10 w-10 text-[var(--color-text-tertiary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {STATUS_TABS.find((t) => t.value === status)?.label} 상태의 입점 신청이 없습니다.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-light)]">
          <table className="w-full">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <Th>회사명</Th>
                <Th>구분</Th>
                <Th>사업자번호</Th>
                <Th>대표자</Th>
                <Th align="right">신청일</Th>
                <th className="px-4 py-3">
                  <span className="sr-only">상세</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-light)]">
              {vendors.map((v) => (
                <tr
                  key={v.id}
                  className="transition-colors hover:bg-[var(--color-bg-tertiary)]"
                >
                  <td className="px-4 py-3 text-sm font-medium">{v.companyName}</td>
                  <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    {VENDOR_TYPE_LABEL[v.vendorType] ?? v.vendorType}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums">{v.bizRegNo}</td>
                  <td className="px-4 py-3 text-sm">{v.ceoName}</td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums text-[var(--color-text-secondary)]">
                    {formatDate(v.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/vendors/${v.id}`}
                      className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
                    >
                      심사
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function formatDate(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "";
  // Firestore Admin Timestamp (toDate 메서드)
  const withToDate = ts as { toDate?: () => Date };
  if (typeof withToDate.toDate === "function") {
    try {
      return withToDate.toDate().toLocaleDateString("ko-KR");
    } catch {
      /* fallthrough */
    }
  }
  // superjson serialize 후 { seconds, nanoseconds } 또는 { _seconds, _nanoseconds }
  const withSeconds = ts as { seconds?: number; _seconds?: number };
  const sec = withSeconds.seconds ?? withSeconds._seconds;
  if (typeof sec === "number") {
    return new Date(sec * 1000).toLocaleDateString("ko-KR");
  }
  return "";
}
