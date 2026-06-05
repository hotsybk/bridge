/**
 * 배송비 정책 상수 — Phase δ-5.
 *
 * /cart 와 /checkout 양쪽에서 공통 사용. 이후 vendor 별 다른 배송비 정책이
 * 도입되더라도 이 한 파일만 수정한다.
 */

export const SHIPPING_FEE_PER_VENDOR = 3000;

/**
 * 주문에 포함된 고유 vendor 수 기반으로 총 배송비 계산.
 * @param vendorIds — 카트·주문에 포함된 vendor id 들 (중복 허용)
 */
export function calculateShippingTotal(vendorIds: string[]): number {
  return new Set(vendorIds).size * SHIPPING_FEE_PER_VENDOR;
}
