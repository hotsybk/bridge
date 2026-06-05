// Wave M — /admin/settlement Server Component.
// tab=fast|scheduled|held|completed (URL searchParam) 에 따라 tRPC fetch.
// PREVIEW (dev/unauth) fallback 유지.

import type {Timestamp} from "firebase/firestore";

import {trpcServer} from "@/lib/trpc/server";
import type {Settlement, SettlementStatus} from "@/lib/types";
import {serializeFirestore} from "@/lib/utils/serialize-firestore";

import {SettlementClient} from "./client";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

type TabKey = "fast" | "scheduled" | "held" | "completed";

type TabFilter = {
  status?: SettlementStatus;
  isFastSettlement?: boolean;
};

const TAB_FILTERS: Record<TabKey, TabFilter> = {
  fast: {status: "REQUESTED", isFastSettlement: true},
  scheduled: {status: "PENDING"},
  held: {status: "HOLD"},
  completed: {status: "PAID"},
};

// PREVIEW fallback — 운영 환경에서는 실제 Firestore 데이터.
// client tsToMs 파서가 {seconds, _seconds, toMillis, toDate} 모두 수용하므로
// 가장 안전한 plain object {seconds, nanoseconds} 로 mock. (Timestamp 호환 cast)
function makeMockTs(daysAgo: number): Timestamp {
  return {seconds: Math.floor((Date.now() - daysAgo * 86400 * 1000) / 1000), nanoseconds: 0} as unknown as Timestamp;
}

function makeMockTsFuture(daysAhead: number): Timestamp {
  return {seconds: Math.floor((Date.now() + daysAhead * 86400 * 1000) / 1000), nanoseconds: 0} as unknown as Timestamp;
}

function mockSettlement(
  args: Partial<Settlement> & {id: string; vendorId: string; vendorName: string},
): Settlement {
  return {
    periodStart: makeMockTs(2),
    periodEnd: makeMockTs(1),
    grossAmount: 0,
    paymentFeeAmount: 0,
    paymentFeeVatAmount: 0,
    commissionAmount: 0,
    commissionVatAmount: 0,
    refundDeductAmount: 0,
    couponDeductAmount: 0,
    netPayout: 0,
    isFastSettlement: false,
    fastSettlementDays: 7,
    fastSettlementFee: 0,
    finalPayout: 0,
    subOrderRefs: [],
    status: "PENDING",
    scheduledPayoutAt: makeMockTsFuture(7),
    createdAt: makeMockTs(0),
    updatedAt: makeMockTs(0),
    ...args,
  } as Settlement;
}

function getMockSettlements(tab: TabKey): Settlement[] {
  if (tab === "fast") {
    return [
      mockSettlement({
        id: "demo-s1",
        vendorId: "demo-v1",
        vendorName: "메디서플라이",
        grossAmount: 2340000,
        commissionAmount: 117000,
        paymentFeeAmount: 65520,
        netPayout: 2150000,
        isFastSettlement: true,
        fastSettlementDays: 3,
        fastSettlementFee: 28080,
        finalPayout: 2121920,
        status: "REQUESTED",
        scheduledPayoutAt: makeMockTsFuture(3),
      }),
      mockSettlement({
        id: "demo-s2",
        vendorId: "demo-v2",
        vendorName: "한빛메디칼(주)",
        grossAmount: 1820000,
        commissionAmount: 91000,
        paymentFeeAmount: 50960,
        netPayout: 1670000,
        isFastSettlement: true,
        fastSettlementDays: 3,
        fastSettlementFee: 21840,
        finalPayout: 1648160,
        status: "REQUESTED",
        scheduledPayoutAt: makeMockTsFuture(3),
      }),
      mockSettlement({
        id: "demo-s3",
        vendorId: "demo-v3",
        vendorName: "케어스토어",
        grossAmount: 980000,
        commissionAmount: 49000,
        paymentFeeAmount: 27440,
        netPayout: 898000,
        isFastSettlement: true,
        fastSettlementDays: 3,
        fastSettlementFee: 11760,
        finalPayout: 886240,
        status: "REQUESTED",
        scheduledPayoutAt: makeMockTsFuture(3),
      }),
    ];
  }
  if (tab === "scheduled") {
    return [
      mockSettlement({
        id: "demo-s4",
        vendorId: "demo-v1",
        vendorName: "메디서플라이",
        grossAmount: 4520000,
        commissionAmount: 226000,
        paymentFeeAmount: 126560,
        netPayout: 4150000,
        finalPayout: 4150000,
        scheduledPayoutAt: makeMockTsFuture(5),
      }),
      mockSettlement({
        id: "demo-s5",
        vendorId: "demo-v4",
        vendorName: "헬스케어",
        grossAmount: 6840000,
        commissionAmount: 342000,
        paymentFeeAmount: 191520,
        netPayout: 6280000,
        finalPayout: 6280000,
        scheduledPayoutAt: makeMockTsFuture(6),
      }),
    ];
  }
  if (tab === "held") {
    return [
      mockSettlement({
        id: "demo-s6",
        vendorId: "demo-v5",
        vendorName: "테스트벤더",
        grossAmount: 850000,
        finalPayout: 800000,
        status: "HOLD",
        statusReason: "분쟁 진행 중 (#dispute-031)",
      }),
    ];
  }
  return [
    mockSettlement({
      id: "demo-s7",
      vendorId: "demo-v1",
      vendorName: "메디서플라이",
      grossAmount: 3450000,
      commissionAmount: 172500,
      paymentFeeAmount: 96600,
      netPayout: 3180000,
      finalPayout: 3180000,
      status: "PAID",
      paidAt: makeMockTs(7),
      payoutId: "demo-payout-001",
    }),
  ];
}

const MOCK_COUNTS = {
  thisWeekScheduled: 48200000,
  fastPending: 3,
  held: 850000,
  monthlyCommission: 4820000,
};

export default async function AdminSettlementPage({
  searchParams,
}: {
  searchParams: Promise<{tab?: string}>;
}) {
  const sp = await searchParams;
  const tab: TabKey =
    sp.tab === "scheduled" || sp.tab === "held" || sp.tab === "completed"
      ? (sp.tab as TabKey)
      : "fast";

  const filter = TAB_FILTERS[tab];

  let settlements: Settlement[] = [];
  let counts = MOCK_COUNTS;
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [listResult, c] = await Promise.all([
      trpc.admin.settlement.list({
        status: filter.status,
        isFastSettlement: filter.isFastSettlement,
        pageSize: 50,
      }),
      trpc.admin.settlement.counts(),
    ]);
    settlements = serializeFirestore(listResult.settlements);
    counts = c;
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      settlements = getMockSettlements(tab);
    }
  }

  return (
    <SettlementClient
      tab={tab}
      settlements={settlements}
      counts={counts}
      isPreview={isPreview}
    />
  );
}
