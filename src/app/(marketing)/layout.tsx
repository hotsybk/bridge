// Phase ν-5 작업3 — (marketing) route group 공통 layout.
//
// 8개 마케팅 페이지(about, pricing, support, support/contact, support/faq,
// legal/terms, legal/privacy, legal/marketplace)의 인라인
// MarketingNav + MinimalFooter 중복을 제거.
//
// active prop 은 client child(useSelectedLayoutSegment 사용) 가 산출하므로
// layout 자체는 server component 로 유지하면서 nav 만 client 컴포넌트로 위임.

import { MarketingLayoutNav } from "./_components/marketing-layout-nav";
import { MinimalFooter } from "@/components/marketing/minimal-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingLayoutNav />
      {children}
      <MinimalFooter />
    </>
  );
}
