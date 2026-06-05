import { TRPCError } from "@trpc/server";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { Product } from "@/lib/types";

export type ProductMemo = {
  id: string;
  actorId: string;
  body: string;
  createdAt: Timestamp | null;
};

const ProductStatusEnum = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "REVISION_REQUESTED",
  "ACTIVE",
  "REJECTED",
  "PAUSED",
  "ARCHIVED",
]);

type ProductWithLegacyStatus = Product & {
  status?: string;
  moderation?: { status?: string; submittedAt?: { seconds?: number }; reviewedAt?: { seconds?: number } };
  createdAt?: { seconds?: number };
  nameEn?: string;
};

export const adminProductRouter = createTRPCRouter({
  /**
   * 모더레이션 큐 / 상태별 list.
   *
   * Phase 2 단순화 — moderation.status (없으면 legacy status) 기준으로
   * in-memory filter. 200건 까지 안전. Phase 3 에서 composite index + Firestore where 로 전환.
   */
  list: adminProcedure
    .input(
      z.object({
        status: ProductStatusEnum.optional().default("PENDING_REVIEW"),
        categoryId: z.string().optional(),
        vendorId: z.string().optional(),
        search: z.string().optional(),
        pageSize: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{ products: Product[]; hasMore: boolean; nextCursor?: string }> => {
        const db = adminDb();
        const snap = await db.collection(COLLECTIONS.products).limit(200).get();
        let items = snap.docs.map((d) => {
          const data = d.data() as Omit<Product, "id">;
          return { id: d.id, ...data } as ProductWithLegacyStatus;
        });

        // status filter (legacy status fallback)
        items = items.filter((p) => {
          const modStatus = p.moderation?.status ?? p.status;
          return modStatus === input.status;
        });

        if (input.categoryId) {
          items = items.filter((p) => p.categoryId === input.categoryId);
        }
        if (input.vendorId) {
          items = items.filter((p) => p.vendorId === input.vendorId);
        }
        if (input.search) {
          const q = input.search.toLowerCase();
          items = items.filter((p) =>
            [p.name, p.nameEn, p.brand, p.vendorName]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q),
          );
        }

        // 오래된 신청이 먼저 처리되도록 submittedAt asc, 없으면 createdAt
        items.sort((a, b) => {
          const av =
            a.moderation?.submittedAt?.seconds ?? a.createdAt?.seconds ?? 0;
          const bv =
            b.moderation?.submittedAt?.seconds ?? b.createdAt?.seconds ?? 0;
          return av - bv;
        });

        let start = 0;
        if (input.cursor) {
          const idx = items.findIndex((p) => p.id === input.cursor);
          if (idx >= 0) start = idx + 1;
        }
        const page = items.slice(start, start + input.pageSize + 1);
        const hasMore = page.length > input.pageSize;
        const products = (hasMore ? page.slice(0, -1) : page) as Product[];
        const nextCursor = hasMore
          ? products[products.length - 1]?.id
          : undefined;
        return { products, hasMore, nextCursor };
      },
    ),

  /** 모더레이션 큐 KPI 카운트 — 대시보드/segment tab 표시용. */
  counts: adminProcedure.query(async () => {
    const db = adminDb();
    const snap = await db.collection(COLLECTIONS.products).get();
    const items = snap.docs.map(
      (d) =>
        d.data() as {
          moderation?: { status?: string; reviewedAt?: { seconds?: number } };
          status?: string;
        },
    );
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime() / 1000;
    const count = (status: string) =>
      items.filter((p) => (p.moderation?.status ?? p.status) === status).length;
    const approvedToday = items.filter(
      (p) =>
        p.moderation?.status === "ACTIVE" &&
        (p.moderation?.reviewedAt?.seconds ?? 0) >= todayTs,
    ).length;
    const rejectedToday = items.filter(
      (p) =>
        p.moderation?.status === "REJECTED" &&
        (p.moderation?.reviewedAt?.seconds ?? 0) >= todayTs,
    ).length;
    return {
      PENDING_REVIEW: count("PENDING_REVIEW"),
      REVISION_REQUESTED: count("REVISION_REQUESTED"),
      ACTIVE: count("ACTIVE"),
      REJECTED: count("REJECTED"),
      approvedToday,
      rejectedToday,
    };
  }),

  /** 단건. */
  getById: adminProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ input }): Promise<Product | null> => {
      const snap = await adminDb()
        .collection(COLLECTIONS.products)
        .doc(input.productId)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<Product, "id">;
      return { id: snap.id, ...data };
    }),

  /** 승인 — PENDING_REVIEW → ACTIVE. statusReason 클리어. */
  approve: adminProcedure
    .input(
      z.object({
        productId: z.string(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      mutateProductStatus({
        actorUid: ctx.uid,
        productId: input.productId,
        newStatus: "ACTIVE",
        statusReason: null,
        notification: {
          type: "PRODUCT_APPROVED",
          title: "상품이 승인되었습니다",
          body: "",
        },
      }),
    ),

  /** 반려 — PENDING_REVIEW → REJECTED. 사유 필수. */
  reject: adminProcedure
    .input(
      z.object({
        productId: z.string(),
        reason: z.string().min(1, "반려 사유를 입력해주세요").max(500),
      }),
    )
    .mutation(({ ctx, input }) =>
      mutateProductStatus({
        actorUid: ctx.uid,
        productId: input.productId,
        newStatus: "REJECTED",
        statusReason: input.reason,
        notification: {
          type: "PRODUCT_REJECTED",
          title: "상품 등록이 반려되었습니다",
          body: input.reason,
        },
      }),
    ),

  /**
   * 수정 요청 — PENDING_REVIEW → REVISION_REQUESTED.
   *
   * revisionFields 와 reason 필수. vendor 가 수정 후 재제출하면
   * 다시 PENDING_REVIEW 로 전환.
   */
  requestRevision: adminProcedure
    .input(
      z.object({
        productId: z.string(),
        revisionFields: z.array(z.string()).min(1, "수정 필드를 1개 이상 선택해주세요"),
        reason: z
          .string()
          .min(1, "수정 요청 사유를 입력해주세요")
          .max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const now = FieldValue.serverTimestamp();
      const ref = db.collection(COLLECTIONS.products).doc(input.productId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "상품을 찾을 수 없습니다.",
        });
      }
      const before = snap.data() ?? {};

      await ref.update({
        "moderation.status": "REVISION_REQUESTED",
        "moderation.statusReason": input.reason,
        "moderation.revisionFields": input.revisionFields,
        "moderation.reviewedById": ctx.uid,
        "moderation.reviewedAt": now,
        updatedAt: now,
      });

      // notifications 큐 — Cloud Function (on-notification-created) 가 알림톡 발송 처리
      const vendorId = (before as { vendorId?: string }).vendorId;
      if (vendorId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "VENDOR",
          targetId: vendorId,
          type: "PRODUCT_REVISION",
          title: "상품에 수정이 필요합니다",
          body: input.reason,
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: now,
        });
      }

      // auditLog
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "PRODUCT_REVISION_REQUESTED",
        targetType: "Product",
        targetId: input.productId,
        before: {
          status:
            (before as { moderation?: { status?: string } }).moderation
              ?.status ?? null,
        },
        after: {
          status: "REVISION_REQUESTED",
          revisionFields: input.revisionFields,
          reason: input.reason,
        },
        createdAt: now,
      });

      return { ok: true, productId: input.productId };
    }),

  /** 일괄 승인 — 최대 50건, 단건 단위 처리. */
  bulkApprove: adminProcedure
    .input(
      z.object({
        productIds: z.array(z.string()).min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.allSettled(
        input.productIds.map((id) =>
          mutateProductStatus({
            actorUid: ctx.uid,
            productId: id,
            newStatus: "ACTIVE",
            statusReason: null,
            notification: {
              type: "PRODUCT_APPROVED",
              title: "상품이 승인되었습니다",
              body: "",
            },
          }),
        ),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      return { succeeded, failed, total: results.length };
    }),

  /** 운영자 메모 목록 — products/{id}/memos 서브컬렉션. */
  listMemos: adminProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ input }): Promise<ProductMemo[]> => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.products)
        .doc(input.productId)
        .collection("memos")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      return snap.docs.map((d) => {
        const data = d.data() as Omit<ProductMemo, "id">;
        return { id: d.id, ...data };
      });
    }),

  /** 운영자 메모 추가. */
  addMemo: adminProcedure
    .input(
      z.object({
        productId: z.string(),
        body: z.string().min(1, "메모 내용을 입력해주세요").max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const now = FieldValue.serverTimestamp();
      const pRef = db.collection(COLLECTIONS.products).doc(input.productId);
      const pSnap = await pRef.get();
      if (!pSnap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 상품을 찾을 수 없습니다.",
        });
      }

      await pRef.collection("memos").add({
        actorId: ctx.uid,
        body: input.body,
        createdAt: now,
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "PRODUCT_MEMO_ADDED",
        targetType: "Product",
        targetId: input.productId,
        createdAt: now,
      });

      return { ok: true };
    }),
});

async function mutateProductStatus(args: {
  actorUid: string;
  productId: string;
  newStatus: "ACTIVE" | "REJECTED";
  statusReason: string | null;
  notification: { type: string; title: string; body: string };
}) {
  const db = adminDb();
  const now = FieldValue.serverTimestamp();
  const ref = db.collection(COLLECTIONS.products).doc(args.productId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "상품을 찾을 수 없습니다.",
    });
  }
  const before = snap.data() ?? {};

  // 1) products/{id} 갱신
  const update: Record<string, unknown> = {
    "moderation.status": args.newStatus,
    "moderation.statusReason": args.statusReason,
    "moderation.reviewedById": args.actorUid,
    "moderation.reviewedAt": now,
    updatedAt: now,
  };
  // legacy status 필드도 ACTIVE 일 때 동기화 (buyer 카탈로그 호환)
  if (args.newStatus === "ACTIVE") update.status = "ACTIVE";
  await ref.update(update);

  // 2) notifications 큐 등록 (Cloud Function 이 발송)
  const vendorId = (before as { vendorId?: string }).vendorId;
  const productName = (before as { name?: string }).name ?? "";
  if (vendorId) {
    await db.collection(COLLECTIONS.notifications).add({
      targetType: "VENDOR",
      targetId: vendorId,
      type: args.notification.type,
      title: args.notification.title,
      body: args.notification.body || `상품 "${productName}"`,
      channels: ["KAKAO", "IN_APP"],
      kakaoSent: false,
      emailSent: false,
      createdAt: now,
    });
  }

  // 3) auditLogs
  await db.collection(COLLECTIONS.auditLogs).add({
    actorId: args.actorUid,
    actorRole: "ADMIN",
    action: `PRODUCT_${args.newStatus}`,
    targetType: "Product",
    targetId: args.productId,
    before: {
      status:
        (before as { moderation?: { status?: string } }).moderation?.status ??
        null,
    },
    after: { status: args.newStatus, statusReason: args.statusReason },
    createdAt: now,
  });

  return { ok: true, productId: args.productId, newStatus: args.newStatus };
}
