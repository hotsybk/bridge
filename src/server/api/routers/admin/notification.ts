import { TRPCError } from "@trpc/server";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// schema
// ─────────────────────────────────────────────────────────────

const TemplateEnum = z.enum([
  "VENDOR_APPROVED",
  "VENDOR_REJECTED",
  "VENDOR_SUSPENDED",
  "VENDOR_REOPENED",
  "PRODUCT_APPROVED",
  "PRODUCT_REJECTED",
  "PRODUCT_REVISION",
  "ORDER_NEW",
  "ORDER_SHIPPED",
  "ORDER_REFUNDED",
  "DISPUTE_OPENED",
  "DISPUTE_RESOLVED",
  "GROUPBUY_FULFILLED",
  "GROUPBUY_FAILED",
  "SETTLEMENT_APPROVED",
  "SETTLEMENT_PAID",
  "HOSPITAL_NOTICE",
  "VENDOR_NOTICE",
]);

const TargetSegmentEnum = z.enum([
  "ALL_HOSPITALS",
  "ACTIVE_HOSPITALS_30D",
  "INACTIVE_HOSPITALS_90D",
  "ALL_VENDORS",
  "APPROVED_VENDORS",
  "BY_CATEGORY",
  "CUSTOM",
]);

export type NotificationItem = {
  id: string;
  targetType?: "HOSPITAL" | "VENDOR" | "USER";
  targetId?: string;
  type?: string;
  title?: string;
  body?: string;
  channels?: string[];
  kakaoSent?: boolean;
  emailSent?: boolean;
  errorReason?: string | null;
  isBulk?: boolean;
  sentByAdminId?: string;
  scheduledAt?: Timestamp | null;
  createdAt?: Timestamp | null;
};

// ─────────────────────────────────────────────────────────────
// router
// ─────────────────────────────────────────────────────────────

export const adminNotificationRouter = createTRPCRouter({
  /**
   * 발송 이력 list — notifications 컬렉션.
   */
  list: adminProcedure
    .input(
      z.object({
        type: z.string().optional(),
        targetType: z.enum(["HOSPITAL", "VENDOR", "USER"]).optional(),
        pageSize: z.number().min(1).max(100).default(30),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{
        notifications: NotificationItem[];
        hasMore: boolean;
        nextCursor?: string;
      }> => {
        const db = adminDb();
        let q: FirebaseFirestore.Query = db
          .collection(COLLECTIONS.notifications)
          .orderBy("createdAt", "desc")
          .limit(input.pageSize + 1);

        if (input.type) q = q.where("type", "==", input.type);
        if (input.targetType) q = q.where("targetType", "==", input.targetType);
        if (input.cursor) {
          const cursorSnap = await db
            .collection(COLLECTIONS.notifications)
            .doc(input.cursor)
            .get();
          if (cursorSnap.exists) q = q.startAfter(cursorSnap);
        }

        const snap = await q.get();
        const items: NotificationItem[] = snap.docs.map((d) => {
          const data = d.data() as Omit<NotificationItem, "id">;
          return { id: d.id, ...data };
        });

        const hasMore = items.length > input.pageSize;
        const trimmed = hasMore ? items.slice(0, -1) : items;
        const nextCursor = hasMore
          ? trimmed[trimmed.length - 1]?.id
          : undefined;
        return { notifications: trimmed, hasMore, nextCursor };
      },
    ),

  /**
   * 발송 KPI — 이번달 발송량 / 성공률 / 실패 / 활성 템플릿.
   */
  counts: adminProcedure.query(async () => {
    const db = adminDb();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const snap = await db.collection(COLLECTIONS.notifications).get();
    const items = snap.docs.map(
      (d) =>
        d.data() as {
          createdAt?: Timestamp;
          kakaoSent?: boolean;
          emailSent?: boolean;
          errorReason?: string | null;
        },
    );

    const monthly = items.filter((n) => {
      const ts = n.createdAt?.toMillis?.() ?? 0;
      return ts >= monthStart.getTime();
    });

    const sent = items.filter(
      (n) => n.kakaoSent === true || n.emailSent === true,
    );
    const failed = items.filter(
      (n) => n.errorReason && !n.kakaoSent && !n.emailSent,
    );
    const successRate =
      items.length > 0 ? (sent.length / items.length) * 100 : 100;

    return {
      monthlySent: monthly.length,
      successRate: Math.round(successRate * 10) / 10,
      failedCount: failed.length,
      activeTemplates: 18,
    };
  }),

  /**
   * 운영자 일괄 발송 — segment 지정.
   */
  bulkSend: adminProcedure
    .input(
      z.object({
        template: TemplateEnum,
        title: z.string().min(1).max(60),
        body: z.string().min(1).max(1000),
        segment: TargetSegmentEnum,
        categoryIds: z.array(z.string()).optional(),
        scheduledAt: z.union([z.string(), z.date()]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();

      let targetIds: Array<{ type: "HOSPITAL" | "VENDOR"; id: string }> = [];

      if (
        input.segment === "ALL_HOSPITALS" ||
        input.segment === "ACTIVE_HOSPITALS_30D" ||
        input.segment === "INACTIVE_HOSPITALS_90D"
      ) {
        const snap = await db.collection(COLLECTIONS.hospitals).get();
        const items = snap.docs.map(
          (d) =>
            ({ id: d.id, ...d.data() }) as {
              id: string;
              kpi?: { lastActiveAt?: Timestamp };
            },
        );
        const now = Date.now();
        const day30 = now - 30 * 86400 * 1000;
        const day90 = now - 90 * 86400 * 1000;

        let filtered = items;
        if (input.segment === "ACTIVE_HOSPITALS_30D") {
          filtered = items.filter((h) => {
            const last = h.kpi?.lastActiveAt?.toMillis?.() ?? 0;
            return last >= day30;
          });
        } else if (input.segment === "INACTIVE_HOSPITALS_90D") {
          filtered = items.filter((h) => {
            const last = h.kpi?.lastActiveAt?.toMillis?.() ?? 0;
            return last < day90;
          });
        }
        targetIds = filtered.map((h) => ({ type: "HOSPITAL" as const, id: h.id }));
      } else if (
        input.segment === "ALL_VENDORS" ||
        input.segment === "APPROVED_VENDORS"
      ) {
        let q: FirebaseFirestore.Query = db.collection(COLLECTIONS.vendors);
        if (input.segment === "APPROVED_VENDORS") {
          q = q.where("status", "==", "APPROVED");
        }
        const snap = await q.get();
        targetIds = snap.docs.map((d) => ({
          type: "VENDOR" as const,
          id: d.id,
        }));
      }

      // 한도: 1회 1000건 (Firestore batch 한계)
      if (targetIds.length > 1000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `대상이 ${targetIds.length}명 — 1회 1000건 한도 초과. segment를 좁혀 다시 시도하세요.`,
        });
      }

      if (targetIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "대상이 없습니다. segment를 확인하세요.",
        });
      }

      const now = FieldValue.serverTimestamp();
      const scheduledAt = input.scheduledAt
        ? typeof input.scheduledAt === "string"
          ? new Date(input.scheduledAt)
          : input.scheduledAt
        : null;

      const batch = db.batch();
      for (const target of targetIds) {
        const ref = db.collection(COLLECTIONS.notifications).doc();
        batch.set(ref, {
          targetType: target.type,
          targetId: target.id,
          type: input.template,
          title: input.title,
          body: input.body,
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          sentByAdminId: ctx.uid,
          isBulk: true,
          scheduledAt: scheduledAt ?? null,
          createdAt: now,
        });
      }
      await batch.commit();

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "NOTIFICATION_BULK_SENT",
        targetType: "Notification",
        targetId: "batch",
        after: {
          template: input.template,
          segment: input.segment,
          targetCount: targetIds.length,
          scheduledAt: scheduledAt?.toISOString() ?? null,
        },
        createdAt: now,
      });

      return { queued: targetIds.length };
    }),

  /**
   * 실패 notification 단건 재시도 — 새 doc 추가로 onNotificationCreated trigger 재발화.
   */
  retry: adminProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.notifications)
        .doc(input.notificationId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "원본 notification을 찾을 수 없습니다.",
        });
      }

      const data = snap.data() as Record<string, unknown>;
      await db.collection(COLLECTIONS.notifications).add({
        ...data,
        kakaoSent: false,
        emailSent: false,
        errorReason: null,
        retryOf: input.notificationId,
        retriedByAdminId: ctx.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "NOTIFICATION_RETRIED",
        targetType: "Notification",
        targetId: input.notificationId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * Solapi 잔액·일일 한도 — env 미설정 시 MOCK 상태 반환.
   */
  solapiStatus: adminProcedure.query(async () => {
    const apiKey = process.env.SOLAPI_API_KEY;
    if (!apiKey) {
      return {
        balance: 0,
        currency: "KRW" as const,
        dailyLimit: 10000,
        dailyUsed: 0,
        status: "MOCK" as const,
      };
    }
    // TODO: Solapi balance API 실 호출 (Phase 3+).
    return {
      balance: 0,
      currency: "KRW" as const,
      dailyLimit: 10000,
      dailyUsed: 0,
      status: "OK" as const,
    };
  }),
});
