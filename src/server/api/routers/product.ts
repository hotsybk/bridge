// Phase 2 — buyer 카탈로그 검색 router.
// 비로그인 사용자도 둘러보기 가능 (publicProcedure).
// Algolia 미연동 단계 — Firestore 단순 쿼리 (결정 #3 옵션 B 권장 노선).
//
// 인덱스 요구사항: 별도 composite index 불필요 (단순 where + orderBy 1개).

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";

import { createTRPCRouter, publicProcedure } from "../trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { Product } from "@/lib/types";

const DEVICE_CLASS_VALUES = ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "NON_DEVICE"] as const;
const SORT_VALUES = ["latest", "priceAsc", "priceDesc", "popular"] as const;

/**
 * Wave 2 — 대분류(진료과) categoryId 필터 보강.
 *
 * 상품은 소분류 categoryId(예: `cat-oriental-needle`)를 가진다. 대분류
 * (예: `cat-oriental`)를 클릭하면 하위 소분류 상품이 모두 포함되어야 한다.
 *
 * 전략 (DB 추가 read 없이 in-memory 판정):
 *  - 정확히 일치하면 그대로 통과 (소분류 클릭)
 *  - `${categoryId}-` 로 시작하면 통과 (대분류의 하위 소분류 — id prefix 규칙 활용)
 *
 * 진료과 카테고리 id 규칙: 대분류 = `cat-{slug}`, 소분류 = `cat-{slug}-{sub}`.
 * 따라서 prefix 검사만으로 대→소 포함이 성립한다. 구 nanoid/cat-* 체계는
 * prefix 가 겹치지 않아 안전하게 무시된다.
 */
function matchesCategory(productCategoryId: string, filterId: string): boolean {
  if (!productCategoryId) return false;
  return (
    productCategoryId === filterId ||
    productCategoryId.startsWith(`${filterId}-`)
  );
}

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
        vendorId: z.string().optional(),
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
      // Phase 2 초기 — composite index 회피 위해 in-memory filter.
      // 시드 + 초기 데이터 규모(<수백) 에서는 안전. Phase 2.5 에서 Algolia + composite index 도입.
      const snap = await db.collection(COLLECTIONS.products).get();
      let products = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);

      // 1) status == ACTIVE
      products = products.filter(
        (p) => (p as { status?: string }).status === "ACTIVE",
      );

      // 2) 추가 필터 (대분류 클릭 시 하위 소분류 상품 포함)
      if (input.categoryId) {
        const filterId = input.categoryId;
        products = products.filter((p) => matchesCategory(p.categoryId, filterId));
      }
      if (input.vendorId) {
        products = products.filter(
          (p) => (p as { vendorId?: string }).vendorId === input.vendorId,
        );
      }
      if (input.deviceClass) {
        products = products.filter((p) => p.deviceClass === input.deviceClass);
      }
      if (input.subscribable === true) {
        products = products.filter(
          (p) => (p as { subscribable?: boolean }).subscribable === true,
        );
      }
      if (input.groupBuyable === true) {
        products = products.filter(
          (p) => (p as { groupBuyable?: boolean }).groupBuyable === true,
        );
      }

      // 3) 부분검색 (Phase 2.5 Algolia 전환 예정)
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

      // 4) 정렬
      products.sort((a, b) => {
        switch (input.sort) {
          case "priceAsc":
            return a.basePrice - b.basePrice;
          case "priceDesc":
            return b.basePrice - a.basePrice;
          case "popular":
            return (
              ((b as { viewCount?: number }).viewCount ?? 0) -
              ((a as { viewCount?: number }).viewCount ?? 0)
            );
          case "latest":
          default: {
            const av = (a as { createdAt?: { seconds?: number } }).createdAt?.seconds ?? 0;
            const bv = (b as { createdAt?: { seconds?: number } }).createdAt?.seconds ?? 0;
            return bv - av;
          }
        }
      });

      // 5) cursor pagination (cursor = 마지막 id)
      let startIdx = 0;
      if (input.cursor) {
        const idx = products.findIndex((p) => p.id === input.cursor);
        if (idx >= 0) startIdx = idx + 1;
      }
      const page = products.slice(startIdx, startIdx + input.limit + 1);
      const hasMore = page.length > input.limit;
      const items = hasMore ? page.slice(0, input.limit) : page;
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
      // viewCount fire-and-forget 증가 (best-effort, 에러 무시)
      void db
        .collection(COLLECTIONS.products)
        .doc(input.id)
        .update({ viewCount: FieldValue.increment(1) })
        .catch(() => {
          /* best-effort */
        });

      return { id: snap.id, ...data } as Product;
    }),

  // ─────────────────────────────────────────────────────────
  // search — Algolia 통합 검색 (Wave Z)
  //
  //   - env 키 설정 시 Algolia REST 호출
  //   - 미설정 또는 호출 실패 시 Firestore fallback (list 와 유사한 in-memory 필터)
  //   - 반환에 source 필드 포함 — 개발자가 어디서 응답이 왔는지 확인 가능
  // ─────────────────────────────────────────────────────────
  search: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        categoryId: z.string().optional(),
        vendorId: z.string().optional(),
        page: z.number().int().nonnegative().default(0),
        hitsPerPage: z.number().int().positive().max(60).default(24),
        sort: z
          .enum(["popularity", "newest", "price_asc", "price_desc"])
          .default("popularity"),
      }),
    )
    .query(async ({ input }) => {
      const { searchProducts, isAlgoliaConfigured } = await import(
        "@/server/services/algolia"
      );

      // 1) Algolia 시도
      if (isAlgoliaConfigured()) {
        const result = await searchProducts(input);
        if (result) {
          return {
            hits: result.hits,
            nbHits: result.nbHits,
            page: result.page,
            nbPages: result.nbPages,
            source: "algolia" as const,
          };
        }
      }

      // 2) Firestore fallback
      const db = adminDb();
      const snap = await db.collection(COLLECTIONS.products).get();
      let products = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Product & {
          objectID?: string;
        },
      );

      // ACTIVE 필터
      products = products.filter(
        (p) => (p as { status?: string }).status === "ACTIVE",
      );

      if (input.categoryId) {
        const filterId = input.categoryId;
        products = products.filter((p) => matchesCategory(p.categoryId, filterId));
      }
      if (input.vendorId) {
        products = products.filter(
          (p) => (p as { vendorId?: string }).vendorId === input.vendorId,
        );
      }
      if (input.query) {
        const needle = input.query.toLowerCase();
        products = products.filter((p) => {
          const haystack = [
            p.name,
            p.nameEn,
            p.brand,
            p.manufacturer,
            p.vendorName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(needle);
        });
      }

      // 정렬
      products.sort((a, b) => {
        switch (input.sort) {
          case "price_asc":
            return a.basePrice - b.basePrice;
          case "price_desc":
            return b.basePrice - a.basePrice;
          case "newest": {
            const av =
              (a as { createdAt?: { seconds?: number } }).createdAt
                ?.seconds ?? 0;
            const bv =
              (b as { createdAt?: { seconds?: number } }).createdAt
                ?.seconds ?? 0;
            return bv - av;
          }
          case "popularity":
          default:
            return (
              ((b as { orderCount?: number }).orderCount ?? 0) -
              ((a as { orderCount?: number }).orderCount ?? 0)
            );
        }
      });

      const nbHits = products.length;
      const nbPages = Math.max(1, Math.ceil(nbHits / input.hitsPerPage));
      const start = input.page * input.hitsPerPage;
      const paged = products.slice(start, start + input.hitsPerPage);
      const hits = paged.map((p) => ({ objectID: p.id, ...p }));

      return {
        hits,
        nbHits,
        page: input.page,
        nbPages,
        source: "firestore-fallback" as const,
      };
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

type Category = {
  id: string;
  slug: string;
  name: string;
  parentId?: string | null;
  depth: number;
  sortOrder: number;
  path: string[];
  icon?: string;        // Wave 1 — 진료과 대분류만 보유 (lucide 아이콘명)
  isActive?: boolean;
};
