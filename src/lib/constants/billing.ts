/**
 * 과금/수수료 정책 상수 — Σ-4.
 *
 * 주의: 주문 생성(order.ts) 시점의 commission/payout 은 **denorm 추정치**다.
 * 실제 정산 금액은 settlement-calc (functions/src/lib/settlement-calc.ts) 에서
 * `categoryCommissionRate ?? vendor.defaultCommissionRate ?? DEFAULT_COMMISSION_RATE`
 * 로 재계산된다 (카테고리/벤더별 rate 우선). 이 상수는 최종 fallback 기본값.
 */

/** 기본 중개수수료율 (5%) — 카테고리/벤더 rate 미설정 시 fallback */
export const DEFAULT_COMMISSION_RATE = 0.05;

/** 부가세율 (10%) */
export const VAT_RATE = 0.1;
