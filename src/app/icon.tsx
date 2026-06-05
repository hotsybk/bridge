import { ImageResponse } from "next/og";

/**
 * Phase ν-5 작업5 — 동적 favicon (Next.js App Router 표준 위치).
 *
 * 정식 PNG 파일이 들어오기 전까지 글자 "M" 을 accent 컬러 배경으로 렌더.
 * Next.js 가 자동으로 `/icon` 으로 노출.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0066CC",
          color: "#FFFFFF",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          fontFamily: "system-ui, sans-serif",
          borderRadius: 6,
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
