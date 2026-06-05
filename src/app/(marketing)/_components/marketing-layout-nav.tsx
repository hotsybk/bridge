"use client";

// Phase ν-5 작업3 — (marketing) layout 의 client nav wrapper.
//
// useSelectedLayoutSegment 로 현재 라우트의 첫 세그먼트를 읽어 `active` prop 을
// 산출한 뒤 `<MarketingNav />` 에 전달.
//
// segment 매핑:
//   - null         → home (landing) — 그러나 landing 은 (marketing) 그룹 밖이라
//                    이 경로로 진입할 수 없음. 안전을 위해 fallback "home".
//   - "about"      → "about"
//   - "pricing"    → "pricing"
//   - "support"    → "support"
//   - "legal"      → undefined (NAV 항목에 없음 — active 없음)
//   - 그 외        → undefined

import { useSelectedLayoutSegment } from "next/navigation";

import { MarketingNav } from "@/components/marketing/marketing-nav";

type Active = "home" | "about" | "pricing" | "support" | undefined;

export function MarketingLayoutNav() {
  const segment = useSelectedLayoutSegment();
  const active: Active =
    segment === "about"
      ? "about"
      : segment === "pricing"
        ? "pricing"
        : segment === "support"
          ? "support"
          : undefined;
  return <MarketingNav active={active} />;
}
