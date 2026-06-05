import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────────────────────

export type SystemAlertItem = {
  id: string;
  type?: string;
  severity?: "INFO" | "WARNING" | "ERROR" | string;
  title?: string;
  message?: string;
  acknowledged?: boolean;
  payload?: Record<string, unknown>;
  // 자유 필드 (alert 타입마다 다름)
  orderId?: string;
  disputeId?: string;
  vendorId?: string;
  hospitalId?: string;
  serviceKey?: string;
  latencyMs?: number;
  createdAt?: Timestamp | null;
};

export type MetricsSnapshot = {
  snapshotId: string;
  dau: number;
  mau: number;
  paymentSuccessRate: number;
  alimtalkSuccessRate: number;
  cloudFunctionErrorRate: number;
  gmvHour: number;
  gmvToday: number;
  newOrdersHour: number;
  newOrdersDay: number;
  notificationsHour: number;
  kakaoSentHour: number;
  retryCount: number;
  auditLogsHour: number;
  hourStart?: Timestamp | null;
  createdAt?: Timestamp | null;
};

export type ServiceHealthItem = {
  key: string;
  name?: string;
  url?: string;
  state?: "OK" | "DEGRADED" | "DOWN";
  latencyMs?: number;
  statusCode?: number | null;
  reason?: string | null;
  lastCheckedAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

// ─────────────────────────────────────────────────────────────
// router
// ─────────────────────────────────────────────────────────────

export const adminMonitoringRouter = createTRPCRouter({
  /**
   * _systemAlerts 컬렉션 최신 N건.
   * Cloud Function 에서 dispute opened / payment failed / SLA 임박 / service DOWN 등 push.
   */
  systemAlerts: adminProcedure
    .input(
      z.object({
        pageSize: z.number().min(1).max(100).default(20),
        includeAcknowledged: z.boolean().default(false),
      }),
    )
    .query(async ({ input }): Promise<SystemAlertItem[]> => {
      const db = adminDb();
      let query = db
        .collection("_systemAlerts")
        .orderBy("createdAt", "desc")
        .limit(input.pageSize);
      // Phase γ-1 — 기본은 미확인 alert 만 표시.
      // includeAcknowledged=true 일 때 ack 된 것도 함께.
      if (!input.includeAcknowledged) {
        // acknowledged != true 인 doc — Firestore는 != 쿼리가 비효율적이라
        // in-memory filter 로 단순 처리. 200개 이상 ack 없으면 client filter.
        query = db
          .collection("_systemAlerts")
          .orderBy("createdAt", "desc")
          .limit(Math.min(input.pageSize * 3, 100));
      }
      const snap = await query.get();
      const all = snap.docs.map((d) => {
        const data = d.data() as Omit<SystemAlertItem, "id">;
        return { id: d.id, ...data };
      });
      const items = input.includeAcknowledged
        ? all
        : all.filter((a) => !a.acknowledged);
      return items.slice(0, input.pageSize);
    }),

  /**
   * _systemAlerts ack — 운영자가 alert 를 확인 처리.
   * Phase γ-1.
   */
  ackAlert: adminProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection("_systemAlerts").doc(input.alertId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "알림을 찾을 수 없습니다.",
        });
      }
      const now = FieldValue.serverTimestamp();
      await ref.update({
        acknowledged: true,
        acknowledgedBy: ctx.uid,
        acknowledgedAt: now,
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "SYSTEM_ALERT_ACK",
        targetType: "SystemAlert",
        targetId: input.alertId,
        createdAt: now,
      });
      return { ok: true };
    }),

  /**
   * 최신 metrics snapshot — _metricsSnapshots 의 가장 최근 doc.
   * Wave T 에서 hourly cron 으로 적재.
   * snapshot 없으면 기본 mock 반환 (PREVIEW fallback).
   */
  metrics: adminProcedure.query(async () => {
    const db = adminDb();
    const snap = await db
      .collection("_metricsSnapshots")
      .orderBy("hourStart", "desc")
      .limit(1)
      .get();
    if (snap.empty) {
      return {
        dau: 0,
        mau: 0,
        paymentSuccessRate: 0,
        alimtalkSuccessRate: 0,
        cloudFunctionErrorRate: 0,
        gmvHour: 0,
        gmvToday: 0,
        newOrdersHour: 0,
        newOrdersDay: 0,
        notificationsHour: 0,
        kakaoSentHour: 0,
        retryCount: 0,
        auditLogsHour: 0,
        snapshotId: "",
        hasData: false as const,
      };
    }
    const data = snap.docs[0].data() as MetricsSnapshot;
    return {
      dau: data.dau ?? 0,
      mau: data.mau ?? 0,
      paymentSuccessRate: data.paymentSuccessRate ?? 0,
      alimtalkSuccessRate: data.alimtalkSuccessRate ?? 0,
      cloudFunctionErrorRate: data.cloudFunctionErrorRate ?? 0,
      gmvHour: data.gmvHour ?? 0,
      gmvToday: data.gmvToday ?? 0,
      newOrdersHour: data.newOrdersHour ?? 0,
      newOrdersDay: data.newOrdersDay ?? 0,
      notificationsHour: data.notificationsHour ?? 0,
      kakaoSentHour: data.kakaoSentHour ?? 0,
      retryCount: data.retryCount ?? 0,
      auditLogsHour: data.auditLogsHour ?? 0,
      snapshotId: data.snapshotId ?? snap.docs[0].id,
      hasData: true as const,
    };
  }),

  /**
   * metrics 시계열 — 최근 N 시간의 hourly snapshot.
   * 차트용. 빈 hour 도 0 으로 채워야 깔끔하지만 일단 있는 doc 만 반환.
   */
  metricsHistory: adminProcedure
    .input(
      z.object({ hours: z.number().min(1).max(168).default(24) }),
    )
    .query(async ({ input }) => {
      const db = adminDb();
      const snap = await db
        .collection("_metricsSnapshots")
        .orderBy("hourStart", "desc")
        .limit(input.hours)
        .get();
      const items = snap.docs.map((d) => {
        const data = d.data() as MetricsSnapshot;
        return {
          snapshotId: d.id,
          hourStart: data.hourStart ?? null,
          dau: data.dau ?? 0,
          gmvHour: data.gmvHour ?? 0,
          gmvToday: data.gmvToday ?? 0,
          paymentSuccessRate: data.paymentSuccessRate ?? 0,
          alimtalkSuccessRate: data.alimtalkSuccessRate ?? 0,
          cloudFunctionErrorRate: data.cloudFunctionErrorRate ?? 0,
          newOrdersHour: data.newOrdersHour ?? 0,
          notificationsHour: data.notificationsHour ?? 0,
        };
      });
      // 시간 오름차순으로 반환 (차트 그릴 때 편함)
      items.reverse();
      return items;
    }),

  /**
   * _serviceHealth — PortOne / Solapi / SendGrid 등 외부 의존성 상태.
   */
  serviceHealth: adminProcedure.query(async (): Promise<ServiceHealthItem[]> => {
    const db = adminDb();
    const snap = await db.collection("_serviceHealth").get();
    return snap.docs.map((d) => {
      const data = d.data() as Omit<ServiceHealthItem, "key">;
      return { key: d.id, ...data };
    });
  }),

  /**
   * _systemAlerts 의 anomaly type 별 집계 — 최근 N일.
   * Wave W audit-anomaly-detector cron 이 적재한 alert 들의 분포를 본다.
   */
  anomaliesByType: adminProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(7) }))
    .query(async ({ input }): Promise<Array<{ type: string; count: number }>> => {
      const db = adminDb();
      const from = new Date(Date.now() - input.days * 86400 * 1000);
      const snap = await db
        .collection("_systemAlerts")
        .where("createdAt", ">=", from)
        .get();
      const byType = new Map<string, number>();
      for (const doc of snap.docs) {
        const t = (doc.data() as { type?: string }).type;
        if (t) byType.set(t, (byType.get(t) ?? 0) + 1);
      }
      return [...byType.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
    }),
});
