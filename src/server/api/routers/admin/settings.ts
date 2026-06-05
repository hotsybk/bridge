import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  superAdminProcedure,
} from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// 설정 컬렉션: /systemSettings/{section}
// section: general | payment | notification | external | security
// ─────────────────────────────────────────────────────────────

const SECTION_ENUM = z.enum([
  "general",
  "payment",
  "notification",
  "external",
  "security",
]);

const SECRET_FIELDS = [
  "apiKey",
  "apiSecret",
  "webhookSecret",
  "secretKey",
  "privateKey",
];

function maskSecrets<T extends Record<string, unknown>>(data: T): T {
  const masked: Record<string, unknown> = { ...data };
  for (const key of Object.keys(masked)) {
    if (
      SECRET_FIELDS.some((s) =>
        key.toLowerCase().includes(s.toLowerCase()),
      )
    ) {
      const val = masked[key];
      if (typeof val === "string" && val.length > 8) {
        masked[key] = val.slice(0, 4) + "•".repeat(8) + val.slice(-4);
      }
    }
  }
  return masked as T;
}

// ─────────────────────────────────────────────────────────────
// router
// ─────────────────────────────────────────────────────────────

export const adminSettingsRouter = createTRPCRouter({
  /**
   * 섹션별 설정 read — 모든 admin.
   * 비밀 키는 mask 처리 후 반환.
   */
  get: adminProcedure
    .input(z.object({ section: SECTION_ENUM }))
    .query(async ({ input }) => {
      const snap = await adminDb()
        .collection("systemSettings")
        .doc(input.section)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as Record<string, unknown>;
      if (
        input.section === "payment" ||
        input.section === "notification" ||
        input.section === "external"
      ) {
        return maskSecrets(data);
      }
      return data;
    }),

  /**
   * 일반 설정 — ADMIN 이상.
   */
  updateGeneral: adminProcedure
    .input(
      z.object({
        platformName: z.string().min(1).max(60).optional(),
        logoUrl: z.string().url().nullable().optional(),
        currency: z.enum(["KRW", "USD"]).optional(),
        timezone: z.string().optional(),
        language: z.enum(["ko", "en"]).optional(),
        supportEmail: z.string().email().optional(),
        mailorderRegNo: z.string().max(60).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      await db
        .collection("systemSettings")
        .doc("general")
        .set(
          {
            ...input,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: ctx.uid,
          },
          { merge: true },
        );
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "SETTINGS_GENERAL_UPDATED",
        targetType: "SystemSettings",
        targetId: "general",
        after: input,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 결제 설정 — SUPER_ADMIN only.
   */
  updatePayment: superAdminProcedure
    .input(
      z.object({
        portoneTestMode: z.boolean().optional(),
        portonePaymentTimeoutSec: z.number().int().positive().optional(),
        portoneRefundTimeoutSec: z.number().int().positive().optional(),
        portoneWebhookRetryCount: z.number().int().min(0).max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      await db
        .collection("systemSettings")
        .doc("payment")
        .set(
          {
            ...input,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: ctx.uid,
          },
          { merge: true },
        );
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "SETTINGS_PAYMENT_UPDATED",
        targetType: "SystemSettings",
        targetId: "payment",
        after: input,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 알림 설정 — SUPER_ADMIN only.
   */
  updateNotification: superAdminProcedure
    .input(
      z.object({
        solapiSenderNumber: z.string().optional(),
        solapiPfid: z.string().optional(),
        solapiTemplateStatus: z
          .record(
            z.string(),
            z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      await db
        .collection("systemSettings")
        .doc("notification")
        .set(
          {
            ...input,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: ctx.uid,
          },
          { merge: true },
        );
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "SETTINGS_NOTIFICATION_UPDATED",
        targetType: "SystemSettings",
        targetId: "notification",
        after: input,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 외부 통합 설정 — SUPER_ADMIN only.
   */
  updateExternal: superAdminProcedure
    .input(
      z.object({
        mfdsEndpoint: z.string().url().optional(),
        clovaOcrInvokeUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      await db
        .collection("systemSettings")
        .doc("external")
        .set(
          {
            ...input,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: ctx.uid,
          },
          { merge: true },
        );
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "SETTINGS_EXTERNAL_UPDATED",
        targetType: "SystemSettings",
        targetId: "external",
        after: input,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 보안 설정 — SUPER_ADMIN only.
   */
  updateSecurity: superAdminProcedure
    .input(
      z.object({
        rateLimitLogin: z.number().int().positive().optional(),
        rateLimitApi: z.number().int().positive().optional(),
        rateLimitPayment: z.number().int().positive().optional(),
        sessionTimeoutAdminDays: z.number().int().min(1).max(30).optional(),
        sessionTimeoutUserDays: z.number().int().min(1).max(30).optional(),
        blockedIps: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      await db
        .collection("systemSettings")
        .doc("security")
        .set(
          {
            ...input,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: ctx.uid,
          },
          { merge: true },
        );
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "SETTINGS_SECURITY_UPDATED",
        targetType: "SystemSettings",
        targetId: "security",
        after: input,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 차단 IP 추가 — SUPER_ADMIN only.
   */
  blockIp: superAdminProcedure
    .input(
      z.object({
        ip: z.string().min(1).max(64),
        reason: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection("systemSettings").doc("security");
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const current =
          ((snap.exists ? (snap.data() as { blockedIps?: string[] }).blockedIps : []) ??
            []) as string[];
        if (!current.includes(input.ip)) current.push(input.ip);
        tx.set(
          ref,
          {
            blockedIps: current,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: ctx.uid,
          },
          { merge: true },
        );
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "IP_BLOCKED",
        targetType: "SystemSettings",
        targetId: "security",
        after: { ip: input.ip, reason: input.reason ?? null },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /**
   * 차단 IP 해제 — SUPER_ADMIN only.
   */
  unblockIp: superAdminProcedure
    .input(z.object({ ip: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection("systemSettings").doc("security");
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const current = ((snap.exists
          ? (snap.data() as { blockedIps?: string[] }).blockedIps
          : []) ?? []) as string[];
        const filtered = current.filter((i) => i !== input.ip);
        tx.set(
          ref,
          {
            blockedIps: filtered,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: ctx.uid,
          },
          { merge: true },
        );
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "IP_UNBLOCKED",
        targetType: "SystemSettings",
        targetId: "security",
        after: { ip: input.ip },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),
});
