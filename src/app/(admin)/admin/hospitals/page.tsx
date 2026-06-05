// Wave J — 병원 회원 list. Firestore + tRPC 풀 연동 Server Component.
// PREVIEW (dev/unauth) 환경에서는 mock fallback.

import Link from "next/link";
import { ArrowRight, ChevronDown, Search } from "lucide-react";

import { AdminKpiCell } from "@/components/admin/admin-kpi-cell";
import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { PreviewBadge } from "@/components/shared/preview-badge";
import { trpcServer } from "@/lib/trpc/server";
import { tsToMs, formatDate } from "@/lib/utils/firestore-time";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

type HospitalTypeValue =
  | "CLINIC"
  | "SMALL_HOSPITAL"
  | "GENERAL_HOSPITAL"
  | "TERTIARY"
  | "ORIENTAL"
  | "DENTAL";

const TYPE_LABEL: Record<HospitalTypeValue, string> = {
  CLINIC: "의원",
  SMALL_HOSPITAL: "중소병원",
  GENERAL_HOSPITAL: "종합병원",
  TERTIARY: "상급종합",
  ORIENTAL: "한방",
  DENTAL: "치과",
};

type Tab = "ALL" | HospitalTypeValue;

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "CLINIC", label: "의원" },
  { value: "SMALL_HOSPITAL", label: "중소병원" },
  { value: "GENERAL_HOSPITAL", label: "종합병원" },
  { value: "TERTIARY", label: "상급종합" },
  { value: "ORIENTAL", label: "한방" },
  { value: "DENTAL", label: "치과" },
];

type RowHospital = {
  id: string;
  name: string;
  bizRegNo: string;
  type: HospitalTypeValue;
  joinedAtMs: number;
  lastActiveMs: number;
  cumulativeOrder: number;
  active: boolean;
};

// PREVIEW fallback. 운영 환경에서는 실제 Firestore 데이터를 사용.
const MOCK_HOSPITALS: RowHospital[] = [
  {
    id: "demo-h1",
    name: "서울메디컬의원",
    bizRegNo: "123-45-67890",
    type: "CLINIC",
    joinedAtMs: Date.parse("2025-08-12"),
    lastActiveMs: Date.parse("2026-06-01"),
    cumulativeOrder: 38420000,
    active: true,
  },
  {
    id: "demo-h2",
    name: "한빛병원",
    bizRegNo: "234-56-78901",
    type: "SMALL_HOSPITAL",
    joinedAtMs: Date.parse("2025-11-04"),
    lastActiveMs: Date.parse("2026-05-31"),
    cumulativeOrder: 124800000,
    active: true,
  },
  {
    id: "demo-h3",
    name: "동대문가정의학과",
    bizRegNo: "345-67-89012",
    type: "CLINIC",
    joinedAtMs: Date.parse("2026-01-20"),
    lastActiveMs: Date.parse("2026-05-31"),
    cumulativeOrder: 12400000,
    active: true,
  },
  {
    id: "demo-h4",
    name: "광주중앙병원",
    bizRegNo: "456-78-90123",
    type: "GENERAL_HOSPITAL",
    joinedAtMs: Date.parse("2025-04-22"),
    lastActiveMs: Date.parse("2026-05-30"),
    cumulativeOrder: 286400000,
    active: true,
  },
  {
    id: "demo-h5",
    name: "강남미소치과",
    bizRegNo: "567-89-01234",
    type: "DENTAL",
    joinedAtMs: Date.parse("2025-12-08"),
    lastActiveMs: Date.parse("2026-05-30"),
    cumulativeOrder: 18900000,
    active: true,
  },
  {
    id: "demo-h6",
    name: "서울대학교병원",
    bizRegNo: "012-34-56789",
    type: "TERTIARY",
    joinedAtMs: Date.parse("2025-03-08"),
    lastActiveMs: Date.parse("2026-05-31"),
    cumulativeOrder: 824000000,
    active: true,
  },
  {
    id: "demo-h7",
    name: "경희한방병원",
    bizRegNo: "111-22-33445",
    type: "ORIENTAL",
    joinedAtMs: Date.parse("2025-06-21"),
    lastActiveMs: Date.parse("2026-05-15"),
    cumulativeOrder: 32400000,
    active: true,
  },
  {
    id: "demo-h8",
    name: "이천이비인후과",
    bizRegNo: "222-33-44556",
    type: "CLINIC",
    joinedAtMs: Date.parse("2025-05-02"),
    lastActiveMs: Date.parse("2026-02-18"),
    cumulativeOrder: 4200000,
    active: false,
  },
];

const MOCK_COUNTS = { total: 1234, active30d: 856, newThisMonth: 47, churnRisk: 28 };

export default async function AdminHospitalsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; search?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const typeFilter = (sp.type as Tab | undefined) ?? "ALL";
  const search = sp.search ?? "";

  let rows: RowHospital[] = [];
  let counts = MOCK_COUNTS;
  let isPreview = false;
  let totalCount = 0;

  try {
    const trpc = await trpcServer();
    const [listResult, c] = await Promise.all([
      trpc.admin.hospital.list({
        type:
          typeFilter !== "ALL" ? (typeFilter as HospitalTypeValue) : undefined,
        status: sp.status === "SUSPENDED" ? "SUSPENDED" : undefined,
        search: search || undefined,
        pageSize: 50,
      }),
      trpc.admin.hospital.counts(),
    ]);

    const day30Ms = Date.now() - 30 * 86400 * 1000;
    rows = listResult.hospitals.map((h) => {
      const joinedAtMs = tsToMs(h.createdAt);
      const lastActiveMs =
        tsToMs(h.kpi?.lastActiveAt) || joinedAtMs;
      return {
        id: h.id,
        name: h.name,
        bizRegNo: h.bizRegNo,
        type: h.type as HospitalTypeValue,
        joinedAtMs,
        lastActiveMs,
        cumulativeOrder: h.kpi?.orderAmount ?? 0,
        active:
          (h.status ?? "ACTIVE") === "ACTIVE" &&
          lastActiveMs >= day30Ms,
      } satisfies RowHospital;
    });
    counts = c;
    totalCount = c.total;
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      const filtered = MOCK_HOSPITALS.filter((h) => {
        if (typeFilter !== "ALL" && h.type !== typeFilter) return false;
        if (search) {
          const lower = search.toLowerCase();
          return (
            h.name.toLowerCase().includes(lower) ||
            h.bizRegNo.includes(search)
          );
        }
        return true;
      });
      rows = filtered;
      totalCount = MOCK_HOSPITALS.length;
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <PageHeader
        label="회원 · 병원"
        title="병원 회원 관리"
        description="등록·활동 현황"
      >
        {isPreview && <PreviewBadge />}
      </PageHeader>

      {/* KPI 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <AdminKpiCell
          label="총 병원"
          value={<CountUp value={counts.total} />}
          sub="개"
        />
        <AdminKpiCell
          label="활성 (30일)"
          value={<CountUp value={counts.active30d} />}
          sub="개"
          delta={
            counts.total > 0
              ? `${Math.round((counts.active30d / counts.total) * 100)}% 활성률`
              : undefined
          }
          deltaColor="success"
        />
        <AdminKpiCell
          label="신규 (이번달)"
          value={<CountUp value={counts.newThisMonth} />}
          sub="개"
          deltaColor="accent"
        />
        <AdminKpiCell
          label="이탈 위험 (90일+)"
          value={<CountUp value={counts.churnRisk} />}
          sub="개"
          delta={counts.churnRisk > 0 ? "재활성 캠페인 권장" : undefined}
          deltaColor="error"
        />
      </dl>

      {/* Segment Tabs — 링크 기반 */}
      <nav
        className="mt-10 flex gap-1 overflow-x-auto border-b border-[var(--color-border-light)]"
        aria-label="병원 유형 필터"
      >
        {TABS.map((t) => {
          const active = typeFilter === t.value;
          const href = new URLSearchParams();
          if (t.value !== "ALL") href.set("type", t.value);
          if (search) href.set("search", search);
          return (
            <Link
              key={t.value}
              href={`/admin/hospitals${href.toString() ? `?${href.toString()}` : ""}`}
              aria-current={active ? "page" : undefined}
              className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
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

      {/* Filter Chip Row + 검색 (form) */}
      <form className="mt-6 flex flex-wrap items-center gap-3" action="/admin/hospitals">
        {typeFilter !== "ALL" && (
          <input type="hidden" name="type" value={typeFilter} />
        )}
        {(["가입 시기", "누적 주문액", "활성 상태"] as const).map((label) => (
          <button
            key={label}
            type="button"
            disabled
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-3 text-xs text-[var(--color-text-tertiary)] opacity-50"
            title="Phase 3+ 활성"
          >
            {label}
            <ChevronDown className="h-3 w-3" />
          </button>
        ))}
        <div className="relative ml-auto min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="병원명·사업자번호 검색"
            className="h-8 w-full border-b border-[var(--color-border-light)] bg-transparent pl-8 pr-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
      </form>

      {/* Line Table */}
      <div className="mt-8 border-y border-[var(--color-border-light)]">
        <div className="hidden md:grid grid-cols-[1fr_140px_100px_120px_120px_140px_100px_40px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>병원명</span>
          <span>사업자번호</span>
          <span>유형</span>
          <span>가입일</span>
          <span>마지막 활동</span>
          <span className="text-right">누적 주문액</span>
          <span>상태</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-text-secondary)]">
            해당 조건의 병원이 없습니다
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)]">
            {rows.map((h) => (
              <li key={h.id}>
                {/* Desktop: grid row */}
                <Link
                  href={`/admin/hospitals/${h.id}`}
                  className="hidden md:grid grid-cols-[1fr_140px_100px_120px_120px_140px_100px_40px] items-center gap-4 px-2 py-4 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]/40"
                >
                  <span className="truncate font-medium text-[var(--color-text-primary)]">
                    {h.name}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                    {h.bizRegNo}
                  </span>
                  <span className="inline-flex h-6 w-fit items-center rounded-full border border-[var(--color-border-light)] px-2 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
                    {TYPE_LABEL[h.type] ?? h.type}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                    {formatDate(h.joinedAtMs)}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                    {formatDate(h.lastActiveMs)}
                  </span>
                  <span className="text-right font-mono tabular-nums">
                    {h.cumulativeOrder > 0
                      ? `₩${h.cumulativeOrder.toLocaleString()}`
                      : "—"}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`status-pulse-dot h-1.5 w-1.5 rounded-full ${
                        h.active
                          ? "bg-[var(--color-success)]"
                          : "bg-[var(--color-text-tertiary)]"
                      }`}
                    />
                    <span
                      className={`text-xs font-medium ${
                        h.active
                          ? "text-[var(--color-success)]"
                          : "text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      {h.active ? "활성" : "비활성"}
                    </span>
                  </span>
                  <span className="flex justify-end text-[var(--color-text-tertiary)]">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
                {/* Mobile: card layout */}
                <Link
                  href={`/admin/hospitals/${h.id}`}
                  className="flex flex-col gap-2 px-3 py-4 transition-colors hover:bg-[var(--color-bg-secondary)]/40 md:hidden"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">
                      {h.name}
                    </span>
                    <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-[var(--color-border-light)] px-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                      {TYPE_LABEL[h.type] ?? h.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-mono tabular-nums text-[var(--color-text-tertiary)]">
                      {h.bizRegNo}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {h.cumulativeOrder > 0
                        ? `₩${h.cumulativeOrder.toLocaleString()}`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                    <span className="font-mono tabular-nums">
                      가입 {formatDate(h.joinedAtMs)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 rounded-full ${
                          h.active
                            ? "bg-[var(--color-success)]"
                            : "bg-[var(--color-text-tertiary)]"
                        }`}
                      />
                      <span
                        className={`font-medium ${
                          h.active
                            ? "text-[var(--color-success)]"
                            : "text-[var(--color-text-tertiary)]"
                        }`}
                      >
                        {h.active ? "활성" : "비활성"}
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--color-text-tertiary)]">
        1 ~ {rows.length} / 전체 {totalCount}건
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

