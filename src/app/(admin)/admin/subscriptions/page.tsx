// Wave Q3 — 운영자 정기구독 모니터링 (Server Component, Firestore + tRPC 풀 연동).
//
// 좌측: KPI 4 + Segment Tabs + 검색 + 행 액션 (일시정지/재개)
// 우측: 상위 vendor 활성 구독 ledger
// 컬렉션 미존재 또는 권한 없음 시 PREVIEW_MODE fallback.

import { trpcServer } from "@/lib/trpc/server";
import { serializeFirestore } from "@/lib/utils/serialize-firestore";

import {
  AdminSubscriptionsClient,
  type SubscriptionCounts,
  type SubscriptionRow,
  type TopVendorEntry,
} from "./client";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

function makeMock(): {
  subscriptions: SubscriptionRow[];
  counts: SubscriptionCounts;
  topVendors: TopVendorEntry[];
} {
  const day = 86400;
  const now = Math.floor(Date.now() / 1000);
  const sub = (
    id: string,
    hospitalName: string,
    vendorId: string,
    vendorName: string,
    productName: string,
    cadence: "WEEKLY" | "BIWEEKLY" | "MONTHLY",
    daysUntilNext: number,
    qty: number,
    runCount: number,
    status: "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED",
    priceChangePercent?: number,
  ): SubscriptionRow => ({
    id,
    hospitalId: `h-${id}`,
    hospitalName,
    vendorId,
    vendorName,
    productId: `p-${id}`,
    productName,
    status,
    cadence,
    nextRunAt:
      status === "ACTIVE"
        ? ({ _seconds: now + daysUntilNext * day } as never)
        : null,
    qty,
    runCount,
    priceChangePercent,
  });

  const subscriptions: SubscriptionRow[] = [
    sub("s-001", "서울메디컬의원", "v1", "메디서플라이", "라텍스 장갑 (M) 100매", "BIWEEKLY", 6, 12, 18, "ACTIVE"),
    sub("s-002", "강남내과", "v2", "한빛메디칼(주)", "1회용 주사기 5ml", "BIWEEKLY", 2, 24, 32, "ACTIVE"),
    sub("s-003", "동대문병원", "v1", "메디서플라이", "KF94 마스크 50매", "MONTHLY", 10, 20, 12, "ACTIVE"),
    sub("s-004", "광진의료원", "v3", "케어스토어", "알코올 솜 200매", "MONTHLY", 7, 18, 6, "ACTIVE"),
    sub("s-005", "성북치과", "v4", "덴탈프로", "치과용 거즈 50매", "BIWEEKLY", 3, 30, 24, "ACTIVE"),
    sub("s-006", "한강병원", "v5", "헬스케어", "심전도 패치 24매", "MONTHLY", 16, 8, 4, "ACTIVE", 6.2),
    sub("s-007", "서초정형외과", "v6", "올드메디", "수술용 매스 (소)", "MONTHLY", 0, 10, 8, "PAUSED"),
    sub("s-008", "마포한방의원", "v7", "라이프케어솔루션", "혈압계 카프 교체용", "MONTHLY", 90, 4, 2, "ACTIVE"),
    sub("s-009", "송파메디칼센터", "v1", "메디서플라이", "라텍스 장갑 (L) 100매", "BIWEEKLY", 6, 18, 14, "ACTIVE"),
    sub("s-010", "노원소아과", "v3", "케어스토어", "체온계용 일회용 커버", "MONTHLY", 0, 12, 4, "PAUSED"),
    sub("s-011", "도봉피부과", "v5", "헬스케어", "1회용 매스 (대)", "MONTHLY", 30, 6, 2, "ACTIVE", 5.4),
    sub("s-012", "관악의원", "v1", "메디서플라이", "알코올 솜 200매", "MONTHLY", 8, 24, 22, "ACTIVE"),
    sub("s-013", "구로내과", "v2", "한빛메디칼(주)", "체온계 디지털", "MONTHLY", 0, 2, 1, "EXPIRED"),
    sub("s-014", "양천의료원", "v4", "덴탈프로", "치과 일회용 컵", "MONTHLY", 6, 100, 8, "ACTIVE", 7.8),
    sub("s-015", "은평재활병원", "v7", "라이프케어솔루션", "산소포화도 측정기 소모품", "MONTHLY", 0, 8, 3, "PAUSED"),
    sub("s-016", "중랑가정의학", "v3", "케어스토어", "1회용 주사기 1ml", "BIWEEKLY", 4, 30, 28, "ACTIVE"),
    sub("s-017", "강서종합병원", "v1", "메디서플라이", "라텍스 장갑 (S) 100매", "BIWEEKLY", 6, 24, 16, "ACTIVE"),
    sub("s-018", "금천의원", "v6", "올드메디", "수술용 매스 (대)", "MONTHLY", 32, 6, 4, "ACTIVE"),
  ];

  const nowMs = Date.now();
  const sevenDaysMs = 7 * day * 1000;
  const counts: SubscriptionCounts = {
    active: subscriptions.filter((s) => s.status === "ACTIVE").length,
    paused: subscriptions.filter((s) => s.status === "PAUSED").length,
    next7Days: subscriptions.filter((s) => {
      if (s.status !== "ACTIVE") return false;
      const secs =
        (s.nextRunAt && typeof s.nextRunAt === "object"
          ? (s.nextRunAt as { _seconds?: number })._seconds
          : 0) ?? 0;
      const ms = secs * 1000;
      return ms >= nowMs && ms - nowMs <= sevenDaysMs;
    }).length,
    priceChangeAffected: subscriptions.filter(
      (s) =>
        typeof s.priceChangePercent === "number" &&
        Math.abs(s.priceChangePercent) >= 5,
    ).length,
  };

  const byVendor = new Map<string, { name: string; count: number }>();
  for (const s of subscriptions) {
    if (s.status !== "ACTIVE" || !s.vendorId) continue;
    const entry = byVendor.get(s.vendorId) ?? {
      name: s.vendorName ?? s.vendorId,
      count: 0,
    };
    entry.count += 1;
    byVendor.set(s.vendorId, entry);
  }
  const topVendors: TopVendorEntry[] = [...byVendor.entries()]
    .map(([id, { name, count }]) => ({ vendorId: id, vendorName: name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { subscriptions, counts, topVendors };
}

export default async function AdminSubscriptionsPage() {
  let subscriptions: SubscriptionRow[] = [];
  let counts: SubscriptionCounts = {
    active: 0,
    paused: 0,
    next7Days: 0,
    priceChangeAffected: 0,
  };
  let topVendors: TopVendorEntry[] = [];
  let usingMock = false;

  try {
    const trpc = await trpcServer();
    const [listRes, countsRes, topRes] = await Promise.all([
      trpc.admin.subscription.list({ pageSize: 100 }),
      trpc.admin.subscription.counts(),
      trpc.admin.subscription.topByVendor({ limit: 5 }),
    ]);
    subscriptions = serializeFirestore(listRes.subscriptions) as SubscriptionRow[];
    counts = countsRes;
    topVendors = topRes;

    if (subscriptions.length === 0 && PREVIEW_MODE) {
      const m = makeMock();
      subscriptions = m.subscriptions;
      counts = m.counts;
      topVendors = m.topVendors;
      usingMock = true;
    }
  } catch {
    if (PREVIEW_MODE) {
      const m = makeMock();
      subscriptions = m.subscriptions;
      counts = m.counts;
      topVendors = m.topVendors;
      usingMock = true;
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  return (
    <AdminSubscriptionsClient
      subscriptions={subscriptions}
      counts={counts}
      topVendors={topVendors}
      readOnly={usingMock}
    />
  );
}
