# Phase 1 브라우저 수동 검증 체크리스트

> Phase 1 완료 직후, Phase 2 진입 전에 사용자가 직접 브라우저에서 검증해야 하는 항목 목록.
> 자동 테스트로는 커버하지 못한 (1) Storage 업로드 (2) 실제 Custom Claims 갱신 흐름 (3) 5분짜리 signed URL (4) 알림톡 mock 호출 (5) 사이드 가드 redirect 4종을 사람 눈으로 확인한다.
>
> 검증 환경:
> - Firebase 프로젝트: `bridge-61dd9` (dev)
> - 로컬 URL: <http://localhost:3000>
> - 기동: `pnpm dev`
> - 시드 user 비밀번호는 `.env.local`의 `SEED_BUYER_PASSWORD` / `SEED_VENDOR_PASSWORD` / `SEED_ADMIN_PASSWORD` 참고 (자동 생성, 평문 로그 금지)
> - 시드 user 이메일: `buyer@example.com` / `vendor@example.com` / `admin@example.com`
>
> 각 항목은 통과 시 `[x]` 체크, 실패 시 `[ ]` 유지 + 하단 **발견 사항**에 재현 단계·스크린샷 경로·콘솔 로그 기록.

---

## 사전 준비

- [ ] `pnpm install` 후 `pnpm dev`가 에러 없이 기동되는가 (포트 3000)
- [ ] Firebase 콘솔에서 `bridge-61dd9` 프로젝트가 정상이고, Firestore·Auth·Storage·Rules 모두 배포된 상태인가
- [ ] `.env.local`에 12개 Firebase 키 + 2개 cookie key + 3개 SEED_*_PASSWORD가 모두 채워졌는가
- [ ] 브라우저 DevTools → Application → Cookies 에서 `AuthToken` 쿠키가 없는 깨끗한 상태에서 시작했는가 (Incognito 권장)

---

## 1. 시드 user 3명 로그인 검증

각 시드 user가 정상 로그인되고 Custom Claims가 토큰에 반영되는지 확인.

- [ ] **buyer@example.com** 로그인 → `/` 진입 → DevTools Console에서 `await firebase.auth().currentUser.getIdTokenResult()`의 `claims`에 `{ role: "BUYER_OWNER", hospitalId: "<유효한 hospital ID>" }` 포함
- [ ] **vendor@example.com** 로그인 → DevTools Console에서 claims에 `{ role: "VENDOR_OWNER", vendorId: "<유효한 vendor ID>" }` 포함
- [ ] **admin@example.com** 로그인 → DevTools Console에서 claims에 `{ role: "ADMIN" }` 포함
- [ ] 세 user 모두 로그아웃 후 `/login`/`/register` 접근 시 정상적으로 폼이 보이고, **로그인된 상태로 `/login` 또는 `/register` 직접 접근 시 `/`로 redirect** 되는가

## 2. buyer 온보딩 4-step wizard

새 buyer 계정으로 `/onboarding/buyer` 전체 흐름 검증.

- [ ] `/register`에서 BUYER_OWNER 역할로 신규 회원가입 → 자동으로 `/onboarding/buyer` redirect
- [ ] **Step 1 (사업자등록증 업로드)**: 파일 선택 → Firebase Storage `/hospital-docs/{uid}/biz-reg-{ts}.{ext}` 경로에 업로드 성공 (DevTools Network 탭에서 200 응답)
- [ ] **Step 2 (OCR mock 결과 확인)**: 사업자번호 자동 추출되어 폼에 미리 채워짐 (Clova OCR mock — 결정적 hash 기반 더미 값)
- [ ] **Step 3 (병원 정보 + 주소)**: 모든 필드 입력 후 "다음" 클릭 시 NTS verify mock 호출 → `bizRegNo` 끝자리가 3~9이면 통과
- [ ] **Step 4 (확인)**: "온보딩 완료" 클릭 → tRPC `hospital.onboard` 호출 → 성공 응답 후 `/` 로 redirect
- [ ] redirect 직후 DevTools Console에서 `getIdTokenResult({forceRefresh: true})` 실행 → claims에 `hospitalId` 신규 부여 확인 (Custom Claims merge 정상)
- [ ] Firestore 콘솔에서 `/hospitals/{hospitalId}` 문서 + `/users/{uid}` 문서의 `hospitalId` 필드 둘 다 동기화

## 3. vendor 온보딩 5-step wizard (DISTRIBUTOR)

새 vendor 계정 (DISTRIBUTOR 유형)으로 전체 흐름 검증.

- [ ] `/register`에서 VENDOR_OWNER 역할로 신규 가입 → `/onboarding/vendor` redirect
- [ ] **Step 1 (vendorType 선택)**: `DISTRIBUTOR` 선택 → 다음 화면에서 "의료기기 판매업 신고증" 업로드 필드가 보이는가 (MANUFACTURER/IMPORTER 선택 시에는 "제조·수입업 허가증" 필드)
- [ ] **Step 2 (사업자등록증)**: Firebase Storage `/vendor-docs/{uid}/biz-reg-{ts}.{ext}` 업로드 성공
- [ ] **Step 3 (판매업 신고증)**: `/vendor-docs/{uid}/sales-license-{ts}.{ext}` 업로드 성공
- [ ] **Step 4 (회사 정보 + 정산 계좌)**: 모든 필드 입력 + 영업 카테고리 1개 이상 선택
- [ ] **Step 5 (확인)**: "신청 제출" 클릭 → tRPC `vendor.onboard` 호출 → 성공 응답 `{ status: "PENDING_REVIEW" }`
- [ ] Firestore 콘솔에서 `/vendors/{vendorId}` 문서 생성 + `status: "PENDING_REVIEW"` 확인, 그리고 sub-collection `/vendors/{vendorId}/vendorMembers/{uid}` 도큐먼트 존재

## 4. vendor 온보딩 5-step wizard (MANUFACTURER)

다른 vendor 계정으로 MANUFACTURER 분기 확인.

- [ ] 신규 가입 → vendorType=MANUFACTURER 선택 → Step 3에서 "제조·수입업 허가증" 업로드 필드가 보임
- [ ] `/vendor-docs/{uid}/manufacture-license-{ts}.{ext}` 업로드 성공
- [ ] 신청 제출 → Firestore `vendors/{vendorId}` 문서에 `manufactureLicenseUrl` 필드 채워짐, `salesLicenseImageUrl` 필드는 비어있음
- [ ] 신청 직후 셀러 페이지 접근 시 `/seller/pending`으로 redirect 되는가

## 5. /seller/* 가드 redirect 검증

vendor user가 status에 따라 올바른 경로로 빠지는지 확인.

- [ ] **PENDING_REVIEW 상태 vendor**: `/seller/products` 직접 접근 → `/seller/pending` redirect (sub-group `(approved)` layout 가드 동작)
- [ ] `/seller/pending` 페이지에서 현재 상태 (Clock 아이콘 + "심사 대기 중") 안내 텍스트가 보임
- [ ] (admin 액션 후) **APPROVED 상태 vendor**: `/seller/products` 직접 접근 → 정상 진입 (redirect 없음)
- [ ] **REJECTED 상태 vendor**: `/seller/pending` 페이지에 FileWarning 아이콘 + 반려 사유가 표시됨
- [ ] **SUSPENDED 상태 vendor**: `/seller/pending` 페이지에 ShieldX 아이콘 + 정지 사유가 표시됨

## 6. /admin/* 가드 검증

ADMIN role 외 user는 admin 페이지 접근 차단.

- [ ] buyer1 로그인 상태에서 `/admin/vendors` 접근 → `/` 로 redirect (proxy.ts 가드 동작)
- [ ] vendor1 로그인 상태에서 `/admin/vendors` 접근 → `/` 로 redirect
- [ ] admin@example.com 로그인 → `/admin/vendors` 정상 진입

## 7. admin 심사 큐 페이지 (`/admin/vendors`)

- [ ] 큐 페이지 진입 시 상단 status 필터 탭 4개 (심사 대기 / 승인됨 / 반려 / 정지) 보임
- [ ] 기본 진입 시 `?status=PENDING_REVIEW` 탭 활성화
- [ ] Phase 1.7에서 만든 PENDING_REVIEW vendor가 표 행으로 보임 (회사명, 구분, 사업자번호, 대표자, 신청일)
- [ ] 빈 상태일 때 Inbox 아이콘 + "심사 대기 상태의 입점 신청이 없습니다." 메시지 표시
- [ ] 행의 "심사 →" 클릭 시 `/admin/vendors/{id}` 상세로 이동

## 8. admin 심사 상세 페이지 + signed URL 미리보기 (`/admin/vendors/[id]`)

- [ ] 상세 페이지 진입 시 회사 정보 / 정산 계좌 / 영업 카테고리 / 제출 서류 4개 카드 보임
- [ ] **제출 서류 카드**: 사업자등록증 / (DISTRIBUTOR면) 판매업 신고증 / (MANUFACTURER·IMPORTER면) 제조·수입업 허가증 각 row 의 "새 탭에서 열기" 클릭 시 Firebase Storage signed URL이 새 탭에 열리고 PDF/이미지가 보임
- [ ] signed URL 생성 후 **6분 경과 후** 새 탭에서 URL 다시 열면 403 또는 expired 에러 (5분 만료 검증)
- [ ] 미제출 서류 row 는 점선 테두리 + "미제출 또는 URL 없음" 안내

## 9. 승인 → 알림톡 mock → /seller/* 진입 가능 확인

- [ ] PENDING_REVIEW vendor 상세 페이지에서 "승인" 버튼 → Dialog 열림 → "내부 메모" 입력 (선택) → "승인" 확정
- [ ] 처리 중 spinner 또는 disabled 상태 표시 후 페이지 refresh → 상태 칩이 "현재 상태: 승인"으로 변경
- [ ] DevTools Server Console (또는 Vercel/Next.js dev 터미널) 에서 `[solapi mock] queued template=VENDOR_APPROVED` 로그 확인
- [ ] Firestore `/notifications` 컬렉션에 신규 doc 추가 (channel=KAKAO_ALIMTALK, template=VENDOR_APPROVED, status=QUEUED)
- [ ] Firestore `/auditLogs` 컬렉션에 admin 액션 doc 추가 (action=VENDOR_APPROVE, actorUid, targetVendorId)
- [ ] 승인된 vendor 계정으로 로그인 → ID 토큰 force refresh → `/seller/products` 직접 접근 → 정상 진입 (redirect 없음)
- [ ] **반려 액션**: 다른 PENDING_REVIEW vendor 상세 → "반려" 버튼 → 사유 필수 입력 (빈 값일 때 확정 버튼 disabled) → 확정 → 상태가 "반려"로 변경 + `solapi mock VENDOR_REJECTED` 로그 + 상세 페이지에 "이 신청은 반려된 상태입니다. 재신청은 vendor 측에서 새 가입을 통해 진행됩니다." 힌트 표시

## 10. 일시정지 → SUSPENDED + 재오픈 가능 확인

- [ ] APPROVED 상태 vendor 상세 → "일시정지" 버튼 → 사유 입력 (필수) → 확정 → 상태 "일시 정지"로 변경
- [ ] `solapi mock VENDOR_SUSPENDED` 로그 + notifications/auditLogs 추가
- [ ] 정지된 vendor 계정으로 로그인 후 `/seller/products` 직접 접근 → `/seller/pending` redirect, ShieldX 아이콘 + 정지 사유 표시
- [ ] SUSPENDED vendor 상세에서 "이 신청은 정지 상태입니다. 승인 버튼으로 정지 해제가 가능합니다." 힌트 표시 + "승인" 버튼 활성 (canApprove)
- [ ] "승인" 클릭 → 정지 해제 → 상태 "승인"으로 복귀 + `solapi mock VENDOR_REOPENED` 로그
- [ ] 재오픈 후 vendor 계정으로 `/seller/products` 정상 진입

---

## 발견 사항 (failure 또는 갸우뚱한 점 기록)

> 각 발견은 다음 형식으로 기록한다:
>
> **#1 — [한 줄 요약]**
> - 어느 항목: §X.Y
> - 재현 단계: ...
> - 콘솔/Network 로그: ...
> - 스크린샷: `docs/screenshots/phase1-{slug}.png`
> - 영향도: critical / major / minor

(여기에 추가)

---

## 모든 항목 통과 후 다음 단계

1. 본 문서의 모든 `[ ]` → `[x]` 변환 + 발견 사항이 없거나 minor 만 남은 상태 확인
2. `docs/phase-2-prerequisites.md`의 외부 API 가입 항목 진행 시작
3. `docs/phase-2-decisions.md`의 3개 결정 사항 검토 후 Claude Code에게 신호 전달
