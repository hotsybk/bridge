import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  ShieldX,
  XCircle,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { trpcServer } from "@/lib/trpc/server";

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

  // 4개 status 별 카운트 가져오기 (통계 카드용)
  const [pendingList, approvedList, rejectedList, suspendedList] = await Promise.all([
    trpc.admin.vendor.list({ status: "PENDING_REVIEW" }),
    trpc.admin.vendor.list({ status: "APPROVED" }),
    trpc.admin.vendor.list({ status: "REJECTED" }),
    trpc.admin.vendor.list({ status: "SUSPENDED" }),
  ]);

  // 현재 status 에 해당하는 vendor 목록
  const currentList =
    status === "PENDING_REVIEW"
      ? pendingList
      : status === "APPROVED"
        ? approvedList
        : status === "REJECTED"
          ? rejectedList
          : suspendedList;

  const { vendors } = currentList;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
      <PageHeader
        label="Admin"
        title="입점 심사"
        description="공급업체 신청을 심사하고 승인·반려·정지를 결정합니다."
      />

      {/* 통계 카드 4개 */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="심사 대기"
          value={pendingList.vendors.length}
          unit="건"
          icon={Clock}
        />
        <StatCard
          label="승인됨"
          value={approvedList.vendors.length}
          unit="건"
          icon={CheckCircle2}
        />
        <StatCard
          label="반려"
          value={rejectedList.vendors.length}
          unit="건"
          icon={XCircle}
        />
        <StatCard
          label="일시정지"
          value={suspendedList.vendors.length}
          unit="건"
          icon={ShieldX}
        />
      </div>

      {/* Status 필터 탭 */}
      <nav
        className="mt-10 flex gap-1 overflow-x-auto pb-1"
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
        <div className="mt-6">
          <EmptyState
            icon={Inbox}
            title={`${STATUS_TABS.find((t) => t.value === status)?.label} 상태의 입점 신청이 없습니다`}
            description={
              status === "PENDING_REVIEW"
                ? "새 신청은 자동으로 이 목록에 추가됩니다. 잠시 후 다시 확인해주세요."
                : "필터를 다른 상태로 바꿔보세요."
            }
            action={
              status !== "PENDING_REVIEW" ? (
                <Link
                  href="/admin/vendors?status=PENDING_REVIEW"
                  className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  심사 대기로 가기
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--color-border-light)]">
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
  const withToDate = ts as { toDate?: () => Date };
  if (typeof withToDate.toDate === "function") {
    try {
      return withToDate.toDate().toLocaleDateString("ko-KR");
    } catch {
      /* fallthrough */
    }
  }
  const withSeconds = ts as { seconds?: number; _seconds?: number };
  const sec = withSeconds.seconds ?? withSeconds._seconds;
  if (typeof sec === "number") {
    return new Date(sec * 1000).toLocaleDateString("ko-KR");
  }
  return "";
}
