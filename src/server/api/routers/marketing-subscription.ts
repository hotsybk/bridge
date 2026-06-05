// Phase ν-5 작업2 — 출시 알림 신청 mutation (/groupbuys, /rfq 등).
//
// Firestore /marketingSubscriptions/{id} 에 적재. 같은 (email, type) 조합은 dedupe.
// publicProcedure — 비로그인 사용자도 가입 가능. ctx.uid 있으면 함께 기록.
//
// 운영자가 추후 출시 시 일괄 발송 cron 또는 admin 수동 발송 사용.

import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";

export const MARKETING_SUBSCRIPTION_TYPES = [
  "GROUPBUY_LAUNCH",
  "RFQ_LAUNCH",
  "SUBSCRIPTION_LAUNCH",
  "GENERAL",
] as const;

export const marketingSubscriptionRouter = createTRPCRouter({
  /**
   * 출시 알림 신청.
   * - 같은 (email, type) 조합이 이미 있으면 idempotent ok 반환 (재제출에도 사용자 친화적).
   * - 5분 내 같은 email 이 5건 이상 제출 시 throw.
   */
  subscribe: publicProcedure
    .input(
      z.object({
        type: z.enum(MARKETING_SUBSCRIPTION_TYPES),
        email: z.string().email().max(200),
        categories: z.array(z.string().max(60)).max(20).optional(),
        consentToMarketing: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();

      // Rate limit — 5분에 5건
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentSnap = await db
        .collection("marketingSubscriptions")
        .where("email", "==", input.email)
        .where("createdAt", ">=", Timestamp.fromDate(fiveMinAgo))
        .count()
        .get();
      if (recentSnap.data().count >= 5) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "5분에 최대 5건까지만 알림을 신청할 수 있습니다.",
        });
      }

      // Dedupe — 같은 (email, type) 이 이미 있으면 OK 반환
      const dupSnap = await db
        .collection("marketingSubscriptions")
        .where("email", "==", input.email)
        .where("type", "==", input.type)
        .limit(1)
        .get();
      if (!dupSnap.empty) {
        return {
          ok: true,
          subscriptionId: dupSnap.docs[0]!.id,
          alreadySubscribed: true,
        };
      }

      const ref = await db.collection("marketingSubscriptions").add({
        type: input.type,
        email: input.email,
        categories: input.categories ?? [],
        consentToMarketing: input.consentToMarketing,
        userId: ctx.uid ?? null,
        notifiedAt: null,
        status: "PENDING",
        source: "WEB",
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, subscriptionId: ref.id, alreadySubscribed: false };
    }),
});
