// Wave I — 운영자 공동구매 상세 (Server Component + tRPC).
//
// 좌측: KPI · 정보 · 참여 병원 list
// 우측: 강제 마감/취소/메모 client island
// Firestore 미존재 시 PREVIEW_MODE fallback.

import type { GroupBuy } from "@/lib/types";
import { trpcServer } from "@/lib/trpc/server";
import { serializeFirestore } from "@/lib/utils/serialize-firestore";

import { GroupBuyDetailClient, type ParticipationView } from "./detail-client";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

function makeMockDetail(campaignId: string): {
  groupBuy: GroupBuy;
  participations: ParticipationView[];
} {
  const now = Math.floor(Date.now() / 1000);
  const hour = 3600;
  const groupBuy: GroupBuy = {
    id: campaignId,
    productId: "p-mock",
    productName: "라텍스 장갑 (M) 100매 — 6월 1차",
    vendorId: "v-mock",
    vendorName: "메디서플라이",
    title: "라텍스 장갑 (M) 100매 — 6월 1차",
    description: "월간 1차 공동구매",
    startsAt: { seconds: now - 5 * 24 * hour } as never,
    endsAt: { seconds: now + 18 * hour } as never,
    targetQty: 200,
    currentQty: 142,
    tierPricing: [
      { minQty: 50, price: 22000 },
      { minQty: 100, price: 20000 },
      { minQty: 200, price: 18000 },
    ],
    status: "OPEN",
    participationCount: 28,
    createdAt: { seconds: now - 7 * 24 * hour } as never,
    updatedAt: { seconds: now - hour } as never,
  };

  const participations: ParticipationView[] = [
    { id: "p1", hospitalName: "서울메디컬의원", qty: 12, createdAt: { seconds: now - 4 * 24 * hour } },
    { id: "p2", hospitalName: "강남내과", qty: 8, createdAt: { seconds: now - 4 * 24 * hour + 6000 } },
    { id: "p3", hospitalName: "동대문병원", qty: 24, createdAt: { seconds: now - 3 * 24 * hour } },
    { id: "p4", hospitalName: "광진의료원", qty: 6, createdAt: { seconds: now - 3 * 24 * hour + 1000 } },
    { id: "p5", hospitalName: "성북치과", qty: 18, createdAt: { seconds: now - 2 * 24 * hour } },
    { id: "p6", hospitalName: "한강병원", qty: 10, createdAt: { seconds: now - 2 * 24 * hour + 5000 } },
    { id: "p7", hospitalName: "서초정형외과", qty: 4, createdAt: { seconds: now - 24 * hour } },
    { id: "p8", hospitalName: "마포한방의원", qty: 6, createdAt: { seconds: now - 24 * hour + 8000 } },
  ];

  return { groupBuy, participations };
}

export default async function AdminGroupBuyDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  let groupBuy: GroupBuy | null = null;
  let participations: ParticipationView[] = [];
  let usingMock = false;

  try {
    const trpc = await trpcServer();
    const [gb, pRes] = await Promise.all([
      trpc.admin.groupbuy.getById({ groupBuyId: campaignId }),
      trpc.admin.groupbuy.listParticipations({ groupBuyId: campaignId, pageSize: 100 }),
    ]);
    groupBuy = gb ? (serializeFirestore(gb) as GroupBuy) : null;
    participations = serializeFirestore(pRes) as ParticipationView[];
  } catch {
    if (PREVIEW_MODE) {
      const m = makeMockDetail(campaignId);
      groupBuy = m.groupBuy;
      participations = m.participations;
      usingMock = true;
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  if (!groupBuy) {
    if (PREVIEW_MODE) {
      const m = makeMockDetail(campaignId);
      groupBuy = m.groupBuy;
      participations = m.participations;
      usingMock = true;
    } else {
      return (
        <div className="px-8 py-10 md:px-12 md:py-14">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            공동구매 캠페인을 찾을 수 없습니다.
          </p>
        </div>
      );
    }
  }

  return (
    <GroupBuyDetailClient
      campaignId={campaignId}
      groupBuy={groupBuy}
      participations={participations}
      readOnly={usingMock}
    />
  );
}
