"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * 전역 토스트 — Phase γ-1.
 *
 * sonner 기반. position top-right, richColors. CSS 변수 토큰을 사용해
 * 다크 모드 / 라이트 모드 자동 대응.
 */
export function Toaster() {
  return (
    <SonnerToaster
      // position을 bottom-right로 변경 — 이전 top-right는 nav 우측 영역(로그인/회원가입)을
      // invisible container로 가려 클릭을 차단했음.
      position="bottom-right"
      richColors
      closeButton
      // sonner viewport container도 명시적으로 pointer-events 제어
      // (개별 toast card는 sonner 내부에서 pointer-events: auto 처리됨)
      className="!pointer-events-none [&_li]:!pointer-events-auto"
      offset={16}
      toastOptions={{
        style: {
          background: "var(--color-bg-primary)",
          border: "1px solid var(--color-border-light)",
          color: "var(--color-text-primary)",
          fontFamily: "Pretendard Variable, sans-serif",
        },
      }}
    />
  );
}
