import { ImageResponse } from "next/og";

/**
 * Phase ν-2 — 동적 OG 이미지 (Next.js 16 ImageResponse).
 *
 * 1200x630 — Twitter Large Card · Facebook 권장 사이즈.
 * Apple 톤 — 흰 배경 + 워드마크 + 큰 헤드라인 + 작은 라벨.
 */

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 96px",
          background:
            "linear-gradient(135deg, #ffffff 0%, #f5f7fb 50%, #e8f0fb 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#0a0a0a",
        }}
      >
        {/* 상단 — 워드마크 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#0066CC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            M
          </div>
          <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>
            MedPlace
          </span>
        </div>

        {/* 중앙 — 헤드라인 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#0066CC",
              marginBottom: 28,
            }}
          >
            한국 의료 B2B 마켓플레이스
          </span>
          <span
            style={{
              fontSize: 84,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
            }}
          >
            발주서 다시 쓰는 시간,
          </span>
          <span
            style={{
              fontSize: 84,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: "#0066CC",
            }}
          >
            이제 0초.
          </span>
        </div>

        {/* 하단 — 보조 카피 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 20,
            color: "#666",
          }}
        >
          <span>의료기관 ↔ 공급업체 직거래 · 자동 정산 · UDI 자동보고</span>
          <span style={{ fontWeight: 500, color: "#0a0a0a" }}>medplace.kr</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
