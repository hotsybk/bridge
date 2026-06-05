import type { Metadata } from "next";

import { NotificationsList } from "@/components/shared/notifications-list";

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
    <main className="mx-auto max-w-5xl px-6 py-12 md:px-12 md:py-20">
      <header className="border-b border-[var(--color-border-light)] pb-8 md:pb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          셀러센터 · 알림
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
          알림
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--color-text-secondary)]">
          새 주문 · 분쟁 · 정산 · 심사 결과에서 발생한 모든 알림을 한 곳에서 확인합니다.
        </p>
      </header>

      <div className="mt-10 md:mt-12">
        <NotificationsList audience="VENDOR" />
      </div>

      <div className="h-24" />
    </main>
  );
}
