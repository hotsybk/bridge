// Wave I — 운영자 공동구매 운영 (Server Component, Firestore + tRPC 풀 연동).
//
// 좌측: KPI 5 + Segment Tabs + Table
// 강제 마감/취소: client island (./actions-client)
// Firestore 미존재 또는 권한 없음 시 PREVIEW_MODE fallback (시드 mock).

import type { GroupBuy } from "@/lib/types";
import { trpcServer } from "@/lib/trpc/server";
import { serializeFirestore } from "@/lib/utils/serialize-firestore";

import { GroupBuysClient, type GroupBuyCounts } from "./groupbuys-client";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

function makeMock(): { groupBuys: GroupBuy[]; counts: GroupBuyCounts } {
  const now = Math.floor(Date.now() / 1000);
  const hour = 3600;
  const mock = (
    id: string,
    productName: string,
    vendorName: string,
    currentQty: number,
    targetQty: number,
    closesInHours: number,
    participationCount: number,
    status: GroupBuy["status"],
  ): GroupBuy =>
    ({
      id,
      productId: `p-${id}`,
      productName,
      vendorId: "v-mock",
      vendorName,
      title: productName,
      startsAt: { seconds: now - 7 * 24 * hour } as never,
      endsAt: { seconds: now + closesInHours * hour } as never,
      targetQty,
      currentQty,
      tierPricing: [
        { minQty: 50, price: 22000 },
        { minQty: 100, price: 20000 },
        { minQty: 200, price: 18000 },
      ],
      status,
      participationCount,
      createdAt: { seconds: now - 7 * 24 * hour } as never,
      updatedAt: { seconds: now - hour } as never,
    }) as GroupBuy;

  const groupBuys: GroupBuy[] = [
    mock("gb-001", "라텍스 장갑 (M) 100매 — 6월 1차", "메디서플라이", 142, 200, 24, 28, "OPEN"),
    mock("gb-002", "KF94 마스크 50매 박스 공동구매", "케어스토어", 89, 150, 26, 18, "OPEN"),
    mock("gb-003", "1회용 주사기 5ml — 대량", "한빛메디칼(주)", 412, 400, 42, 42, "TARGET_MET"),
    mock("gb-004", "치과용 거즈 50매 — 6월", "덴탈프로", 72, 120, 12, 14, "OPEN"),
    mock("gb-005", "수술용 매스 (소) 박스", "올드메디", 64, 100, 48, 12, "OPEN"),
    mock("gb-006", "혈압계 디지털 BP-12 단체구매", "라이프케어솔루션", 18, 20, 8, 18, "TARGET_MET"),
    mock("gb-011", "알코올 솜 200매 박스", "메디서플라이", 312, 250, -120, 38, "FULFILLED"),
    mock("gb-012", "치과 일회용 컵 1000매", "덴탈프로", 88, 200, -144, 12, "FAILED"),
  ];

  const nowMs = Date.now();
  const counts: GroupBuyCounts = {
    open: groupBuys.filter((g) => g.status === "OPEN").length,
    targetMet: groupBuys.filter((g) => g.status === "TARGET_MET").length,
    fulfilled: groupBuys.filter((g) => g.status === "FULFILLED").length,
    failed: groupBuys.filter((g) => g.status === "FAILED").length,
    closingSoon: groupBuys.filter((g) => {
      if (g.status !== "OPEN" && g.status !== "TARGET_MET") return false;
      const endsAtMs = ((g.endsAt as unknown as { seconds: number }).seconds ?? 0) * 1000;
      return endsAtMs > nowMs && endsAtMs - nowMs < 24 * 3600 * 1000;
    }).length,
  };
  return { groupBuys, counts };
}

export default async function AdminGroupBuysPage() {
  let groupBuys: GroupBuy[] = [];
  let counts: GroupBuyCounts = {
    open: 0,
    targetMet: 0,
    fulfilled: 0,
    failed: 0,
    closingSoon: 0,
  };
  let usingMock = false;

  try {
    const trpc = await trpcServer();
    const [listRes, countsRes] = await Promise.all([
      trpc.admin.groupbuy.list({ pageSize: 50 }),
      trpc.admin.groupbuy.counts(),
    ]);
    groupBuys = serializeFirestore(listRes.groupBuys) as GroupBuy[];
    counts = countsRes;
    if (groupBuys.length === 0 && PREVIEW_MODE) {
      const m = makeMock();
      groupBuys = m.groupBuys;
      counts = m.counts;
      usingMock = true;
    }
  } catch {
    if (PREVIEW_MODE) {
      const m = makeMock();
      groupBuys = m.groupBuys;
      counts = m.counts;
      usingMock = true;
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  return (
    <GroupBuysClient
      initialGroupBuys={groupBuys}
      initialCounts={counts}
      readOnly={usingMock}
    />
  );
}
