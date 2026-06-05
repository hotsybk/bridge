// Wave N — /admin/udi-reports Server Component.
// 최근 12개월 master timeline + 이번달 KPI + Tab + table.
// PREVIEW (dev/unauth) 시 mock fallback.

import {trpcServer} from "@/lib/trpc/server";

import {UdiReportsClient, type AdminUdiReportRow, type UdiCounts} from "./client";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mockReports(): AdminUdiReportRow[] {
  const now = new Date();
  const list: AdminUdiReportRow[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const isCurrent = i === 0;
    const isPartial = i === 1;
    const total = isCurrent ? 1234 : 7000 + Math.floor(Math.random() * 2000);
    const fail = isPartial ? 12 : 0;
    list.push({
      id: period,
      period,
      status: isCurrent
        ? "IN_PROGRESS"
        : isPartial
          ? "PARTIAL"
          : "COMPLETED",
      totalCount: total,
      successCount: total - fail,
      failCount: fail,
    });
  }
  return list;
}

function mockCounts(): UdiCounts {
  return {
    totalCount: 1234,
    successCount: 0,
    failCount: 0,
    retryAvailable: 0,
  };
}

export default async function AdminUdiReportsPage() {
  const period = currentPeriod();
  let reports: AdminUdiReportRow[] = [];
  let counts: UdiCounts = mockCounts();
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [listResult, c] = await Promise.all([
      trpc.admin.udi.listReports(),
      trpc.admin.udi.counts({period}),
    ]);
    reports = listResult as AdminUdiReportRow[];
    counts = c;
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      reports = mockReports();
      counts = mockCounts();
    }
  }

  return (
    <UdiReportsClient
      reports={reports}
      counts={counts}
      currentPeriod={period}
      isPreview={isPreview}
    />
  );
}
