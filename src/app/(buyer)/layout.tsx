import { MobileBottomTabBar } from "@/components/buyer/mobile-bottom-tab-bar";

/**
 * Phase ξ-1 — 구매자 route group 공통 layout.
 *
 * 모바일 글로벌 bottom tab bar 마운트.
 * 데스크탑(md+)은 자동 숨김.
 *
 * 본문에는 `pb-14 md:pb-0` 패딩이 필요하지만, 각 페이지가 자체적으로
 * 풍부한 bottom padding 을 갖고 있어 일단 전체 컨테이너에 `pb-14 md:pb-0` 만 추가.
 */
export default function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pb-14 md:pb-0">
      {children}
      <MobileBottomTabBar />
    </div>
  );
}
