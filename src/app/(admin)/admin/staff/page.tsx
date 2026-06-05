import { ShieldAlert } from "lucide-react";

import { AdminKpiCell } from "@/components/admin/admin-kpi-cell";
import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { trpcServer } from "@/lib/trpc/server";

import { StaffTable, type StaffRow } from "./actions";

export const dynamic = "force-dynamic";

/**
 * 운영자 — Staff (운영자 관리) — Wave L 풀 구현.
 *
 * SUPER_ADMIN 전용. proxy.ts 에서 페이지 진입 가드 + tRPC superAdminProcedure 이중 방어.
 * KPI 4칸 + invite 버튼 + line table + 자기 자신/마지막 SUPER_ADMIN 보호.
 */

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

const MOCK_STAFF: StaffRow[] = [
  {
    uid: "demo-s-001",
    name: "김운영",
    email: "kim@medplace.io",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    lastLogin: "2026-06-01 09:23",
    activity: 142,
  },
  {
    uid: "demo-s-002",
    name: "이관리",
    email: "lee@medplace.io",
    role: "ADMIN",
    status: "ACTIVE",
    lastLogin: "2026-05-31 14:20",
    activity: 87,
  },
  {
    uid: "demo-s-003",
    name: "박감사",
    email: "park@medplace.io",
    role: "ADMIN",
    status: "ACTIVE",
    lastLogin: "2026-06-01 11:05",
    activity: 96,
  },
  {
    uid: "demo-s-004",
    name: "최보조",
    email: "choi@medplace.io",
    role: "ADMIN",
    status: "DISABLED",
    statusReason: "퇴사 (2026-05-15)",
    lastLogin: "2026-05-29 16:42",
    activity: 23,
  },
];

function formatTimestamp(ts: unknown): string | undefined {
  if (!ts || typeof ts !== "object") return undefined;
  const seconds = (ts as { seconds?: number; _seconds?: number }).seconds ??
    (ts as { _seconds?: number })._seconds;
  if (typeof seconds !== "number") return undefined;
  const d = new Date(seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminStaffPage() {
  let staff: StaffRow[] = [];
  let counts = { total: 0, superAdmin: 0, admin: 0, recentLogin: 0 };

  try {
    const trpc = await trpcServer();
    const [list, c] = await Promise.all([
      trpc.admin.staff.list(),
      trpc.admin.staff.counts(),
    ]);
    staff = list.map((s) => ({
      uid: s.uid,
      name: s.name,
      email: s.email,
      role: s.role,
      status: s.status ?? "ACTIVE",
      statusReason: s.statusReason ?? null,
      lastLogin: formatTimestamp(s.lastLoginAt) ?? formatTimestamp(s.createdAt),
    }));
    counts = c;
  } catch {
    // 비로그인 dev 미리보기 fallback
    if (PREVIEW_MODE) {
      staff = MOCK_STAFF;
      counts = {
        total: MOCK_STAFF.length,
        superAdmin: MOCK_STAFF.filter((s) => s.role === "SUPER_ADMIN").length,
        admin: MOCK_STAFF.filter((s) => s.role === "ADMIN").length,
        recentLogin: MOCK_STAFF.filter((s) => s.status === "ACTIVE").length,
      };
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <PageHeader
        label="회원 · 운영자"
        title="운영자 관리"
        description="운영자 추가·권한 변경·감사. 최고 운영자만 접근 가능."
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 py-1 text-xs text-[var(--color-text-tertiary)]">
          <ShieldAlert className="h-3 w-3" />최고 운영자
        </span>
      </PageHeader>

      {/* KPI 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <AdminKpiCell
          label="총 운영자"
          value={<CountUp value={counts.total} />}
          sub="명"
        />
        <AdminKpiCell
          label="최고 운영자"
          value={<CountUp value={counts.superAdmin} />}
          sub="명"
          delta="최소 1명 유지"
          deltaColor="accent"
        />
        <AdminKpiCell
          label="운영자"
          value={<CountUp value={counts.admin} />}
          sub="명"
        />
        <AdminKpiCell
          label="지난 7일 로그인"
          value={<CountUp value={counts.recentLogin} />}
          sub="명"
          delta={
            counts.total > 0
              ? `${Math.round((counts.recentLogin / counts.total) * 100)}% 활성`
              : "—"
          }
          deltaColor="success"
        />
      </dl>

      <div className="mt-10">
        <StaffTable staff={staff} superAdminCount={counts.superAdmin} />
      </div>

      <div className="mt-10 space-y-1.5">
        <p className="text-xs text-[var(--color-accent)]">
          최고 운영자는 최소 1명 활성 유지되어야 합니다
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          모든 운영자 액션(초대·권한 변경·비활성화)은 감사 로그에 자동 기록됩니다
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          자기 자신의 권한 변경 및 비활성화는 차단됩니다 (lockout 방지)
        </p>
      </div>
    </div>
  );
}

