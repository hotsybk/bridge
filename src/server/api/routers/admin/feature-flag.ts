// Wave U — 기능 플래그 (FeatureFlag) 관리 router.
// 컬렉션: /featureFlags/{flagId}
// SUPER_ADMIN 만 mutate. ADMIN 도 list (조회).

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  superAdminProcedure,
} from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

const FLAG_ID_REGEX = /^[a-z0-9][a-z0-9-_.]{0,58}[a-z0-9]$/i;

const SegmentEnum = z.enum(["ALL", "HOSPITALS", "VENDORS", "INTERNAL"]);

export const adminFeatureFlagRouter = createTRPCRouter({
  /**
   * 전체 list — admin 누구나.
   */
  list: adminProcedure.query(async () => {
    const snap = await adminDb()
      .collection(COLLECTIONS.featureFlags)
      .orderBy("id")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }),

  /**
   * upsert — SUPER_ADMIN only.
   * createdAt 은 merge 로 첫 생성에만 기록되도록 setIfMissing 패턴.
   */
  upsert: superAdminProcedure
    .input(
      z.object({
        id: z
          .string()
          .min(1)
          .max(60)
          .regex(FLAG_ID_REGEX, "flag id 형식이 올바르지 않습니다."),
        description: z.string().max(200).default(""),
        enabled: z.boolean(),
        rolloutPercentage: z.number().min(0).max(100).default(100),
        segment: SegmentEnum.optional(),
        enabledByDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.featureFlags).doc(input.id);
      const existing = await ref.get();
      const payload: Record<string, unknown> = {
        id: input.id,
        description: input.description,
        enabled: input.enabled,
        rolloutPercentage: input.rolloutPercentage,
        updatedAt: FieldValue.serverTimestamp(),
        updatedById: ctx.uid,
      };
      if (input.segment !== undefined) payload.segment = input.segment;
      if (input.enabledByDefault !== undefined)
        payload.enabledByDefault = input.enabledByDefault;
      if (!existing.exists) {
        payload.createdAt = FieldValue.serverTimestamp();
      }
      await ref.set(payload, { merge: true });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: existing.exists ? "FEATURE_FLAG_UPDATED" : "FEATURE_FLAG_CREATED",
        targetType: "FeatureFlag",
        targetId: input.id,
        after: input,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 삭제 — SUPER_ADMIN only.
   */
  delete: superAdminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      await db.collection(COLLECTIONS.featureFlags).doc(input.id).delete();
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "FEATURE_FLAG_DELETED",
        targetType: "FeatureFlag",
        targetId: input.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),
});
