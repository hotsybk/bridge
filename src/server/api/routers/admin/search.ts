import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// Phase γ-1 — admin 전역 ⌘K 검색.
//
// 단순 prefix + exact-id 매칭. Algolia 통합은 Phase 3+.
// ─────────────────────────────────────────────────────────────

export type GlobalSearchResult = {
  type: "order" | "hospital" | "vendor" | "dispute" | "product" | "user";
  id: string;
  title: string;
  subtitle: string;
  url: string;
};

export const adminSearchRouter = createTRPCRouter({
  global: adminProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        limit: z.number().int().positive().max(20).default(8),
      }),
    )
    .query(async ({ input }): Promise<{ results: GlobalSearchResult[] }> => {
      const db = adminDb();
      const raw = input.query.trim();
      if (!raw) return { results: [] };

      const results: GlobalSearchResult[] = [];

      // 1) 주문번호 (MP-...)
      if (raw.toUpperCase().startsWith("MP-")) {
        try {
          const snap = await db
            .collection(COLLECTIONS.orders)
            .where("orderNo", "==", raw.toUpperCase())
            .limit(3)
            .get();
          snap.docs.forEach((d) => {
            const data = d.data() as {
              orderNo?: string;
              hospitalName?: string;
              finalAmount?: number;
              totalAmount?: number;
            };
            const amount = data.finalAmount ?? data.totalAmount ?? 0;
            results.push({
              type: "order",
              id: d.id,
              title: data.orderNo ?? d.id,
              subtitle: `${data.hospitalName ?? "병원"} · ₩${amount.toLocaleString()}`,
              url: `/admin/orders/${d.id}`,
            });
          });
        } catch (err) {
          console.warn("[admin.search.global] orderNo search failed", err);
        }
      }

      // 2) Hospital / Vendor name prefix
      const endTerm = raw + "";
      const [hSnap, vSnap, pSnap] = await Promise.all([
        db
          .collection(COLLECTIONS.hospitals)
          .orderBy("name")
          .startAt(raw)
          .endAt(endTerm)
          .limit(3)
          .get()
          .catch(() => null),
        db
          .collection(COLLECTIONS.vendors)
          .orderBy("name")
          .startAt(raw)
          .endAt(endTerm)
          .limit(3)
          .get()
          .catch(() => null),
        db
          .collection(COLLECTIONS.products)
          .orderBy("name")
          .startAt(raw)
          .endAt(endTerm)
          .limit(3)
          .get()
          .catch(() => null),
      ]);

      hSnap?.docs.forEach((d) => {
        const data = d.data() as { name?: string };
        results.push({
          type: "hospital",
          id: d.id,
          title: data.name ?? d.id,
          subtitle: d.id,
          url: `/admin/hospitals/${d.id}`,
        });
      });
      vSnap?.docs.forEach((d) => {
        const data = d.data() as { name?: string };
        results.push({
          type: "vendor",
          id: d.id,
          title: data.name ?? d.id,
          subtitle: d.id,
          url: `/admin/vendors/${d.id}`,
        });
      });
      pSnap?.docs.forEach((d) => {
        const data = d.data() as { name?: string; vendorName?: string };
        results.push({
          type: "product",
          id: d.id,
          title: data.name ?? d.id,
          subtitle: data.vendorName ?? d.id,
          url: `/admin/products/${d.id}`,
        });
      });

      // 3) ID 정확 일치 — query 가 nanoid (≥ 15자) 형태면 직접 doc 조회.
      if (raw.length >= 15 && /^[A-Za-z0-9_-]+$/.test(raw)) {
        const candidates: Array<{
          col: keyof typeof COLLECTIONS;
          type: GlobalSearchResult["type"];
          urlPath: string;
        }> = [
          { col: "hospitals", type: "hospital", urlPath: "hospitals" },
          { col: "vendors", type: "vendor", urlPath: "vendors" },
          { col: "orders", type: "order", urlPath: "orders" },
          { col: "disputes", type: "dispute", urlPath: "disputes" },
          { col: "products", type: "product", urlPath: "products" },
        ];
        const lookups = await Promise.all(
          candidates.map(async (c) => {
            try {
              const ref = db.collection(COLLECTIONS[c.col]).doc(raw);
              const snap = await ref.get();
              return { snap, meta: c };
            } catch {
              return null;
            }
          }),
        );
        for (const item of lookups) {
          if (!item) continue;
          const { snap, meta } = item;
          if (!snap.exists) continue;
          // 중복 방지
          if (results.some((r) => r.id === snap.id && r.type === meta.type)) continue;
          const data = snap.data() as {
            name?: string;
            orderNo?: string;
            hospitalName?: string;
            vendorName?: string;
          };
          const title =
            data.name ?? data.orderNo ?? data.hospitalName ?? data.vendorName ?? snap.id;
          results.push({
            type: meta.type,
            id: snap.id,
            title,
            subtitle: snap.id,
            url: `/admin/${meta.urlPath}/${snap.id}`,
          });
        }
      }

      return { results: results.slice(0, input.limit) };
    }),
});
