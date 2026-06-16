import type { Metadata } from "next";

import { NotificationsList } from "@/components/shared/notifications-list";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "알림 센터",
  description: "새 주문·분쟁·정산·심사 결과 알림을 한 곳에서 확인합니다.",
};

// 셀러센터 페이지 — vendor 가드는 (approved)/layout 에서 처리.
export const dynamic = "force-dynamic";

/**
 * Phase ν-2 — /seller/notifications (vendor 알림 센터).
 *
 * SellerSubNav 는 (approved)/layout 에서 마운트.
 * Apple 톤 — 박스 0개, divide-y / border-y 라인 only.
 */
export default function VendorNotificationsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <PageHeader
        label="파트너센터 · 알림"
        title="알림"
        description="새 주문 · 분쟁 · 정산 · 심사 결과에서 발생한 모든 알림을 한 곳에서 확인합니다."
      />

      <div className="mt-10 md:mt-12">
        <NotificationsList audience="VENDOR" />
      </div>

      <div className="h-24" />
    </main>
  );
}
