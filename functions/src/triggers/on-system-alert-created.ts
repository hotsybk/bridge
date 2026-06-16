// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-system-alert-created must be used only on the server side.");
}

// Σ-2 — 외부 알림 채널 디스패처.
//
// `_systemAlerts/{alertId}` onCreate 시 Slack webhook + 이메일로 외부 발송.
// 기존에는 alert 가 Firestore 에만 적재되어 운영자가 admin/monitoring 을
// 직접 봐야만 장애를 인지 → 장애 발생을 아무도 모르는 문제.
//
// 환경변수:
//   SLACK_WEBHOOK_URL  — Slack Incoming Webhook (미설정 시 Slack skip)
//   ALERT_EMAIL        — 장애 알림 수신 이메일 (미설정 시 email skip)
//
// 정책:
//   - severity(또는 level) 가 critical/high/error 인 alert 만 외부 발송 (노이즈 억제)
//   - best-effort: 발송 실패해도 throw 안 함 (alert 자체는 이미 Firestore 에 적재됨)
//   - dispatchedAt 마킹으로 재시도/중복 발송 방지

// eslint-disable-next-line import/first
import {onDocumentCreated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {FieldValue} from "../lib/firestore";
// eslint-disable-next-line import/first
import {withRetry, fetchWithTimeout} from "../lib/retry";
// eslint-disable-next-line import/first
import {sendEmail} from "../lib/email";

type SystemAlertDoc = {
  type?: string;
  severity?: string;
  level?: string;
  title?: string;
  message?: string;
  detail?: string;
  source?: string;
  target?: string;
  data?: Record<string, unknown>;
};

// 외부 발송 대상 severity (그 외는 Firestore 기록만)
const EXTERNAL_LEVELS = new Set([
  "critical",
  "high",
  "error",
  "fatal",
  "danger",
  "down",
]);

function resolveLevel(a: SystemAlertDoc): string {
  return String(a.severity ?? a.level ?? "info").toLowerCase();
}

async function postToSlack(
  webhookUrl: string,
  alert: SystemAlertDoc,
  level: string,
  alertId: string,
): Promise<void> {
  const emoji =
    level === "critical" || level === "fatal" ?
      ":rotating_light:" :
      level === "down" ?
        ":red_circle:" :
        ":warning:";
  const title = alert.title ?? alert.type ?? "시스템 알림";
  const body = alert.message ?? alert.detail ?? "(내용 없음)";
  const fields: Array<{type: string; text: string}> = [
    {type: "mrkdwn", text: `*레벨:*\n${level.toUpperCase()}`},
  ];
  if (alert.source) fields.push({type: "mrkdwn", text: `*소스:*\n${alert.source}`});
  if (alert.target) fields.push({type: "mrkdwn", text: `*대상:*\n${alert.target}`});

  const payload = {
    blocks: [
      {
        type: "header",
        text: {type: "plain_text", text: `${emoji} ${title}`, emoji: true},
      },
      {type: "section", text: {type: "mrkdwn", text: body}},
      ...(fields.length > 0 ? [{type: "section", fields}] : []),
      {
        type: "context",
        elements: [
          {type: "mrkdwn", text: `MedPlace 모니터링 · alertId: ${alertId}`},
        ],
      },
    ],
  };

  await withRetry(async () => {
    const res = await fetchWithTimeout(webhookUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = new Error(`slack webhook failed: ${res.status}`) as Error & {
        status?: number;
      };
      err.status = res.status;
      throw err;
    }
    return true;
  });
}

export const onSystemAlertCreated = onDocumentCreated(
  {
    document: "_systemAlerts/{alertId}",
    region: "asia-northeast3",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const alert = snap.data() as SystemAlertDoc;
    const alertId = event.params.alertId;
    const level = resolveLevel(alert);

    // 노이즈 억제 — 심각도 낮은 alert 은 외부 발송 skip
    if (!EXTERNAL_LEVELS.has(level)) {
      logger.debug("[on-system-alert] skip external (low level)", {
        alertId,
        level,
      });
      return;
    }

    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    const alertEmail = process.env.ALERT_EMAIL;
    let slackOk = false;
    let emailOk = false;

    // 1) Slack
    if (slackUrl) {
      try {
        await postToSlack(slackUrl, alert, level, alertId);
        slackOk = true;
      } catch (err) {
        logger.error("[on-system-alert] slack dispatch failed", {
          alertId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2) 이메일
    if (alertEmail) {
      try {
        const title = alert.title ?? alert.type ?? "시스템 알림";
        const body = alert.message ?? alert.detail ?? "(내용 없음)";
        await sendEmail({
          to: alertEmail,
          subject: `[MedPlace ${level.toUpperCase()}] ${title}`,
          html: `
            <h2 style="margin:0 0 8px">${title}</h2>
            <p style="color:#444">${body}</p>
            <table style="border-collapse:collapse;font-size:13px;color:#666">
              <tr><td style="padding:2px 8px"><b>레벨</b></td><td>${level}</td></tr>
              ${alert.source ? `<tr><td style="padding:2px 8px"><b>소스</b></td><td>${alert.source}</td></tr>` : ""}
              ${alert.target ? `<tr><td style="padding:2px 8px"><b>대상</b></td><td>${alert.target}</td></tr>` : ""}
              <tr><td style="padding:2px 8px"><b>alertId</b></td><td>${alertId}</td></tr>
            </table>
          `.trim(),
        });
        emailOk = true;
      } catch (err) {
        logger.error("[on-system-alert] email dispatch failed", {
          alertId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!slackUrl && !alertEmail) {
      logger.warn(
        "[on-system-alert] no external channel configured " +
          "(set SLACK_WEBHOOK_URL or ALERT_EMAIL)",
        {alertId, level},
      );
    }

    // 3) 발송 결과 마킹 (best-effort)
    try {
      await snap.ref.update({
        dispatch: {slackOk, emailOk, dispatchedAt: FieldValue.serverTimestamp()},
      });
    } catch {
      // best-effort
    }
  },
);
