# CLAUDE.md — MedPlace 프로젝트 헌법 (v2 — Firebase 스택)

> 이 문서는 Claude Code가 매 작업 시작 전 가장 먼저 읽어야 하는 프로젝트 운영 규칙이다.
> 모든 PR, 파일 생성, 리팩토링은 이 문서의 원칙을 따른다.
>
> **v2 변경 사항**: 데이터·인증·스토리지 스택을 Supabase/Postgres/Prisma → Firebase로 전환
> (NEXUS FATE 스택 통일). v1에서 변경된 부분은 §변경이력 참조.

---

## 0. 프로젝트 개요

**프로젝트명**: MedPlace (가칭)
**한 줄 정의**: 한국 의료기관 ↔ 의료기기·소모품 공급업체를 연결하는 멀티벤더 B2B 마켓플레이스
**핵심 기능**: 멀티벤더 마켓플레이스 + 정기구독 자동발주 + 공동구매 + RFQ + UDI 자동보고
**디자인 톤**: Apple 스타일 (여백 중심, 신뢰감, 큰 타이포)
**시장**: 한국 한정 (i18n 불필요)
**스택 통일**: NEXUS FATE와 동일한 Firebase 생태계 사용

---

## 1. 절대 금기 사항 (Critical Don'ts)

### 1.1 코드 안정성
- ❌ **route/page/Firestore 컬렉션 구조를 명시적 요청 없이 건드리지 말 것** (production 장애 방지)
- ❌ **Firestore Security Rules 변경 시 자동 배포 금지** — Rules 변경은 항상 사용자에게 diff 먼저 보여줄 것. `firebase deploy --only firestore:rules` 자동 실행 금지
- ❌ **Cloud Functions 자동 배포 금지** — 코드 작성 후 사용자가 직접 `firebase deploy --only functions:<name>` 실행
- ❌ 환경변수를 코드에 하드코딩 금지 — 모든 비밀값은 `.env.local` 및 Firebase Functions config
- ❌ `any` 타입 사용 금지. 불가피한 경우 `// @ts-expect-error` + 사유 주석
- ❌ Firestore에서 monotonically increasing document ID 사용 금지 (Customer1, Customer2 형식) — 핫스팟 발생. `nanoid()` 또는 Firestore auto-id 사용
- ❌ Firestore 단일 컬렉션에 모든 데이터 평면 저장 금지 — 도메인별 분리 (`/hospitals`, `/vendors`, `/orders` 등)

### 1.2 디자인 금기
- ❌ **한글 5자 이상 또는 띄어쓰기 포함 텍스트에 `bg-clip-text text-transparent` gradient 적용 금지** — 글자 단위 분절 발생
- ❌ Apple 공식 이미지·아이콘·폰트(SF Pro 등) 직접 사용 금지 — 자체 자산 + Pretendard만 사용
- ❌ 이모지를 UI에 사용 금지 — Lucide React 아이콘만 사용
- ❌ 사이드바·탭 스트립·플로팅 네비를 깊이 있는 페이지에 추가하지 말 것 (NEXUS FATE 룰 차용)

### 1.3 비즈니스 로직 금기
- ❌ 의료기기판매업 신고증 검증 없이 vendor 입점 승인 금지
- ❌ UDI·LOT·유통기한 누락 상태로 SubOrder를 SHIPPED 상태로 전환 금지
- ❌ 공동구매 미달 시 자동 capture 금지 — 반드시 void 처리
- ❌ 결제 금액 변경은 PortOne 결제 검증(payment verification) 후에만 신뢰

### 1.4 Firestore 데이터 무결성 금기
- ❌ 다중 컬렉션에 걸친 쓰기를 트랜잭션 없이 처리 금지 — 항상 `runTransaction` 또는 `writeBatch` 사용
- ❌ 단일 트랜잭션에 500 docs 초과 작업 금지 (Firestore 하드 한계)
- ❌ Cloud Function 외부에서 정산/공동구매 마감 등 atomic 보장이 필요한 작업 실행 금지
- ❌ 클라이언트 SDK에서 vendor·hospital 통계 컬렉션 직접 쓰기 금지 (Cloud Function only)

---

## 2. 기술 스택 (고정값)

| 분야 | 기술 | 버전/비고 |
|---|---|---|
| Framework | Next.js | 16 (App Router) |
| Language | TypeScript | 5.x strict mode |
| Styling | Tailwind CSS | 4.x |
| UI Library | shadcn/ui | latest (Radix 기반) |
| Icons | lucide-react | latest |
| Font | Pretendard Variable | next/font/local |
| **DB** | **Firebase Firestore (Native mode)** | **asia-northeast3 (Seoul)** |
| **DB Server SDK** | **firebase-admin** | latest |
| **DB Client SDK** | **firebase (Web v9 modular)** | latest |
| **Auth** | **Firebase Authentication** | 이메일/비밀번호 + Google (1차) / 카카오 (이후) |
| **Auth Edge** | **next-firebase-auth-edge** | App Router 공식 권장 패턴, 세션 쿠키 기반 |
| **Storage** | **Firebase Storage** | asia-northeast3 |
| **Serverless** | **Cloud Functions for Firebase** | 2nd gen, asia-northeast3, Node.js 22 |
| **Scheduled Jobs** | **Cloud Scheduler + Cloud Functions** | 정기구독/공동구매 마감/UDI 월배치 |
| API | tRPC | v11 (Next.js Route Handler 위에서) |
| Payment | PortOne | V2 (구 아임포트) |
| Realtime | Firestore onSnapshot | 무료, Auth 통합 |
| Search | Algolia (or Typesense self-host) | Firestore 추천 검색 솔루션 |
| Cache/Queue | Upstash Redis + BullMQ (외부 의존 최소화 후보) | Phase 2~ 결정 |
| Notification | 솔라피 알림톡 | 카카오 사전 심사 템플릿 |
| Hosting | Vercel (Web) + Firebase (Functions/Firestore/Storage) | 하이브리드 |
| Monitoring | Sentry + PostHog + Vercel Analytics + Firebase Performance | — |
| UDI 보고 | 식약처 의료기기통합정보시스템 OPEN API | emedi.mfds.go.kr |
| 사업자 OCR | Naver Clova OCR | 사업자등록증 인식 |

**스택 변경은 사용자 명시적 승인 없이 금지.**

### 2.1 pnpm v11 빌드 스크립트 정책
pnpm v11부터 `package.json`의 `pnpm.onlyBuiltDependencies` 필드는 **deprecated** — 더 이상 읽지 않는다. 빌드 스크립트를 가진 패키지는 **`pnpm-workspace.yaml`의 `allowBuilds`**(혹은 `ignoredBuiltDependencies`)로 명시한다.

운영 규칙:
- 신규 패키지 설치 후 `[ERR_PNPM_IGNORED_BUILDS]` 경고가 뜨면 → `pnpm-workspace.yaml`의 `allowBuilds`에 `true`로 등록 후 재설치
- native 바이너리(`sharp`, `unrs-resolver`)는 필수
- 빌드 스크립트가 없는 패키지는 등록 불필요

```yaml
allowBuilds:
  msw: true
  sharp: true
  unrs-resolver: true
  protobufjs: true        # firebase-admin 간접 의존성
  '@firebase/util': true  # firebase 패키지 의존성
```

### 2.1.1 pnpm 설치 방식 권장 (corepack 우선)

pnpm 설치는 다음 우선순위로 진행:

1. **corepack 방식 (권장)** — Node.js 22+ 내장
   - 설치: `corepack enable; corepack prepare pnpm@latest --activate`
   - shim 위치: `C:\Program Files\nodejs\node_modules\corepack\shims` (Windows)
   - 이 경로를 사용자 영구 PATH에 등록 필수 (인스톨러가 자동 등록 안 함)
   - 장점: `Program Files` 안에 있어 OneDrive/iCloud 동기화 영향 없음

2. **standalone 방식 (비권장, fallback)**
   - GitHub releases zip을 `AppData\Local\pnpm`에 설치
   - ⚠️ Windows에서 `AppData`가 OneDrive 백업 대상이면 파일이 자동 정리될 수 있음
   - Phase 1.3 단계에서 standalone 설치본이 OneDrive 동기화로 사라진 사례 발생 — 재발 방지 차원에서 비권장
   - 부득이 사용 시 OneDrive 백업 제외 폴더로 설정 필요

### 2.2 Firebase 프로젝트 분리 정책
- `bridge-dev` (실제 ID: `bridge-61dd9`) — 개발 (모든 개발자 공용)
- `bridge-staging` — 통합 테스트 (PR Preview용) — Phase 1 후반에 생성
- `bridge-prod` — 운영 — production 진입 시점에 생성
- 각 프로젝트는 별도의 Firestore·Auth·Storage·Functions를 가진다
- Firebase Project ID로 환경 자동 분기 (`NEXT_PUBLIC_FIREBASE_PROJECT_ID`)
- `.firebaserc`에 alias로 매핑: `dev` / `staging` / `prod`

### 2.3 Firestore Hot-Path 정책 (NEXUS FATE 경험 반영)
- 1초당 1 doc 이상 업데이트되는 path는 즉시 hot-path로 간주, distributed counter 패턴 적용
- 공동구매 진행 카운터 같은 high-write 필드는 shard 10~20개로 분산
- 읽기는 shard 합산 (`Promise.all` + reduce)
- 자세한 구현은 ARCHITECTURE.md §6 참조

---

## 3. 파일·폴더 구조

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # RootLayout (Pretendard 변수 + globals.css import)
│   ├── globals.css               # 디자인 토큰 + shadcn HSL — App Router 표준 위치
│   ├── (marketing)/              # 공개 페이지 그룹
│   │   ├── page.tsx              # 랜딩
│   │   ├── about/
│   │   └── pricing/
│   ├── (buyer)/                  # 병원 사용자
│   │   ├── search/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── orders/
│   │   ├── subscriptions/
│   │   ├── groupbuys/
│   │   └── rfq/
│   ├── (vendor)/                 # 공급업체 셀러센터
│   │   └── seller/
│   │       ├── products/
│   │       ├── orders/
│   │       ├── settlement/
│   │       └── analytics/
│   ├── (admin)/                  # 플랫폼 운영자
│   │   └── admin/
│   │       ├── vendors/
│   │       ├── products/
│   │       └── settlement/
│   ├── (auth)/                   # 로그인·가입
│   │   ├── login/
│   │   └── onboarding/
│   └── api/
│       ├── login/                # next-firebase-auth-edge가 사용하는 로그인 쿠키 엔드포인트
│       ├── logout/               # 로그아웃 쿠키 제거
│       ├── refresh-token/        # 클라이언트 ID 토큰 갱신
│       ├── trpc/[trpc]/
│       └── webhooks/
│           ├── portone/
│           └── solapi/
├── components/
│   ├── ui/                       # shadcn 컴포넌트
│   ├── marketing/                # 랜딩 전용
│   ├── buyer/
│   ├── vendor/
│   ├── admin/
│   └── shared/
├── server/
│   ├── firebase/
│   │   ├── admin.ts              # firebase-admin singleton (Server only)
│   │   ├── auth.ts               # 서버 측 인증 헬퍼 (getTokens 등)
│   │   └── collections.ts        # 컬렉션 경로 상수 + 타입 헬퍼
│   ├── api/
│   │   ├── routers/              # tRPC routers
│   │   │   ├── auth.ts
│   │   │   ├── hospital.ts
│   │   │   ├── vendor.ts
│   │   │   ├── product.ts
│   │   │   ├── order.ts
│   │   │   ├── subscription.ts
│   │   │   ├── groupbuy.ts
│   │   │   ├── rfq.ts
│   │   │   └── admin.ts
│   │   ├── trpc.ts
│   │   └── root.ts
│   └── services/                 # 비즈니스 로직
│       ├── portone.ts
│       ├── clova-ocr.ts
│       ├── solapi.ts
│       ├── udi-report.ts
│       └── algolia.ts
├── lib/
│   ├── firebase/
│   │   ├── client.ts             # Firebase Web SDK (브라우저)
│   │   └── auth-context.tsx      # AuthContext + useAuth hook
│   ├── utils.ts
│   ├── constants.ts
│   ├── validators/               # Zod schemas
│   └── hooks/
├── styles/                       # 빈 폴더 유지 — 향후 별도 CSS 모듈(프린트 전용, 이메일 템플릿)용
└── proxy.ts                      # next-firebase-auth-edge authMiddleware (Next.js 16: 옛 middleware.ts)

functions/                        # Cloud Functions for Firebase (별도 패키지)
├── src/
│   ├── index.ts                  # entry, exports
│   ├── triggers/                 # Firestore 트리거
│   │   ├── on-order-created.ts
│   │   └── on-suborder-shipped.ts
│   ├── scheduled/                # Cloud Scheduler 트리거
│   │   ├── subscription-runner.ts    # 매일 03:00 KST
│   │   ├── groupbuy-closer.ts        # 매분 (마감 임박 정리)
│   │   └── udi-monthly-report.ts     # 매월 말일
│   ├── callable/                 # HTTPS Callable
│   │   ├── settle-suborder.ts
│   │   └── finalize-groupbuy.ts
│   ├── lib/
│   │   ├── firestore.ts
│   │   ├── portone.ts
│   │   └── distributed-counter.ts
│   └── types.ts
├── package.json                  # 별도 의존성
├── tsconfig.json
└── .eslintrc.json

firestore.rules                   # Firestore Security Rules
firestore.indexes.json            # Composite Index 정의
storage.rules                     # Cloud Storage Security Rules
firebase.json                     # Firebase CLI 설정
.firebaserc                       # 프로젝트 alias (dev/staging/prod)
```

**규칙**:
- `app/` 내부에서는 라우팅과 페이지 컴포넌트만. 비즈니스 로직은 `server/services/` 또는 `functions/`로
- tRPC router는 도메인 단위로 분리
- shadcn 컴포넌트는 절대 직접 수정하지 말 것. 필요 시 `components/shared/`에 wrapper 작성
- 글로벌 스타일은 `src/app/globals.css` 한 곳에서 관리(Next.js 16 App Router 표준). `layout.tsx`에서 직접 import한다. `src/styles/`는 보조 CSS 전용
- **Cloud Functions는 별도 패키지** (`functions/`) — `src/` 코드와 의존성 분리. Web 빌드에 firebase-admin 포함되지 않도록 격리
- **클라이언트 SDK(`firebase`)는 `src/lib/firebase/`에서만 import** — 절대 server/ 폴더에서 import 금지 (혼동 방지)
- **Admin SDK(`firebase-admin`)는 `src/server/firebase/` 또는 `functions/`에서만 import** — 절대 client component에서 import 금지

---

## 4. 환경변수 명세 (`.env.example`)

```bash
# Firebase Web (Client) — NEXT_PUBLIC_ 프리픽스 필수 (브라우저 노출)
NEXT_PUBLIC_FIREBASE_API_KEY=""
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
NEXT_PUBLIC_FIREBASE_APP_ID=""

# Firebase Admin (Server only — 절대 NEXT_PUBLIC_ 붙이지 말 것)
FIREBASE_ADMIN_PROJECT_ID=""
FIREBASE_ADMIN_CLIENT_EMAIL=""
FIREBASE_ADMIN_PRIVATE_KEY=""           # \n은 그대로 두고 코드에서 replace

# next-firebase-auth-edge
NEXT_PUBLIC_FIREBASE_AUTH_COOKIE_NAME="AuthToken"
FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_1=""  # 32 bytes 이상, openssl rand -base64 32
FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_2=""  # 키 로테이션용

# OAuth — Google은 Firebase Console에서 자동, 카카오는 Phase 2+ Custom Token 방식
KAKAO_REST_API_KEY=""                    # Phase 2+
KAKAO_CLIENT_SECRET=""                   # Phase 2+

# PortOne V2
PORTONE_STORE_ID=""
PORTONE_API_SECRET=""
PORTONE_CHANNEL_KEY_KAKAO=""
PORTONE_CHANNEL_KEY_TOSS=""
PORTONE_WEBHOOK_SECRET=""

# Naver Clova OCR (사업자등록증)
NAVER_CLOVA_OCR_INVOKE_URL=""
NAVER_CLOVA_OCR_SECRET=""

# Solapi (알림톡)
SOLAPI_API_KEY=""
SOLAPI_API_SECRET=""
SOLAPI_PFID=""   # 카카오 플러스친구 ID

# Upstash Redis (Phase 2+ — 캐시·rate limiting)
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Algolia (Phase 2+ — 상품 검색)
NEXT_PUBLIC_ALGOLIA_APP_ID=""
NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=""        # search-only key
ALGOLIA_ADMIN_KEY=""                     # server only

# MFDS UDI OpenAPI
MFDS_UDI_API_KEY=""
MFDS_UDI_API_ENDPOINT=""

# 국세청 사업자 진위확인
NTS_BIZINFO_API_KEY=""

# Sentry
SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=""
NEXT_PUBLIC_POSTHOG_HOST=""

# Cron Secret (Vercel Cron 또는 Cloud Scheduler 인증)
CRON_SECRET=""
```

`.env.local`은 절대 커밋 금지. `.gitignore`에 명시.

---

## 5. 코드 스타일 컨벤션

### 5.1 명명 규칙
- **파일명**: kebab-case (`product-list.tsx`, `order-detail.tsx`)
- **컴포넌트**: PascalCase (`ProductList`, `OrderDetail`)
- **함수·변수**: camelCase
- **상수**: SCREAMING_SNAKE_CASE
- **Firestore 컬렉션**: camelCase 복수형 (`hospitals`, `vendors`, `subOrders`)
- **Firestore 필드**: camelCase
- **Document ID**: `nanoid()` 또는 Firestore auto-id (monotonically 증가 금지)

### 5.2 import 순서
```ts
// 1. React / Next
import { useState } from "react";
import Link from "next/link";

// 2. 외부 라이브러리
import { z } from "zod";
import { format } from "date-fns";

// 3. Firebase (별도 그룹 — 혼동 방지)
import { collection, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

// 4. 내부 (절대경로)
import { api } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

// 5. 타입 (별도 그룹)
import type { Hospital } from "@/lib/types";
```

### 5.3 컴포넌트 작성
- Server Component 기본. Client는 명시적 `"use client"`
- Firebase Client SDK 호출은 항상 Client Component에서만
- Server Component에서는 `firebase-admin`만 사용
- Props 타입은 `interface Props {}` 또는 inline
- 한 파일 = 한 컴포넌트 원칙
- 50줄 넘으면 분리 고려

### 5.4 server-side 가드 패턴

> Phase 1.4 에서 `server-only` npm 패키지가 tsx/Node 스크립트(시드, Cloud Function 로컬 실행)와 충돌해 제거되었다.
> 대신 동등한 런타임 가드를 server-only 모듈 최상단에 둔다.

**규칙**: `firebase-admin`, signed URL 발급기, 사업자 진위확인 service 등 **브라우저에 절대 노출되면 안 되는 모듈**은 다음 패턴을 파일 최상단(다른 import 보다 앞)에 둔다:

```ts
// Server-only enforcement.
// `server-only` 패키지는 import 시점에 throw하므로 tsx/Node 스크립트(시드/Cloud Function 로컬 실행)
// 와 충돌. 동등한 runtime 가드로 대체.
if (typeof window !== "undefined") {
  throw new Error("<모듈명> must be used only on the server side.");
}

import { ... } from "firebase-admin/...";
// (이하 구현)
```

**적용 대상**:
- `src/server/firebase/admin.ts` — Admin SDK singleton
- `src/server/firebase/auth.ts` — getServerTokens 등 서버 헬퍼
- `src/server/services/*.ts` — Clova OCR / NTS verify / Solapi / PortOne 등 외부 API 클라이언트
- `src/lib/firestore-helpers.ts` — Admin 전용 헬퍼 부분
- `functions/src/**/*.ts` — Cloud Functions 전체

**금지 사항**:
- `server-only` npm 패키지 재도입 금지 (tsx 충돌 재발)
- `process.env` 가드 (예: `if (typeof process === "undefined")`) 단독 사용 금지 — Edge runtime 도 `process`를 가짐. 반드시 `typeof window` 체크
- Client Component 가 의도치 않게 이런 모듈을 import 한 경우, 빌드는 통과하더라도 런타임에 명시적으로 throw 되어 즉시 발견되어야 한다

**부가 규칙**:
- import 순서상 이 가드는 다른 import 보다 앞에 위치 (가드 자체는 statement 이므로 ESLint `import/first` 와 충돌할 수 있음 — 필요 시 `// eslint-disable-next-line import/first` 사용)
- 에러 메시지는 영어 1줄로 짧게. 사용자 노출용이 아니라 개발자가 잘못된 import 를 즉시 발견하기 위함
- Cloud Functions 내부 모듈은 자동으로 server-only 환경이지만, 일관성을 위해 동일 가드 유지 권장

### 5.5 에러 처리
- tRPC procedure 내부는 `TRPCError` throw
- Cloud Function 내부는 `HttpsError` throw (callable) 또는 명시적 try-catch + logger
- 결제·UDI 보고 등 외부 API는 Sentry capture + 재시도 큐(Firestore `_retryQueue` 컬렉션)
- 사용자에게는 한글 메시지 (예: "결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")

### 5.6 i18n
- 한국어 고정. 영어 메시지 작성 금지.
- 한 곳에서 관리하기 위해 `lib/messages.ts`에 상수화 권장 (단 MVP에서는 inline 허용)

### 5.7 Firestore 쿼리 패턴
- **읽기**: Server Component → `firebase-admin`, Client Component → `firebase/firestore`
- **컬렉션 path 상수화**: `src/server/firebase/collections.ts`에 모든 경로 상수 + 타입 헬퍼
- **인덱스**: 복합 쿼리는 항상 `firestore.indexes.json`에 명시. 콘솔에서 즉석 생성 금지
- **타임스탬프**: 항상 `serverTimestamp()` 사용 — 클라이언트 시간 신뢰 금지

---

## 6. Git 컨벤션

### 6.1 브랜치
- `main` — 운영
- `dev` — 통합 개발
- `feat/{phase}-{기능명}` — 예: `feat/phase1-firebase-auth`
- `fix/{이슈번호}-{요약}`
- `chore/{내용}`

### 6.2 커밋 메시지
```
<type>: <한 줄 요약>

<상세 설명 (선택)>

<관련 이슈 / Phase>
```

**type**: `feat`, `fix`, `chore`, `refactor`, `style`, `docs`, `test`

예시:
```
feat: 공급업체 의료기기판매업 신고증 OCR 검증 추가

- Clova OCR로 신고증 번호 추출
- Firestore `vendors/{id}` 문서에 reviewQueue: true 플래그
- Cloud Function on-vendor-pending이 운영자 알림 발송

Phase 1 / #12
```

### 6.3 PR
- 1 PR = 1 기능 또는 1 체크포인트
- Description에 (1) 무엇을 (2) 왜 (3) 어떻게 테스트 했는지 작성
- Phase별 체크포인트 단위 권장
- Firestore Rules 또는 Functions 변경이 있으면 PR description에 반드시 명시

---

## 7. 테스트 정책

### 7.1 우선순위 (MVP)
- ✅ **필수**: 결제 플로우, 정기구독 cron, 공동구매 capture/void, **Firestore Security Rules**
- 🟡 **권장**: 사업자 인증, vendor 심사
- ⬜ **선택**: UI 컴포넌트, 랜딩

### 7.2 도구
- 단위: Vitest
- E2E: Playwright (결제는 PortOne 테스트 모드)
- **Firestore Rules**: `@firebase/rules-unit-testing` + Firebase Emulator Suite
- **Cloud Functions**: Firebase Local Emulator + Vitest

### 7.3 Firebase Emulator Suite 활용
- 로컬 개발 시 `firebase emulators:start` 사용 권장
- 실제 dev 프로젝트 접속은 최소화 (실수로 production 영향 방지)

---

## 8. 보안 & 컴플라이언스 체크리스트

매 PR마다 다음을 확인:
- [ ] 비밀값이 코드/로그에 노출되지 않았는가
- [ ] `NEXT_PUBLIC_` 프리픽스가 잘못 붙은 server-only 키가 없는가
- [ ] **Firestore Security Rules**가 신규/변경된 컬렉션에 작성되었는가
- [ ] **클라이언트 SDK에서 민감 컬렉션(`settlements`, `auditLogs` 등)에 직접 접근하지 않는가**
- [ ] tRPC procedure에 `protectedProcedure` 또는 role check 적용했는가
- [ ] Firestore 쿼리에 `hospitalId` 또는 `vendorId`로 row-level 격리를 했는가 (Security Rules + 코드 양쪽)
- [ ] 사용자 입력은 Zod로 검증했는가
- [ ] 파일 업로드는 MIME type, 크기 제한, Firebase Storage Rules로 제한했는가
- [ ] 한국 「개인정보보호법」: 사업자 정보·연락처 수집은 동의 받았는가
- [ ] 한국 「전자상거래법」: 통신판매업 신고번호 푸터 표시
- [ ] 한국 「의료기기법」: 판매업 신고증 미검증 vendor의 상품 노출 금지

---

## 9. 작업 시작 시 Claude Code 행동 규칙

1. **새 작업이 들어오면**: 먼저 `CLAUDE.md`, `PRD.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`를 모두 읽었는지 확인
2. **모호한 요청이면**: 추측하지 말고 사용자에게 질문 (한 번에 1~3개)
3. **큰 변경이면**: 코드 작성 전에 **계획**을 먼저 제시하고 사용자 승인 받기
4. **파일 생성·수정 후**: 변경된 파일 목록과 영향 범위를 요약 출력
5. **에러 발생 시**: 추측 디버깅 금지. 에러 메시지·재현 단계·로그를 사용자에게 보고
6. **Firestore Rules·Functions 변경 시**: 반드시 diff를 보여주고 사용자가 직접 `firebase deploy` 실행

---

## 10. Phase 진행 현황 (이 섹션은 진행하며 갱신)

- [x] Phase 1: Foundation, Firebase 셋업, Auth (1.0 ~ 1.8 완료)
- [ ] Phase 2: Catalog, Cart, Multi-vendor Checkout (Week 5~12)
- [ ] Phase 3: Subscription Auto-ordering (Week 13~18)
- [ ] Phase 4: Group Buying (Week 19~24)
- [ ] Phase 5: RFQ & Quoting (Week 25~30)
- [ ] Phase 6: UDI 자동보고 & Analytics (Week 31~36)

---

## 변경 이력

### v2 (Firebase 전환)
- 데이터: PostgreSQL + Prisma → Firebase Firestore
- 인증: NextAuth v5 → Firebase Authentication + next-firebase-auth-edge
- 스토리지: Cloudflare R2 → Firebase Storage
- 실시간: Supabase Realtime → Firestore onSnapshot
- 서버 로직: 일부를 Cloud Functions for Firebase로 이전 (정산·공동구매 마감·정기구독·UDI 보고)
- 폴더 구조: `prisma/` 제거, `functions/` 추가, `src/server/firebase/` 추가
- 환경변수: DATABASE_URL 계열 제거, Firebase 키 추가

### v1 (Initial)
- Supabase + Postgres + Prisma 스택

---

**이 문서가 갱신될 때마다 모든 작업자(사용자 + Claude Code)가 재학습해야 한다.**
