"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Phase ν-2 — PostHog client provider.
 *
 * NEXT_PUBLIC_POSTHOG_KEY 미설정 시 init skip (console.warn 한 번).
 * dynamic import 로 client-only 보장 + 빌드 시 SSR 영향 차단.
 *
 * 5개 핵심 이벤트는 src/lib/posthog/events.ts 의 helper 로 발행.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

    if (!key) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[PostHog] KEY 미설정 — init skip (dev/preview 환경)");
      }
      return;
    }

    let cancelled = false;
    void (async () => {
      const mod = await import("posthog-js");
      const posthog = mod.default;
      if (cancelled) return;
      // 멱등성 — already inited 이면 skip
      if (typeof window !== "undefined" && (window as unknown as { __ph_inited?: boolean }).__ph_inited) {
        return;
      }
      posthog.init(key, {
        api_host: host,
        capture_pageview: true,
        capture_pageleave: true,
        loaded: () => {
          if (typeof window !== "undefined") {
            (window as unknown as { __ph_inited?: boolean }).__ph_inited = true;
          }
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
