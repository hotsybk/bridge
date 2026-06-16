// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/scheduled/subscription-runner must be used only on the server side.");
}

// Wave Y — Phase 3 정기구독 자동 발주 cron.
//
// 매일 03:00 KST 실행.
//
// 동작:
// 1. ACTIVE + nextRunAt <= now 인 subscriptions 조회 (limit 500)
// 2. 각 구독:
//    a. 상품 가격 확인 — 5%+ 변동 시 PRICE_HOLD + hospital 알림
//    b. 정상 시 자동 주문 생성 (orders + subOrders + items)
//       PortOne 통합 전이라 mock paymentId 로 자동 PAID
//    c. Subscription.lastRunAt / nextRunAt / totalRuns / totalAmount 갱신
//    d. SubscriptionRun 적재 (SUCCESS / FAILED / PRICE_HOLD)
//    e. hospital 알림 (KAKAO + IN_APP)
// 3. 배치 audit log 적재

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {shortId} from "../lib/id-gen";
// eslint-disable-next-line import/first
import {recordHeartbeat} from "../lib/heartbeat";

type ProductDoc = {
  basePrice?: number;
  priceTiers?: Array<{minQty: number; price: number}>;
  status?: string;
  moderation?: {status?: string};
};

type SubscriptionDoc = {
  hospitalId?: string;
  hospitalName?: string;
  userId?: string;
  vendorId?: string;
  vendorName?: string;
  productId?: string;
  productName?: string;
  productImage?: string | null;
  cadence?: string;
  qty?: number;
  unitPrice?: number;
  unit?: string;
  status?: string;
  nextRunAt?: Timestamp;
  shippingAddress?: {
    name: string;
    phone: string;
    zipcode: string;
    address: string;
    addressDetail?: string;
  };
};

function resolveUnitPrice(product: ProductDoc, qty: number): number {
  const base = Number(product.basePrice ?? 0);
  if (!product.priceTiers || product.priceTiers.length === 0) return base;
  const sorted = [...product.priceTiers].sort((a, b) => b.minQty - a.minQty);
  const tier = sorted.find((t) => qty >= t.minQty);
  return tier ? tier.price : base;
}

function calculateNextRunAt(cadence: string, from: Date): Date {
  const next = new Date(from);
  switch (cadence) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export const subscriptionRunner = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async () => {
    const now = Timestamp.now();
    logger.info("[subscription-runner] tick", {now: now.toDate().toISOString()});

    // 1) 대상 조회
    const snap = await db
      .collection(COLLECTIONS.subscriptions)
      .where("status", "==", "ACTIVE")
      .where("nextRunAt", "<=", now)
      .limit(500)
      .get();

    logger.info("[subscription-runner] scanned", {count: snap.size});

    let success = 0;
    let failed = 0;
    let priceHold = 0;

    for (const subDoc of snap.docs) {
      const sub = subDoc.data() as SubscriptionDoc;
      const subId = subDoc.id;

      try {
        if (!sub.productId || !sub.vendorId || !sub.hospitalId) {
          throw new Error("필수 필드(productId/vendorId/hospitalId) 누락");
        }

        // 2) 상품 가격 확인
        const productSnap = await db
          .collection(COLLECTIONS.products)
          .doc(sub.productId)
          .get();
        if (!productSnap.exists) {
          await subDoc.ref.update({
            status: "CANCELLED",
            statusReason: "상품을 찾을 수 없음",
            updatedAt: FieldValue.serverTimestamp(),
          });
          await subDoc.ref.collection("runs").add({
            subscriptionId: subId,
            scheduledAt: sub.nextRunAt ?? Timestamp.now(),
            status: "FAILED",
            errorReason: "상품을 찾을 수 없음",
            createdAt: FieldValue.serverTimestamp(),
          });
          failed++;
          continue;
        }
        const product = productSnap.data() as ProductDoc;
        const qty = Number(sub.qty ?? 0);
        const currentPrice = resolveUnitPrice(product, qty);
        const oldPrice = Number(sub.unitPrice ?? 0);

        // 가격 변동 5%+ → PRICE_HOLD
        if (oldPrice > 0) {
          const priceChange = ((currentPrice - oldPrice) / oldPrice) * 100;
          if (Math.abs(priceChange) >= 5) {
            const serverNow = FieldValue.serverTimestamp();
            await subDoc.ref.update({
              priceChangePercent: priceChange,
              priceChangeRequiresApproval: true,
              updatedAt: serverNow,
            });
            await subDoc.ref.collection("runs").add({
              subscriptionId: subId,
              scheduledAt: sub.nextRunAt ?? Timestamp.now(),
              status: "PRICE_HOLD",
              priceAtRun: currentPrice,
              errorReason: `가격이 ${priceChange.toFixed(1)}% 변동 — 사용자 승인 필요`,
              createdAt: serverNow,
            });
            await db.collection(COLLECTIONS.notifications).add({
              targetType: "HOSPITAL",
              targetId: sub.hospitalId,
              type: "SUBSCRIPTION_PRICE_CHANGED",
              title: "정기구독 가격 변동 알림",
              body: `${sub.productName ?? "상품"} 가격이 ${priceChange > 0 ? "+" : ""}${priceChange.toFixed(1)}% 변동되었습니다. 승인이 필요합니다.`,
              channels: ["KAKAO", "IN_APP"],
              kakaoSent: false,
              emailSent: false,
              createdAt: serverNow,
            });
            priceHold++;
            continue;
          }
        }

        // 3) 자동 주문 생성
        const unitPrice = currentPrice > 0 ? currentPrice : oldPrice;
        const subtotal = unitPrice * qty;
        const vatAmount = Math.floor(subtotal * 0.1);
        const shippingAmount = 0;
        const totalAmount = subtotal + shippingAmount;

        // Phase β-2: nanoid-like shortId 8자 — 36^8 조합으로 충돌 확률 ≈0.
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10);
        const orderNo = `MP-SUB-${dateStr}-${shortId(8)}`;
        const mockPaymentId = `mock_sub_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;

        const orderRef = db.collection(COLLECTIONS.orders).doc();
        const serverNow = FieldValue.serverTimestamp();
        // Σ-1 — order + subOrder + item + 구독 nextRunAt 갱신 + run 을 한 배치로 원자화.
        // 중간 실패 시 nextRunAt 미갱신 → 다음 cron 중복 발주(이중 청구) 방지.
        const batch = db.batch();

        batch.set(orderRef, {
          orderNo,
          hospitalId: sub.hospitalId,
          hospitalName: sub.hospitalName ?? "병원",
          userId: sub.userId ?? "system",
          userName: "정기구독",

          subscriptionId: subId,
          isSubscriptionOrder: true,

          status: "PAID",

          subtotalAmount: subtotal,
          shippingAmount,
          discountAmount: 0,
          vatAmount,
          totalAmount,

          paymentMethod: "CARD",
          paymentKey: mockPaymentId,
          paidAt: serverNow,
          payment: {
            method: "CARD",
            status: "PAID",
            paymentId: mockPaymentId,
            channel: "subscription-mock",
            paidAt: serverNow,
            events: [
              {type: "Subscription.Triggered", subscriptionId: subId},
              {type: "Payment.Mock.Captured", paymentId: mockPaymentId},
            ],
          },

          approvalStatus: "NOT_REQUIRED",

          // 배송지 — flat + nested 둘 다
          shippingZipcode: sub.shippingAddress?.zipcode ?? "",
          shippingAddress: sub.shippingAddress?.address ?? "",
          shippingAddressDetail: sub.shippingAddress?.addressDetail ?? null,
          shippingRecipient: sub.shippingAddress?.name ?? sub.hospitalName ?? "병원",
          shippingPhone: sub.shippingAddress?.phone ?? "",
          shippingMemo: null,

          subOrderCount: 1,
          vendorIds: [sub.vendorId],

          coupon: null,
          invoiceRequested: false,
          invoiceEmail: null,
          buyerNote: null,

          createdAt: serverNow,
          updatedAt: serverNow,
        });

        // SubOrder
        const subOrderRef = orderRef.collection("subOrders").doc();
        const subOrderNo = `${orderNo}-01`;
        const commissionRate = 0.05;
        const commission = Math.floor(subtotal * commissionRate);
        const commissionVat = Math.floor(commission * 0.1);
        const payoutAmount = subtotal - commission - commissionVat;

        batch.set(subOrderRef, {
          subOrderNo,
          orderId: orderRef.id,
          orderNo,
          vendorId: sub.vendorId,
          vendorName: sub.vendorName ?? "공급사",
          hospitalId: sub.hospitalId,
          hospitalName: sub.hospitalName ?? "병원",

          status: "ACCEPTED",

          subtotal,
          shippingFee: 0,
          vat: vatAmount,
          total: subtotal,

          commissionRate,
          commission,
          commissionVat,
          payoutAmount,

          udiReported: false,
          itemCount: 1,

          createdAt: serverNow,
          updatedAt: serverNow,
        });

        const itemRef = subOrderRef.collection("items").doc();
        batch.set(itemRef, {
          productId: sub.productId,
          productName: sub.productName ?? "상품",
          productImage: sub.productImage ?? null,
          unitPrice,
          qty,
          amount: subtotal,
          unit: sub.unit ?? "EA",
        });

        // 4) Subscription 갱신 (nextRunAt 전진 — 중복 발주 방지의 핵심)
        const cadence = sub.cadence ?? "MONTHLY";
        const newNextRunAt = calculateNextRunAt(cadence, new Date());
        batch.update(subDoc.ref, {
          lastRunAt: serverNow,
          nextRunAt: Timestamp.fromDate(newNextRunAt),
          unitPrice, // 최신 가격 스냅샷 갱신
          totalRuns: FieldValue.increment(1),
          totalAmount: FieldValue.increment(subtotal),
          priceChangePercent: FieldValue.delete(),
          priceChangeRequiresApproval: FieldValue.delete(),
          updatedAt: serverNow,
        });

        // 5) SubscriptionRun 적재 (SUCCESS)
        const runRef = subDoc.ref.collection("runs").doc();
        batch.set(runRef, {
          subscriptionId: subId,
          scheduledAt: sub.nextRunAt ?? Timestamp.now(),
          status: "SUCCESS",
          orderId: orderRef.id,
          priceAtRun: unitPrice,
          createdAt: serverNow,
          completedAt: serverNow,
        });

        // Σ-1 — 원자적 커밋: order + subOrder + item + 구독 갱신 + run 일괄
        await batch.commit();

        // 6) hospital 알림 (best-effort, 커밋 후 — 알림 실패가 주문을 롤백하면 안 됨)
        try {
          await db.collection(COLLECTIONS.notifications).add({
            targetType: "HOSPITAL",
            targetId: sub.hospitalId,
            type: "SUBSCRIPTION_ORDER_PLACED",
            title: "정기구독 자동 발주",
            body: `${sub.productName ?? "상품"} ${qty}${sub.unit ?? "EA"} 자동 발주됨 (${orderNo})`,
            channels: ["KAKAO", "IN_APP"],
            kakaoSent: false,
            emailSent: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (notifyErr) {
          logger.warn("[subscription-runner] notify failed", {
            subId,
            err: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
          });
        }

        success++;
      } catch (err) {
        failed++;
        const reason = err instanceof Error ? err.message : String(err);
        logger.error("[subscription-runner] failed", {subId, reason});
        try {
          await subDoc.ref.collection("runs").add({
            subscriptionId: subId,
            scheduledAt: sub.nextRunAt ?? Timestamp.now(),
            status: "FAILED",
            errorReason: reason,
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (qErr) {
          logger.error("[subscription-runner] run write failed", {
            subId,
            err: qErr instanceof Error ? qErr.message : String(qErr),
          });
        }
        // _retryQueue 적재
        try {
          await db.collection(COLLECTIONS.retryQueue).add({
            type: "SUBSCRIPTION_RUN",
            payload: {subscriptionId: subId},
            reason,
            attemptCount: 0,
            status: "PENDING",
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch {
          // best-effort
        }
      }
    }

    // 7) 배치 audit log
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "SUBSCRIPTION_RUNNER",
        targetType: "Subscription",
        targetId: "batch",
        after: {scanned: snap.size, success, failed, priceHold},
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch {
      // best-effort
    }

    logger.info("[subscription-runner] done", {
      scanned: snap.size,
      success,
      failed,
      priceHold,
    });

    // Σ-3 — dead-man's-switch heartbeat
    await recordHeartbeat("subscriptionRunner", {
      lastScanned: snap.size,
      lastSuccess: success,
      lastFailed: failed,
    });
  },
);
