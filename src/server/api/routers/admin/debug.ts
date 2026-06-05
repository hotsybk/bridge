// Wave V — Debug 도구 router.
// SUPER_ADMIN only. Firestore Query Explorer + Retry Queue Manager.
//
// 주의: queryFirestore 는 READ-ONLY 다. 모든 운영자 액션은 auditLog 자동 적재.

import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { createTRPCRouter, superAdminProcedure } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// 보안 — 허용 컬렉션 화이트리스트.
// 임의의 path 입력으로 system 컬렉션 들춰보는 것 방지.
// ─────────────────────────────────────────────────────────────
const ALLOWED_COLLECTIONS = [
  "users",
  "hospitals",
  "vendors",
  "products",
  "orders",
  "subscriptions",
  "groupBuys",
  "rfqs",
  "settlements",
  "payouts",
  "notifications",
  "auditLogs",
  "categories",
  "disputes",
  "coupons",
  "udiReports",
  "carts",
  "featureFlags",
  "systemSettings",
  "_retryQueue",
  "_portoneWebhooks",
  "_systemAlerts",
  "_solapiWebhooks",
  "_metricsSnapshots",
  "_serviceHealth",
  "_udiReportQueue",
] as const;

const OpEnum = z.enum([
  "==",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "array-contains",
  "in",
]);

const DirEnum = z.enum(["asc", "desc"]);

const RetryStatusEnum = z.enum(["PENDING", "RESOLVED", "CANCELLED", "FAILED"]);

// JSON 직렬화 친화 형태로 firestore doc 변환 (Timestamp → ISO string).
function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (
      typeof (v as { toDate?: () => Date }).toDate === "function"
    ) {
      try {
        return (v as { toDate: () => Date }).toDate().toISOString();
      } catch {
        return v;
      }
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = serialize(val);
    }
    return out;
  }
  return value;
}

export const adminDebugRouter = createTRPCRouter({
  /**
   * Firestore Query Explorer — READ-ONLY.
   * 화이트리스트된 컬렉션만 접근 가능.
   */
  queryFirestore: superAdminProcedure
    .input(
      z.object({
        collection: z.string().min(1).max(60),
        where: z
          .array(
            z.object({
              field: z.string().min(1).max(60),
              op: OpEnum,
              value: z.unknown(),
            }),
          )
          .max(5)
          .optional(),
        orderBy: z.string().min(1).max(60).optional(),
        direction: DirEnum.default("desc"),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ALLOWED_COLLECTIONS.includes(input.collection as (typeof ALLOWED_COLLECTIONS)[number])) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `허용되지 않은 컬렉션입니다: ${input.collection}`,
        });
      }

      const db = adminDb();
      let q: FirebaseFirestore.Query = db.collection(input.collection);
      for (const w of input.where ?? []) {
        q = q.where(
          w.field,
          w.op as FirebaseFirestore.WhereFilterOp,
          w.value as never,
        );
      }
      if (input.orderBy) q = q.orderBy(input.orderBy, input.direction);
      q = q.limit(input.limit);

      let snap: FirebaseFirestore.QuerySnapshot;
      try {
        snap = await q.get();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Firestore 쿼리 실패: ${msg}`,
        });
      }

      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(serialize(d.data()) as Record<string, unknown>),
      }));

      // 운영자가 어떤 컬렉션을 들여다봤는지 audit log.
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "DEBUG_FIRESTORE_QUERY",
        targetType: "Firestore",
        targetId: input.collection,
        after: {
          collection: input.collection,
          where: input.where ?? [],
          orderBy: input.orderBy ?? null,
          direction: input.direction,
          limit: input.limit,
          resultCount: rows.length,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { rows, count: rows.length };
    }),

  /**
   * _retryQueue list — 최근 50건.
   */
  listRetryQueue: superAdminProcedure
    .input(
      z
        .object({
          status: RetryStatusEnum.optional(),
        })
        .default({}),
    )
    .query(async ({ input }) => {
      const db = adminDb();
      let q: FirebaseFirestore.Query = db
        .collection(COLLECTIONS.retryQueue)
        .orderBy("createdAt", "desc")
        .limit(50);
      if (input.status) q = q.where("status", "==", input.status);
      const snap = await q.get();
      return snap.docs.map((d) => ({
        id: d.id,
        ...(serialize(d.data()) as Record<string, unknown>),
      }));
    }),

  /**
   * 큐 entry 재시도 — status=PENDING 으로 되돌리고 attemptCount 증가.
   * 실제 재처리는 별도 cron / trigger 가 PENDING 인 entry 를 처리.
   */
  retryEntry: superAdminProcedure
    .input(z.object({ entryId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.retryQueue).doc(input.entryId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "큐 entry 를 찾을 수 없습니다." });
      }
      const data = snap.data() as { type?: string };
      await ref.update({
        status: "PENDING",
        attemptCount: FieldValue.increment(1),
        lastRetryAt: FieldValue.serverTimestamp(),
        lastRetryById: ctx.uid,
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "RETRY_QUEUE_REPLAYED",
        targetType: "RetryQueue",
        targetId: input.entryId,
        after: { type: data.type ?? null },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 큐 entry 취소 — status=CANCELLED 마킹.
   */
  cancelEntry: superAdminProcedure
    .input(z.object({ entryId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.retryQueue).doc(input.entryId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "큐 entry 를 찾을 수 없습니다." });
      }
      await ref.update({
        status: "CANCELLED",
        cancelledById: ctx.uid,
        cancelledAt: FieldValue.serverTimestamp(),
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "RETRY_QUEUE_CANCELLED",
        targetType: "RetryQueue",
        targetId: input.entryId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 허용 컬렉션 list — UI dropdown 용.
   */
  listCollections: superAdminProcedure.query(() => {
    return [...ALLOWED_COLLECTIONS];
  }),
});
