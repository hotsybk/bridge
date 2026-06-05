// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("portone.ts must be used only on the server side.");
}

// Wave D / Phase β-1 — PortOne V2 API 클라이언트 (server-only).
//
// env:
//   PORTONE_API_SECRET    — PortOne V2 API Secret (server-to-server 인증)
//   PORTONE_WEBHOOK_SECRET — webhook signature 검증용 HMAC secret
//   PORTONE_STORE_ID      — 가맹점 식별자
//
// env 가 비어 있으면 mock 응답을 반환 (dev 환경 동작 유지).
//
// Phase β-1 변경:
//   - preRegisterPayment 신규 (위변조 방지용 결제 사전 등록)
//   - getPayment 의 반환 타입을 PortonePaymentInfo 로 명세
//   - 모든 함수가 mock fallback 유지 — PORTONE_API_SECRET 없으면 자동 mock

// eslint-disable-next-line import/first
import crypto from "crypto";
// eslint-disable-next-line import/first
import { withRetry } from "@/server/lib/retry";

const BASE_URL = "https://api.portone.io";

/**
 * HTTP status 를 포함하는 에러 — withRetry 가 4xx/5xx 분기에 활용.
 */
class PortoneHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PortoneHttpError";
    this.status = status;
  }
}

/**
 * Phase β-2 — production 에서 PORTONE_API_SECRET 누락 시 fail-fast.
 *
 * dev/staging 은 mock fallback 유지 (PortOne 가입 전에도 흐름 검증 가능).
 * production 만 차단: mock 으로 silent 통과되면 결제 검증·환불·정산이 모두 가짜 응답으로 통과 → 사고.
 */
function assertPortoneSecretInProd(): void {
  if (process.env.NODE_ENV === "production" && !process.env.PORTONE_API_SECRET) {
    throw new Error(
      "[PORTONE] PORTONE_API_SECRET 가 production 에 설정되지 않음 — fail-fast",
    );
  }
}

export type PortoneCancelInput = {
  paymentId: string;
  reason: string;
  /** 부분 취소 가능. 미지정 시 전액. */
  amount?: number;
  /** 가상계좌 환불 시 필수 */
  refundAccount?: { bank: string; number: string; holderName: string };
};

export type PortoneCancelResult = {
  paymentId: string;
  cancellation: {
    id: string;
    status: "SUCCEEDED" | "FAILED";
    totalAmount: number;
    requestedAt: string;
    completedAt?: string;
  };
  source: "portone" | "mock";
};

/**
 * 결제 취소 — 부분 / 전액 환불 모두 지원.
 *
 * PORTONE_API_SECRET 가 없으면 mock 응답을 반환 (dev 환경에서
 * 강제 환불 UI 흐름을 검증할 수 있도록).
 */
export async function cancelPayment(input: PortoneCancelInput): Promise<PortoneCancelResult> {
  assertPortoneSecretInProd();
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) {
    console.warn("[portone] PORTONE_API_SECRET not set, returning mock response");
    return {
      paymentId: input.paymentId,
      cancellation: {
        id: `mock-cancel-${Date.now()}`,
        status: "SUCCEEDED",
        totalAmount: input.amount ?? 0,
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      source: "mock",
    };
  }

  const json = await withRetry(async () => {
    const res = await fetch(
      `${BASE_URL}/payments/${encodeURIComponent(input.paymentId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `PortOne ${apiSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: input.reason,
          amount: input.amount,
          refundAccount: input.refundAccount,
        }),
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new PortoneHttpError(
        res.status,
        `PortOne cancel failed: ${res.status} ${errText}`,
      );
    }
    return (await res.json()) as Omit<PortoneCancelResult, "source">;
  });
  return { ...json, source: "portone" };
}

// ─────────────────────────────────────────────────────────────
// getPayment — 결제 단건 조회 (위변조 검증 / webhook 보완용)
// ─────────────────────────────────────────────────────────────

/**
 * PortOne V2 Payment 단건 조회 응답 일부 (필요 필드만 명세).
 * 공식 schema: https://developers.portone.io/api/rest-v2/payment#get
 */
export type PortonePaymentInfo = {
  status:
    | "READY"
    | "PENDING"
    | "VIRTUAL_ACCOUNT_ISSUED"
    | "PAID"
    | "FAILED"
    | "PARTIAL_CANCELLED"
    | "CANCELLED";
  id: string;
  transactionId?: string;
  merchantId?: string;
  storeId?: string;
  amount: {
    total: number;
    taxFree?: number;
    vat?: number;
    supply?: number;
    discount?: number;
    paid?: number;
    cancelled?: number;
    cancelledTaxFree?: number;
  };
  currency?: string;
  method?: {
    type?: string;
    [k: string]: unknown;
  } | null;
  channel?: {
    key?: string;
    name?: string;
    type?: string;
    [k: string]: unknown;
  } | null;
  paidAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  customer?: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
  };
  customData?: string;
  source?: "portone" | "mock";
  [k: string]: unknown;
};

/**
 * 결제 단건 조회 — webhook 검증 / 결제 정합성 확인용.
 *
 * PORTONE_API_SECRET 미설정 시 mock 객체 반환 (paymentId 가 mock_pay_ 로 시작하면
 * PAID 로, mock_fail_ 로 시작하면 FAILED 로 반환 — dev 환경에서 흐름 검증용).
 */
export async function getPayment(paymentId: string): Promise<PortonePaymentInfo> {
  assertPortoneSecretInProd();
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) {
    console.warn("[portone] PORTONE_API_SECRET not set, returning mock payment");
    const isFail = paymentId.startsWith("mock_fail_");
    return {
      id: paymentId,
      status: isFail ? "FAILED" : "PAID",
      amount: { total: 0 },
      currency: "KRW",
      method: { type: "CARD" },
      channel: { key: "mock-channel", type: "PG" },
      paidAt: new Date().toISOString(),
      source: "mock",
    };
  }
  const json = await withRetry(async () => {
    const res = await fetch(
      `${BASE_URL}/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `PortOne ${apiSecret}` },
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new PortoneHttpError(
        res.status,
        `PortOne getPayment failed: ${res.status} ${errText}`,
      );
    }
    return (await res.json()) as PortonePaymentInfo;
  });
  return { ...json, source: "portone" };
}

// ─────────────────────────────────────────────────────────────
// preRegisterPayment — 결제 사전 등록 (위변조 방지)
// ─────────────────────────────────────────────────────────────

export type PreRegisterPaymentInput = {
  paymentId: string;
  totalAmount: number;
  taxFreeAmount?: number;
  currency?: "KRW";
};

export type PreRegisterPaymentResult = {
  paymentId: string;
  status: "REGISTERED" | "SKIPPED";
  source: "portone" | "mock";
};

/**
 * PortOne V2 Pre-register Payment.
 *
 * 클라이언트 SDK 가 결제창을 띄우기 전에 서버가 PortOne 에 (paymentId, amount, currency)
 * 를 사전 등록해두면, 클라이언트가 결제 금액을 위변조하더라도 PortOne 이 거부한다.
 *
 * 공식 API: PUT https://api.portone.io/payments/{paymentId}/pre-register
 *
 * env 미설정 시 mock skip 반환 — checkout 페이지는 mock 모드로 polling 한다.
 */
export async function preRegisterPayment(
  input: PreRegisterPaymentInput,
): Promise<PreRegisterPaymentResult> {
  assertPortoneSecretInProd();
  if (process.env.NODE_ENV === "production" && !process.env.PORTONE_STORE_ID) {
    throw new Error(
      "[PORTONE] PORTONE_STORE_ID 가 production 에 설정되지 않음 — fail-fast",
    );
  }
  const apiSecret = process.env.PORTONE_API_SECRET;
  const storeId = process.env.PORTONE_STORE_ID;
  if (!apiSecret || !storeId) {
    return {
      paymentId: input.paymentId,
      status: "SKIPPED",
      source: "mock",
    };
  }

  await withRetry(async () => {
    const res = await fetch(
      `${BASE_URL}/payments/${encodeURIComponent(input.paymentId)}/pre-register`,
      {
        method: "POST",
        headers: {
          Authorization: `PortOne ${apiSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storeId,
          totalAmount: input.totalAmount,
          taxFreeAmount: input.taxFreeAmount,
          currency: input.currency ?? "KRW",
        }),
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new PortoneHttpError(
        res.status,
        `PortOne pre-register failed: ${res.status} ${errText}`,
      );
    }
  });

  return {
    paymentId: input.paymentId,
    status: "REGISTERED",
    source: "portone",
  };
}

// ─────────────────────────────────────────────────────────────
// Wave I — Pre-authorization / Capture (공동구매용)
// ─────────────────────────────────────────────────────────────

export type PreAuthInput = {
  amount: number;
  orderName: string;
  customerId: string;
  cardKey?: string;
};

export type PreAuthResult = {
  paymentId: string;
  status: "PRE_AUTHORIZED" | "FAILED";
  source: "portone" | "mock";
  raw?: unknown;
};

/**
 * 공동구매 참여 시 카드 hold (pre-authorization).
 *
 * PortOne V2 는 결제창 client SDK 가 결제 인증을 수행하므로 서버는 paymentId 만 책임.
 * 실 구현은 Phase 2.5+ (PortOne 가입 + billingKey 발급 후) 진행.
 * env 가 없으면 mock paymentId 반환 — UI 흐름 검증 가능.
 */
export async function preAuthorize(input: PreAuthInput): Promise<PreAuthResult> {
  assertPortoneSecretInProd();
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) {
    console.warn("[portone] PORTONE_API_SECRET not set, mock pre-auth", input.orderName);
    return {
      paymentId: `mock-preauth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: "PRE_AUTHORIZED",
      source: "mock",
    };
  }
  // TODO Phase 2.5+: 실 PortOne pre-auth flow
  // 1) 클라이언트에서 빌링키 발급 (PortOne client SDK)
  // 2) 서버에서 빌링키 + amount 로 hold 요청
  // 3) paymentId 반환
  return {
    paymentId: `pid-${Date.now()}`,
    status: "PRE_AUTHORIZED",
    source: "mock",
  };
}

export type CaptureAuthInput = {
  paymentId: string;
  amount?: number;
};

export type CaptureAuthResult = {
  paymentId: string;
  status: "CAPTURED" | "FAILED";
  source: "portone" | "mock";
};

/**
 * Pre-auth 결제 captue — 공동구매 목표 달성 시 일괄 호출.
 *
 * 실 구현: POST /payments/{paymentId}/capture
 * env 가 없으면 mock CAPTURED 반환.
 */
export async function captureAuth(input: CaptureAuthInput): Promise<CaptureAuthResult> {
  assertPortoneSecretInProd();
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) {
    console.warn("[portone] PORTONE_API_SECRET not set, mock capture", input.paymentId);
    return { paymentId: input.paymentId, status: "CAPTURED", source: "mock" };
  }
  // TODO Phase 2.5+: 실 PortOne capture endpoint
  return { paymentId: input.paymentId, status: "CAPTURED", source: "mock" };
}

/**
 * Webhook signature 검증.
 *
 * PortOne V2 webhook signature = HMAC-SHA256(payload, secret) → hex.
 *
 * Phase α-4 — fail-closed.
 *   - signature 없으면 거부
 *   - secret 미설정이면 dev/prod 무관하게 거부 (이전엔 dev 우회)
 *   - dev 환경에서 webhook 테스트 시 PORTONE_WEBHOOK_SECRET 을 .env.local 에 명시 필수.
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!signature) return false;
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      "[portone] PORTONE_WEBHOOK_SECRET not configured — webhook denied (fail-closed)",
    );
    return false;
  }
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    // timing-safe compare
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
