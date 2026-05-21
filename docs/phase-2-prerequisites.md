# Phase 2 사전 준비 — 외부 API 가입 로드맵

> Phase 2 (Catalog · Cart · Multi-vendor Checkout)는 외부 결제·검색·알림 SaaS에 강하게 의존한다.
> 가입·심사 대기 시간이 길어 사용자가 미리 신청해두면 Phase 2 진입 시 코드 작업이 막히지 않는다.
>
> **현재 상태 (2026-05-21 기준)**: 모든 `.env.local` placeholder 키는 Phase 1.2에서 이미 작성되어 있다 (값은 빈 문자열). 가입 완료 후 해당 키에 값만 채워 넣으면 된다.

---

## 1. PortOne V2 (구 아임포트) — **결제 게이트웨이**

**용도**: 카드·간편결제·계좌이체 처리. Phase 2 multi-vendor checkout 의 핵심.

**가입 흐름**:
1. <https://portone.io> 가입 (사업자 등록증 필요 — MedPlace 법인 명의)
2. 콘솔에서 "스토어" 생성 → `STORE_ID` 발급 (즉시)
3. PG 채널 연동 신청:
   - **카카오페이**: 카카오 비즈니스 가맹 심사 — **3~5 영업일**
   - **토스페이먼츠**: 토스 PG 가맹 심사 — **3~7 영업일**
4. Webhook 엔드포인트 등록 — Vercel Preview URL이 정해진 후 (`https://medplace-staging.vercel.app/api/webhooks/portone`)
5. API Secret + Webhook Secret 발급
6. **테스트 모드 키**로 먼저 받아두고, production 키는 Phase 2 후반에 별도 신청

**소요 시간**: **3~7 영업일** (PG 심사 종속). 카카오·토스 동시 신청 권장.

**채울 키** (`.env.local`):
```bash
PORTONE_STORE_ID=""
PORTONE_API_SECRET=""
PORTONE_CHANNEL_KEY_KAKAO=""
PORTONE_CHANNEL_KEY_TOSS=""
PORTONE_WEBHOOK_SECRET=""
```

**주의**:
- 사업자 등록증 사진 + 통신판매업 신고증이 가맹 심사에 필요. 둘 다 사전 발급 권장.
- 카카오페이는 카카오 비즈니스 채널이 별도로 필요 (알림톡과 같은 채널 재사용 가능).
- production 키는 절대 Phase 2 개발 중에 받지 말 것 — 실 결제 발생 위험. 테스트 모드만.

---

## 2. Algolia — **상품 검색 (Phase 2+)**

**용도**: Firestore 트리거로 `/products` 변경분을 Algolia 인덱스에 sync. typo-tolerance + facet (카테고리·가격대) + 한국어 토큰화.

**가입 흐름**:
1. <https://www.algolia.com> 무료 가입 (즉시)
2. 신규 application 생성 → `Application ID` 발급
3. API Keys 페이지에서 `Search-Only API Key` + `Admin API Key` 발급 (즉시)
4. 인덱스는 Phase 2 코드 작성 시 생성 (`products_dev`, `products_staging`, `products_prod`)

**소요 시간**: **즉시 (10분 이내)**. 외부 심사 없음.

**채울 키**:
```bash
NEXT_PUBLIC_ALGOLIA_APP_ID=""
NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=""        # search-only key (브라우저 노출 OK)
ALGOLIA_ADMIN_KEY=""                     # server only — 절대 NEXT_PUBLIC_ 금지
```

**주의**:
- Free tier: 10,000 search/month + 10,000 record. Phase 2 MVP 충분.
- Phase 1에서는 활성화 보류 → Phase 2 결정 #3 참고 (`docs/phase-2-decisions.md`).

---

## 3. Solapi — **카카오 알림톡**

**용도**: vendor 승인/반려/주문/배송 알림. Phase 1.8 에서 mock 으로만 호출 중 (`src/server/services/solapi.ts`).

**가입 흐름**:
1. <https://solapi.com> 가입 (사업자 등록증 필요)
2. 카카오 비즈니스 계정 연결 → "발신 채널 (플러스친구)" 등록 — **1~3 영업일**
3. SOLAPI 콘솔에서 `API Key` + `API Secret` 발급 (즉시)
4. **알림톡 템플릿 사전 심사** (각 템플릿 별 카카오 심사):
   - `VENDOR_APPROVED` — 입점 승인 안내
   - `VENDOR_REJECTED` — 입점 반려 안내 (사유 변수 포함)
   - `VENDOR_SUSPENDED` — 이용 정지 안내
   - `VENDOR_REOPENED` — 정지 해제 안내
   - `ORDER_NEW` — Phase 2: 신규 주문 알림 (vendor 측)
   - `ORDER_SHIPPED` — Phase 2: 발송 완료 (buyer 측)
   - `SUBSCRIPTION_FAIL` — Phase 3: 정기구독 결제 실패
5. 템플릿별 심사 — **각 2~4 영업일**. 거절 시 문구 수정 후 재신청 (자주 반려됨, 여유 일정 필수).

**소요 시간**: **계정 1~3일 + 템플릿 각 2~4일** → 전체 7~14 영업일 (병렬 진행 시).

**채울 키**:
```bash
SOLAPI_API_KEY=""
SOLAPI_API_SECRET=""
SOLAPI_PFID=""          # 카카오 플러스친구 ID (등록 후 발급)
```

**주의**:
- 알림톡 문구는 광고성 표현 금지 (정보성만). "할인", "특가" 단어 사용 시 거절률 매우 높음.
- 템플릿 변수는 `#{변수명}` 형식, 카카오 심사용 샘플 값 필수 입력.
- 사전 심사 통과한 템플릿 코드는 `src/server/services/solapi.ts`의 `TEMPLATE_CODES` 상수에 매핑.

---

## 4. (참고) 이미 준비된 항목

다음은 Phase 1 시점에 이미 발급되어 있거나, Phase 2 직접 의존이 아니어서 미루어도 무방:

| 항목 | 상태 | 비고 |
|---|---|---|
| Firebase (dev/staging/prod) | dev=`bridge-61dd9` 완료, staging/prod 미생성 | Phase 1.8 완료 시점에 dev 환경 안정. staging 은 Phase 2 후반 첫 Vercel Preview 시 필요 |
| Vercel 프로젝트 | 미연결 | Phase 2 결정 #1 (`docs/phase-2-decisions.md`) — Preview 시작 시점 결정 후 진행 |
| Naver Clova OCR | placeholder, mock 사용 중 | Phase 2 MVP는 계속 mock 유지 가능. 실 API 전환은 production 직전 |
| 국세청 사업자 진위확인 | placeholder, mock 사용 중 | 동일 (mock 유지) |
| MFDS UDI OpenAPI | placeholder | Phase 6 까지 mock |
| 솔라피 알림톡 mock | Phase 1.8-E 에서 mock 동작 검증 완료 | 위 §3 참고 |
| Upstash Redis | placeholder | Phase 2 결정 #2 (`docs/phase-2-decisions.md`) — cart 저장소 선택 후 가입 여부 결정 |

---

## 5. 가입 대기 중 병렬로 진행 가능한 작업

PG 심사·알림톡 템플릿 심사가 영업일 단위로 걸리는 동안, Claude Code 가 외부 키 없이 진행할 수 있는 작업:

### 5.1 product 컬렉션 스키마 + tRPC router (Phase 2 첫 작업)
- `src/lib/types.ts`의 `Product`/`ProductVariant`/`Inventory` 타입은 ARCHITECTURE.md §2.3 에서 이미 정의 완료
- `src/server/firebase/collections.ts`에 `PRODUCTS` 경로 상수 추가 + 시드 데이터는 Phase 1.4 에서 3개 product 이미 삽입됨
- 다음 작업: `src/server/api/routers/product.ts` (vendor 측 CRUD + 공개 list/getById), `/seller/products` UI 골격, `/products/[id]` 공개 상품 페이지
- 외부 API 의존 없음 — 결제·검색은 mock/stub 으로 우회 가능

### 5.2 cart UI 골격 (저장소 결정 전 단계)
- `useCart()` hook 의 인터페이스 정의 (`addItem`, `removeItem`, `updateQty`, `clear`)
- 저장소 결정 (#2) 전까지는 `localStorage` 임시 구현으로 진행 가능
- 진짜 저장소 (Firestore / Upstash) 는 결정 후 단순 swap

### 5.3 Firestore Security Rules — `/products` + `/cartItems` (또는 cart 결정 후) 작성
- 자동 deploy 금지 (헌법 §1.1). diff 제시 후 사용자 수동 `firebase deploy --only firestore:rules`

### 5.4 admin 상품 모더레이션 큐 (#1.8 패턴 재사용)
- `/admin/products?status=PENDING_REVIEW` — 신규 상품 의료기기 인허가 정보 검토
- Phase 1.8의 `/admin/vendors` 패턴을 그대로 product 로 적용

---

## 6. Phase 2 진입 신호 체크리스트

다음 모두 충족 시 사용자가 Claude Code 에게 "Phase 2 진입" 신호:

- [ ] **§1 PortOne**: STORE_ID + API_SECRET 최소 발급 (테스트 모드 채널 1개 이상)
- [ ] **§2 Algolia**: 가입 완료 + APP_ID 발급 (인덱스 미생성 OK)
- [ ] **§3 Solapi**: 계정 가입 + PFID 등록 + 최소 1개 템플릿 (VENDOR_APPROVED) 심사 통과
- [ ] **`docs/phase-1-manual-verification.md`** 모든 항목 통과
- [ ] **`docs/phase-2-decisions.md`** 3개 결정 사항 확정

---

## 변경 이력

- 2026-05-21: 최초 작성 (Phase 1 완료 시점)
