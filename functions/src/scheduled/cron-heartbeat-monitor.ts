// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/scheduled/cron-heartbeat-monitor must be used only on the server side.");
}

// Σ-3 — cron dead-man's-switch.
//
// 매시간 실행. critical 스케줄 함수들이 _serviceHealth/{name}.lastRunAt 에 남긴
// heartbeat 의 신선도를 검사 → 기대 주기보다 오래 멈춰 있으면 _systemAlerts 발생
// (on-system-alert-created 가 Slack/이메일로 외부 발송).
//
// "cron 이 조용히 죽었는데 아무도 모르는" 상황 방지.

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp} from "../lib/firestore";

type MonitoredCron = {
  name: string;
  /** 이 시간(h)보다 오래 heartbeat 가 없으면 alert */
  maxAgeHours: number;
  label: string;
};

// 감시 대상 — 기대 주기 + 여유분.
const MONITORED: MonitoredCron[] = [
  {name: "subscriptionRunner", maxAgeHours: 26, label: "정기구독 자동발주(매일 03:00)"},
  {name: "settlementDaily", maxAgeHours: 26, label: "일일 정산(매일)"},
  {name: "groupbuyCloser", maxAgeHours: 1, label: "공동구매 마감(매분)"},
  {name: "firestoreBackup", maxAgeHours: 26, label: "Firestore 백업(매일 04:00)"},
];

export const cronHeartbeatMonitor = onSchedule(
  {
    schedule: "10 * * * *", // 매시 10분
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async () => {
    const overrideHours = Number(process.env.CRON_HEARTBEAT_MAX_AGE_HOURS);
    const now = Date.now();
    const stale: Array<{name: string; label: string; ageHours: number | null}> =
      [];

    for (const cron of MONITORED) {
      const maxAge =
        Number.isFinite(overrideHours) && overrideHours > 0 ?
          overrideHours :
          cron.maxAgeHours;
      try {
        const snap = await db
          .collection("_serviceHealth")
          .doc(cron.name)
          .get();
        const data = snap.data() as {lastRunAt?: Timestamp} | undefined;
        const lastRunMs = data?.lastRunAt?.toMillis?.() ?? 0;

        // 한 번도 실행 기록이 없으면 — 배포 직후일 수 있으므로 경고만(skip alert)
        if (!lastRunMs) {
          logger.info("[cron-heartbeat] no heartbeat yet", {name: cron.name});
          continue;
        }

        const ageHours = (now - lastRunMs) / (1000 * 60 * 60);
        if (ageHours > maxAge) {
          stale.push({name: cron.name, label: cron.label, ageHours});
        }
      } catch (err) {
        logger.error("[cron-heartbeat] check failed", {
          name: cron.name,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (stale.length === 0) {
      logger.info("[cron-heartbeat] all crons healthy");
      return;
    }

    // 중복 alert 억제 — 동일 cron 에 대해 6h 내 미해결 alert 있으면 skip
    for (const s of stale) {
      try {
        const sixHoursAgo = Timestamp.fromMillis(now - 6 * 60 * 60 * 1000);
        const dup = await db
          .collection("_systemAlerts")
          .where("type", "==", "CRON_STALLED")
          .where("target", "==", s.name)
          .where("createdAt", ">=", sixHoursAgo)
          .limit(1)
          .get();
        if (!dup.empty) continue;

        await db.collection("_systemAlerts").add({
          type: "CRON_STALLED",
          severity: "critical",
          title: `cron 정지 감지: ${s.label}`,
          message:
            `${s.label} 이(가) ${
              s.ageHours === null ? "한 번도 실행되지 않음" :
                `${s.ageHours.toFixed(1)}시간째 멈춤`
            }. Cloud Scheduler / 함수 로그를 확인하세요.`,
          source: "cron-heartbeat-monitor",
          target: s.name,
          acknowledged: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        logger.warn("[cron-heartbeat] STALE", s);
      } catch (err) {
        logger.error("[cron-heartbeat] alert write failed", {
          name: s.name,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  },
);
