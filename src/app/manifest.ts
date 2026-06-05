import type { MetadataRoute } from "next";

/**
 * Phase ν-5 작업5 — PWA 매니페스트 토대.
 *
 * 정식 PNG 아이콘 파일은 디자이너가 별도로 /public/ 에 생성한다.
 * (icon-192.png, icon-512.png, icon-maskable.png — Phase 외부 작업)
 *
 * 매니페스트는 Next.js App Router 가 자동으로 `/manifest.json` 으로 노출한다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedPlace — 의료 B2B 마켓플레이스",
    short_name: "MedPlace",
    description:
      "한국 의료기관과 공급업체를 잇는 멀티벤더 B2B 마켓플레이스",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#0066CC",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    lang: "ko-KR",
    categories: ["medical", "business", "shopping"],
  };
}
