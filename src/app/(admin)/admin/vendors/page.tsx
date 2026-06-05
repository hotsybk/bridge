import Link from "next/link";

import { CountUp } from "@/components/shared/count-up";
import { trpcServer } from "@/lib/trpc/server";

import { VendorBulkTable } from "./bulk-actions";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

const STATUS_TABS = [
  { value: "PENDING_REVIEW", label: "심사 대기" },
  { value: "APPROVED", label: "승인됨" },
  { value: "REJECTED", label: "반려" },
  { value: "SUSPENDED", label: "정지" },
] as const;

type StatusValue = (typeof STATUS_TABS)[number]["value"];

type AdminVendor = {
  id: string;
  companyName: string;
  vendorType: string;
  bizRegNo: string;
  ceoName: string;
  createdAt: unknown;
};

// 데모 데이터 — 비로그인 dev 환경에서만
const DEMO_DATA: Record<StatusValue, AdminVendor[]> = {
  PENDING_REVIEW: [
    {
      id: "demo-v1",
      companyName: "(주)메디서플라이",
      vendorType: "DISTRIBUTOR",
      bizRegNo: "123-45-67890",
      ceoName: "김민수",
      createdAt: { _seconds: Math.floor(Date.now() / 1000) - 86400 },
    },
    {
      id: "demo-v2",
      companyName: "한빛메디칼(주)",
      vendorType: "MANUFACTURER",
      bizRegNo: "201-86-44512",
      ceoName: "이주현",
      createdAt: { _seconds: Math.floor(Date.now() / 1000) - 172800 },
    },
    {
      id: "demo-v3",
      companyName: "케어스토어",
      vendorType: "IMPORTER",
      bizRegNo: "445-21-08812",
      ceoName: "박지연",
      createdAt: { _seconds: Math.floor(Date.now() / 1000) - 259200 },
    },
  ],
  APPROVED: [
    {
      id: "demo-v4",
      companyName: "서울헬스케어",
      vendorType: "DISTRIBUTOR",
      bizRegNo: "120-81-55621",
      ceoName: "정현우",
      createdAt: { _seconds: Math.floor(Date.now() / 1000) - 1296000 },
    },
    {
      id: "demo-v5",
      companyName: "GS메디칼",
      vendorType: "MANUFACTURER",
      bizRegNo: "211-87-44782",
      ceoName: "장수빈",
      createdAt: { _seconds: Math.floor(Date.now() / 1000) - 2592000 },
    },
  ],
  REJECTED: [
    {
      id: "demo-v6",
      companyName: "테스트벤더",
      vendorType: "DISTRIBUTOR",
      bizRegNo: "999-99-99999",
      ceoName: "홍길동",
      createdAt: { _seconds: Math.floor(Date.now() / 1000) - 432000 },
    },
  ],
  SUSPENDED: [],
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

  // 4개 status 별 카운트 + 현재 목록
  let pendingList: AdminVendor[] = [];
  let approvedList: AdminVendor[] = [];
  let rejectedList: AdminVendor[] = [];
  let suspendedList: AdminVendor[] = [];

  try {
    const trpc = await trpcServer();
    const [p, a, r, s] = await Promise.all([
      trpc.admin.vendor.list({ status: "PENDING_REVIEW" }),
      trpc.admin.vendor.list({ status: "APPROVED" }),
      trpc.admin.vendor.list({ status: "REJECTED" }),
      trpc.admin.vendor.list({ status: "SUSPENDED" }),
    ]);
    pendingList = p.vendors as AdminVendor[];
    approvedList = a.vendors as AdminVendor[];
    rejectedList = r.vendors as AdminVendor[];
    suspendedList = s.vendors as AdminVendor[];
  } catch {
    if (PREVIEW_MODE) {
      pendingList = DEMO_DATA.PENDING_REVIEW;
      approvedList = DEMO_DATA.APPROVED;
      rejectedList = DEMO_DATA.REJECTED;
      suspendedList = DEMO_DATA.SUSPENDED;
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  const currentList =
    status === "PENDING_REVIEW"
      ? pendingList
      : status === "APPROVED"
        ? approvedList
        : status === "REJECTED"
          ? rejectedList
          : suspendedList;

  const counts: Record<StatusValue, number> = {
    PENDING_REVIEW: pendingList.length,
    APPROVED: approvedList.length,
    REJECTED: rejectedList.length,
    SUSPENDED: suspendedList.length,
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-20">
      {/* Eyebrow + h1 */}
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
        운영자 · 입점 심사
      </p>
      <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        공급업체 입점을 심사합니다
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-[var(--color-text-secondary)]">
        신청 서류를 검토하고 승인·반려·정지를 결정합니다.
      </p>

      {/* KPI — divider only */}
      <dl className="mt-14 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        {STATUS_TABS.map((t) => (
          <KpiCell
            key={t.value}
            label={t.label}
            value={counts[t.value]}
            active={status === t.value}
          />
        ))}
      </dl>

      {/* Filter tabs — underline only */}
      <nav
        className="mt-12 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="status 필터"
      >
        {STATUS_TABS.map((t) => {
          const active = status === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/vendors?status=${t.value}`}
              className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs tabular-nums text-[var(--color-text-tertiary)]">
                {counts[t.value]}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-0.5 bg-[var(--color-accent)]"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* List */}
      {currentList.length === 0 ? (
        <EmptyRow status={status} />
      ) : (
        <VendorBulkTable
          vendors={currentList}
          enableBulk={status === "PENDING_REVIEW"}
        />
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function KpiCell({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active: boolean;
}) {
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <p
        className={`text-[11px] font-medium uppercase tracking-[0.18em] transition-colors ${
          active
            ? "text-[var(--color-accent)]"
            : "text-[var(--color-text-tertiary)]"
        }`}
      >
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
        <CountUp value={value} />
        <span className="ml-1 text-sm font-normal text-[var(--color-text-tertiary)]">
          건
        </span>
      </p>
    </div>
  );
}

function EmptyRow({ status }: { status: StatusValue }) {
  const label = STATUS_TABS.find((t) => t.value === status)?.label ?? "";
  return (
    <div className="border-b border-[var(--color-border-light)] py-24 text-center">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {label} 상태의 입점 신청이 없습니다
      </p>
      {status !== "PENDING_REVIEW" ? (
        <Link
          href="/admin/vendors?status=PENDING_REVIEW"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          심사 대기로 가기 →
        </Link>
      ) : (
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          새 신청은 자동으로 추가됩니다
        </p>
      )}
    </div>
  );
}

