import { z } from "zod";
import type { Timestamp } from "firebase-admin/firestore";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────────────────────

export type AuditLogItem = {
  id: string;
  actorId?: string;
  actorRole?: string;
  actorName?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string;
  ua?: string;
  status?: "SUCCESS" | "FAILURE";
  createdAt?: Timestamp | null;
};

// ─────────────────────────────────────────────────────────────
// router
// ─────────────────────────────────────────────────────────────

export const adminAuditRouter = createTRPCRouter({
  /**
   * 감사 로그 list.
   *
   * Phase 2 단순화: 인덱스 부하 회피 위해 createdAt desc 만 사용하고,
   * actor/action/targetType 필터는 in-memory 후처리.
   * 큰 컬렉션은 Phase 3+ composite index + where 로 전환.
   */
  list: adminProcedure
    .input(
      z.object({
        actor: z.string().optional(),
        action: z.string().optional(),
        targetType: z.string().optional(),
        status: z.enum(["SUCCESS", "FAILURE"]).optional(),
        pageSize: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{
        items: AuditLogItem[];
        hasMore: boolean;
        nextCursor?: string;
      }> => {
        const db = adminDb();
        let q = db
          .collection(COLLECTIONS.auditLogs)
          .orderBy("createdAt", "desc")
          .limit(input.pageSize + 1);

        if (input.cursor) {
          const cursorSnap = await db
            .collection(COLLECTIONS.auditLogs)
            .doc(input.cursor)
            .get();
          if (cursorSnap.exists) {
            q = q.startAfter(cursorSnap);
          }
        }

        const snap = await q.get();
        let items: AuditLogItem[] = snap.docs.map((d) => {
          const data = d.data() as Omit<AuditLogItem, "id">;
          return { id: d.id, ...data };
        });

        if (input.actor) {
          items = items.filter((i) => i.actorRole === input.actor);
        }
        if (input.action) {
          items = items.filter((i) =>
            (i.action ?? "").includes(input.action!),
          );
        }
        if (input.targetType) {
          items = items.filter((i) => i.targetType === input.targetType);
        }
        if (input.status) {
          items = items.filter((i) => i.status === input.status);
        }

        const hasMore = items.length > input.pageSize;
        const trimmed = hasMore ? items.slice(0, -1) : items;
        const nextCursor = hasMore
          ? trimmed[trimmed.length - 1]?.id
          : undefined;
        return { items: trimmed, hasMore, nextCursor };
      },
    ),

  /**
   * KPI 3개 — 오늘 이벤트 / 운영자 액션 / 거부된 시도.
   */
  counts: adminProcedure.query(async () => {
    const db = adminDb();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const snap = await db
      .collection(COLLECTIONS.auditLogs)
      .where("createdAt", ">=", todayStart)
      .get();
    const items = snap.docs.map(
      (d) =>
        d.data() as {
          actorRole?: string;
          action?: string;
          status?: string;
        },
    );
    return {
      todayTotal: items.length,
      adminActions: items.filter(
        (i) => i.actorRole === "ADMIN" || i.actorRole === "SUPER_ADMIN",
      ).length,
      denied: items.filter(
        (i) =>
          (i.action ?? "").includes("DENIED") ||
          (i.action ?? "").includes("FORBIDDEN") ||
          i.status === "FAILURE",
      ).length,
    };
  }),
});
