import { redirect } from "next/navigation";

import { trpcServer } from "@/lib/trpc/server";

// 모든 /seller/* (approved) 페이지는 인증 컨텍스트 의존 — 정적 prerender 불가.
export const dynamic = "force-dynamic";

/**
 * Phase 1.7-C — 셀러센터 가드.
 *
 * /seller/products, /seller/orders, /seller/settlement, /seller/analytics 등 모든
 * APPROVED 전용 페이지에 적용. /seller/pending 은 이 layout 밖 (sub-group 분리).
 *
 * 흐름:
 *  - vendor === null            → /onboarding/vendor (가입 미완료)
 *  - status === APPROVED        → children 렌더
 *  - 그 외 status (PENDING_DOCS, PENDING_REVIEW, SUSPENDED, REJECTED) → /seller/pending
 *
 * Firestore에서 실시간 status 를 읽으므로 admin 이 status 를 APPROVED 로 갱신하는 즉시
 * 다음 페이지 요청부터 통과. Custom Claims 갱신·force-refresh 불필요.
 */
export default async function SellerApprovedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const trpc = await trpcServer();
  const vendor = await trpc.vendor.getCurrent();

  if (!vendor) {
    redirect("/onboarding/vendor");
  }
  if (vendor.status !== "APPROVED") {
    redirect("/seller/pending");
  }

  return <>{children}</>;
}
