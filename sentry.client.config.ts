// Phase ν-2 — Sentry client init (browser).
// SENTRY_DSN 미설정 시 graceful skip (console.warn 한 번).
//
// 운영 환경에서는 NEXT_PUBLIC_SENTRY_DSN 또는 SENTRY_DSN 둘 다 가능.
// Client 측은 NEXT_PUBLIC_ 프리픽스가 정석이지만 Sentry SDK 가 둘 다 인식.

import * as Sentry from "@sentry/nextjs";

const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production",
  });
} else if (process.env.NODE_ENV !== "production") {
  console.warn(
    "[Sentry] DSN 미설정 — client init skip (dev/preview 환경)",
  );
}
