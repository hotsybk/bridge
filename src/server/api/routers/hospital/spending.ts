// Phase Φ-C 작업1 — buyer 지출 분석 tRPC router (read-only).
//
// 병원 구매팀이 본인 병원의 지출을 분석하는 대시보드 데이터.
// orders (status PAID/COMPLETED) + subOrders/items 를 in-memory 집계.
//
// Endpoint:
//   spending({ months }) —
//     totalSpending / thisMonthSpending / orderCount / avgOrderValue
//     monthlySpending[] (최근 N개월)
//     byCategory[]      (categoryPath[0] 기준 집계)
//     byVendor[]        (top 5 공급사)
//     topProducts[]     (자주 산 상품 top 10)
//
// 데이터 규모 작음 (병원 1곳 주문) → in-memory 집계로 충분.
// hospitalId 없으면 빈 구조 graceful 반환.

import { z } from "zod";

import { buyerProcedure } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

// 집계 대상 주문 status (결제 완료 이후).
const COUNTED_STATUSES = new Set(["PAID", "COMPLETED", "SETTLED"]);

type OrderDoc = {
  status?: string;
  totalAmount?: number;
  finalAmount?: number;
  createdAt?: unknown;
  paidAt?: unknown;
};

type ItemDoc = {
  productId?: string;
  productName?: string;
  qty?: number;
  amount?: number;
  categoryId?: string | null;
};

type SubOrderDoc = {
  vendorId?: string;
  vendorName?: string;
};

function tsToMs(ts: unknown): number {
  if (!ts || typeof ts !== "object") return 0;
  const w = ts as {
    toMillis?: () => number;
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
  };
  if (typeof w.toMillis === "function") {
    try {
      return w.toMillis();
    } catch {
      /* fallthrough */
    }
  }
  if (typeof w.toDate === "function") {
    try {
      return w.toDate().getTime();
    } catch {
      /* fallthrough */
    }
  }
  const sec = w.seconds ?? w._seconds;
  if (typeof sec === "number") return sec * 1000;
  return 0;
}

function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type SpendingResult = {
  totalSpending: number;
  thisMonthSpending: number;
  orderCount: number;
  avgOrderValue: number;
  monthlySpending: Array<{ month: string; amount: number }>;
  byCategory: Array<{ category: string; amount: number; count: number }>;
  byVendor: Array<{ vendorName: string; amount: number; count: number }>;
  topProducts: Array<{ name: string; qty: number; amount: number }>;
};

function emptyResult(months: number): SpendingResult {
  const monthlySpending: Array<{ month: string; amount: number }> = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlySpending.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      amount: 0,
    });
  }
  return {
    totalSpending: 0,
    thisMonthSpending: 0,
    orderCount: 0,
    avgOrderValue: 0,
    monthlySpending,
    byCategory: [],
    byVendor: [],
    topProducts: [],
  };
}

/**
 * hospital.spending — buyerProcedure query.
 * hospital 라우터에 `spending:` 으로 직접 병합된다 (root.ts 경유 자동 노출).
 */
export const hospitalSpendingProcedure = buyerProcedure
  .input(z.object({ months: z.number().int().min(1).max(24).default(6) }))
  .query(async ({ ctx, input }): Promise<SpendingResult> => {
      const hospitalId = ctx.hospitalId;
      if (!hospitalId) return emptyResult(input.months);

      const db = adminDb();

      // 최근 N개월 시작 시점 (월 1일 00:00).
      const now = new Date();
      const windowStart = new Date(
        now.getFullYear(),
        now.getMonth() - (input.months - 1),
        1,
        0,
        0,
        0,
      );
      const windowStartMs = windowStart.getTime();
      const thisMonth = monthKey(now.getTime());

      // monthly 버킷 초기화 (0원 월도 표시).
      const monthlyMap = new Map<string, number>();
      for (let i = input.months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthlyMap.set(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          0,
        );
      }

      let orderSnap: FirebaseFirestore.QuerySnapshot;
      try {
        // hospitalId + createdAt DESC 인덱스 활용 (firestore.indexes.json 존재).
        orderSnap = await db
          .collection(COLLECTIONS.orders)
          .where("hospitalId", "==", hospitalId)
          .orderBy("createdAt", "desc")
          .limit(2000)
          .get();
      } catch {
        // 인덱스 부재 등 — fallback (정렬 없이)
        try {
          orderSnap = await db
            .collection(COLLECTIONS.orders)
            .where("hospitalId", "==", hospitalId)
            .limit(2000)
            .get();
        } catch {
          return emptyResult(input.months);
        }
      }

      // 집계 accumulators.
      let totalSpending = 0;
      let thisMonthSpending = 0;
      let orderCount = 0;

      const vendorMap = new Map<
        string,
        { vendorName: string; amount: number; count: number }
      >();
      const productMap = new Map<
        string,
        { name: string; qty: number; amount: number }
      >();
      const categoryAmount = new Map<string, number>();
      const categoryCount = new Map<string, number>();
      const categoryIds = new Set<string>();

      type PendingItem = {
        amount: number;
        qty: number;
        categoryId: string | null;
      };
      const pendingItems: PendingItem[] = [];

      for (const orderDoc of orderSnap.docs) {
        const order = orderDoc.data() as OrderDoc;
        if (!COUNTED_STATUSES.has(order.status ?? "")) continue;

        const orderMs = tsToMs(order.paidAt) || tsToMs(order.createdAt);
        if (orderMs && orderMs < windowStartMs) continue;

        const amount = order.finalAmount ?? order.totalAmount ?? 0;
        totalSpending += amount;
        orderCount += 1;

        const mk = orderMs ? monthKey(orderMs) : thisMonth;
        if (monthlyMap.has(mk)) {
          monthlyMap.set(mk, (monthlyMap.get(mk) ?? 0) + amount);
        }
        if (mk === thisMonth) thisMonthSpending += amount;

        // subOrders → vendor 집계.
        const subSnap = await orderDoc.ref.collection("subOrders").get();
        for (const subDoc of subSnap.docs) {
          const sub = subDoc.data() as SubOrderDoc;
          const vId = sub.vendorId ?? "unknown";
          const vName = sub.vendorName ?? "공급사";
          const cur = vendorMap.get(vId) ?? {
            vendorName: vName,
            amount: 0,
            count: 0,
          };
          cur.count += 1;

          // items → product / category 집계.
          const itemsSnap = await subDoc.ref.collection("items").get();
          let subAmount = 0;
          for (const itemDoc of itemsSnap.docs) {
            const item = itemDoc.data() as ItemDoc;
            const itemAmount = item.amount ?? 0;
            const itemQty = item.qty ?? 0;
            subAmount += itemAmount;

            // product top
            const pKey = item.productId ?? item.productName ?? itemDoc.id;
            const pCur = productMap.get(pKey) ?? {
              name: item.productName ?? "상품",
              qty: 0,
              amount: 0,
            };
            pCur.qty += itemQty;
            pCur.amount += itemAmount;
            productMap.set(pKey, pCur);

            // category — categoryId 해석 후 집계 (지연).
            const cId = item.categoryId ?? null;
            if (cId) categoryIds.add(cId);
            pendingItems.push({
              amount: itemAmount,
              qty: itemQty,
              categoryId: cId,
            });
          }
          cur.amount += subAmount;
          vendorMap.set(vId, cur);
        }
      }

      // categoryId → 최상위 카테고리명 해석.
      const categoryNameById = new Map<string, string>();
      if (categoryIds.size > 0) {
        await Promise.all(
          Array.from(categoryIds).map(async (cId) => {
            try {
              const cSnap = await db
                .collection(COLLECTIONS.categories)
                .doc(cId)
                .get();
              if (cSnap.exists) {
                const c = cSnap.data() as { path?: string[]; name?: string };
                const top =
                  (Array.isArray(c.path) && c.path.length > 0
                    ? c.path[0]
                    : null) ??
                  c.name ??
                  null;
                if (top) categoryNameById.set(cId, top);
              }
            } catch {
              /* ignore — fallback 처리 */
            }
          }),
        );
      }

      for (const it of pendingItems) {
        const catName = it.categoryId
          ? (categoryNameById.get(it.categoryId) ?? "기타")
          : "기타";
        categoryAmount.set(
          catName,
          (categoryAmount.get(catName) ?? 0) + it.amount,
        );
        categoryCount.set(catName, (categoryCount.get(catName) ?? 0) + 1);
      }

      const monthlySpending = Array.from(monthlyMap.entries()).map(
        ([month, amt]) => ({ month, amount: amt }),
      );

      const byCategory = Array.from(categoryAmount.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          count: categoryCount.get(category) ?? 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const byVendor = Array.from(vendorMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      return {
        totalSpending,
        thisMonthSpending,
        orderCount,
        avgOrderValue: orderCount > 0 ? Math.round(totalSpending / orderCount) : 0,
        monthlySpending,
        byCategory,
        byVendor,
        topProducts,
      };
  });
