import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { enforceRateLimit } from "@/server/lib/rate-limit";

/**
 * Wave AA — 마케팅 보조 페이지 (/support/contact) 의 문의 폼 처리.
 *
 * 비로그인 사용자도 제출 가능하므로 publicProcedure 로 노출.
 * Firestore `supportInquiries` 컬렉션에 적재되고, admin 큐 알림이 함께 발행된다.
 */
export const supportRouter = createTRPCRouter({
  submitInquiry: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        company: z.string().max(120).optional(),
        email: z.string().email(),
        phone: z.string().max(40).optional(),
        category: z.enum(["ACCOUNT", "PAYMENT", "ORDER", "ONBOARDING", "OTHER"]),
        message: z.string().min(10).max(2000),
        consentToPrivacy: z.literal(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = adminDb();

      // Σ-3 — IP 기반 rate limit (email 변경 우회 차단): 10분 10건
      await enforceRateLimit({
        key: `support:${ctx.ip ?? "unknown"}`,
        limit: 10,
        windowSec: 600,
      });

      // Phase β-3 작업 4 — rate limit (email 기반, 기존).
      // 같은 이메일이 5분 내 3건 이상 제출 시 차단.
      // (reCAPTCHA 는 별도 작업으로 분리 — Phase γ 또는 δ)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentSnap = await db
        .collection("supportInquiries")
        .where("email", "==", input.email)
        .where("createdAt", ">=", Timestamp.fromDate(fiveMinAgo))
        .count()
        .get();
      if (recentSnap.data().count >= 3) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "5분에 최대 3건까지만 문의할 수 있습니다.",
        });
      }

      const ref = await db.collection("supportInquiries").add({
        name: input.name,
        company: input.company ?? null,
        email: input.email,
        phone: input.phone ?? null,
        category: input.category,
        message: input.message,
        consentToPrivacy: input.consentToPrivacy,
        userId: ctx.uid ?? null,
        status: "OPEN",
        createdAt: FieldValue.serverTimestamp(),
      });

      // 운영자 큐 알림 — 관리자 대시보드에서 노출
      await db.collection("notifications").add({
        targetType: "ADMIN_QUEUE",
        targetId: "support",
        type: "SUPPORT_INQUIRY_RECEIVED",
        title: `새 문의: ${input.category}`,
        body: `${input.name} (${input.email}) — ${input.message.slice(0, 100)}`,
        channels: ["IN_APP"],
        inquiryId: ref.id,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { inquiryId: ref.id, ok: true };
    }),
});
