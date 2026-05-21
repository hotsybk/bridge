// Phase 2 — buyer 카탈로그 검색 router.
// 비로그인 사용자도 둘러보기 가능 (publicProcedure).
// Algolia 미연동 단계 — Firestore 단순 쿼리 (결정 #3 옵션 B 권장 노선).
//
// 인덱스 요구사항: 별도 composite index 불필요 (단순 where + orderBy 1개).

import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, publicProcedure } from "../trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { Product } from "@/lib/types";

const DEVICE_CLASS_VALUES = ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "NON_DEVICE"] as const;
const SORT_VALUES = ["latest", "priceAsc", "priceDesc", "popular"] as const;

export const productRouter = createTRPCRouter({
  // ─────────────────────────────────────────────────────────
  // list — 카탈로그 검색·필터
  //
  //   - search 문자열은 클라이언트에서 case-insensitive 부분 일치 (Phase 2.5 Algolia 전환)
  //   - status === "ACTIVE" 필터 항상 적용
  //   - cursor 페이지네이션 (limit 24)
  // ─────────────────────────────────────────────────────────
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        categoryId: z.string().optional(),
        deviceClass: z.enum(DEVICE_CLASS_VALUES).optional(),
        subscribable: z.boolean().optional(),
        groupBuyable: z.boolean().optional(),
        sort: z.enum(SORT_VALUES).default("latest"),
        limit: z.number().int().min(1).max(60).default(24),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = adminDb();
      let q = db
        .collection(COLLECTIONS.products)
        .where("status", "==", "ACTIVE") as FirebaseFirestore.Query;

      if (input.categoryId) q = q.where("categoryId", "==", input.categoryId);
      if (input.deviceClass) q = q.where("deviceClass", "==", input.deviceClass);
      if (input.subscribable === true) q = q.where("subscribable", "==", true);
      if (input.groupBuyable === true) q = q.where("groupBuyable", "==", true);

      // 정렬
      switch (input.sort) {
        case "priceAsc":
          q = q.orderBy("basePrice", "asc");
          break;
        case "priceDesc":
          q = q.orderBy("basePrice", "desc");
          break;
        case "popular":
          q = q.orderBy("viewCount", "desc");
          break;
        case "latest":
        default:
          q = q.orderBy("createdAt", "desc");
          break;
      }

      // cursor pagination
      if (input.cursor) {
        const cursorSnap = await db
          .collection(COLLECTIONS.products)
          .doc(input.cursor)
          .get();
        if (cursorSnap.exists) q = q.startAfter(cursorSnap);
      }

      q = q.limit(input.limit + 1); // hasMore 판정용 +1

      const snap = await q.get();
      let products = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);

      // 클라이언트 측 부분 검색 (Phase 2.5 Algolia 전환 전 임시)
      if (input.search) {
        const needle = input.search.toLowerCase();
        products = products.filter((p) => {
          const haystack = [p.name, p.nameEn, p.brand, p.manufacturer, p.vendorName]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(needle);
        });
      }

      const hasMore = products.length > input.limit;
      const items = hasMore ? products.slice(0, input.limit) : products;
      const nextCursor = hasMore ? items[items.length - 1]?.id : null;

      return { items, nextCursor };
    }),

  // ─────────────────────────────────────────────────────────
  // getById — 상품 상세
  // ─────────────────────────────────────────────────────────
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.products)
        .doc(input.id)
        .get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "상품을 찾을 수 없습니다." });
      }
      const data = snap.data() as Omit<Product, "id">;
      // viewCount fire-and-forget 증가 (best-effort)
      void db.collection(COLLECTIONS.products).doc(input.id).update({
        viewCount: FieldValueIncrement(1),
      }).catch(() => {});

      return { id: snap.id, ...data } as Product;
    }),

  // ─────────────────────────────────────────────────────────
  // categories — 전체 카테고리 트리 (검색 사이드바용)
  // ─────────────────────────────────────────────────────────
  categories: publicProcedure.query(async () => {
    const db = adminDb();
    const snap = await db
      .collection(COLLECTIONS.categories)
      .orderBy("sortOrder", "asc")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
  }),
});

// helper — fire-and-forget increment 용 (firebase-admin/firestore FieldValue)
function FieldValueIncrement(by: number) {
  // 동적 require 회피 — firebase-admin 의 FieldValue 사용
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FieldValue } = require("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
  return FieldValue.increment(by);
}

type Category = {
  id: string;
  slug: string;
  name: string;
  parentId?: string;
  depth: number;
  sortOrder: number;
  path: string[];
};
