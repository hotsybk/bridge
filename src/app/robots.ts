// Phase ν-1 — robots.ts.
// 운영자·셀러센터·계정 등 인증 전용 path 는 색인 차단.

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
    "https://medplace.kr";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/*",
          "/seller",
          "/seller/*",
          "/account",
          "/account/*",
          "/onboarding",
          "/onboarding/*",
          "/checkout",
          "/cart",
          "/orders",
          "/orders/*",
          "/subscriptions",
          "/subscriptions/*",
          "/groupbuys/*",
          "/rfq",
          "/rfq/*",
          "/api/*",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
