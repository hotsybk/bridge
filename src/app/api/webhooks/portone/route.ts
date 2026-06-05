// Wave D + Phase β-1 — PortOne V2 webhook 핸들러.
//
// 외부에서 들어오는 결제 이벤트(승인/실패/취소)를 받아:
//   1) signature 검증 (verifyWebhookSignature)
//   2) `_portoneWebhooks` 컬렉션에 raw payload 적재 (감사/재처리)
//   3) orders/{orderId} 의 payment.status / status / events 갱신
//      - Transaction.Paid 이벤트는 confirmOrder 흐름과 race 가능 → idempotent skip
//   4) auditLogs 기록
//
// matcher 패턴상 `/api/...` 는 next-firebase-auth-edge proxy 가 통과시키므로
// 별도 우회 설정 불필요. signature 검증으로 보호.

import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import {
  getPayment,
  verifyWebhookSignature,
} from "@/server/services/portone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookBody = {
  type: string;
  data: {
    paymentId: string;
    orderId?: string;
    status?: string;
    [k: string]: unknown;
  };
};

export async function POST(req: NextRequest) {
  // 1) raw body + signature
  const payload = await req.text();
  const signature =
    req.headers.get("x-portone-signature") ??
    req.headers.get("webhook-signature") ??
    "";

  if (!verifyWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(payload) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const db = adminDb();
  const now = FieldValue.serverTimestamp();
  const paymentId = body.data?.paymentId ?? "";
  let orderId = body.data?.orderId ?? "";

  // orderId 가 webhook 에 없으면 paymentKey 로 역조회 (PortOne V2 는 보통 paymentId 만 보냄)
  if (!orderId && paymentId) {
    try {
      const orderSnap = await db
        .collection(COLLECTIONS.orders)
        .where("paymentKey", "==", paymentId)
        .limit(1)
        .get();
      if (!orderSnap.empty) {
        orderId = orderSnap.docs[0].id;
      }
    } catch (err) {
      console.warn("[portone-webhook] order lookup by paymentKey failed", err);
    }
  }

  // 2) raw payload 적재 (idempotent — Firestore auto-id, type+paymentId 인덱싱은 _portoneWebhooks)
  try {
    await db.collection("_portoneWebhooks").add({
      type: body.type,
      paymentId,
      orderId,
      raw: body,
      receivedAt: now,
    });
  } catch (err) {
    console.error("[portone-webhook] failed to persist raw payload", err);
  }

  // 3) type 별 order 갱신
  const orderRef = orderId
    ? db.collection(COLLECTIONS.orders).doc(orderId)
    : null;

  const eventEntry = {
    type: body.type,
    at: new Date(),
    raw: body.data,
  };

  if (orderRef) {
    try {
      // 현재 order 상태를 먼저 조회 — idempotent 보장
      const orderSnap = await orderRef.get();
      const orderData = orderSnap.exists
        ? (orderSnap.data() as {
            status?: string;
            payment?: { status?: string; paidAt?: unknown };
            finalAmount?: number;
            totalAmount?: number;
          })
        : null;

      switch (body.type) {
        case "Transaction.Paid": {
          // 이미 PAID 상태이면 — confirmOrder 가 먼저 처리. 중복 처리 방지.
          if (orderData?.status === "PAID") {
            await orderRef.update({
              "payment.events": FieldValue.arrayUnion({
                ...eventEntry,
                skipped: "already_paid",
              }),
              updatedAt: now,
            });
            break;
          }

          // 금액 일치 검증 (webhook 도 위변조 차단)
          try {
            const payment = await getPayment(paymentId);
            const expected =
              orderData?.finalAmount ?? orderData?.totalAmount ?? 0;
            const actual = payment.amount?.total ?? 0;
            const isMock = payment.source === "mock";
            if (!isMock && actual !== expected) {
              // 금액 불일치 → CANCELLED 표시 + audit (실제 cancel 호출은 confirmOrder 와 충돌 방지로 생략)
              await orderRef.update({
                status: "CANCELLED",
                cancelReason: "AMOUNT_MISMATCH_WEBHOOK",
                "payment.status": "CANCELLED",
                "payment.events": FieldValue.arrayUnion({
                  ...eventEntry,
                  rejected: "amount_mismatch",
                  expected,
                  actual,
                }),
                updatedAt: now,
              });
              break;
            }
          } catch (err) {
            console.warn("[portone-webhook] getPayment verify failed", err);
          }

          await orderRef.update({
            status: "PAID",
            paidAt: now,
            "payment.status": "PAID",
            "payment.paidAt": now,
            "payment.events": FieldValue.arrayUnion(eventEntry),
            updatedAt: now,
          });
          break;
        }
        case "Transaction.PartialCancelled":
          await orderRef.update({
            "payment.status": "PARTIAL_CANCELLED",
            "payment.events": FieldValue.arrayUnion(eventEntry),
            updatedAt: now,
          });
          break;
        case "Transaction.Failed":
          await orderRef.update({
            "payment.status": "FAILED",
            "payment.events": FieldValue.arrayUnion(eventEntry),
            // 이미 PAID 인 주문에 Failed 가 오면 status 는 건드리지 않음 (취소 이벤트로만 처리)
            status:
              orderData?.status === "PAID"
                ? orderData.status
                : "PENDING_PAYMENT",
            updatedAt: now,
          });
          break;
        case "Transaction.Cancelled":
          await orderRef.update({
            "payment.status": "CANCELLED",
            "payment.events": FieldValue.arrayUnion(eventEntry),
            status: "CANCELLED",
            cancelledAt: now,
            updatedAt: now,
          });
          break;
        case "Transaction.Ready":
        case "Transaction.Pending":
          await orderRef.update({
            "payment.events": FieldValue.arrayUnion(eventEntry),
            updatedAt: now,
          });
          break;
        default:
          // 알 수 없는 이벤트는 raw 만 적재
          await orderRef.update({
            "payment.events": FieldValue.arrayUnion(eventEntry),
            updatedAt: now,
          });
      }
    } catch (err) {
      // order not found 또는 update 실패 — 로그만 남기고 200 반환 (재시도 폭주 방지)
      console.warn("[portone-webhook] order update failed", { orderId, err });
    }
  }

  // 4) audit log
  try {
    await db.collection(COLLECTIONS.auditLogs).add({
      actorId: "system",
      actorRole: "SYSTEM",
      action: `PORTONE_WEBHOOK_${body.type}`,
      targetType: "Order",
      targetId: orderId,
      after: { paymentStatus: body.data?.status, paymentId },
      createdAt: now,
    });
  } catch (err) {
    console.warn("[portone-webhook] audit log failed", err);
  }

  return NextResponse.json({ ok: true });
}

// GET — health check (PortOne 콘솔에서 endpoint 등록 검증용)
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "portone-webhook" });
}
