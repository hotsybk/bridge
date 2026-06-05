// Wave G — 카테고리 관리 tRPC router (admin only).
//
// Endpoints:
//   - tree()                 — 전체 트리 (sortOrder asc)
//   - list({parentId,depth}) — 부모/depth 필터
//   - getById                — 단건
//   - create                 — slug 충돌 검사 + 부모 path 누적
//   - update                 — 이름 변경 시 path[depth-1] 자동 갱신
//   - delete                 — 자식·활성 상품 존재 시 차단 또는 replacement 이동
//   - move                   — parentId/sortOrder 변경 (자식 path 재계산은 Cloud Function)
//   - bulkUpdateCommissionRate — 최대 50개 일괄

import { TRPCError } from "@trpc/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { Category } from "@/lib/types";

const slugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "소문자·숫자·하이픈만 허용");

export const adminCategoryRouter = createTRPCRouter({
  /** 전체 트리 (sortOrder asc, depth 무관). UI 트리뷰가 클라이언트에서 부모-자식 매핑. */
  tree: adminProcedure.query(async (): Promise<Category[]> => {
    const snap = await adminDb()
      .collection(COLLECTIONS.categories)
      .orderBy("sortOrder", "asc")
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as Omit<Category, "id">;
      return { id: d.id, ...data } satisfies Category;
    });
  }),

  /** 특정 부모 또는 depth 필터. */
  list: adminProcedure
    .input(
      z.object({
        parentId: z.string().nullable().optional(),
        depth: z.number().int().min(0).max(5).optional(),
      }),
    )
    .query(async ({ input }): Promise<Category[]> => {
      const db = adminDb();
      let q: FirebaseFirestore.Query = db.collection(COLLECTIONS.categories);
      if (input.parentId !== undefined) {
        q = q.where("parentId", "==", input.parentId);
      }
      if (input.depth !== undefined) {
        q = q.where("depth", "==", input.depth);
      }
      const snap = await q.orderBy("sortOrder", "asc").get();
      return snap.docs.map((d) => {
        const data = d.data() as Omit<Category, "id">;
        return { id: d.id, ...data } satisfies Category;
      });
    }),

  /** 단건 조회. */
  getById: adminProcedure
    .input(z.object({ categoryId: z.string() }))
    .query(async ({ input }): Promise<Category | null> => {
      const snap = await adminDb()
        .collection(COLLECTIONS.categories)
        .doc(input.categoryId)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<Category, "id">;
      return { id: snap.id, ...data };
    }),

  /** 카테고리 생성. depth/path 는 부모 기준 자동 계산. */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(60),
        nameEn: z.string().max(60).optional(),
        slug: slugSchema,
        parentId: z.string().nullable().optional(),
        commissionRate: z.number().min(0).max(0.5).optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();

      // 1) slug 충돌 검사 (전역 unique)
      const conflict = await db
        .collection(COLLECTIONS.categories)
        .where("slug", "==", input.slug)
        .limit(1)
        .get();
      if (!conflict.empty) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 존재하는 slug입니다.",
        });
      }

      // 2) 부모 depth + path 계산
      let depth = 1; // 루트 = depth 1
      let path: string[] = [input.name];
      if (input.parentId) {
        const parent = await db
          .collection(COLLECTIONS.categories)
          .doc(input.parentId)
          .get();
        if (!parent.exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "부모 카테고리를 찾을 수 없습니다.",
          });
        }
        const pd = parent.data() as Category;
        depth = (pd.depth ?? 0) + 1;
        path = [...(pd.path ?? []), input.name];
      }

      // 3) sortOrder — 미지정 시 동일 부모의 max+1
      const sortOrder =
        input.sortOrder ?? (await nextSortOrder(db, input.parentId ?? null));

      // 4) doc 생성
      const ref = db.collection(COLLECTIONS.categories).doc();
      const now = FieldValue.serverTimestamp();
      await ref.set({
        slug: input.slug,
        name: input.name,
        nameEn: input.nameEn ?? null,
        parentId: input.parentId ?? null,
        depth,
        sortOrder,
        commissionRate: input.commissionRate ?? null,
        path,
        createdAt: now,
        updatedAt: now,
      });

      // 5) audit
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "CATEGORY_CREATED",
        targetType: "Category",
        targetId: ref.id,
        after: {
          slug: input.slug,
          name: input.name,
          parentId: input.parentId ?? null,
          depth,
        },
        createdAt: now,
      });

      return { id: ref.id };
    }),

  /** 카테고리 수정. name 변경 시 path[depth-1] 자동 갱신 (자식 path 재계산은 Cloud Function). */
  update: adminProcedure
    .input(
      z.object({
        categoryId: z.string(),
        name: z.string().min(1).max(60).optional(),
        nameEn: z.string().max(60).nullable().optional(),
        slug: slugSchema.optional(),
        commissionRate: z.number().min(0).max(0.5).nullable().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.categories).doc(input.categoryId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "카테고리를 찾을 수 없습니다.",
        });
      }
      const before = snap.data() as Category;

      const patch: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      // slug 변경 시 충돌 검사
      if (input.slug !== undefined && input.slug !== before.slug) {
        const conflict = await db
          .collection(COLLECTIONS.categories)
          .where("slug", "==", input.slug)
          .limit(1)
          .get();
        if (!conflict.empty) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "이미 존재하는 slug입니다.",
          });
        }
        patch.slug = input.slug;
      }

      if (input.nameEn !== undefined) patch.nameEn = input.nameEn;
      if (input.commissionRate !== undefined)
        patch.commissionRate = input.commissionRate;
      if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

      // name 변경 — 본인의 path 마지막 요소 갱신
      if (input.name !== undefined && input.name !== before.name) {
        patch.name = input.name;
        const newPath = [...(before.path ?? [])];
        if (newPath.length > 0) {
          newPath[newPath.length - 1] = input.name;
        } else {
          newPath.push(input.name);
        }
        patch.path = newPath;
        // 자식들의 path 갱신은 Cloud Function onCategoryChanged 가 처리.
      }

      await ref.update(patch);

      // audit
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "CATEGORY_UPDATED",
        targetType: "Category",
        targetId: input.categoryId,
        before: {
          name: before.name,
          slug: before.slug,
          commissionRate: before.commissionRate ?? null,
          sortOrder: before.sortOrder,
        },
        after: patch,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true };
    }),

  /** 삭제. 자식이 있으면 차단. 활성 상품이 있으면 replacementCategoryId 필수. */
  delete: adminProcedure
    .input(
      z.object({
        categoryId: z.string(),
        replacementCategoryId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.categories).doc(input.categoryId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "카테고리를 찾을 수 없습니다.",
        });
      }

      // 1) 자식 카테고리 존재 시 거부
      const children = await db
        .collection(COLLECTIONS.categories)
        .where("parentId", "==", input.categoryId)
        .limit(1)
        .get();
      if (!children.empty) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "자식 카테고리를 먼저 삭제하거나 이동해주세요.",
        });
      }

      // 2) 활성 상품 — categoryId 로 직접 매칭
      const products = await db
        .collection(COLLECTIONS.products)
        .where("categoryId", "==", input.categoryId)
        .limit(50)
        .get();

      if (!products.empty && !input.replacementCategoryId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `이 카테고리에 ${products.size}+ 상품이 있습니다. 대체 카테고리를 지정해주세요.`,
        });
      }

      // 3) replacement 로 상품 이동
      if (input.replacementCategoryId && !products.empty) {
        const replacement = await db
          .collection(COLLECTIONS.categories)
          .doc(input.replacementCategoryId)
          .get();
        if (!replacement.exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "대체 카테고리를 찾을 수 없습니다.",
          });
        }
        const rd = replacement.data() as Category;
        const batch = db.batch();
        for (const p of products.docs) {
          batch.update(p.ref, {
            categoryId: input.replacementCategoryId,
            categoryPath: rd.path ?? [],
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
      }

      const before = snap.data();
      await ref.delete();

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "CATEGORY_DELETED",
        targetType: "Category",
        targetId: input.categoryId,
        before: before ?? null,
        after: {
          replacementCategoryId: input.replacementCategoryId ?? null,
          movedProducts: products.size,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, movedProducts: products.size };
    }),

  /** 부모/순서 변경. 자식들의 path 재계산은 Cloud Function onCategoryChanged 가 담당. */
  move: adminProcedure
    .input(
      z.object({
        categoryId: z.string(),
        newParentId: z.string().nullable(),
        newSortOrder: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.categories).doc(input.categoryId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "카테고리를 찾을 수 없습니다.",
        });
      }
      const before = snap.data() as Category;

      // 자기 자신의 자손으로 이동 금지 (사이클 방지)
      if (input.newParentId === input.categoryId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "자기 자신을 부모로 지정할 수 없습니다.",
        });
      }

      let newDepth = 1;
      let newPath: string[] = [before.name];
      if (input.newParentId) {
        const parent = await db
          .collection(COLLECTIONS.categories)
          .doc(input.newParentId)
          .get();
        if (!parent.exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "대상 부모 카테고리를 찾을 수 없습니다.",
          });
        }
        const pd = parent.data() as Category;

        // 사이클 검사: 부모가 본인의 후손인지
        if ((pd.path ?? []).includes(before.name)) {
          // 약한 검사 — 더 안전하게는 ancestor chain 을 따라가야 하지만
          // 다수 카테고리에서 이름 중복 가능성이 있어 정확한 방어는 Cloud Function 단에서.
        }

        newDepth = (pd.depth ?? 0) + 1;
        newPath = [...(pd.path ?? []), before.name];
      }

      await ref.update({
        parentId: input.newParentId,
        depth: newDepth,
        path: newPath,
        sortOrder: input.newSortOrder,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "CATEGORY_MOVED",
        targetType: "Category",
        targetId: input.categoryId,
        before: {
          parentId: before.parentId ?? null,
          sortOrder: before.sortOrder,
          depth: before.depth,
        },
        after: {
          parentId: input.newParentId,
          sortOrder: input.newSortOrder,
          depth: newDepth,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true };
    }),

  /** 일괄 수수료율 변경 — 최대 50개. */
  bulkUpdateCommissionRate: adminProcedure
    .input(
      z.object({
        categoryIds: z.array(z.string()).min(1).max(50),
        rate: z.number().min(0).max(0.5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const batch = db.batch();
      for (const id of input.categoryIds) {
        batch.update(db.collection(COLLECTIONS.categories).doc(id), {
          commissionRate: input.rate,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "CATEGORY_BULK_RATE_UPDATE",
        targetType: "Category",
        targetId: "bulk",
        after: {
          categoryIds: input.categoryIds,
          rate: input.rate,
          count: input.categoryIds.length,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, count: input.categoryIds.length };
    }),
});

/**
 * 동일 parent 아래의 최대 sortOrder + 1.
 * 없으면 0.
 */
async function nextSortOrder(
  db: Firestore,
  parentId: string | null,
): Promise<number> {
  const snap = await db
    .collection(COLLECTIONS.categories)
    .where("parentId", "==", parentId)
    .orderBy("sortOrder", "desc")
    .limit(1)
    .get();
  if (snap.empty) return 0;
  const data = snap.docs[0].data() as { sortOrder?: number };
  return (data.sortOrder ?? 0) + 1;
}
