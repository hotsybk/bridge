// Wave H — 운영자 쿠폰 관리 (Server Component, Firestore + tRPC 풀 연동).
//
// 좌측: KPI 4 + Segment Tabs + Filter + Table
// 신규 쿠폰 생성: client island (./create-dialog)
// 데이터 미존재 또는 권한 없음 시 PREVIEW_MODE fallback (시드 mock).

import type { Coupon } from "@/lib/types";
import { trpcServer } from "@/lib/trpc/server";

import { CouponsClient } from "./create-dialog";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

// 미리보기 fallback — Firestore 가 비었거나 권한 미부여 시 보이는 mock.
function makeMock(): { coupons: Coupon[]; counts: CouponCounts } {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  const mock = (
    id: string,
    code: string,
    name: string,
    discountType: "PERCENT" | "FIXED",
    discountValue: number,
    targetType: "ALL" | "CATEGORY" | "VENDOR" | "FIRST_PURCHASE",
    status: "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DISABLED",
    usedCount: number,
    issueLimit: number | undefined,
    startOffset: number,
    endOffset: number,
  ): Coupon =>
    ({
      id,
      code,
      name,
      discountType,
      discountValue,
      targetType,
      targetIds: [],
      status,
      usedCount,
      issueLimit: issueLimit ?? undefined,
      perUserLimit: 1,
      startsAt: { seconds: now + startOffset * day } as never,
      expiresAt: { seconds: now + endOffset * day } as never,
      createdAt: { seconds: now - 30 * day } as never,
      updatedAt: { seconds: now - 30 * day } as never,
      createdById: "mock",
    }) as Coupon;

  const coupons: Coupon[] = [
    mock(
      "mock-1",
      "WELCOME10",
      "신규 가입 10% 할인",
      "PERCENT",
      10,
      "FIRST_PURCHASE",
      "ACTIVE",
      234,
      1000,
      -30,
      30,
    ),
    mock(
      "mock-2",
      "GLOVES50K",
      "장갑 카테고리 50,000원 할인",
      "FIXED",
      50000,
      "CATEGORY",
      "ACTIVE",
      12,
      100,
      -10,
      5,
    ),
    mock(
      "mock-3",
      "MEDISUPPLY20",
      "메디서플라이 20% 할인",
      "PERCENT",
      20,
      "VENDOR",
      "ACTIVE",
      8,
      50,
      -10,
      20,
    ),
    mock(
      "mock-4",
      "SUMMER40K",
      "여름 시즌 4만원 할인",
      "FIXED",
      40000,
      "ALL",
      "SCHEDULED",
      0,
      500,
      30,
      60,
    ),
    mock(
      "mock-5",
      "MAYFLASH10",
      "5월 플래시 10%",
      "PERCENT",
      10,
      "ALL",
      "EXPIRED",
      482,
      500,
      -60,
      -30,
    ),
  ];

  const counts: CouponCounts = {
    active: coupons.filter((c) => c.status === "ACTIVE").length,
    scheduled: coupons.filter((c) => c.status === "SCHEDULED").length,
    expired: coupons.filter((c) => c.status === "EXPIRED").length,
    disabled: 0,
    totalIssued: coupons.reduce((s, c) => s + (c.issueLimit ?? 0), 0),
    totalUsed: coupons.reduce((s, c) => s + (c.usedCount ?? 0), 0),
  };
  return { coupons, counts };
}

type CouponCounts = {
  active: number;
  scheduled: number;
  expired: number;
  disabled: number;
  totalIssued: number;
  totalUsed: number;
};

export default async function AdminCouponsPage() {
  let coupons: Coupon[] = [];
  let counts: CouponCounts = {
    active: 0,
    scheduled: 0,
    expired: 0,
    disabled: 0,
    totalIssued: 0,
    totalUsed: 0,
  };
  let usingMock = false;

  try {
    const trpc = await trpcServer();
    const [listRes, countsRes] = await Promise.all([
      trpc.admin.coupon.list({ pageSize: 50 }),
      trpc.admin.coupon.counts(),
    ]);
    coupons = listRes.coupons;
    counts = countsRes;
    if (coupons.length === 0 && PREVIEW_MODE) {
      const m = makeMock();
      coupons = m.coupons;
      counts = m.counts;
      usingMock = true;
    }
  } catch {
    if (PREVIEW_MODE) {
      const m = makeMock();
      coupons = m.coupons;
      counts = m.counts;
      usingMock = true;
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  return (
    <CouponsClient
      initialCoupons={coupons}
      initialCounts={counts}
      readOnly={usingMock}
    />
  );
}
