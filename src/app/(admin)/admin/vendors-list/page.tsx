import Link from "next/link";

import { CountUp } from "@/components/shared/count-up";
import { trpcServer } from "@/lib/trpc/server";
import type { Vendor, VendorGrade, VendorType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 운영자 — 공급업체 회원 관리.
 *
 * `/admin/vendors`(입점 심사 큐)와 별도. 승인된 + 정지 vendor list.
 * Wave K — admin.vendor.listApproved + listApprovedCounts 풀 연동.
 */

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

type SegmentValue = "ALL" | "DISTRIBUTOR" | "MANUFACTURER" | "IMPORTER" | "SUSPENDED";

const SEGMENTS: Array<{ value: SegmentValue; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "DISTRIBUTOR", label: "판매업자" },
  { value: "MANUFACTURER", label: "제조업자" },
  { value: "IMPORTER", label: "수입업자" },
  { value: "SUSPENDED", label: "정지" },
];

const VENDOR_TYPE_LABEL: Record<string, string> = {
  DISTRIBUTOR: "판매",
  MANUFACTURER: "제조",
  IMPORTER: "수입",
};

const GRADE_LABEL: Record<VendorGrade, string> = {
  STANDARD: "STD",
  PLUS: "PLUS",
  PREMIUM: "PRM",
  DIRECT: "DRT",
};

const GRADE_TONE: Record<VendorGrade, string> = {
  PREMIUM: "border-[var(--color-accent)] text-[var(--color-accent)]",
  DIRECT: "border-[var(--color-success)] text-[var(--color-success)]",
  PLUS: "border-[var(--color-border-default)] text-[var(--color-text-secondary)]",
  STANDARD: "border-[var(--color-border-light)] text-[var(--color-text-tertiary)]",
};

type Counts = {
  total: number;
  distributor: number;
  manufacturer: number;
  importer: number;
  newThisMonth: number;
  suspended: number;
};

const DEMO_COUNTS: Counts = {
  total: 142,
  distributor: 78,
  manufacturer: 42,
  importer: 22,
  newThisMonth: 8,
  suspended: 4,
};

const DEMO_APPROVED: Vendor[] = [
  demoVendor("demo-v1", "(주)메디서플라이", "DISTRIBUTOR", "123-45-67890", "PREMIUM", 0.04, 142, 482_000_000),
  demoVendor("demo-v2", "한빛메디칼(주)", "MANUFACTURER", "234-56-78901", "PREMIUM", 0.04, 88, 312_000_000),
  demoVendor("demo-v3", "케어스토어", "DISTRIBUTOR", "345-67-89012", "PLUS", 0.045, 92, 184_000_000),
  demoVendor("demo-v4", "헬스케어", "IMPORTER", "456-78-90123", "DIRECT", 0.035, 48, 524_000_000),
  demoVendor("demo-v5", "덴탈프로", "DISTRIBUTOR", "567-89-01234", "STANDARD", 0.05, 64, 92_000_000),
  demoVendor("demo-v6", "올드메디", "DISTRIBUTOR", "678-90-12345", "PLUS", 0.045, 72, 128_000_000),
  demoVendor("demo-v7", "라이프케어솔루션", "MANUFACTURER", "789-01-23456", "PLUS", 0.045, 38, 210_000_000),
];

const DEMO_SUSPENDED: Vendor[] = [
  demoVendor("demo-s1", "테스트벤더", "DISTRIBUTOR", "890-12-34567", "STANDARD", 0.05, 8, 12_000_000, "SUSPENDED"),
  demoVendor("demo-s2", "프리메디칼", "DISTRIBUTOR", "901-23-45678", "STANDARD", 0.05, 22, 48_000_000, "SUSPENDED"),
];

function demoVendor(
  id: string,
  companyName: string,
  vendorType: VendorType,
  bizRegNo: string,
  grade: VendorGrade,
  rate: number,
  productCount: number,
  totalGmv: number,
  status: "APPROVED" | "SUSPENDED" = "APPROVED",
): Vendor {
  const now = Math.floor(Date.now() / 1000);
  return {
    id,
    bizRegNo,
    bizRegImageUrl: "",
    companyName,
    ceoName: "",
    phone: "",
    email: "",
    zipcode: "",
    address: "",
    vendorType,
    status,
    defaultCommissionRate: rate,
    fastSettlementEnabled: false,
    categories: [],
    productCount,
    totalGmv,
    reviewCount: 0,
    grade,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt: { seconds: now - 60 * 86400 } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedAt: { seconds: now } as any,
  };
}

export default async function AdminVendorsListPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const requested = sp.segment as SegmentValue | undefined;
  const segment: SegmentValue =
    SEGMENTS.find((s) => s.value === requested)?.value ?? "ALL";
  const search = (sp.q ?? "").trim() || undefined;

  let counts: Counts = DEMO_COUNTS;
  let vendors: Vendor[] = [];
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    counts = await trpc.admin.vendor.listApprovedCounts();

    if (segment === "SUSPENDED") {
      const res = await trpc.admin.vendor.list({ status: "SUSPENDED", pageSize: 50 });
      vendors = res.vendors;
      if (search) {
        const k = search.toLowerCase();
        vendors = vendors.filter(
          (v) =>
            v.companyName?.toLowerCase().includes(k) ||
            v.bizRegNo?.includes(search),
        );
      }
    } else {
      const vendorTypeFilter: VendorType | undefined =
        segment === "DISTRIBUTOR" || segment === "MANUFACTURER" || segment === "IMPORTER"
          ? segment
          : undefined;
      const res = await trpc.admin.vendor.listApproved({
        vendorType: vendorTypeFilter,
        search,
        pageSize: 50,
      });
      vendors = res.vendors;
    }
  } catch {
    if (!PREVIEW_MODE) {
      throw new Error("관리자 권한이 필요합니다.");
    }
    isPreview = true;
    if (segment === "SUSPENDED") {
      vendors = DEMO_SUSPENDED;
    } else if (segment === "DISTRIBUTOR") {
      vendors = DEMO_APPROVED.filter((v) => v.vendorType === "DISTRIBUTOR");
    } else if (segment === "MANUFACTURER") {
      vendors = DEMO_APPROVED.filter((v) => v.vendorType === "MANUFACTURER");
    } else if (segment === "IMPORTER") {
      vendors = DEMO_APPROVED.filter((v) => v.vendorType === "IMPORTER");
    } else {
      vendors = DEMO_APPROVED;
    }
    if (search) {
      const k = search.toLowerCase();
      vendors = vendors.filter(
        (v) =>
          v.companyName?.toLowerCase().includes(k) ||
          v.bizRegNo?.includes(search),
      );
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
        회원 · 공급업체
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        공급업체 회원 관리
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        입점 승인된 공급업체의 회원·운영 현황
        {isPreview && (
          <span className="ml-2 inline-flex h-5 items-center rounded-full border border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-2 text-[10px] font-medium text-[var(--color-warning)]">
            PREVIEW
          </span>
        )}
      </p>

      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <KpiCell label="총 공급업체" value={counts.total} unit="곳" />
        <KpiCell
          label="활성 (전체)"
          value={counts.total}
          unit="곳"
          deltaTone="success"
          delta={`${counts.distributor + counts.manufacturer + counts.importer}곳 분류`}
        />
        <KpiCell
          label="신규 (이번달)"
          value={counts.newThisMonth}
          unit="곳"
          deltaTone="accent"
          delta={counts.newThisMonth > 0 ? "이번 달 신규" : "—"}
        />
        <KpiCell
          label="정지 중"
          value={counts.suspended}
          unit="곳"
          deltaTone={counts.suspended > 0 ? "error" : "success"}
          delta={counts.suspended > 0 ? "모니터링" : "정상"}
        />
      </dl>

      <nav
        className="mt-10 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="공급업체 필터"
      >
        {SEGMENTS.map((s) => {
          const active = segment === s.value;
          const count =
            s.value === "ALL"
              ? counts.total
              : s.value === "DISTRIBUTOR"
                ? counts.distributor
                : s.value === "MANUFACTURER"
                  ? counts.manufacturer
                  : s.value === "IMPORTER"
                    ? counts.importer
                    : counts.suspended;
          const href = buildHref({ segment: s.value, q: search });
          return (
            <Link
              key={s.value}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {s.label}
              <span className="ml-1.5 text-xs tabular-nums text-[var(--color-text-tertiary)]">
                {count}
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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form
          method="get"
          action="/admin/vendors-list"
          className="ml-auto flex items-center gap-2"
        >
          <input type="hidden" name="segment" value={segment} />
          <input
            type="search"
            name="q"
            defaultValue={search ?? ""}
            placeholder="회사명/사업자번호 검색…"
            className="h-8 w-64 border-b border-[var(--color-border-light)] bg-transparent text-xs placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </form>
      </div>

      <div className="mt-8 border-y border-[var(--color-border-light)]">
        <div className="hidden md:grid grid-cols-[1.4fr_140px_80px_60px_120px_140px_80px_80px] gap-3 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>회사명</span>
          <span>사업자번호</span>
          <span>유형</span>
          <span>등급</span>
          <span>가입일</span>
          <span className="text-right">누적 매출</span>
          <span className="text-right">활성 상품</span>
          <span>상태</span>
        </div>
        <ul className="divide-y divide-[var(--color-border-light)]">
          {vendors.length === 0 && (
            <li className="px-2 py-16 text-center text-sm text-[var(--color-text-tertiary)]">
              {search
                ? `"${search}" 검색 결과 없음`
                : "해당 조건에 맞는 공급업체가 없습니다"}
            </li>
          )}
          {vendors.map((v) => {
            const grade: VendorGrade = (v.grade ?? "STANDARD") as VendorGrade;
            const isSuspended = v.status === "SUSPENDED";
            const statusColor = isSuspended
              ? "text-[var(--color-error)]"
              : "text-[var(--color-success)]";
            const statusLabel = isSuspended ? "정지" : "활성";
            return (
              <li key={v.id}>
                {/* Desktop: grid row */}
                <div className="hidden md:grid grid-cols-[1.4fr_140px_80px_60px_120px_140px_80px_80px] items-center gap-3 px-2 py-3.5 text-sm">
                  <Link
                    href={`/admin/vendors/${v.id}`}
                    className="truncate font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                  >
                    {v.companyName}
                  </Link>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                    {v.bizRegNo}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {VENDOR_TYPE_LABEL[v.vendorType] ?? v.vendorType}
                  </span>
                  <span
                    className={`inline-flex h-5 w-fit items-center rounded-full border px-1.5 text-[10px] font-medium ${GRADE_TONE[grade]}`}
                    title={`등급: ${grade} · 수수료 ${(v.defaultCommissionRate * 100).toFixed(1)}%`}
                  >
                    {GRADE_LABEL[grade]}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                    {formatJoinedAt(v.createdAt)}
                  </span>
                  <span className="text-right font-mono tabular-nums">
                    ₩{(v.totalGmv ?? 0).toLocaleString()}
                  </span>
                  <span className="text-right font-mono text-xs tabular-nums">
                    {v.productCount ?? 0}
                  </span>
                  <span className={`text-xs font-medium ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>
                {/* Mobile: card layout */}
                <Link
                  href={`/admin/vendors/${v.id}`}
                  className="flex flex-col gap-2 px-3 py-4 transition-colors hover:bg-[var(--color-bg-secondary)]/40 md:hidden"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">
                      {v.companyName}
                    </span>
                    <span
                      className={`inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-[10px] font-medium ${GRADE_TONE[grade]}`}
                    >
                      {GRADE_LABEL[grade]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-mono tabular-nums text-[var(--color-text-tertiary)]">
                      {v.bizRegNo}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      ₩{(v.totalGmv ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                    <span>
                      {VENDOR_TYPE_LABEL[v.vendorType] ?? v.vendorType} · 활성 상품 {v.productCount ?? 0}
                    </span>
                    <span className={`font-medium ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function buildHref({
  segment,
  q,
}: {
  segment: SegmentValue;
  q?: string;
}): string {
  const params = new URLSearchParams();
  if (segment !== "ALL") params.set("segment", segment);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/admin/vendors-list?${qs}` : "/admin/vendors-list";
}

function formatJoinedAt(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "—";
  const w1 = ts as { toDate?: () => Date };
  if (typeof w1.toDate === "function") {
    try {
      const d = w1.toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      /* fallthrough */
    }
  }
  const w2 = ts as { seconds?: number; _seconds?: number };
  const sec = w2.seconds ?? w2._seconds;
  if (typeof sec === "number") {
    const d = new Date(sec * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return "—";
}

function KpiCell({
  label,
  value,
  unit,
  delta,
  deltaTone,
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: string;
  deltaTone?: "accent" | "warning" | "error" | "success";
}) {
  const deltaColor = {
    accent: "text-[var(--color-accent)]",
    warning: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
    success: "text-[var(--color-success)]",
  } as const;
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
        <CountUp value={value} integer />
        {unit && (
          <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
            {unit}
          </span>
        )}
      </p>
      {delta && (
        <p
          className={`mt-2 text-xs ${
            deltaTone ? deltaColor[deltaTone] : "text-[var(--color-text-tertiary)]"
          }`}
        >
          {delta}
        </p>
      )}
    </div>
  );
}
