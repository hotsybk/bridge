# MedPlace

한국 의료기관과 의료기기·소모품 공급업체를 연결하는 멀티벤더 B2B 마켓플레이스.

> 모든 작업은 프로젝트 루트의 네 가지 헌법 문서(v2)를 따른다:
> [CLAUDE.md](CLAUDE.md) · [PRD.md](PRD.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
>
> **현재 스택**: NEXUS FATE와 통일된 **Firebase 생태계** (Firestore + Auth + Storage + Cloud Functions).
> v1(Supabase + Prisma + NextAuth) → v2 전환 진행 중.

---

## 요구사항

| 항목 | 버전 | 비고 |
| --- | --- | --- |
| Node.js | `>= 20` | 검증: `v24.14.0` |
| pnpm | `>= 11` | 윈도우 사용자 영역 설치 권장 (아래 참고) |
| Firebase CLI | `>= 13` | 2단계에서 `firebase-tools` 설치 |

### pnpm 설치 (Windows 권한 우회)

corepack은 Node 시스템 디렉토리 쓰기 권한이 필요하다. 권한이 없으면 standalone 바이너리를 사용자 영역에 설치한다:

```powershell
$pnpmHome = "$env:USERPROFILE\AppData\Local\pnpm"
# 1. https://github.com/pnpm/pnpm/releases 에서 pnpm-win32-x64.zip 다운로드 후 압축 해제
# 2. pnpm.exe + dist/ 를 $pnpmHome 으로 복사
# 3. PATH 영구 등록
[Environment]::SetEnvironmentVariable("PNPM_HOME", $pnpmHome, "User")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$pnpmHome;$userPath", "User")
```

---

## 셋업

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경변수 파일 작성
cp .env.example .env.local
# .env.local 을 열어 실제 값으로 채운다 (Firebase 키 등 — Firebase 셋업 섹션 참고)

# 3. Pretendard Variable 폰트 확인
# public/fonts/PretendardVariable.woff2 가 있는지 확인
# 없다면 public/fonts/README.md 의 안내에 따라 직접 받는다

# 4. 개발 서버 기동
pnpm dev
# → http://localhost:3000
```

### 환경변수 (`.env.local`)

전체 키 목록은 [`.env.example`](.env.example) 참고. v2 핵심 키:

- **Firebase Web**: `NEXT_PUBLIC_FIREBASE_*` (6개) — Web SDK 초기화
- **Firebase Admin**: `FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` — 서버 사이드 전용
- **next-firebase-auth-edge 쿠키 키**: `FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_1/2` — `openssl rand -base64 32` 두 번
- 결제·OCR·UDI·알림톡 키는 Phase 진행 시점에 발급받아 채운다 (MVP 단계는 mock)

---

## Firebase 셋업

> **이 섹션은 placeholder입니다.** Firebase 패키지·CLI 골격 파일은 v2 마이그레이션 2단계(현재 진행 중)에서 설치되며, Firebase 프로젝트 생성·키 발급·`firebase deploy` 가이드는 v2 마이그레이션 3단계에서 단계별 체크리스트로 제공됩니다.
>
> 미리 알아두기:
> - Firebase 프로젝트: `bridge-dev` (현재: `bridge-61dd9`) / `bridge-staging` / `bridge-prod` 3개 분리
> - 리전: **`asia-northeast3` (Seoul)** 고정 (Firestore + Storage + Functions 모두)
> - Auth Provider: 이메일/비밀번호 + Google (Phase 1), 카카오는 Phase 2+ Custom Token 방식
> - **Firestore Security Rules·Indexes·Functions 자동 배포 금지** (CLAUDE.md §1.1) — 항상 사용자가 수동으로 `firebase deploy` 실행

---

## 폴더 구조

```
src/
├── app/                Next.js App Router
│   ├── (marketing)/    공개 페이지
│   ├── (buyer)/        병원 사용자
│   ├── (vendor)/       공급업체 셀러센터
│   ├── (admin)/        플랫폼 운영자
│   ├── (auth)/         로그인·가입
│   └── api/            /login, /logout, /refresh-token (auth-edge) · /trpc · /webhooks
├── components/         UI 컴포넌트 (ui/ 는 shadcn)
├── server/
│   ├── firebase/       firebase-admin singleton · auth 헬퍼 · 컬렉션 상수
│   ├── api/            tRPC routers · trpc.ts · root.ts
│   └── services/       비즈니스 로직 (portone, clova-ocr, solapi 등)
├── lib/
│   ├── firebase/       Web SDK client · AuthContext
│   ├── types.ts        Firestore 도큐먼트 타입 (Hospital, Vendor, Product ...)
│   ├── utils.ts · fonts.ts · constants.ts
│   ├── validators/ · hooks/
├── styles/             빈 폴더 유지 (향후 별도 CSS 모듈용)
└── proxy.ts            next-firebase-auth-edge authMiddleware (Next.js 16, 옛 middleware.ts)

functions/              Cloud Functions for Firebase (별도 패키지)
├── src/
│   ├── triggers/       Firestore 트리거
│   ├── scheduled/      Cloud Scheduler (구독 cron, 공동구매 마감, UDI 월배치)
│   ├── callable/       HTTPS Callable (createOrder, finalizeGroupBuy 등)
│   └── lib/
firestore.rules · firestore.indexes.json · storage.rules · firebase.json · .firebaserc
```

자세한 규칙은 [CLAUDE.md §3](CLAUDE.md) 참고.

---

## Phase 1 진행 상태 (v2 기준 재정의)

- [x] 1.0 헌법 v2 적용 (Firebase 전환)
- [x] 1.1 v2 폐기 단계 — Prisma/Supabase 흔적 제거
- [x] 1.2 Firebase 골격 — 패키지 설치, CLI 골격 파일, `src/lib/firebase`, `src/server/firebase`, `functions/`
- [x] 1.3 사용자 작업 — Firebase 콘솔 셋업, 키 발급, `firebase deploy` 수동 실행 (bridge-61dd9 dev 프로젝트)
- [x] 1.4 Firestore 컬렉션 타입 검증 + 시드(16 doc) + `onSnapshot` 실시간 구독 검증
- [x] 1.5 Firebase Auth + next-firebase-auth-edge — login/register UI + /api/login·logout·refresh-token·auth/init-user + proxy.ts 보호 라우트 + 시드 user 2명 실제 Auth 등록 (debug page는 /admin/debug/snapshot 으로 이동)
- [x] 1.6 buyer 온보딩 — Clova OCR / NTS verify mock + tRPC v11 셋업(hospital router) + /onboarding/buyer 4-step wizard + setCustomUserClaims merge 패턴
- [x] 1.7 vendor 온보딩 — vendor router(status=PENDING_REVIEW) + /onboarding/vendor 5-step + (vendor)/seller/(approved) layout 가드 + /seller/pending 상태별 안내 페이지 + Storage Rules 온보딩 임시 허용 patch
- [x] 1.8 admin 입점 심사 — admin/vendor router(list/getById/approve/reject/suspend/reopen) + /admin/vendors 큐 + [vendorId] 상세 + dialog 액션 + solapi mock + storage signed URL helper + 시드 ADMIN user 추가
- [ ] 1.6 랜딩 페이지 (Apple 스타일)
- [ ] 1.7 buyer 온보딩 — OCR/국세청 mock + Firestore /users·/hospitals + Custom Claims
- [ ] 1.8 vendor 온보딩 + admin 입점 심사 + 통합 테스트

각 체크포인트의 요구사항은 헌법 문서 4종 참고.

---

## 핵심 스택 (v2)

| 분야 | 기술 |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5.x strict |
| Styling | Tailwind CSS v4 + shadcn/ui + Pretendard Variable |
| **DB** | **Firebase Firestore (Native, `asia-northeast3`)** |
| **Auth** | **Firebase Authentication + `next-firebase-auth-edge`** (서명 쿠키) |
| **Storage** | **Firebase Storage (`asia-northeast3`)** |
| **Serverless** | **Cloud Functions for Firebase (2nd gen) + Cloud Scheduler** |
| **Realtime** | **Firestore `onSnapshot`** |
| API | tRPC v11 (firebase-admin 컨텍스트) |
| Payment | PortOne V2 |
| Search | Algolia (Phase 2+ — Firestore 트리거 sync) |
| Hosting | Vercel (Web) + Firebase (Functions/Firestore/Storage) — 하이브리드 |

전체 스택은 [CLAUDE.md §2](CLAUDE.md) 참고. **명시적 승인 없이 스택을 변경하지 않는다.**

---

## 자주 쓰는 명령

```bash
pnpm dev                                 # 개발 서버
pnpm build                               # 운영 빌드
pnpm lint                                # ESLint
pnpm dlx shadcn@latest add <component>   # shadcn 컴포넌트 추가

# Firebase (2단계 완료 후 사용 가능)
firebase login                                                  # 최초 1회
firebase emulators:start                                        # 로컬 에뮬레이터 (Auth + Firestore + Functions + Storage)
firebase deploy --only firestore:rules,firestore:indexes        # Rules·Index 배포 (수동)
firebase deploy --only storage                                  # Storage Rules 배포
firebase deploy --only functions:<name>                         # 개별 함수 배포 (전체 배포 지양)
```

> **자동 `firebase deploy` 금지** — CLAUDE.md §1.1. 항상 사용자가 직접 명령 실행.

---

## 배포

- **Web**: Vercel Pro (Next.js 빌드 + Edge runtime)
- **Backend**: Firebase (Firestore + Auth + Storage + Functions, 리전 `asia-northeast3`)
- 환경: `medplace-dev` / `medplace-staging` / `medplace-prod` 3개 Firebase 프로젝트 분리
- 첫 배포는 Phase 1.8 완료 시점에 Vercel Preview + `firebase deploy --only firestore:rules` 두 곳 모두 검증
