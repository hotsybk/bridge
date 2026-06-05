// Wave Q1 — buyer 카트 router.
//
// /carts/{hospitalId} 단일 doc 모델 (hospital 단위).
// items[] 임베디드 — 카트는 일반적으로 수십개 이내라 sub-collection 불필요.
// 모든 endpoint 는 buyerProcedure (hospitalId 필수).
//
// 가격 정책:
//   - product.priceTiers 가 있으면 수량 기준 자동 적용 (가장 높은 minQty 매치)
//   - 없으면 product.basePrice
//   - 수량 변경 시 재계산
//
// 쿠폰:
//   - applyCoupon 은 카트에 코드만 저장 (검증은 가벼운 존재 체크)
//   - 실 할인은 checkout 단계 (order.createOrder) 에서 다시 평가
//   - 실제 redeem 은 주문 생성 시 redemption 도 함께 기록

import {TRPCError} from "@trpc/server";
import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";

import {buyerProcedure, createTRPCRouter} from "@/server/api/trpc";
import {adminDb} from "@/server/firebase/admin";
import {COLLECTIONS} from "@/server/firebase/collections";

export type CartItem = {
  productId: string;
  vendorId: string;
  vendorName: string;
  productName: string;
  thumbnail?: string | null;
  unitPrice: number; // tier 적용된 단가
  qty: number;
  amount: number; // unitPrice * qty
  categoryId?: string;
  unit: string;
  moq?: number;
};

type CartDoc = {
  items: CartItem[];
  couponCode: string | null;
};

type ProductDoc = {
  vendorId: string;
  vendorName: string;
  name: string;
  thumbnail?: string;
  images?: string[];
  basePrice: number;
  priceTiers?: Array<{minQty: number; price: number}>;
  categoryId?: string;
  unit?: string;
  moq?: number;
  status?: string;
  moderation?: {status?: string};
};

function pickUnitPrice(product: ProductDoc, qty: number): number {
  const tiers = product.priceTiers ?? [];
  if (tiers.length === 0) return product.basePrice;
  const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty);
  const tier = sorted.find((t) => qty >= t.minQty);
  return tier ? tier.price : product.basePrice;
}

function emptyCart(): CartDoc {
  return {items: [], couponCode: null};
}

export const cartRouter = createTRPCRouter({
  // ─────────────────────────────────────────────────────────
  // get — 카트 조회 (없으면 빈 카트 반환)
  // ─────────────────────────────────────────────────────────
  get: buyerProcedure.query(async ({ctx}) => {
    const hospitalId = ctx.hospitalId;
    if (!hospitalId) {
      // 디자인 미리보기에서 hospitalId 없으면 빈 카트
      return emptyCart();
    }
    const snap = await adminDb()
      .collection(COLLECTIONS.carts)
      .doc(hospitalId)
      .get();
    if (!snap.exists) return emptyCart();
    const data = snap.data() as Partial<CartDoc>;
    return {
      items: Array.isArray(data.items) ? data.items : [],
      couponCode: data.couponCode ?? null,
    } as CartDoc;
  }),

  // ─────────────────────────────────────────────────────────
  // add — 상품을 카트에 추가 (있으면 수량 합산)
  // ─────────────────────────────────────────────────────────
  add: buyerProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive(),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      if (!hospitalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "병원 계정이 필요합니다.",
        });
      }

      const productSnap = await db
        .collection(COLLECTIONS.products)
        .doc(input.productId)
        .get();
      if (!productSnap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "상품을 찾을 수 없습니다.",
        });
      }
      const product = productSnap.data() as ProductDoc;
      const modStatus = product.moderation?.status ?? product.status;
      if (modStatus !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "판매 중인 상품이 아닙니다.",
        });
      }

      const cartRef = db.collection(COLLECTIONS.carts).doc(hospitalId);
      const cartSnap = await cartRef.get();
      const cart: CartDoc = cartSnap.exists
        ? ({
            items: Array.isArray(
              (cartSnap.data() as Partial<CartDoc>).items,
            )
              ? (cartSnap.data() as CartDoc).items
              : [],
            couponCode:
              (cartSnap.data() as Partial<CartDoc>).couponCode ?? null,
          } as CartDoc)
        : emptyCart();

      const existingIdx = cart.items.findIndex(
        (i) => i.productId === input.productId,
      );
      if (existingIdx >= 0) {
        const item = cart.items[existingIdx];
        const newQty = item.qty + input.qty;
        const newUnitPrice = pickUnitPrice(product, newQty);
        cart.items[existingIdx] = {
          ...item,
          qty: newQty,
          unitPrice: newUnitPrice,
          amount: newUnitPrice * newQty,
        };
      } else {
        const unitPrice = pickUnitPrice(product, input.qty);
        cart.items.push({
          productId: input.productId,
          vendorId: product.vendorId,
          vendorName: product.vendorName,
          productName: product.name,
          thumbnail: product.thumbnail ?? product.images?.[0] ?? null,
          unitPrice,
          qty: input.qty,
          amount: unitPrice * input.qty,
          categoryId: product.categoryId,
          unit: product.unit ?? "EA",
          moq: product.moq ?? 1,
        });
      }

      await cartRef.set(
        {
          items: cart.items,
          couponCode: cart.couponCode,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
      return {ok: true, itemCount: cart.items.length};
    }),

  // ─────────────────────────────────────────────────────────
  // updateQty — 수량 변경 (0 이면 제거). 가격 재계산.
  // ─────────────────────────────────────────────────────────
  updateQty: buyerProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(0),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      if (!hospitalId) {
        throw new TRPCError({code: "FORBIDDEN"});
      }

      const cartRef = db.collection(COLLECTIONS.carts).doc(hospitalId);
      const cartSnap = await cartRef.get();
      if (!cartSnap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "카트가 비어있습니다.",
        });
      }
      const cart: CartDoc = {
        items: Array.isArray((cartSnap.data() as Partial<CartDoc>).items)
          ? (cartSnap.data() as CartDoc).items
          : [],
        couponCode:
          (cartSnap.data() as Partial<CartDoc>).couponCode ?? null,
      };
      const idx = cart.items.findIndex((i) => i.productId === input.productId);
      if (idx < 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "카트에 없는 상품입니다.",
        });
      }

      if (input.qty === 0) {
        cart.items = cart.items.filter(
          (i) => i.productId !== input.productId,
        );
      } else {
        // tier 가격 재계산
        const productSnap = await db
          .collection(COLLECTIONS.products)
          .doc(input.productId)
          .get();
        if (!productSnap.exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "상품을 찾을 수 없습니다.",
          });
        }
        const product = productSnap.data() as ProductDoc;
        const unitPrice = pickUnitPrice(product, input.qty);
        cart.items[idx] = {
          ...cart.items[idx],
          qty: input.qty,
          unitPrice,
          amount: unitPrice * input.qty,
        };
      }

      await cartRef.set(
        {
          items: cart.items,
          couponCode: cart.couponCode,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
      return {ok: true};
    }),

  // ─────────────────────────────────────────────────────────
  // remove — 항목 제거
  // ─────────────────────────────────────────────────────────
  remove: buyerProcedure
    .input(z.object({productId: z.string().min(1)}))
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      if (!hospitalId) throw new TRPCError({code: "FORBIDDEN"});

      const cartRef = db.collection(COLLECTIONS.carts).doc(hospitalId);
      const cartSnap = await cartRef.get();
      if (!cartSnap.exists) return {ok: true};
      const data = cartSnap.data() as Partial<CartDoc>;
      const items = (Array.isArray(data.items) ? data.items : []).filter(
        (i) => i.productId !== input.productId,
      );
      await cartRef.set(
        {
          items,
          couponCode: data.couponCode ?? null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
      return {ok: true};
    }),

  // ─────────────────────────────────────────────────────────
  // applyCoupon — 쿠폰 코드 검증 + 카트에 저장
  // 실 할인 평가는 createOrder 시점에 재실행됨.
  // ─────────────────────────────────────────────────────────
  applyCoupon: buyerProcedure
    .input(z.object({code: z.string().min(1)}))
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      if (!hospitalId) throw new TRPCError({code: "FORBIDDEN"});

      const cartRef = db.collection(COLLECTIONS.carts).doc(hospitalId);
      const cartSnap = await cartRef.get();
      if (!cartSnap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "카트가 비어있습니다.",
        });
      }

      const code = input.code.toUpperCase();
      // 가벼운 존재 + ACTIVE 검증만 (전체 비즈 검증은 coupon.validate 또는 createOrder 에서)
      const couponSnap = await db
        .collection(COLLECTIONS.coupons)
        .where("code", "==", code)
        .limit(1)
        .get();
      if (couponSnap.empty) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "존재하지 않는 쿠폰 코드입니다.",
        });
      }
      const coupon = couponSnap.docs[0].data() as {status?: string};
      if (coupon.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "사용할 수 없는 쿠폰입니다.",
        });
      }

      await cartRef.set(
        {
          couponCode: code,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
      return {ok: true, couponCode: code};
    }),

  // ─────────────────────────────────────────────────────────
  // removeCoupon — 쿠폰 코드 제거
  // ─────────────────────────────────────────────────────────
  removeCoupon: buyerProcedure.mutation(async ({ctx}) => {
    const hospitalId = ctx.hospitalId;
    if (!hospitalId) throw new TRPCError({code: "FORBIDDEN"});
    await adminDb()
      .collection(COLLECTIONS.carts)
      .doc(hospitalId)
      .set(
        {
          couponCode: null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    return {ok: true};
  }),

  // ─────────────────────────────────────────────────────────
  // clear — 카트 전체 비우기 (주문 생성 후 호출됨)
  // ─────────────────────────────────────────────────────────
  clear: buyerProcedure.mutation(async ({ctx}) => {
    const hospitalId = ctx.hospitalId;
    if (!hospitalId) throw new TRPCError({code: "FORBIDDEN"});
    await adminDb()
      .collection(COLLECTIONS.carts)
      .doc(hospitalId)
      .set(
        {
          items: [],
          couponCode: null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    return {ok: true};
  }),
});
