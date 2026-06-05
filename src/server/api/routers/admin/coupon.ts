// Wave H — 쿠폰 관리 tRPC router (admin only).
//
// Endpoints:
//   - list({status,search,pageSize,cursor})
//   - counts()
//   - getById({couponId})
//   - generateCode()        — 8자리 자동 코드 생성 (충돌 검사 포함)
//   - create({...})         — 쿠폰 발행
//   - update({...})         — 이름·기간·한도·최소주문액 수정
//   - disable({reason})     — 즉시 비활성화 (status: DISABLED)
//   - listRedemptions({couponId,...}) — 사용 ledger

import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { Coupon, CouponRedemption } from "@/lib/types";

const DiscountType = z.enum(["PERCENT", "FIXED"]);
const TargetType = z.enum(["ALL", "CATEGORY", "VENDOR", "FIRST_PURCHASE"]);
const Status = z.enum(["ACTIVE", "SCHEDULED", "EXPIRED", "DISABLED"]);

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // O,0,1,I 제외

export const adminCouponRouter = createTRPCRouter({
  /** 쿠폰 목록. status 필터 + 코드/이름 검색 + cursor pagination. */
  list: adminProcedure
    .input(
      z.object({
        status: Status.optional(),
        search: z.string().optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = adminDb();
      let q: FirebaseFirestore.Query = db
        .collection(COLLECTIONS.coupons)
        .orderBy("createdAt", "desc");
      if (input.status) {
        q = q.where("status", "==", input.status);
      }
      q = q.limit(input.pageSize + 1);
      if (input.cursor) {
        const c = await db
          .collection(COLLECTIONS.coupons)
          .doc(input.cursor)
          .get();
        if (c.exists) q = q.startAfter(c);
      }
      const snap = await q.get();
      let items = snap.docs.map((d) => {
        const data = d.data() as Omit<Coupon, "id">;
        return { id: d.id, ...data } satisfies Coupon;
      });

      if (input.search) {
        const k = input.search.toLowerCase();
        items = items.filter(
          (c) =>
            c.code.toLowerCase().includes(k) ||
            c.name.toLowerCase().includes(k),
        );
      }

      const hasMore = items.length > input.pageSize;
      const coupons = hasMore ? items.slice(0, -1) : items;
      const nextCursor = hasMore
        ? coupons[coupons.length - 1]?.id
        : undefined;
      return { coupons, hasMore, nextCursor };
    }),

  /** KPI counts. 컬렉션 전체 스캔 — 운영 초기 (~수백건) 가정. */
  counts: adminProcedure.query(async () => {
    const db = adminDb();
    const snap = await db.collection(COLLECTIONS.coupons).get();
    const items = snap.docs.map((d) => d.data() as Coupon);
    return {
      active: items.filter((c) => c.status === "ACTIVE").length,
      scheduled: items.filter((c) => c.status === "SCHEDULED").length,
      expired: items.filter((c) => c.status === "EXPIRED").length,
      disabled: items.filter((c) => c.status === "DISABLED").length,
      totalIssued: items.reduce((s, c) => s + (c.issueLimit ?? 0), 0),
      totalUsed: items.reduce((s, c) => s + (c.usedCount ?? 0), 0),
    };
  }),

  /** 단건 조회. */
  getById: adminProcedure
    .input(z.object({ couponId: z.string() }))
    .query(async ({ input }): Promise<Coupon | null> => {
      const snap = await adminDb()
        .collection(COLLECTIONS.coupons)
        .doc(input.couponId)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<Coupon, "id">;
      return { id: snap.id, ...data };
    }),

  /** 8자리 코드 자동 생성 + 충돌 검사 (최대 5회 재시도). */
  generateCode: adminProcedure.mutation(async () => {
    const db = adminDb();
    for (let attempt = 0; attempt < 5; attempt++) {
      let code = "";
      for (let i = 0; i < 8; i++) {
        code +=
          CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      const conflict = await db
        .collection(COLLECTIONS.coupons)
        .where("code", "==", code)
        .limit(1)
        .get();
      if (conflict.empty) return { code };
    }
    // 5회 충돌 시 timestamp 접미사 fallback
    const code =
      Array.from(
        { length: 6 },
        () =>
          CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
      ).join("") + Date.now().toString().slice(-4);
    return { code };
  }),

  /** 쿠폰 발행. */
  create: adminProcedure
    .input(
      z.object({
        code: z
          .string()
          .min(4)
          .max(20)
          .regex(/^[A-Z0-9_-]+$/, "대문자·숫자·_·-만 허용"),
        name: z.string().min(1).max(60),
        description: z.string().max(200).optional(),
        discountType: DiscountType,
        discountValue: z.number().positive(),
        maxDiscountAmount: z.number().positive().optional(),
        minOrderAmount: z.number().min(0).optional(),
        targetType: TargetType,
        targetIds: z.array(z.string()).optional(),
        startsAt: z.union([z.string(), z.date()]),
        expiresAt: z.union([z.string(), z.date()]),
        issueLimit: z.number().int().positive().optional(),
        perUserLimit: z.number().int().positive().default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();

      // 1) code 중복 검사
      const conflict = await db
        .collection(COLLECTIONS.coupons)
        .where("code", "==", input.code)
        .limit(1)
        .get();
      if (!conflict.empty) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 존재하는 코드입니다.",
        });
      }

      // 2) discountType 별 validation
      if (
        input.discountType === "PERCENT" &&
        (input.discountValue > 100 || input.discountValue < 1)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "% 쿠폰은 1~100 사이여야 합니다.",
        });
      }

      // 3) targetType 별 targetIds 검증
      if (
        (input.targetType === "CATEGORY" ||
          input.targetType === "VENDOR") &&
        (!input.targetIds || input.targetIds.length === 0)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "적용 대상 ID를 지정해주세요.",
        });
      }

      // 4) 시작/만료일 변환 + 검증
      const startsAt =
        typeof input.startsAt === "string"
          ? new Date(input.startsAt)
          : input.startsAt;
      const expiresAt =
        typeof input.expiresAt === "string"
          ? new Date(input.expiresAt)
          : input.expiresAt;
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "유효하지 않은 날짜입니다.",
        });
      }
      if (expiresAt <= startsAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "만료일이 시작일보다 이후여야 합니다.",
        });
      }

      const now = Date.now();
      const status: "ACTIVE" | "SCHEDULED" =
        startsAt.getTime() <= now ? "ACTIVE" : "SCHEDULED";

      const ref = db.collection(COLLECTIONS.coupons).doc();
      const serverNow = FieldValue.serverTimestamp();

      await ref.set({
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxDiscountAmount: input.maxDiscountAmount ?? null,
        minOrderAmount: input.minOrderAmount ?? null,
        targetType: input.targetType,
        targetIds: input.targetIds ?? [],
        startsAt,
        expiresAt,
        issueLimit: input.issueLimit ?? null,
        perUserLimit: input.perUserLimit,
        usedCount: 0,
        status,
        createdAt: serverNow,
        updatedAt: serverNow,
        createdById: ctx.uid,
      });

      // audit
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "COUPON_CREATED",
        targetType: "Coupon",
        targetId: ref.id,
        after: {
          code: input.code,
          name: input.name,
          discountType: input.discountType,
          discountValue: input.discountValue,
          targetType: input.targetType,
          status,
        },
        createdAt: serverNow,
      });

      return { id: ref.id, status };
    }),

  /** 쿠폰 수정 — 발행 후 일부 필드만 변경 가능. */
  update: adminProcedure
    .input(
      z.object({
        couponId: z.string(),
        name: z.string().min(1).max(60).optional(),
        description: z.string().max(200).nullable().optional(),
        expiresAt: z.union([z.string(), z.date()]).optional(),
        issueLimit: z.number().int().positive().nullable().optional(),
        perUserLimit: z.number().int().positive().optional(),
        minOrderAmount: z.number().min(0).nullable().optional(),
        maxDiscountAmount: z.number().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.coupons).doc(input.couponId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "쿠폰을 찾을 수 없습니다.",
        });
      }
      const before = snap.data() as Coupon;
      const patch: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      if (input.expiresAt !== undefined) {
        const expiresAt =
          typeof input.expiresAt === "string"
            ? new Date(input.expiresAt)
            : input.expiresAt;
        if (Number.isNaN(expiresAt.getTime())) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "유효하지 않은 만료일입니다.",
          });
        }
        patch.expiresAt = expiresAt;
      }
      if (input.issueLimit !== undefined) patch.issueLimit = input.issueLimit;
      if (input.perUserLimit !== undefined)
        patch.perUserLimit = input.perUserLimit;
      if (input.minOrderAmount !== undefined)
        patch.minOrderAmount = input.minOrderAmount;
      if (input.maxDiscountAmount !== undefined)
        patch.maxDiscountAmount = input.maxDiscountAmount;

      await ref.update(patch);

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "COUPON_UPDATED",
        targetType: "Coupon",
        targetId: input.couponId,
        before: {
          name: before.name,
          expiresAt: before.expiresAt ?? null,
          issueLimit: before.issueLimit ?? null,
        },
        after: patch,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /** 즉시 비활성화 — status: DISABLED. */
  disable: adminProcedure
    .input(
      z.object({
        couponId: z.string(),
        reason: z.string().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.coupons).doc(input.couponId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "쿠폰을 찾을 수 없습니다.",
        });
      }
      await ref.update({
        status: "DISABLED",
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "COUPON_DISABLED",
        targetType: "Coupon",
        targetId: input.couponId,
        after: { reason: input.reason },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /** 사용 ledger 조회 (서브컬렉션). */
  listRedemptions: adminProcedure
    .input(
      z.object({
        couponId: z.string(),
        pageSize: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = adminDb();
      const baseRef = db
        .collection(COLLECTIONS.coupons)
        .doc(input.couponId)
        .collection("redemptions");
      let q: FirebaseFirestore.Query = baseRef
        .orderBy("redeemedAt", "desc")
        .limit(input.pageSize + 1);
      if (input.cursor) {
        const c = await baseRef.doc(input.cursor).get();
        if (c.exists) q = q.startAfter(c);
      }
      const snap = await q.get();
      const items = snap.docs.map((d) => {
        const data = d.data() as Omit<CouponRedemption, "id">;
        return { id: d.id, ...data } satisfies CouponRedemption;
      });
      const hasMore = items.length > input.pageSize;
      const redemptions = hasMore ? items.slice(0, -1) : items;
      return {
        redemptions,
        hasMore,
        nextCursor: hasMore
          ? redemptions[redemptions.length - 1]?.id
          : undefined,
      };
    }),
});

