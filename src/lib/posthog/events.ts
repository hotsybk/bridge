/**
 * Phase ν-2 — PostHog 5개 핵심 이벤트 헬퍼.
 *
 * 모든 함수는 client only. PostHog 미설정 시 silent (window.posthog 없음).
 * dynamic import 로 SSR/edge runtime 영향 차단.
 */

type Props = Record<string, string | number | boolean | undefined | null>;

async function track(event: string, props?: Props): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const mod = await import("posthog-js");
    const posthog = mod.default;
    // 초기화 안 됐으면 skip (provider 미마운트 또는 KEY 없음)
    if (!(window as unknown as { __ph_inited?: boolean }).__ph_inited) {
      return;
    }
    posthog.capture(event, props);
  } catch {
    // posthog-js 로드 실패 → silent
  }
}

/** 회원가입 완료 (register page 성공 직후). */
export function trackAuthSignup(props: {
  role: "BUYER_OWNER" | "VENDOR_OWNER";
  method: "EMAIL" | "GOOGLE";
}): void {
  void track("auth_signup", props);
}

/** 카트 담기 (buy panel · cart router 성공 직후). */
export function trackCartAdd(props: {
  productId: string;
  vendorId: string;
  qty: number;
  unitPrice: number;
}): void {
  void track("cart_add", props);
}

/** 체크아웃 진입 (페이지 mount). */
export function trackCheckoutStart(props: {
  itemCount: number;
  itemsTotal: number;
  vendorCount: number;
}): void {
  void track("checkout_start", props);
}

/** 결제 완료 (checkout/complete page mount). */
export function trackOrderComplete(props: {
  orderId: string;
  orderNo: string;
  amount: number;
  method?: string;
}): void {
  void track("order_complete", props);
}

/** 공동구매 참여 성공. */
export function trackGroupbuyJoin(props: {
  groupBuyId: string;
  productId: string;
  qty: number;
  amount: number;
}): void {
  void track("groupbuy_join", props);
}
