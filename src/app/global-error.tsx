"use client";

// Phase ν-1 — root layout 자체가 throw 할 때 최종 fallback.
// Next.js App Router 규칙: global-error.tsx 는 자체적으로 <html>·<body> 를 포함해야 한다.
// 디자인 토큰을 못 쓸 가능성도 있으므로 inline style 로 minimal 안전망.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
    // Phase ν-2 — Sentry capture. DSN 미설정 환경에서는 init skip 되어 no-op.
    void import("@sentry/nextjs")
      .then(({ captureException }) => {
        try {
          captureException(error);
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // sentry artifact missing — silent
      });
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          background: "#ffffff",
          color: "#111111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <main style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#ef4444",
              margin: 0,
            }}
          >
            Critical Error
          </p>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              margin: "20px 0 0",
            }}
          >
            시스템 오류가 발생했습니다
          </h1>
          <p
            style={{
              marginTop: 16,
              fontSize: 14,
              lineHeight: 1.6,
              color: "#666666",
            }}
          >
            잠시 후 다시 시도해 주세요. 같은 문제가 반복되면 운영팀에 문의해 주세요.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: 16,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 11,
                color: "#999999",
              }}
            >
              오류 코드: {error.digest}
            </p>
          )}
          <div
            style={{
              marginTop: 36,
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                height: 44,
                padding: "0 24px",
                borderRadius: 9999,
                border: 0,
                background: "#0070f3",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
            <a
              href="/"
              style={{
                height: 44,
                padding: "0 24px",
                borderRadius: 9999,
                border: "1px solid #e5e5e5",
                background: "#ffffff",
                color: "#111111",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              홈으로
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
