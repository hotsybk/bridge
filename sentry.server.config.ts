// Phase ν-2 — Sentry server init (Node.js runtime).
// SENTRY_DSN 미설정 시 graceful skip.

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN ?? "";

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production",
  });
} else if (process.env.NODE_ENV !== "production") {
  console.warn("[Sentry] DSN 미설정 — server init skip (dev/preview 환경)");
}
