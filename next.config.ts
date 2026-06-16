import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Vercel이 빌드 시 자동 주입하는 환경변수를 클라이언트에 노출 — 배포 알림용
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE:
      process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "placehold.co" },
      // Firebase Storage signed URL (admin 서류 미리보기 등)
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      // Google 프로필 이미지 (OAuth 로그인 사용자 아바타)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

// Σ-2 — Sentry 래핑.
// withSentryConfig 로 감싸야 빌드 시 소스맵이 Sentry 에 업로드되어
// production 에러가 minified 가 아닌 원본 스택으로 보임.
// SENTRY_AUTH_TOKEN/ORG/PROJECT 미설정 시 소스맵 업로드는 자동 skip (빌드는 정상 통과).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // CI 외 환경에서는 빌드 로그 최소화
  silent: !process.env.CI,

  // 클라이언트 번들 소스맵 업로드 범위 확대 (서버 컴포넌트 포함)
  widenClientFileUpload: true,

  // ad-blocker 우회용 터널 라우트 — 클라이언트 이벤트 유실 방지
  tunnelRoute: "/monitoring",

  // Sentry SDK logger 트리쉐이킹 (번들 크기 절감)
  disableLogger: true,

  // Vercel Cron 모니터 자동 등록
  automaticVercelMonitors: true,
});
