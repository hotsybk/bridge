import { ImageResponse } from "next/og";

/**
 * Phase ν-5 작업5 — Apple Touch Icon (홈 화면 추가 시 표시).
 *
 * 정식 PNG 파일이 들어오기 전까지 글자 "M" 을 accent 컬러 배경으로 렌더.
 * Next.js 가 자동으로 `/apple-icon` 으로 노출.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: "-0.06em",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
