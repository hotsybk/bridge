// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error(
    "functions/scheduled/healthcheck must be used only on the server side.",
  );
}

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp} from "../lib/firestore";

type HealthState = "OK" | "DEGRADED" | "DOWN";

type ServiceTarget = {
  key: string; // _serviceHealth doc id
  name: string;
  url: string;
};

const TARGETS: ServiceTarget[] = [
  {
    key: "portone",
    name: "PortOne",
    url: "https://api.portone.io",
  },
  {
    key: "solapi",
    name: "Solapi",
    url: "https://api.solapi.com",
  },
  {
    key: "sendgrid",
    name: "SendGrid",
    url: "https://api.sendgrid.com",
  },
];

/**
 * 단일 서비스 HEAD 요청.
 *
 * 응답 시간 + 상태 판정:
 *   - 응답 200~499 + latency <= 1000ms → OK
 *   - 응답 200~499 + latency > 1000ms  → DEGRADED
 *   - 응답 500+  또는 timeout / network 에러 → DOWN
 */
async function probe(
  target: ServiceTarget,
): Promise<{state: HealthState; latencyMs: number; statusCode?: number; reason?: string}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    let res: Response;
    try {
      res = await fetch(target.url, {
        method: "HEAD",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const latencyMs = Date.now() - start;

    if (res.status >= 500) {
      return {state: "DOWN", latencyMs, statusCode: res.status, reason: `HTTP ${res.status}`};
    }
    if (latencyMs > 1000) {
      return {state: "DEGRADED", latencyMs, statusCode: res.status};
    }
    return {state: "OK", latencyMs, statusCode: res.status};
  } catch (err) {
    const latencyMs = Date.now() - start;
    const reason = err instanceof Error ? err.message : String(err);
    // network 에러 / timeout 은 DOWN 으로 분류
    return {state: "DOWN", latencyMs, reason};
  }
}

/**
 * 매 5분 — PortOne / Solapi / SendGrid HEAD 요청 → `_serviceHealth/{key}` 적재.
 *
 * 상태 변화 (UP → DOWN) 시 _systemAlerts 적재 (5분 내 중복 방지).
 */
export const healthcheck = onSchedule(
  {
    schedule: "*/5 * * * *", // 5분마다
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    logger.info("[healthcheck] start");

    const now = FieldValue.serverTimestamp();
    const nowTs = Timestamp.now();
    const fiveMinAgo = Timestamp.fromMillis(nowTs.toMillis() - 5 * 60 * 1000);

    for (const target of TARGETS) {
      const result = await probe(target);

      // 이전 상태 조회
      let previousState: HealthState | null = null;
      try {
        const prevSnap = await db
          .collection("_serviceHealth")
          .doc(target.key)
          .get();
        if (prevSnap.exists) {
          const prev = prevSnap.data() as {state?: HealthState};
          previousState = prev.state ?? null;
        }
      } catch {
        // ignore
      }

      // 적재
      try {
        await db.collection("_serviceHealth").doc(target.key).set(
          {
            key: target.key,
            name: target.name,
            url: target.url,
            state: result.state,
            latencyMs: result.latencyMs,
            statusCode: result.statusCode ?? null,
            reason: result.reason ?? null,
            lastCheckedAt: now,
            updatedAt: now,
          },
          {merge: true},
        );
      } catch (err) {
        logger.error("[healthcheck] save failed", {
          key: target.key,
          err: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      // 상태 변화 alert
      // OK → DOWN / DEGRADED → DOWN / null → DOWN 시 _systemAlerts
      // 5분 내 동일 type+service alert 가 있으면 중복 생성 안 함
      if (result.state === "DOWN" && previousState !== "DOWN") {
        try {
          const recentSnap = await db
            .collection("_systemAlerts")
            .where("type", "==", "SERVICE_DOWN")
            .where("serviceKey", "==", target.key)
            .where("createdAt", ">=", fiveMinAgo)
            .limit(1)
            .get();
          if (recentSnap.empty) {
            await db.collection("_systemAlerts").add({
              type: "SERVICE_DOWN",
              severity: "ERROR",
              title: `${target.name} 서비스 응답 없음`,
              message: `${target.name} (${target.url}) ${result.reason ?? `HTTP ${result.statusCode ?? "?"}`}`,
              serviceKey: target.key,
              latencyMs: result.latencyMs,
              acknowledged: false,
              createdAt: now,
            });
            logger.warn("[healthcheck] DOWN alert created", {
              key: target.key,
              latencyMs: result.latencyMs,
            });
          }
        } catch (err) {
          logger.warn("[healthcheck] alert create failed", {
            key: target.key,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // DEGRADED 알림은 1회성 — 5분 내 중복 방지
      if (result.state === "DEGRADED" && previousState === "OK") {
        try {
          const recentSnap = await db
            .collection("_systemAlerts")
            .where("type", "==", "SERVICE_DEGRADED")
            .where("serviceKey", "==", target.key)
            .where("createdAt", ">=", fiveMinAgo)
            .limit(1)
            .get();
          if (recentSnap.empty) {
            await db.collection("_systemAlerts").add({
              type: "SERVICE_DEGRADED",
              severity: "WARNING",
              title: `${target.name} 응답 지연`,
              message: `${target.name} latency ${result.latencyMs}ms (임계 1000ms)`,
              serviceKey: target.key,
              latencyMs: result.latencyMs,
              acknowledged: false,
              createdAt: now,
            });
          }
        } catch (err) {
          logger.warn("[healthcheck] degraded alert failed", {
            key: target.key,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    logger.info("[healthcheck] done");
  },
);
