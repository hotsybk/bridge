// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error(
    "functions/scheduled/metrics-hourly must be used only on the server side.",
  );
}

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp, COLLECTIONS} from "../lib/firestore";

/**
 * 시간별 metrics 집계 cron — 매시간 정각 KST.
 *
 * `_metricsSnapshots/{YYYY-MM-DDTHH}` 문서로 적재.
 *
 * 집계 필드:
 *   - dau                          (오늘 orders 의 distinct userId 수)
 *   - mau                          (이번달 orders 의 distinct userId 수)
 *   - paymentSuccessRate           (지난 1h orders 중 payment.status=PAID 비율)
 *   - alimtalkSuccessRate          (지난 1h notifications 중 kakaoSent=true 비율)
 *   - gmvToday                     (오늘 PAID orders 의 finalAmount 합)
 *   - gmvHour                      (지난 1h PAID orders 의 finalAmount 합)
 *   - cloudFunctionErrorRate       (지난 1h _retryQueue 비율 — auditLogs 대비)
 *   - newOrdersHour, newOrdersDay
 *   - notificationsHour
 */
export const metricsHourly = onSchedule(
  {
    schedule: "0 * * * *", // 매시 0분
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    logger.info("[metrics-hourly] start");

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const tsHourAgo = Timestamp.fromDate(hourAgo);
    const tsTodayStart = Timestamp.fromDate(todayStart);
    const tsMonthStart = Timestamp.fromDate(monthStart);

    // snapshot id: YYYY-MM-DDTHH (KST). 시 단위 — 같은 시각 중복 실행 시 덮어쓰기.
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const snapshotId =
      kstNow.toISOString().slice(0, 13).replace("T", "T"); // YYYY-MM-DDTHH

    // ── 1) Orders 집계 ──────────────────────────────────────────
    let dau = 0;
    let mau = 0;
    let newOrdersHour = 0;
    let newOrdersDay = 0;
    let paidHour = 0;
    let paymentSuccessRate = 1;
    let gmvHour = 0;
    let gmvToday = 0;

    try {
      // 오늘 orders (DAU + GMV today)
      const todaySnap = await db
        .collection(COLLECTIONS.orders)
        .where("createdAt", ">=", tsTodayStart)
        .get();
      const userSetDay = new Set<string>();
      for (const doc of todaySnap.docs) {
        const data = doc.data() as {
          userId?: string;
          createdAt?: Timestamp;
          finalAmount?: number;
          payment?: {status?: string};
        };
        if (data.userId) userSetDay.add(data.userId);
        newOrdersDay++;
        if (data.payment?.status === "PAID") {
          gmvToday += data.finalAmount ?? 0;
        }
        if (data.createdAt && data.createdAt.toMillis() >= hourAgo.getTime()) {
          newOrdersHour++;
          if (data.payment?.status === "PAID") {
            paidHour++;
            gmvHour += data.finalAmount ?? 0;
          }
        }
      }
      dau = userSetDay.size;
      paymentSuccessRate =
        newOrdersHour > 0 ? paidHour / newOrdersHour : 1;
    } catch (err) {
      logger.warn("[metrics-hourly] orders aggregate failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      // 이번달 orders (MAU)
      const monthSnap = await db
        .collection(COLLECTIONS.orders)
        .where("createdAt", ">=", tsMonthStart)
        .get();
      const userSetMonth = new Set<string>();
      for (const doc of monthSnap.docs) {
        const data = doc.data() as {userId?: string};
        if (data.userId) userSetMonth.add(data.userId);
      }
      mau = userSetMonth.size;
    } catch (err) {
      logger.warn("[metrics-hourly] mau aggregate failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 2) Notifications 집계 ───────────────────────────────────
    let notificationsHour = 0;
    let kakaoSentHour = 0;
    let alimtalkSuccessRate = 1;

    try {
      const notifSnap = await db
        .collection(COLLECTIONS.notifications)
        .where("createdAt", ">=", tsHourAgo)
        .get();
      for (const doc of notifSnap.docs) {
        const data = doc.data() as {kakaoSent?: boolean};
        notificationsHour++;
        if (data.kakaoSent === true) kakaoSentHour++;
      }
      alimtalkSuccessRate =
        notificationsHour > 0 ? kakaoSentHour / notificationsHour : 1;
    } catch (err) {
      logger.warn("[metrics-hourly] notifications aggregate failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 3) Cloud Function 에러율 (_retryQueue this hour 비율) ──
    let retryCount = 0;
    let auditLogsHour = 0;
    let cloudFunctionErrorRate = 0;

    try {
      const retrySnap = await db
        .collection(COLLECTIONS.retryQueue)
        .where("createdAt", ">=", tsHourAgo)
        .get();
      retryCount = retrySnap.size;
    } catch (err) {
      logger.warn("[metrics-hourly] retry queue aggregate failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const auditSnap = await db
        .collection(COLLECTIONS.auditLogs)
        .where("createdAt", ">=", tsHourAgo)
        .get();
      auditLogsHour = auditSnap.size;
      cloudFunctionErrorRate =
        auditLogsHour > 0 ? retryCount / auditLogsHour : 0;
    } catch (err) {
      logger.warn("[metrics-hourly] audit logs aggregate failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 4) snapshot 적재 ────────────────────────────────────────
    const snapshot = {
      snapshotId,
      hourStart: Timestamp.fromDate(
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0),
      ),
      dau,
      mau,
      paymentSuccessRate: Math.round(paymentSuccessRate * 10000) / 10000,
      alimtalkSuccessRate: Math.round(alimtalkSuccessRate * 10000) / 10000,
      cloudFunctionErrorRate: Math.round(cloudFunctionErrorRate * 10000) / 10000,
      gmvHour,
      gmvToday,
      newOrdersHour,
      newOrdersDay,
      notificationsHour,
      kakaoSentHour,
      retryCount,
      auditLogsHour,
      createdAt: FieldValue.serverTimestamp(),
    };

    try {
      await db
        .collection("_metricsSnapshots")
        .doc(snapshotId)
        .set(snapshot, {merge: true});
      logger.info("[metrics-hourly] snapshot saved", {...snapshot});
    } catch (err) {
      logger.error("[metrics-hourly] snapshot save failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[metrics-hourly] done");
  },
);
