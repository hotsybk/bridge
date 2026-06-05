// Wave H — 카트/체크아웃 단계에서 쿠폰 코드 검증 + 할인액 계산.
//
// validate(): 인증된 buyer 만. 다음을 검증:
//   1) 코드 존재 + status === ACTIVE
//   2) 시작/만료 기간 내
//   3) issueLimit 미초과
//   4) minOrderAmount 충족
//   5) perUserLimit 미초과 (redemptions 서브컬렉션 카운트)
//   6) targetType 별 적용 가능 금액 계산
//   7) 할인액 계산 (PERCENT/FIXED + maxDiscountAmount 한도)
//
// 실 결제 시점에는 별도 redeem() 이 필요 (Cloud Function order create 트리거에서 처리).

import { TRPCError } from "@trpc/server";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { protectedProcedure, createTRPCRouter } from "../trpc";
import { formatKRW } from "@/lib/format";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { Coupon } from "@/lib/types";

function tsToMillis(v: unknown): number {
  if (!v) return 0;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "object" && v !== null && "toMillis" in v) {
    const fn = (v as { toMillis: () => number }).toMillis;
    if (typeof fn === "function") return fn.call(v);
  }
  if (typeof v === "object" && v !== null && "seconds" in v) {
    return (v as { seconds: number }).seconds * 1000;
  }
  if (v instanceof Date) return v.getTime();
  return 0;
}

export const couponRouter = createTRPCRouter({
  /** 카트에서 쿠폰 코드 검증 + 할인액 계산. 실제 redeem 은 별도. */
  validate: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1),
        cartTotal: z.number().min(0),
        items: z.array(
          z.object({
            productId: z.string(),
            vendorId: z.string(),
            categoryId: z.string().optional(),
            amount: z.number(),
          }),
        ),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.coupons)
        .where("code", "==", input.code.toUpperCase())
        .limit(1)
        .get();
      if (snap.empty) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "존재하지 않는 쿠폰 코드입니다.",
        });
      }

      const d = snap.docs[0];
      const c = { id: d.id, ...(d.data() as Omit<Coupon, "id">) } as Coupon;
      const now = Date.now();
      const startsAt = tsToMillis(c.startsAt);
      const expiresAt = tsToMillis(c.expiresAt);

      if (c.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "사용할 수 없는 쿠폰입니다.",
        });
      }
      if (startsAt && now < startsAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "아직 사용 시작 전 쿠폰입니다.",
        });
      }
      if (expiresAt && now > expiresAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "만료된 쿠폰입니다.",
        });
      }
      if (c.issueLimit && c.usedCount >= c.issueLimit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "한도가 소진된 쿠폰입니다.",
        });
      }
      if (c.minOrderAmount && input.cartTotal < c.minOrderAmount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `최소 주문액 ${formatKRW(c.minOrderAmount)} 이상이어야 합니다.`,
        });
      }

      // 1인당 사용 횟수 검사
      if (c.perUserLimit) {
        const usedByUser = await db
          .collection(COLLECTIONS.coupons)
          .doc(c.id)
          .collection("redemptions")
          .where("userId", "==", ctx.uid)
          .get();
        if (usedByUser.size >= c.perUserLimit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이미 사용하신 쿠폰입니다.",
          });
        }
      }

      // 적용 대상 검증 + 할인 적용 가능한 부분 계산
      let applicableAmount = 0;
      if (c.targetType === "ALL" || c.targetType === "FIRST_PURCHASE") {
        applicableAmount = input.cartTotal;
      } else if (c.targetType === "CATEGORY") {
        applicableAmount = input.items
          .filter(
            (i) => i.categoryId && c.targetIds?.includes(i.categoryId),
          )
          .reduce((s, i) => s + i.amount, 0);
      } else if (c.targetType === "VENDOR") {
        applicableAmount = input.items
          .filter((i) => c.targetIds?.includes(i.vendorId))
          .reduce((s, i) => s + i.amount, 0);
      }

      if (applicableAmount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이 쿠폰을 적용할 수 있는 상품이 카트에 없습니다.",
        });
      }

      // 할인 금액 계산
      let discountAmount = 0;
      if (c.discountType === "PERCENT") {
        discountAmount = Math.floor(
          (applicableAmount * c.discountValue) / 100,
        );
        if (c.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, c.maxDiscountAmount);
        }
      } else {
        discountAmount = Math.min(c.discountValue, applicableAmount);
      }

      return {
        couponId: c.id,
        code: c.code,
        name: c.name,
        discountType: c.discountType,
        discountValue: c.discountValue,
        discountAmount,
        applicableAmount,
        finalTotal: Math.max(0, input.cartTotal - discountAmount),
      };
    }),
});
