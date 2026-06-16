import type { Metadata } from "next";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { NotificationsList } from "@/components/shared/notifications-list";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "알림 센터",
  description: "주문·분쟁·정산·정기구독·공동구매 알림을 한 곳에서 확인합니다.",
};

// 인증 컨텍스트 의존 — 정적 prerender 불가.
export const dynamic = "force-dynamic";

/**
 * Phase ν-2 — /notifications (buyer 알림 센터).
 *
 * Apple 톤 — 박스 컨테이너 0개, divide-y / border-y 라인 only.
 * 데이터·필터·페이지네이션은 공용 NotificationsList 컴포넌트가 담당.
 */
export default function BuyerNotificationsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
        <div className="border-b border-[var(--color-border-light)] pb-8 md:pb-10">
          <PageHeader
            label="알림 센터"
            title="알림"
            description="주문·분쟁·정산·정기구독·공동구매 알림 한 곳에서."
          />
        </div>

        <div className="mt-10 md:mt-12">
          <NotificationsList audience="BUYER" />
        </div>

        <div className="h-24" />
      </main>
    </div>
  );
}
