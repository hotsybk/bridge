// Wave M — 정산 계산 라이브러리 (Next.js 서버 측).
//
// tRPC procedure 에서 미리보기 계산용. 본격 일괄 계산은 functions/src/lib/settlement-calc.ts.
// 변경 시 functions/src/lib/settlement-calc.ts 와 동기화 유지.

// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("server/lib/settlement-calc must be used only on the server side.");
}

export type SubOrderInput = {
  id: string;
  orderId: string;
  vendorId: string;
  totalAmount: number;
  categoryId?: string;
  categoryCommissionRate?: number;
  refundedAmount?: number;
};

export type VendorInput = {
  id: string;
  defaultCommissionRate: number;
  fastSettlementEnabled: boolean;
  grade?: string;
};

export type SettlementCalcResult = {
  grossAmount: number;
  paymentFeeAmount: number;
  paymentFeeVatAmount: number;
  commissionAmount: number;
  commissionVatAmount: number;
  refundDeductAmount: number;
  couponDeductAmount: number;
  netPayout: number;
};

const PAYMENT_FEE_RATES: Record<string, number> = {
  CARD: 0.028,
  TRANSFER: 0.005,
  VIRTUAL: 0.003,
};

export function calculateSettlement(args: {
  subOrders: SubOrderInput[];
  vendor: VendorInput;
  paymentChannel?: "CARD" | "TRANSFER" | "VIRTUAL";
  couponDiscountAmount?: number;
}): SettlementCalcResult {
  const {
    subOrders,
    vendor,
    paymentChannel = "CARD",
    couponDiscountAmount = 0,
  } = args;

  const grossAmount = subOrders.reduce((s, so) => s + so.totalAmount, 0);

  const paymentFeeAmount = Math.floor(
    grossAmount * (PAYMENT_FEE_RATES[paymentChannel] ?? 0.028),
  );
  const paymentFeeVatAmount = Math.floor(paymentFeeAmount * 0.1);

  let commissionAmount = 0;
  for (const so of subOrders) {
    const rate =
      so.categoryCommissionRate ?? vendor.defaultCommissionRate ?? 0.05;
    commissionAmount += Math.floor(so.totalAmount * rate);
  }
  const commissionVatAmount = Math.floor(commissionAmount * 0.1);

  const refundDeductAmount = subOrders.reduce(
    (s, so) => s + (so.refundedAmount ?? 0),
    0,
  );

  const couponDeductAmount = couponDiscountAmount;

  const netPayout =
    grossAmount -
    paymentFeeAmount -
    paymentFeeVatAmount -
    commissionAmount -
    commissionVatAmount -
    refundDeductAmount;

  return {
    grossAmount,
    paymentFeeAmount,
    paymentFeeVatAmount,
    commissionAmount,
    commissionVatAmount,
    refundDeductAmount,
    couponDeductAmount,
    netPayout: Math.max(0, netPayout),
  };
}

export function calculateFastFee(netPayout: number, daysAhead: number): number {
  const FAST_RATE_PER_DAY = 0.00012;
  return Math.floor(netPayout * FAST_RATE_PER_DAY * Math.max(0, daysAhead));
}
