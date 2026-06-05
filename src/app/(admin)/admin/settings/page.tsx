// Wave O — 시스템 설정.
// Server Component + tRPC. 5 tab section 별 settings read.
// PREVIEW (비로그인) 환경에서는 mock fallback.

import { trpcServer } from "@/lib/trpc/server";

import { SettingsClient, type SettingsBundle } from "./client";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

const MOCK_BUNDLE: SettingsBundle = {
  general: {
    platformName: "메디플레이스",
    logoUrl: "/images/logo.svg",
    currency: "KRW",
    timezone: "Asia/Seoul",
    language: "ko",
    supportEmail: "support@medplace.kr",
    mailorderRegNo: "2026-서울강남-08923",
  },
  payment: {
    portoneTestMode: false,
    portonePaymentTimeoutSec: 60,
    portoneRefundTimeoutSec: 120,
    portoneWebhookRetryCount: 5,
    apiSecret: "ps_l••••••••....",
  },
  notification: {
    solapiSenderNumber: "02-1234-5678",
    solapiPfid: "@bridge-medplace",
    apiKey: "NCSU••••••••....",
  },
  external: {
    mfdsEndpoint: "https://emedi.mfds.go.kr",
    clovaOcrInvokeUrl: "https://api.naver.com/clova-ocr/v1",
  },
  security: {
    rateLimitLogin: 5,
    rateLimitApi: 100,
    rateLimitPayment: 10,
    sessionTimeoutAdminDays: 12,
    sessionTimeoutUserDays: 30,
    blockedIps: ["203.0.113.42", "198.51.100.42", "192.0.2.18"],
  },
};

export default async function AdminSettingsPage() {
  let bundle: SettingsBundle = {
    general: null,
    payment: null,
    notification: null,
    external: null,
    security: null,
  };
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [general, payment, notification, external, security] = await Promise.all([
      trpc.admin.settings.get({ section: "general" }),
      trpc.admin.settings.get({ section: "payment" }),
      trpc.admin.settings.get({ section: "notification" }),
      trpc.admin.settings.get({ section: "external" }),
      trpc.admin.settings.get({ section: "security" }),
    ]);
    bundle = {
      general: general as SettingsBundle["general"],
      payment: payment as SettingsBundle["payment"],
      notification: notification as SettingsBundle["notification"],
      external: external as SettingsBundle["external"],
      security: security as SettingsBundle["security"],
    };
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      bundle = MOCK_BUNDLE;
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  return <SettingsClient bundle={bundle} isPreview={isPreview} />;
}
