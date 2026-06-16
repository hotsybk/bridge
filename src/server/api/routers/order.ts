// Wave Q1 + Phase β-1 — buyer 주문 router.
//
// 두 가지 결제 흐름 지원:
//
// [Mock 흐름 — PORTONE_STORE_ID 미설정 dev 환경 fallback]
//   createOrder: 카트 → orders + subOrders + items 트랜잭션 생성.
//     - PortOne 통합 전이므로 자동 PAID 처리 (mock paymentId)
//     - 쿠폰 자동 redeem
//     - 카트 자동 비우기
//     - onOrderCreated Cloud Function 이 hospital/vendor 알림 + hospital KPI 갱신
//
// [실결제 흐름 — Phase β-1, PORTONE_STORE_ID 설정 시]
//   prepareOrder: 가격 계산 + paymentId 발급 + PortOne pre-register + draft order(PENDING_PAYMENT) 적재.
//   클라이언트 → PortOne SDK requestPayment(paymentId) 호출.
//   confirmOrder: PortOne getPayment 로 위변조 검증 → order PAID 전환 + 카트 비움.
//   webhook(Transaction.Paid) 가 confirmOrder 누락 케이스 보완 (idempotent).
//
// listMine / getMine: 본인 hospital 주문 list / 상세.

import {nanoid} from "nanoid";
import {TRPCError} from "@trpc/server";
import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";

import {buyerProcedure, createTRPCRouter} from "@/server/api/trpc";
import {adminDb} from "@/server/firebase/admin";
import {COLLECTIONS} from "@/server/firebase/collections";
import {DEFAULT_COMMISSION_RATE, VAT_RATE} from "@/lib/constants/billing";
import {
  cancelPayment,
  getPayment,
  preRegisterPayment,
} from "@/server/services/portone";

type CartItem = {
  productId: string;
  vendorId: string;
  vendorName: string;
  productName: string;
  thumbnail?: string | null;
  unitPrice: number;
  qty: number;
  amount: number;
  categoryId?: string;
  unit: string;
  moq?: number;
};

type CartDoc = {
  items: CartItem[];
  couponCode: string | null;
};

const ShippingAddressSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  zipcode: z.string().min(1),
  address: z.string().min(1),
  addressDetail: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// 가격 계산 helper — createOrder / prepareOrder 공통.
// 쿠폰 검증, VAT, 배송비를 적용하여 최종 금액을 산출.
// ─────────────────────────────────────────────────────────────

type PriceCalcResult = {
  items: CartItem[];
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  vatAmount: number;
  totalAmount: number;
  couponData: {
    code: string;
    couponId: string;
    discountAmount: number;
  } | null;
};

async function calculateCartPrice(
  db: FirebaseFirestore.Firestore,
  items: CartItem[],
  couponCode: string | null | undefined,
): Promise<PriceCalcResult> {
  const subtotalAmount = items.reduce((s, i) => s + i.amount, 0);

  let discountAmount = 0;
  let couponData: PriceCalcResult["couponData"] = null;
  if (couponCode) {
    try {
      const couponSnap = await db
        .collection(COLLECTIONS.coupons)
        .where("code", "==", couponCode)
        .limit(1)
        .get();
      if (!couponSnap.empty) {
        const c = couponSnap.docs[0].data() as {
          status?: string;
          discountType?: "PERCENT" | "FIXED";
          discountValue?: number;
          maxDiscountAmount?: number;
          targetType?: string;
          targetIds?: string[];
        };
        if (c.status === "ACTIVE" && typeof c.discountValue === "number") {
          let applicable = subtotalAmount;
          if (c.targetType === "CATEGORY") {
            applicable = items
              .filter(
                (i) => i.categoryId && c.targetIds?.includes(i.categoryId),
              )
              .reduce((s, i) => s + i.amount, 0);
          } else if (c.targetType === "VENDOR") {
            applicable = items
              .filter((i) => c.targetIds?.includes(i.vendorId))
              .reduce((s, i) => s + i.amount, 0);
          }
          if (applicable > 0) {
            let d = 0;
            if (c.discountType === "PERCENT") {
              d = Math.floor((applicable * c.discountValue) / 100);
              if (c.maxDiscountAmount) {
                d = Math.min(d, c.maxDiscountAmount);
              }
            } else {
              d = Math.min(c.discountValue, applicable);
            }
            if (d > 0) {
              discountAmount = d;
              couponData = {
                code: couponCode,
                couponId: couponSnap.docs[0].id,
                discountAmount: d,
              };
            }
          }
        }
      }
    } catch {
      // 쿠폰 검증 실패 무시
    }
  }

  const shippingAmount = 0; // Wave Q1 mock
  const taxableAmount = Math.max(0, subtotalAmount - discountAmount);
  const vatAmount = Math.floor(taxableAmount * VAT_RATE);
  const totalAmount = taxableAmount + shippingAmount;

  return {
    items,
    subtotalAmount,
    discountAmount,
    shippingAmount,
    vatAmount,
    totalAmount,
    couponData,
  };
}

/**
 * 실 PortOne 결제 활성화 여부.
 * PORTONE_STORE_ID + PORTONE_API_SECRET 둘 다 있을 때만 prepare/confirm 흐름이 의미가 있음.
 * 미설정 시 createOrder mock 흐름으로 fallback.
 */
function isPortonePaymentEnabled(): boolean {
  return !!(process.env.PORTONE_STORE_ID && process.env.PORTONE_API_SECRET);
}

export const orderRouter = createTRPCRouter({
  // ─────────────────────────────────────────────────────────
  // createOrder — 카트 → orders + subOrders + items
  // ─────────────────────────────────────────────────────────
  createOrder: buyerProcedure
    .input(
      z.object({
        shippingAddress: ShippingAddressSchema,
        paymentMethod: z
          .enum(["CARD", "BANK_TRANSFER", "NET_30", "POINT"])
          .default("CARD"),
        buyerNote: z.string().max(500).optional(),
        invoiceRequested: z.boolean().default(false),
        invoiceEmail: z.string().email().optional(),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      const uid = ctx.uid;
      if (!hospitalId || !uid) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "병원 계정이 필요합니다.",
        });
      }

      // Phase β-1 — 실 PortOne 활성화 환경에서는 createOrder 차단.
      // 프로덕션에서 mock paymentId 로 자동 PAID 처리되는 우회를 방지.
      // production 에서는 prepareOrder + confirmOrder 흐름만 허용.
      if (isPortonePaymentEnabled() && process.env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "실결제 환경에서는 prepareOrder/confirmOrder 흐름을 사용해주세요.",
        });
      }

      // 1) 카트 조회
      const cartRef = db.collection(COLLECTIONS.carts).doc(hospitalId);
      const cartSnap = await cartRef.get();
      if (!cartSnap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "카트가 비어있습니다.",
        });
      }
      const cart = cartSnap.data() as Partial<CartDoc>;
      const items: CartItem[] = Array.isArray(cart.items) ? cart.items : [];
      if (items.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "카트가 비어있습니다.",
        });
      }

      // 2) hospital 정보
      const hospitalSnap = await db
        .collection(COLLECTIONS.hospitals)
        .doc(hospitalId)
        .get();
      const hospital = (hospitalSnap.data() ?? {}) as {name?: string};

      // user 이름
      const userSnap = await db.collection(COLLECTIONS.users).doc(uid).get();
      const userName =
        (userSnap.exists ? (userSnap.data() as {name?: string}).name : null) ??
        "주문자";

      // 3) 금액 계산 (공통 helper)
      const {
        subtotalAmount,
        discountAmount,
        shippingAmount,
        vatAmount,
        totalAmount,
        couponData,
      } = await calculateCartPrice(db, items, cart.couponCode);

      // 4) orderNo 생성 (Phase β-2: nanoid 8자 — 동일 일자 16M 조합, 충돌 확률 ≈0)
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const orderNo = `MP-${dateStr}-${nanoid(8).toUpperCase()}`;

      // 5) vendor 그룹화
      const byVendor = new Map<string, CartItem[]>();
      for (const item of items) {
        const list = byVendor.get(item.vendorId) ?? [];
        list.push(item);
        byVendor.set(item.vendorId, list);
      }
      const vendorIds = Array.from(byVendor.keys());

      // 5.4) Σ-3 — 재고 검증 (oversell 방지).
      //   product.stock 이 유한값(숫자)인 상품만 검사 — null/undefined 는 무제한.
      //   batch 내 FieldValue.increment(-qty) 로 원자적 차감 (lost-decrement 없음).
      const qtyByProduct = new Map<string, number>();
      for (const it of items) {
        qtyByProduct.set(
          it.productId,
          (qtyByProduct.get(it.productId) ?? 0) + it.qty,
        );
      }
      const productIds = Array.from(qtyByProduct.keys());
      const productRefs = productIds.map((pid) =>
        db.collection(COLLECTIONS.products).doc(pid),
      );
      const productSnaps =
        productRefs.length > 0 ? await db.getAll(...productRefs) : [];
      const finiteStockDecrements: Array<{
        ref: FirebaseFirestore.DocumentReference;
        qty: number;
      }> = [];
      for (const snap of productSnaps) {
        if (!snap.exists) {
          // 삭제된 상품이 카트에 남아있는 경우
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "장바구니에 더 이상 판매하지 않는 상품이 있습니다. 장바구니를 확인해주세요.",
          });
        }
        const p = snap.data() as {
          stock?: number;
          name?: string;
          status?: string;
        };
        const requested = qtyByProduct.get(snap.id) ?? 0;
        // Σ-3 — ARCHIVE cascade: 판매 중지(ARCHIVED 등) 상품 주문 차단
        if (p.status && p.status !== "ACTIVE") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `'${p.name ?? "상품"}' 은(는) 현재 판매하지 않습니다. 장바구니에서 제거해주세요.`,
          });
        }
        if (typeof p.stock === "number" && Number.isFinite(p.stock)) {
          if (p.stock < requested) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `'${p.name ?? "상품"}' 재고가 부족합니다 (재고 ${p.stock}, 요청 ${requested}).`,
            });
          }
          finiteStockDecrements.push({ ref: snap.ref, qty: requested });
        }
      }

      // 5.5) Σ-1 — 500-doc 배치 한계 가드 (CLAUDE.md §1.4)
      //   writes = order(1) + subOrders(V) + items(I) + coupon(0~1) + cart(1) + stock(S)
      const totalWrites =
        1 +
        vendorIds.length +
        items.length +
        (cart.couponCode ? 1 : 0) +
        1 +
        finiteStockDecrements.length;
      if (totalWrites > 450) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "한 번에 주문 가능한 상품 종류가 너무 많습니다. 공급사를 나눠 주문해주세요.",
        });
      }

      // 6) orders doc 생성 — Σ-1: 전체를 writeBatch 로 원자화 (§1.4)
      const orderRef = db.collection(COLLECTIONS.orders).doc();
      const serverNow = FieldValue.serverTimestamp();
      const mockPaymentId = `mock_pay_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const batch = db.batch();

      batch.set(orderRef, {
        orderNo,
        hospitalId,
        hospitalName: hospital.name ?? "병원",
        userId: uid,
        userName,

        status: "PAID",

        subtotalAmount,
        shippingAmount,
        discountAmount,
        vatAmount,
        totalAmount,

        // Wave Q1 mock — PortOne 통합 전, 결제는 자동 PAID
        paymentMethod: input.paymentMethod,
        paymentKey: mockPaymentId,
        paidAt: serverNow,
        // 결제 metadata (events 등) 보조 필드
        payment: {
          method: input.paymentMethod,
          status: "PAID",
          paymentId: mockPaymentId,
          channel: "mock-card",
          paidAt: serverNow,
          events: [
            {type: "Order.Created", source: "mock"},
            {type: "Payment.Mock.Captured", paymentId: mockPaymentId},
          ],
        },

        approvalStatus: "NOT_REQUIRED",

        // 배송지 — 기존 Order 타입 (flat 필드) + 신규 nested 둘 다 저장
        shippingZipcode: input.shippingAddress.zipcode,
        shippingAddress: input.shippingAddress.address,
        shippingAddressDetail: input.shippingAddress.addressDetail ?? null,
        shippingRecipient: input.shippingAddress.name,
        shippingPhone: input.shippingAddress.phone,
        shippingMemo: input.buyerNote ?? null,

        // 쿠폰
        coupon: couponData,

        // 세금계산서
        invoiceRequested: input.invoiceRequested,
        invoiceEmail: input.invoiceEmail ?? null,

        // 분할 정보
        subOrderCount: vendorIds.length,
        vendorIds,

        buyerNote: input.buyerNote ?? null,

        createdAt: serverNow,
        updatedAt: serverNow,
      });

      // 7) vendor 별 SubOrder + items
      const subOrderIds: string[] = [];
      let subIdx = 0;
      for (const [vendorId, vendorItems] of byVendor) {
        subIdx += 1;
        const subTotal = vendorItems.reduce((s, i) => s + i.amount, 0);
        const subVat = Math.floor(subTotal * VAT_RATE);
        // denorm 추정치 — 실제 정산은 settlement-calc 가 카테고리/벤더 rate 로 재계산
        const commissionRate = DEFAULT_COMMISSION_RATE;
        const commission = Math.floor(subTotal * commissionRate);
        const commissionVat = Math.floor(commission * VAT_RATE);
        const payoutAmount = subTotal - commission - commissionVat;
        const subOrderRef = orderRef.collection("subOrders").doc();
        const subOrderNo = `${orderNo}-${String(subIdx).padStart(2, "0")}`;

        batch.set(subOrderRef, {
          subOrderNo,
          orderId: orderRef.id,
          orderNo,
          vendorId,
          vendorName: vendorItems[0].vendorName,
          hospitalId,
          hospitalName: hospital.name ?? "병원",

          status: "ACCEPTED",

          subtotal: subTotal,
          shippingFee: 0,
          vat: subVat,
          total: subTotal,

          commissionRate,
          commission,
          commissionVat,
          payoutAmount,

          udiReported: false,
          itemCount: vendorItems.length,

          createdAt: serverNow,
          updatedAt: serverNow,
        });

        for (const item of vendorItems) {
          const itemRef = subOrderRef.collection("items").doc();
          batch.set(itemRef, {
            productId: item.productId,
            productName: item.productName,
            productImage: item.thumbnail ?? null,
            unitPrice: item.unitPrice,
            qty: item.qty,
            amount: item.amount,
            categoryId: item.categoryId ?? null,
            unit: item.unit,
          });
        }
        subOrderIds.push(subOrderRef.id);
      }

      // 8) 쿠폰 redemption 기록 (있을 경우) — 배치에 포함, 주문과 원자적으로 기록
      //    onCouponRedeemed Cloud Function 이 usedCount 증가 (Wave H 기존)
      if (couponData) {
        const redemptionRef = db
          .collection(COLLECTIONS.coupons)
          .doc(couponData.couponId)
          .collection("redemptions")
          .doc();
        batch.set(redemptionRef, {
          couponId: couponData.couponId,
          couponCode: couponData.code,
          hospitalId,
          userId: uid,
          orderId: orderRef.id,
          discountAmount,
          redeemedAt: serverNow,
        });
      }

      // 9) 카트 비우기 — 배치에 포함 (주문 생성과 카트 비움 원자화 → 중복주문 방지)
      batch.set(
        cartRef,
        {
          items: [],
          couponCode: null,
          updatedAt: serverNow,
        },
        {merge: true},
      );

      // 9.3) Σ-3 — 재고 차감 (주문과 원자적). 유한 재고 상품만.
      for (const dec of finiteStockDecrements) {
        batch.update(dec.ref, {
          stock: FieldValue.increment(-dec.qty),
          updatedAt: serverNow,
        });
      }

      // 9.5) Σ-1 — 원자적 커밋: order + subOrders + items + coupon + cart + stock 일괄
      await batch.commit();

      // 10) audit log
      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "ORDER_CREATED",
          targetType: "Order",
          targetId: orderRef.id,
          after: {
            orderNo,
            totalAmount,
            subOrderCount: subOrderIds.length,
            couponApplied: !!couponData,
          },
          createdAt: serverNow,
        });
      } catch {
        // best-effort
      }

      return {
        orderId: orderRef.id,
        orderNo,
        totalAmount,
        subOrderIds,
      };
    }),

  // ─────────────────────────────────────────────────────────
  // prepareOrder — Phase β-1 실결제 흐름 1단계.
  // 가격 계산 + paymentId 발급 + PortOne pre-register + draft order(PENDING_PAYMENT) 적재.
  // 클라이언트는 응답의 paymentId / orderName / finalAmount 로 PortOne SDK 호출.
  // ─────────────────────────────────────────────────────────
  prepareOrder: buyerProcedure
    .input(
      z.object({
        shippingAddress: ShippingAddressSchema,
        paymentMethod: z
          .enum(["CARD", "BANK_TRANSFER", "NET_30", "POINT"])
          .default("CARD"),
        buyerNote: z.string().max(500).optional(),
        invoiceRequested: z.boolean().default(false),
        invoiceEmail: z.string().email().optional(),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      const uid = ctx.uid;
      if (!hospitalId || !uid) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "병원 계정이 필요합니다.",
        });
      }

      // 1) 카트 조회
      const cartRef = db.collection(COLLECTIONS.carts).doc(hospitalId);
      const cartSnap = await cartRef.get();
      if (!cartSnap.exists) {
        throw new TRPCError({code: "NOT_FOUND", message: "카트가 비어있습니다."});
      }
      const cart = cartSnap.data() as Partial<CartDoc>;
      const items: CartItem[] = Array.isArray(cart.items) ? cart.items : [];
      if (items.length === 0) {
        throw new TRPCError({code: "BAD_REQUEST", message: "카트가 비어있습니다."});
      }

      // 2) hospital + user 정보
      const [hospitalSnap, userSnap] = await Promise.all([
        db.collection(COLLECTIONS.hospitals).doc(hospitalId).get(),
        db.collection(COLLECTIONS.users).doc(uid).get(),
      ]);
      const hospital = (hospitalSnap.data() ?? {}) as {
        name?: string;
        approvalEnabled?: boolean;
        approvalLimit?: number;
        approvalChain?: Array<{level: number; userId: string}>;
      };
      const userName =
        (userSnap.exists ? (userSnap.data() as {name?: string}).name : null) ??
        "주문자";

      // 3) 가격 계산
      const price = await calculateCartPrice(db, items, cart.couponCode ?? null);

      // 3.5) 결재 분기 — Phase ν-3
      //   approvalEnabled + finalAmount >= approvalLimit 이면 결재 필요.
      //   draft order 를 status=PENDING_APPROVAL + approvalStatus=PENDING 으로 적재.
      const approvalEnabled = Boolean(hospital.approvalEnabled);
      const approvalLimit = hospital.approvalLimit ?? 0;
      const approvalChain = Array.isArray(hospital.approvalChain)
        ? hospital.approvalChain
        : [];
      const requiresApproval =
        approvalEnabled &&
        approvalChain.length > 0 &&
        price.totalAmount >= approvalLimit;

      // 4) paymentId + orderNo 생성 (Phase β-2: nanoid 8자)
      const paymentId = `pay_${nanoid(20)}`;
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const orderNo = `MP-${dateStr}-${nanoid(8).toUpperCase()}`;
      const orderName =
        items.length === 1
          ? items[0].productName
          : `${items[0].productName} 외 ${items.length - 1}건`;

      // 5) PortOne pre-register (위변조 방지)
      try {
        await preRegisterPayment({
          paymentId,
          totalAmount: price.totalAmount,
          currency: "KRW",
        });
      } catch (err) {
        console.warn("[prepareOrder] preRegister failed", err);
        // 실패해도 mock 모드/dev 에서는 계속 진행 — PortOne 측 거부 시 confirmOrder 에서 status FAILED 로 검증됨
      }

      // 6) vendor 그룹화
      const byVendor = new Map<string, CartItem[]>();
      for (const item of items) {
        const list = byVendor.get(item.vendorId) ?? [];
        list.push(item);
        byVendor.set(item.vendorId, list);
      }
      const vendorIds = Array.from(byVendor.keys());

      // 6.5) Σ-1 — 500-doc 배치 한계 가드
      const totalWrites =
        1 + vendorIds.length + items.length + 1; // order + subOrders + items + cart(없음, 여긴 draft)
      if (totalWrites > 450) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "한 번에 주문 가능한 상품 종류가 너무 많습니다. 공급사를 나눠 주문해주세요.",
        });
      }

      // 7) draft order doc (status: PENDING_PAYMENT) — subOrders/items 까지 적재
      //    Σ-1: order + subOrders + items 를 writeBatch 로 원자화 (§1.4)
      const orderRef = db.collection(COLLECTIONS.orders).doc();
      const serverNow = FieldValue.serverTimestamp();
      const batch = db.batch();

      batch.set(orderRef, {
        orderNo,
        hospitalId,
        hospitalName: hospital.name ?? "병원",
        userId: uid,
        userName,

        status: requiresApproval ? "PENDING_APPROVAL" : "PENDING_PAYMENT",

        subtotalAmount: price.subtotalAmount,
        shippingAmount: price.shippingAmount,
        discountAmount: price.discountAmount,
        vatAmount: price.vatAmount,
        totalAmount: price.totalAmount,
        finalAmount: price.totalAmount,

        paymentMethod: input.paymentMethod,
        paymentKey: paymentId,
        paymentReservedAt: serverNow,
        payment: {
          method: input.paymentMethod,
          status: requiresApproval ? "AWAITING_APPROVAL" : "PENDING",
          paymentId,
          paidAt: null,
          events: [
            {
              type: requiresApproval
                ? "Order.PendingApproval"
                : "Order.Prepared",
              paymentId,
            },
          ],
        },

        approvalStatus: requiresApproval ? "PENDING" : "NOT_REQUIRED",
        ...(requiresApproval
          ? {
              approvalChain: approvalChain.sort((a, b) => a.level - b.level),
              approvalCurrentLevel: approvalChain.sort(
                (a, b) => a.level - b.level,
              )[0].level,
              approvalLog: [],
              approvalRequestedAt: serverNow,
            }
          : {}),

        shippingZipcode: input.shippingAddress.zipcode,
        shippingAddress: input.shippingAddress.address,
        shippingAddressDetail: input.shippingAddress.addressDetail ?? null,
        shippingRecipient: input.shippingAddress.name,
        shippingPhone: input.shippingAddress.phone,
        shippingMemo: input.buyerNote ?? null,

        coupon: price.couponData,

        invoiceRequested: input.invoiceRequested,
        invoiceEmail: input.invoiceEmail ?? null,

        subOrderCount: vendorIds.length,
        vendorIds,

        buyerNote: input.buyerNote ?? null,

        createdAt: serverNow,
        updatedAt: serverNow,
      });

      // 8) vendor 별 SubOrder + items (PENDING_PAYMENT 상태로 적재)
      let subIdx = 0;
      for (const [vendorId, vendorItems] of byVendor) {
        subIdx += 1;
        const subTotal = vendorItems.reduce((s, i) => s + i.amount, 0);
        const subVat = Math.floor(subTotal * VAT_RATE);
        // denorm 추정치 — 실제 정산은 settlement-calc 가 카테고리/벤더 rate 로 재계산
        const commissionRate = DEFAULT_COMMISSION_RATE;
        const commission = Math.floor(subTotal * commissionRate);
        const commissionVat = Math.floor(commission * VAT_RATE);
        const payoutAmount = subTotal - commission - commissionVat;
        const subOrderRef = orderRef.collection("subOrders").doc();
        const subOrderNo = `${orderNo}-${String(subIdx).padStart(2, "0")}`;

        batch.set(subOrderRef, {
          subOrderNo,
          orderId: orderRef.id,
          orderNo,
          vendorId,
          vendorName: vendorItems[0].vendorName,
          hospitalId,
          hospitalName: hospital.name ?? "병원",

          status: requiresApproval ? "PENDING_APPROVAL" : "PENDING_PAYMENT",

          subtotal: subTotal,
          shippingFee: 0,
          vat: subVat,
          total: subTotal,

          commissionRate,
          commission,
          commissionVat,
          payoutAmount,

          udiReported: false,
          itemCount: vendorItems.length,

          createdAt: serverNow,
          updatedAt: serverNow,
        });

        for (const item of vendorItems) {
          const itemRef = subOrderRef.collection("items").doc();
          batch.set(itemRef, {
            productId: item.productId,
            productName: item.productName,
            productImage: item.thumbnail ?? null,
            unitPrice: item.unitPrice,
            qty: item.qty,
            amount: item.amount,
            categoryId: item.categoryId ?? null,
            unit: item.unit,
          });
        }
      }

      // 8.5) Σ-1 — 원자적 커밋: draft order + subOrders + items 일괄
      await batch.commit();

      // 9) audit log
      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: requiresApproval ? "ORDER_PENDING_APPROVAL" : "ORDER_PREPARED",
          targetType: "Order",
          targetId: orderRef.id,
          after: {
            orderNo,
            paymentId,
            finalAmount: price.totalAmount,
            requiresApproval,
            approvalChainLength: requiresApproval ? approvalChain.length : 0,
          },
          createdAt: serverNow,
        });
      } catch {
        // best-effort
      }

      // 9.5) 결재 필요 시 첫 결재자에게 알림
      if (requiresApproval) {
        try {
          const sorted = [...approvalChain].sort((a, b) => a.level - b.level);
          const firstApprover = sorted[0];
          await db.collection(COLLECTIONS.notifications).add({
            targetType: "USER",
            targetId: firstApprover.userId,
            type: "ORDER_APPROVAL_PENDING",
            title: "결재 요청이 도착했습니다",
            body: `주문 ${orderNo} 의 결재가 필요합니다.`,
            data: {
              orderId: orderRef.id,
              orderNo,
              finalAmount: price.totalAmount,
            },
            channels: ["IN_APP", "KAKAO"],
            kakaoSent: false,
            emailSent: false,
            createdAt: serverNow,
          });
          // 신청자 본인 알림
          await db.collection(COLLECTIONS.notifications).add({
            targetType: "USER",
            targetId: uid,
            type: "ORDER_APPROVAL_REQUESTED",
            title: "결재 대기 중",
            body: `주문 ${orderNo} 가 결재 대기 중입니다. 결재 완료 후 결제할 수 있습니다.`,
            data: { orderId: orderRef.id, orderNo },
            channels: ["IN_APP"],
            kakaoSent: false,
            emailSent: false,
            createdAt: serverNow,
          });
        } catch {
          // best-effort
        }
      }

      return {
        paymentId,
        orderId: orderRef.id,
        orderNo,
        orderName,
        finalAmount: price.totalAmount,
        currency: "KRW" as const,
        buyerName: userName,
        hospitalName: hospital.name ?? "병원",
        requiresApproval,
      };
    }),

  // ─────────────────────────────────────────────────────────
  // confirmOrder — Phase β-1 실결제 흐름 2단계.
  // 클라이언트가 PortOne SDK 결제 후 호출. 서버는 getPayment 로 위변조 검증 후 PAID 전환.
  // ─────────────────────────────────────────────────────────
  confirmOrder: buyerProcedure
    .input(
      z.object({
        paymentId: z.string().min(1),
        orderId: z.string().min(1),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      const uid = ctx.uid;
      if (!hospitalId || !uid) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "병원 계정이 필요합니다.",
        });
      }

      // 1) order 조회 + 권한 검사
      const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        throw new TRPCError({code: "NOT_FOUND", message: "주문을 찾을 수 없습니다."});
      }
      const order = orderSnap.data() as {
        hospitalId?: string;
        status?: string;
        orderNo?: string;
        finalAmount?: number;
        totalAmount?: number;
        payment?: {paymentId?: string};
        paymentKey?: string;
      };
      if (order.hospitalId !== hospitalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "다른 병원의 주문은 처리할 수 없습니다.",
        });
      }

      // paymentId 일치 검증 (URL 위변조 차단)
      const storedPaymentId = order.payment?.paymentId ?? order.paymentKey;
      if (storedPaymentId && storedPaymentId !== input.paymentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "결제 식별자가 주문과 일치하지 않습니다.",
        });
      }

      // 이미 처리된 주문 — idempotent return (webhook 과 race 시)
      if (order.status === "PAID") {
        return {
          orderId: input.orderId,
          orderNo: order.orderNo ?? "",
          status: "PAID" as const,
          alreadyConfirmed: true,
        };
      }
      if (order.status === "PENDING_APPROVAL") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "결재 대기 중인 주문입니다. 결재 완료 후 결제할 수 있습니다.",
        });
      }
      if (order.status !== "PENDING_PAYMENT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `이미 처리된 주문입니다 (status: ${order.status ?? "UNKNOWN"})`,
        });
      }

      // 2) PortOne getPayment
      const payment = await getPayment(input.paymentId);

      // 3) 결제 status 검증
      if (payment.status !== "PAID") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `결제가 완료되지 않았습니다 (PortOne status: ${payment.status})`,
        });
      }

      // 4) 금액 일치 검증 (위변조 차단) — mock 모드(total=0) 는 skip
      const expectedAmount = order.finalAmount ?? order.totalAmount ?? 0;
      const actualAmount = payment.amount?.total ?? 0;
      const isMockPayment = payment.source === "mock";
      if (!isMockPayment && actualAmount !== expectedAmount) {
        // 금액 불일치 → 자동 cancel + audit
        try {
          await cancelPayment({
            paymentId: input.paymentId,
            reason: `Amount mismatch (expected ${expectedAmount}, actual ${actualAmount})`,
          });
        } catch (err) {
          console.error("[confirmOrder] auto-cancel failed", err);
        }
        await orderRef.update({
          status: "CANCELLED",
          cancelReason: "AMOUNT_MISMATCH",
          cancelledAt: FieldValue.serverTimestamp(),
          "payment.status": "CANCELLED",
          updatedAt: FieldValue.serverTimestamp(),
        });
        try {
          await db.collection(COLLECTIONS.auditLogs).add({
            actorId: uid,
            actorRole: ctx.role ?? "BUYER_OWNER",
            action: "ORDER_AMOUNT_MISMATCH",
            targetType: "Order",
            targetId: input.orderId,
            after: {
              paymentId: input.paymentId,
              expectedAmount,
              actualAmount,
            },
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch {
          // best-effort
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "결제 금액 검증에 실패했습니다. 자동 환불 처리되었습니다.",
        });
      }

      // 5) order PAID 전환 + subOrders status 갱신
      const serverNow = FieldValue.serverTimestamp();
      await orderRef.update({
        status: "PAID",
        paidAt: serverNow,
        "payment.status": "PAID",
        "payment.paidAt": serverNow,
        "payment.paymentId": input.paymentId,
        "payment.method": payment.method?.type ?? "CARD",
        "payment.channel": payment.channel?.key ?? null,
        "payment.events": FieldValue.arrayUnion({
          type: "Order.Confirmed",
          paymentId: input.paymentId,
          confirmedAt: new Date().toISOString(),
        }),
        updatedAt: serverNow,
      });

      // subOrders status 갱신 (PENDING_PAYMENT → ACCEPTED)
      const subSnap = await orderRef.collection("subOrders").get();
      const subBatch = db.batch();
      subSnap.docs.forEach((s) => {
        subBatch.update(s.ref, {
          status: "ACCEPTED",
          updatedAt: serverNow,
        });
      });
      if (subSnap.size > 0) {
        await subBatch.commit();
      }

      // 6) 쿠폰 redemption 기록 (있을 경우)
      const coupon = orderSnap.get("coupon") as {
        code?: string;
        couponId?: string;
        discountAmount?: number;
      } | null;
      if (coupon && coupon.couponId) {
        try {
          await db
            .collection(COLLECTIONS.coupons)
            .doc(coupon.couponId)
            .collection("redemptions")
            .add({
              couponId: coupon.couponId,
              couponCode: coupon.code ?? "",
              hospitalId,
              userId: uid,
              orderId: input.orderId,
              discountAmount: coupon.discountAmount ?? 0,
              redeemedAt: serverNow,
            });
        } catch {
          // best-effort
        }
      }

      // 7) 카트 비우기
      try {
        await db
          .collection(COLLECTIONS.carts)
          .doc(hospitalId)
          .set(
            {items: [], couponCode: null, updatedAt: serverNow},
            {merge: true},
          );
      } catch {
        // best-effort
      }

      // 8) audit log
      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "ORDER_PAID",
          targetType: "Order",
          targetId: input.orderId,
          after: {
            paymentId: input.paymentId,
            finalAmount: actualAmount || expectedAmount,
            source: payment.source ?? "portone",
          },
          createdAt: serverNow,
        });
      } catch {
        // best-effort
      }

      return {
        orderId: input.orderId,
        orderNo: order.orderNo ?? "",
        status: "PAID" as const,
        alreadyConfirmed: false,
      };
    }),

  // ─────────────────────────────────────────────────────────
  // listMine — 본인 hospital 주문 list (cursor pagination)
  // ─────────────────────────────────────────────────────────
  listMine: buyerProcedure
    .input(
      z.object({
        status: z.string().optional(),
        pageSize: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ctx, input}) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      if (!hospitalId) {
        return {orders: [], hasMore: false, nextCursor: undefined};
      }

      let q: FirebaseFirestore.Query = db
        .collection(COLLECTIONS.orders)
        .where("hospitalId", "==", hospitalId);
      if (input.status) {
        q = q.where("status", "==", input.status);
      }
      q = q.orderBy("createdAt", "desc").limit(input.pageSize + 1);
      if (input.cursor) {
        const c = await db
          .collection(COLLECTIONS.orders)
          .doc(input.cursor)
          .get();
        if (c.exists) q = q.startAfter(c);
      }
      const snap = await q.get();
      const docs = snap.docs.map((d) => ({id: d.id, ...d.data()}));
      const hasMore = docs.length > input.pageSize;
      const trimmed = hasMore ? docs.slice(0, -1) : docs;
      return {
        orders: trimmed,
        hasMore,
        nextCursor: hasMore
          ? (trimmed[trimmed.length - 1] as {id: string}).id
          : undefined,
      };
    }),

  // ─────────────────────────────────────────────────────────
  // getMine — 본인 주문 상세 (subOrders + items 포함)
  // ─────────────────────────────────────────────────────────
  getMine: buyerProcedure
    .input(z.object({orderId: z.string().min(1)}))
    .query(async ({ctx, input}) => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as {hospitalId?: string};
      if (data.hospitalId !== ctx.hospitalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "다른 병원의 주문은 조회할 수 없습니다.",
        });
      }

      const subSnap = await snap.ref.collection("subOrders").get();
      const subOrders = await Promise.all(
        subSnap.docs.map(async (so) => {
          const itemsSnap = await so.ref.collection("items").get();
          return {
            id: so.id,
            ...so.data(),
            items: itemsSnap.docs.map((i) => ({id: i.id, ...i.data()})),
          };
        }),
      );

      return {id: snap.id, ...data, subOrders};
    }),
});
