# Σ-2 — Firestore 백업 인프라 셋업 (bridge-61dd9 / dev)
#
# 전제: gcloud CLI 설치 + `gcloud auth login` 완료.
#   설치: https://cloud.google.com/sdk/docs/install (Windows installer)
#   인증: gcloud auth login   (브라우저 인증 — 본인이 직접)
#
# 실행: PowerShell 에서
#   .\scripts\setup-backup-infra.ps1
#
# 하는 일:
#   1) gcloud 프로젝트 고정
#   2) 백업용 GCS 버킷 생성 (asia-northeast3, 30일 lifecycle)
#   3) 함수 service account 에 export/storage 권한 부여  ← 접근권한 변경 (본인 실행)
#   4) PITR(7일) 활성화
#   5) firestoreBackup 함수 재배포 (BACKUP_BUCKET env 적용)

$ErrorActionPreference = "Stop"
$PROJECT = "bridge-61dd9"
$REGION  = "asia-northeast3"
$BUCKET  = "bridge-61dd9-backups"

Write-Host "== [0/5] gcloud 확인 ==" -ForegroundColor Cyan
gcloud --version | Select-Object -First 1
gcloud config set project $PROJECT

Write-Host "== [1/5] 백업 버킷 생성 ==" -ForegroundColor Cyan
# 이미 있으면 에러 무시
try {
  gcloud storage buckets create "gs://$BUCKET" --project=$PROJECT --location=$REGION --uniform-bucket-level-access
} catch { Write-Host "  (버킷이 이미 있거나 생성 skip)" -ForegroundColor Yellow }

Write-Host "== [2/5] lifecycle 30일 ==" -ForegroundColor Cyan
$lifecycle = '{ "rule": [{ "action": {"type":"Delete"}, "condition": {"age":30} }] }'
$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $lifecycle -Encoding utf8
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file=$tmp
Remove-Item $tmp

Write-Host "== [3/5] 함수 SA 권한 (export + storage) ==" -ForegroundColor Cyan
$NUM = gcloud projects describe $PROJECT --format="value(projectNumber)"
$SA  = "$NUM-compute@developer.gserviceaccount.com"
Write-Host "  service account: $SA"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/datastore.importExportAdmin"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"

Write-Host "== [4/5] PITR(7일) 활성화 ==" -ForegroundColor Cyan
gcloud firestore databases update --database="(default)" --project=$PROJECT --enable-pitr

Write-Host "== [5/5] firestoreBackup 재배포 (BACKUP_BUCKET 적용) ==" -ForegroundColor Cyan
firebase deploy --only functions:firestoreBackup --project dev

Write-Host "`n완료. 내일 04:00 KST 첫 백업 → gs://$BUCKET/firestore-backups/ 확인" -ForegroundColor Green
Write-Host "수동 테스트: firebase functions:shell 후 firestoreBackup() 호출 가능" -ForegroundColor Green
