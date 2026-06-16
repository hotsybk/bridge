// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/scheduled/firestore-backup must be used only on the server side.");
}

// Σ-2 — Firestore 일일 백업 (스케줄 export).
//
// 매일 04:00 KST 실행 (subscription-runner 03:00 직후).
// Firestore 전체를 GCS 버킷으로 export → 실수/악의적 삭제 복구의 최후 방어선.
// (PITR 은 콘솔/gcloud 에서 별도 활성화 — docs/RUNBOOK.md 참조)
//
// 의존성 추가 없이 metadata 서버 access token + Firestore REST export API 사용.
//
// 사전 조건 (docs/RUNBOOK.md):
//   1. GCS 버킷 생성 (예: gs://bridge-61dd9-backups), asia-northeast3, lifecycle 30일
//   2. 함수 service account 에 roles/datastore.importExportAdmin + 버킷 objectAdmin 부여
//   3. functions env: BACKUP_BUCKET=bridge-61dd9-backups
//      (미설정 시 skip — 로컬/dev 보호)

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue} from "../lib/firestore";
// eslint-disable-next-line import/first
import {fetchWithTimeout} from "../lib/retry";

/** Cloud Run metadata 서버에서 default SA access token 획득. */
async function getAccessToken(): Promise<string> {
  const res = await fetchWithTimeout(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {headers: {"Metadata-Flavor": "Google"}},
    5_000,
  );
  if (!res.ok) {
    throw new Error(`metadata token request failed: ${res.status}`);
  }
  const json = (await res.json()) as {access_token?: string};
  if (!json.access_token) {
    throw new Error("metadata token response missing access_token");
  }
  return json.access_token;
}

export const firestoreBackup = onSchedule(
  {
    schedule: "0 4 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const bucket = process.env.BACKUP_BUCKET;
    if (!bucket) {
      logger.warn(
        "[firestore-backup] BACKUP_BUCKET not set — skip. " +
          "Set functions env BACKUP_BUCKET to enable daily export.",
      );
      return;
    }

    const projectId =
      process.env.GCLOUD_PROJECT ??
      process.env.GCP_PROJECT ??
      process.env.FIREBASE_ADMIN_PROJECT_ID;
    if (!projectId) {
      logger.error("[firestore-backup] project id 를 확인할 수 없음");
      return;
    }

    // 날짜 prefix — 동일 일자 재실행 시 덮어쓰기 (idempotent-ish)
    const date = new Date().toISOString().slice(0, 10);
    const outputUriPrefix = `gs://${bucket}/firestore-backups/${date}`;

    try {
      const token = await getAccessToken();
      const res = await fetchWithTimeout(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({outputUriPrefix}),
        },
        30_000,
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "<no body>");
        throw new Error(`export request failed: ${res.status} ${errText}`);
      }

      const op = (await res.json()) as {name?: string};
      logger.info("[firestore-backup] export 시작됨", {
        outputUriPrefix,
        operation: op.name,
      });

      // 마지막 백업 메타 기록 (관측성 — admin 대시보드에서 확인 가능)
      await db.collection("_serviceHealth").doc("firestoreBackup").set(
        {
          name: "firestoreBackup",
          lastRunAt: FieldValue.serverTimestamp(), // cron-heartbeat-monitor 가 확인
          lastBackupAt: FieldValue.serverTimestamp(),
          lastOutputUri: outputUriPrefix,
          lastOperation: op.name ?? null,
          status: "OK",
        },
        {merge: true},
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error("[firestore-backup] export 실패", {reason});

      // 장애 alert — 외부 채널로도 발송 (on-system-alert-created 트리거 경유)
      try {
        await db.collection("_systemAlerts").add({
          type: "FIRESTORE_BACKUP_FAILED",
          severity: "high",
          title: "Firestore 일일 백업 실패",
          message: `백업 export 실패: ${reason}`,
          source: "firestore-backup",
          createdAt: FieldValue.serverTimestamp(),
          acknowledged: false,
        });
      } catch {
        // best-effort
      }

      await db.collection("_serviceHealth").doc("firestoreBackup").set(
        {
          lastFailureAt: FieldValue.serverTimestamp(),
          lastError: reason,
          status: "FAILED",
        },
        {merge: true},
      );
    }
  },
);
