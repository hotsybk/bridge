// Wave O — 운영자 알림 발송.
// Server Component + tRPC 실 연동. PREVIEW (비로그인) 환경에서는 mock fallback.

import { trpcServer } from "@/lib/trpc/server";
import { serializeFirestore } from "@/lib/utils/serialize-firestore";

import {
  NotificationsClient,
  type NotificationRow,
  type SolapiStatus,
} from "./client";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

// PREVIEW fallback — 비로그인 dev 미리보기용.
const MOCK_ROWS: NotificationRow[] = [
  {
    id: "demo-1",
    type: "ORDER_NEW",
    title: "주문 접수 안내",
    body: "서울메디컬의원 님, 주문 MP-2026-06-01-0231 이 접수되었습니다.",
    targetType: "HOSPITAL",
    isBulk: true,
    kakaoSent: true,
    emailSent: false,
    errorReason: null,
    createdAt: { _seconds: Math.floor(Date.now() / 1000) - 600 },
  },
  {
    id: "demo-2",
    type: "HOSPITAL_NOTICE",
    title: "주간 운영 공지",
    body: "이번주 운영 정책 변경 안내",
    targetType: "HOSPITAL",
    isBulk: true,
    kakaoSent: true,
    emailSent: true,
    errorReason: null,
    createdAt: { _seconds: Math.floor(Date.now() / 1000) - 3600 },
  },
  {
    id: "demo-3",
    type: "GROUPBUY_FULFILLED",
    title: "공동구매 성사 안내",
    body: "캠페인이 목표 수량을 달성했습니다.",
    targetType: "HOSPITAL",
    isBulk: false,
    kakaoSent: false,
    emailSent: false,
    errorReason: "수신 거부",
    createdAt: { _seconds: Math.floor(Date.now() / 1000) - 7200 },
  },
];

const MOCK_COUNTS = {
  monthlySent: 1820,
  successRate: 99.4,
  failedCount: 12,
  activeTemplates: 18,
};

const MOCK_SOLAPI: SolapiStatus = {
  balance: 2840500,
  currency: "KRW",
  dailyLimit: 10000,
  dailyUsed: 0,
  status: "MOCK",
};

export default async function AdminNotificationsPage() {
  let notifications: NotificationRow[] = [];
  let counts = { monthlySent: 0, successRate: 100, failedCount: 0, activeTemplates: 18 };
  let solapiStatus: SolapiStatus = MOCK_SOLAPI;
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [listRes, countsRes, solapiRes] = await Promise.all([
      trpc.admin.notifications.list({ pageSize: 30 }),
      trpc.admin.notifications.counts(),
      trpc.admin.notifications.solapiStatus(),
    ]);
    notifications = serializeFirestore(listRes.notifications) as NotificationRow[];
    counts = countsRes;
    solapiStatus = solapiRes;
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      notifications = MOCK_ROWS;
      counts = MOCK_COUNTS;
      solapiStatus = MOCK_SOLAPI;
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  return (
    <NotificationsClient
      notifications={notifications}
      counts={counts}
      solapiStatus={solapiStatus}
      isPreview={isPreview}
    />
  );
}
