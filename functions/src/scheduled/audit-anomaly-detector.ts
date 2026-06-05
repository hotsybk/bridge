// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error(
    "functions/scheduled/audit-anomaly-detector must be used only on the server side.",
  );
}

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp} from "../lib/firestore";

type Severity = "warning" | "error" | "critical";

type Anomaly = {
  type: string;
  severity: Severity;
  title: string;
  message: string;
  meta: Record<string, unknown>;
};

/**
 * Audit anomaly detector — 매시간 정각.
 *
 * 감지 패턴:
 *  1) 권한 변경 폭주 (5분 내 STAFF_ROLE_UPDATED + STAFF_DEACTIVATED ≥ 3건) — critical
 *  2) 운영자 액션 폭주 (1시간 내 한 actor ≥ 50건) — warning
 *  3) 새벽 시간대 SUPER_ADMIN 액션 (KST 00:00~05:00) — warning
 *  4) 환불 폭주 (5분 내 ORDER_FORCE_REFUND ≥ 5건) — error
 *  5) 상품 거부 폭주 (1시간 내 한 actor PRODUCT_REJECTED ≥ 10건) — warning
 *
 * 감지된 anomaly 는 `_systemAlerts` 에 적재. 중복 방지를 위해
 * 같은 type 의 최근 1시간 alert 가 있으면 skip. critical 은 SUPER_ADMIN 전원에게
 * in-app + email 알림 발송 (notifications 컬렉션 적재 — Wave A 발송 Function 이 처리).
 */
export const auditAnomalyDetector = onSchedule(
  {
    schedule: "0 * * * *", // 매시간 정각
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    logger.info("[audit-anomaly-detector] start");

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const tsHourAgo = Timestamp.fromDate(hourAgo);
    const tsFiveMinsAgo = Timestamp.fromDate(fiveMinsAgo);

    const anomalies: Anomaly[] = [];

    // ── 1) 권한 변경 폭주 ───────────────────────────────────────
    try {
      const roleChanges = await db
        .collection("auditLogs")
        .where("action", "in", ["STAFF_ROLE_UPDATED", "STAFF_DEACTIVATED"])
        .where("createdAt", ">=", tsFiveMinsAgo)
        .get();
      if (roleChanges.size >= 3) {
        anomalies.push({
          type: "rapid_role_changes",
          severity: "critical",
          title: "권한 변경 폭주 감지",
          message: `최근 5분 내 ${roleChanges.size}건의 권한 변경`,
          meta: {count: roleChanges.size, period: "5min"},
        });
      }
    } catch (err) {
      logger.warn("[audit-anomaly-detector] rapid_role_changes failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 2) 운영자 액션 폭주 ─────────────────────────────────────
    try {
      const adminActions = await db
        .collection("auditLogs")
        .where("actorRole", "in", ["ADMIN", "SUPER_ADMIN"])
        .where("createdAt", ">=", tsHourAgo)
        .limit(500)
        .get();
      const byActor = new Map<string, number>();
      for (const doc of adminActions.docs) {
        const actorId = (doc.data() as {actorId?: string}).actorId;
        if (actorId) byActor.set(actorId, (byActor.get(actorId) ?? 0) + 1);
      }
      for (const [actorId, count] of byActor) {
        if (count >= 50) {
          anomalies.push({
            type: "admin_action_flood",
            severity: "warning",
            title: "운영자 액션 폭주",
            message: `운영자 ${actorId}가 최근 1시간 내 ${count}건 액션`,
            meta: {actorId, count, period: "1h"},
          });
        }
      }
    } catch (err) {
      logger.warn("[audit-anomaly-detector] admin_action_flood failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 3) 새벽 시간대 SUPER_ADMIN 액션 ─────────────────────────
    try {
      const kstHour = (now.getUTCHours() + 9) % 24;
      if (kstHour >= 0 && kstHour < 5) {
        const nightActions = await db
          .collection("auditLogs")
          .where("actorRole", "==", "SUPER_ADMIN")
          .where("createdAt", ">=", tsHourAgo)
          .get();
        if (nightActions.size >= 1) {
          anomalies.push({
            type: "off_hour_super_admin",
            severity: "warning",
            title: "새벽 시간대 SUPER_ADMIN 액션",
            message: `KST ${String(kstHour).padStart(2, "0")}:00 시간대 ${nightActions.size}건`,
            meta: {count: nightActions.size, kstHour},
          });
        }
      }
    } catch (err) {
      logger.warn("[audit-anomaly-detector] off_hour_super_admin failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 4) 결제 환불 폭주 ───────────────────────────────────────
    try {
      const refunds = await db
        .collection("auditLogs")
        .where("action", "==", "ORDER_FORCE_REFUND")
        .where("createdAt", ">=", tsFiveMinsAgo)
        .get();
      if (refunds.size >= 5) {
        anomalies.push({
          type: "rapid_refunds",
          severity: "error",
          title: "환불 폭주 감지",
          message: `최근 5분 내 ${refunds.size}건 강제 환불`,
          meta: {count: refunds.size, period: "5min"},
        });
      }
    } catch (err) {
      logger.warn("[audit-anomaly-detector] rapid_refunds failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 5) 상품 거부 폭주 (단일 운영자) ─────────────────────────
    try {
      const productRejections = await db
        .collection("auditLogs")
        .where("action", "==", "PRODUCT_REJECTED")
        .where("createdAt", ">=", tsHourAgo)
        .get();
      const rejectByActor = new Map<string, number>();
      for (const doc of productRejections.docs) {
        const actorId = (doc.data() as {actorId?: string}).actorId;
        if (actorId) {
          rejectByActor.set(actorId, (rejectByActor.get(actorId) ?? 0) + 1);
        }
      }
      for (const [actorId, count] of rejectByActor) {
        if (count >= 10) {
          anomalies.push({
            type: "rapid_product_rejections",
            severity: "warning",
            title: "상품 거부 폭주",
            message: `운영자 ${actorId}가 최근 1시간 내 ${count}건 상품 거부`,
            meta: {actorId, count, period: "1h"},
          });
        }
      }
    } catch (err) {
      logger.warn("[audit-anomaly-detector] rapid_product_rejections failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 감지된 anomaly 처리 ─────────────────────────────────────
    let pushed = 0;
    for (const anomaly of anomalies) {
      // 중복 방지: 최근 1시간 내 같은 type alert 가 있으면 skip
      try {
        const recent = await db
          .collection("_systemAlerts")
          .where("type", "==", anomaly.type)
          .where("createdAt", ">=", tsHourAgo)
          .limit(1)
          .get();
        if (!recent.empty) continue;
      } catch (err) {
        logger.warn(`[audit-anomaly-detector] dedupe check failed for ${anomaly.type}`, {
          err: err instanceof Error ? err.message : String(err),
        });
        // dedupe 확인 실패 시 안전한 쪽으로 — alert 생성은 그대로 진행
      }

      try {
        await db.collection("_systemAlerts").add({
          type: anomaly.type,
          severity: anomaly.severity,
          title: anomaly.title,
          message: anomaly.message,
          payload: anomaly.meta,
          acknowledged: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        pushed++;
      } catch (err) {
        logger.warn(`[audit-anomaly-detector] alert push failed for ${anomaly.type}`, {
          err: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      // critical 은 SUPER_ADMIN 전원에게 즉시 알림
      if (anomaly.severity === "critical") {
        try {
          const superAdmins = await db
            .collection("users")
            .where("role", "==", "SUPER_ADMIN")
            .get();
          for (const superAdmin of superAdmins.docs) {
            await db.collection("notifications").add({
              targetType: "USER",
              targetId: superAdmin.id,
              type: "SECURITY_ALERT",
              title: anomaly.title,
              body: anomaly.message,
              channels: ["EMAIL", "IN_APP"],
              kakaoSent: false,
              emailSent: false,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        } catch (err) {
          logger.warn(
            `[audit-anomaly-detector] SUPER_ADMIN notify failed for ${anomaly.type}`,
            {err: err instanceof Error ? err.message : String(err)},
          );
        }
      }
    }

    // ── audit ─────────────────────────────────────────────────
    if (anomalies.length > 0) {
      try {
        await db.collection("auditLogs").add({
          actorId: "system",
          actorRole: "SYSTEM",
          action: "ANOMALY_DETECTOR_RUN",
          targetType: "SystemAlert",
          targetId: "batch",
          after: {
            detected: anomalies.length,
            pushed,
            types: anomalies.map((a) => a.type),
          },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.warn("[audit-anomaly-detector] audit log write failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("[audit-anomaly-detector] done", {
      detected: anomalies.length,
      pushed,
    });
  },
);
