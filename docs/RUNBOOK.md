# MedPlace 운영 런북 (RUNBOOK)

> Σ(20년차 시니어 백로그) 작업으로 추가된 운영 안전망의 설정·대응 절차.
> 코드는 배포돼 있으나, **콘솔/CLI 에서 한 번 해줘야 하는 인프라 설정**을 여기 모은다.

---

## 1. Firestore 백업 (P0)

코드: `functions/src/scheduled/firestore-backup.ts` (매일 04:00 KST).
`BACKUP_BUCKET` 가 설정돼야 동작하며, 미설정 시 자동 skip 한다.

### 1-1. 백업용 GCS 버킷 생성
```bash
# asia-northeast3(서울), 30일 lifecycle
gcloud storage buckets create gs://bridge-61dd9-backups \
  --project=bridge-61dd9 \
  --location=asia-northeast3 \
  --uniform-bucket-level-access

# 30일 후 자동 삭제 lifecycle
cat > /tmp/lifecycle.json <<'EOF'
{ "rule": [{ "action": {"type":"Delete"}, "condition": {"age":30} }] }
EOF
gcloud storage buckets update gs://bridge-61dd9-backups --lifecycle-file=/tmp/lifecycle.json
```

### 1-2. 함수 서비스 계정 권한
2nd-gen 함수의 기본 SA(`<project-number>-compute@developer.gserviceaccount.com`)에 부여:
```bash
PROJECT=bridge-61dd9
SA="$(gcloud projects describe $PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

# Firestore export 권한
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/datastore.importExportAdmin"

# 버킷 쓰기 권한
gcloud storage buckets add-iam-policy-binding gs://bridge-61dd9-backups \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"
```

### 1-3. 함수 env 설정
```bash
firebase functions:config:set  # (1st gen, deprecated)
# 2nd gen 은 .env 파일 또는 Secret/env 사용:
echo "BACKUP_BUCKET=bridge-61dd9-backups" >> functions/.env.bridge-61dd9
firebase deploy --only functions:firestoreBackup
```

### 1-4. 복구 (재해 시)
```bash
gcloud firestore import gs://bridge-61dd9-backups/firestore-backups/<YYYY-MM-DD> \
  --project=bridge-61dd9
```

---

## 2. PITR (Point-in-Time Recovery) — 7일 (P0)

스케줄 export 와 별개로, **최근 7일 내 임의 시점**으로 복구.
콘솔/CLI 1회 활성화 (코드 불필요).
```bash
gcloud firestore databases update --database='(default)' \
  --project=bridge-61dd9 --enable-pitr
```
복구:
```bash
# 새 DB 로 시점 복구 후 검증 → 교체
gcloud firestore databases restore \
  --source-database='(default)' \
  --destination-database='recovered' \
  --snapshot-time='2026-06-15T03:00:00Z'
```

---

## 3. 외부 장애 알림 (Slack/이메일) (P0)

코드: `functions/src/triggers/on-system-alert-created.ts`.
`_systemAlerts` 에 severity `critical/high/error/down` 문서가 생기면 외부로 발송.

설정 (둘 중 하나 이상):
```bash
# functions/.env.bridge-61dd9
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
ALERT_EMAIL=ops@medplace.kr   # SendGrid(EMAIL_FROM/SENDGRID_API_KEY) 필요
```
- Slack Incoming Webhook: Slack App → Incoming Webhooks → Add New Webhook to Workspace
- 미설정 시 alert 는 Firestore(`_systemAlerts`) + admin/monitoring 에만 남음

발송 트리거가 되는 알림:
- `CRON_STALLED` (cron 정지 — §5)
- `FIRESTORE_BACKUP_FAILED` (백업 실패 — §1)
- healthcheck DOWN, dispute SLA escalation, anomaly 등 기존 alert

---

## 4. Sentry 소스맵 (P0)

코드: `next.config.ts` 가 `withSentryConfig` 로 래핑됨.
**Vercel 환경변수**에 다음을 등록해야 빌드 시 소스맵이 업로드되어
production 에러가 원본 스택으로 보인다:
```
SENTRY_AUTH_TOKEN=<sentry org auth token>
SENTRY_ORG=<org slug>
SENTRY_PROJECT=<project slug>
```
미설정 시 빌드는 통과하되 소스맵 업로드만 skip(경고).

---

## 5. cron dead-man's-switch (P1)

코드: `functions/src/scheduled/cron-heartbeat-monitor.ts` (매시 10분).
critical cron(`subscriptionRunner`/`settlementDaily`/`groupbuyCloser`/`firestoreBackup`)이
기대 주기보다 오래 멈추면 `_systemAlerts`(severity critical) → §3 외부 발송.

- 각 cron 은 끝에서 `_serviceHealth/{name}.lastRunAt` heartbeat 기록.
- 임계 조정: functions env `CRON_HEARTBEAT_MAX_AGE_HOURS` (전역 override).
- 오탐 시 admin/monitoring 에서 alert ack.

---

## 6. CI/CD (P0)

- `.github/workflows/ci.yml` — push/PR 마다 web(typecheck·lint·build) + functions(build).
- `.github/workflows/firestore-rules.yml` — `firestore.rules` 변경 시 에뮬레이터로 Rules 테스트.
- 로컬 Rules 테스트: `firebase emulators:exec --only firestore "pnpm test:rules"`

---

## 7. staging / prod 환경 분리 (P0)

현재 `.firebaserc` 의 staging/prod 는 PLACEHOLDER → **dev 가 곧 prod** 인 위험 상태.
production 진입 전 분리:

```bash
# 1) staging / prod 프로젝트 생성 (Firebase Console 또는 CLI)
firebase projects:create bridge-staging --display-name "MedPlace Staging"
firebase projects:create bridge-prod --display-name "MedPlace Prod"

# 2) .firebaserc 의 PLACEHOLDER 를 실제 projectId 로 교체

# 3) 각 환경에 rules/indexes/functions 배포
firebase use staging && firebase deploy
firebase use prod && firebase deploy
```
- Vercel: Production 브랜치(main)=prod 프로젝트 env, Preview 브랜치=staging env.
- 분리 전까지는 seed/테스트 스크립트를 **반드시 에뮬레이터**에서만 실행.

---

## 9. Firestore TTL 정책 (P2)

무한 적재되는 컬렉션은 TTL 필드 기준 자동 삭제로 비용/성능 관리.
콘솔/CLI 1회 설정 (코드의 `expiresAt` 필드 기준):
```bash
# rate limit 버킷 — expiresAt 기준 자동 삭제
gcloud firestore fields ttls update expiresAt \
  --collection-group=_rateLimits --enable-ttl --project=bridge-61dd9
```
대상 후보:
- `_rateLimits.expiresAt` — Σ-3 rate limiter (이미 expiresAt 기록)
- `notifications` / `auditLogs` — 장기 보관 정책 수립 후 적용 (auditLogs 는 audit-archive 로 GCS 이관 중)

---

## 8. 배포 체크리스트

```bash
pnpm typecheck && pnpm lint            # 웹
pnpm typecheck:functions               # 함수
firebase deploy --only firestore:rules # Rules (diff 확인 후)
firebase deploy --only firestore:indexes
firebase deploy --only functions       # 또는 functions:<name>
git push                               # Vercel 자동 배포 (web)
```
