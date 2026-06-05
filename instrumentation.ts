// Phase ν-2 — Next.js instrumentation hook (App Router).
// 런타임별로 Sentry 설정 파일 로드. SENTRY_DSN 미설정 환경에서도 안전.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Sentry App Router error capture hook (Next.js 16).
// Server Component 에서 throw 된 에러를 Sentry 로 전송.
export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string };
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
  },
) {
  const DSN = process.env.SENTRY_DSN ?? "";
  if (!DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
}
