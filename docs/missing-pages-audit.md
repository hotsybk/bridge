# 미비 페이지 전수 조사

> 2026-05-21 기준. Phase 1 + 디자인 보강 1~3차 + 그룹 A/B 완료 시점.
> 작성됨/미비 페이지 전체를 도메인·Phase·우선순위로 정리.

---

## 0. 요약

| 구분 | 개수 |
|---|---|
| ✅ 작성 완료 | **15개** (페이지 12 + API 5) |
| ⏳ Phase 2 미비 | **15개** |
| 🔮 Phase 3~6 미비 | **13개** |
| 📜 법적/시스템 미비 | **6개** |
| **총 미비 페이지** | **34개** |

---

## 1. ✅ 작성 완료 (15개)

### 1.1 공개 (비로그인 접근 가능)

| 경로 | 디자인 완성도 | 비고 |
|---|---|---|
| `/` | ★★★★★ | Apple 스타일 랜딩 (6섹션) |
| `/about` | ★★★★★ | 회사 소개 (B1 신규) |
| `/pricing` | ★★★★★ | 수수료 정책 + FAQ (B2 신규) |
| `/login` | ★★★★ | Split layout + Google OAuth |
| `/register` | ★★★★ | 2-step refactor (역할 → 폼) |

### 1.2 인증 후

| 경로 | 디자인 완성도 | 비고 |
|---|---|---|
| `/onboarding/buyer` | ★★★★ | 4-step wizard + 검증 시각화 (A3) |
| `/onboarding/vendor` | ★★★★ | 5-step + 약관 + 심사 대기 (A4) |
| `/seller/pending` | ★★★★ | 상태별 톤 + 타임라인 (A5) |
| `/seller/products` | ★★★ | placeholder + Phase 2 안내 (B3) |
| `/admin/vendors` | ★★★★ | StatCard 4개 + 큐 (A6) |
| `/admin/vendors/[id]` | ★★★★ | sticky 패널 + 서류 카드 (A7) |
| `/admin/debug/snapshot` | ★ (디버그) | Firestore 실시간 구독 점검용 |

### 1.3 API Route Handlers

| 경로 | 비고 |
|---|---|
| `/api/login` | next-firebase-auth-edge 쿠키 설정 |
| `/api/logout` | 쿠키 제거 |
| `/api/refresh-token` | ID 토큰 갱신 |
| `/api/auth/init-user` | Firestore /users/{uid} 초기화 + Custom Claims |
| `/api/trpc/[trpc]` | tRPC v11 라우터 |

---

## 2. ⏳ Phase 2 미비 (15개)

> Phase 2 = Catalog · Cart · Multi-vendor Checkout · 외부 API 본격 연동.
> 진입 조건: PortOne·Algolia·Solapi 가입 완료.

### 2.1 병원(buyer) 측 — 카탈로그·구매 흐름 (5개)

| # | 경로 | 우선순위 | 작업 시간 | 핵심 기능 |
|---|---|---|---|---|
| C1 | `/search` | **P0** | 12h | 카탈로그 검색 (카테고리·등급·가격·공동구매 필터 + Algolia) |
| C2 | `/products/[id]` | **P0** | 8h | 상품 상세 (UDI·등급·인증서·티어 가격·CTA 5종) |
| C3 | `/cart` | **P0** | 10h | 벤더별 분할 카트 + 결제 진입 |
| C4 | `/checkout` | **P0** | 15h | 3-step 결제 (배송지·결제수단·확인) + PortOne 연동 |
| C5 | `/orders` | **P0** | 6h | 주문 이력 (SubOrder 분리 표시) |

### 2.2 병원(buyer) 측 — 주문 상세 (1개)

| # | 경로 | 우선순위 | 작업 시간 | 핵심 기능 |
|---|---|---|---|---|
| C6 | `/orders/[id]` | **P0** | 5h | 주문 상세 + 배송 상태 추적 + 세금계산서 다운로드 |

### 2.3 공급업체(vendor) 측 — 셀러센터 (5개)

| # | 경로 | 우선순위 | 작업 시간 | 핵심 기능 |
|---|---|---|---|---|
| C7 | `/seller/products` (실제) | **P0** | 8h | 상품 목록 + 등록 + 재고 관리 (현재 placeholder 교체) |
| C8 | `/seller/products/new` | **P0** | 10h | 상품 등록 (UDI·인증서·가격 티어 입력) |
| C9 | `/seller/products/[id]` | **P0** | 6h | 상품 편집·미공개 토글 |
| C10 | `/seller/orders` | **P0** | 8h | 받은 주문 + 배송 처리 + UDI 입력 |
| C11 | `/seller/settlement` | **P1** | 8h | 정산 대시보드 (D+3 자동 정산 내역) |

### 2.4 운영자(admin) 측 — 상품·결제 (3개)

| # | 경로 | 우선순위 | 작업 시간 | 핵심 기능 |
|---|---|---|---|---|
| C12 | `/admin/products` | **P0** | 6h | 상품 모더레이션 큐 (의료기기 인허가 확인) |
| C13 | `/admin/products/[id]` | **P0** | 5h | 상품 상세 + 승인·반려 액션 |
| C14 | `/admin/orders` | **P1** | 5h | 전체 주문 감시 (검색·필터) |

### 2.5 운영자(admin) 측 — 정산 (1개)

| # | 경로 | 우선순위 | 작업 시간 | 핵심 기능 |
|---|---|---|---|---|
| C15 | `/admin/settlement` | **P1** | 10h | 정산 운영 (vendor별 정산 내역·이체 트리거) |

**Phase 2 합계**: 약 **122시간** (3주 풀타임 또는 6~8주 파트)

---

## 3. 🔮 Phase 3~6 미비 (13개)

### 3.1 Phase 3 — 정기구독 자동발주 (4개)

| 경로 | 사용자 | 핵심 기능 | 작업 |
|---|---|---|---|
| `/subscriptions` | buyer | 정기구독 목록 + 활성/일시정지 | 8h |
| `/subscriptions/new` | buyer | 신규 구독 설정 (상품·수량·주기) | 10h |
| `/subscriptions/[id]` | buyer | 구독 상세 + 일정 변경 + 해지 | 6h |
| `/seller/subscriptions` | vendor | 받은 구독 관리 | 6h |

Cloud Function 필요: `subscription-runner` (매일 03:00 KST cron).

### 3.2 Phase 4 — 공동구매 (4개)

| 경로 | 사용자 | 핵심 기능 | 작업 |
|---|---|---|---|
| `/groupbuys` | buyer | 진행 중 공동구매 목록 (카드 그리드) | 8h |
| `/groupbuys/[id]` | buyer | 공동구매 상세 + 참여 + 진행률 (distributed counter) | 12h |
| `/seller/groupbuys` | vendor | 공동구매 운영 (참여 현황) | 6h |
| `/admin/groupbuys` | admin | 공동구매 마감·취소·정산 트리거 | 8h |

Cloud Function 필요: `groupbuy-closer` (매분 마감 임박 정리) + `finalize-groupbuy` (HTTPS Callable).

### 3.3 Phase 5 — RFQ (견적 요청) (3개)

| 경로 | 사용자 | 핵심 기능 | 작업 |
|---|---|---|---|
| `/rfq` | buyer | RFQ 목록 (전송한 견적 요청 상태) | 6h |
| `/rfq/new` | buyer | 견적 요청 생성 (상품·수량·납기) | 10h |
| `/rfq/[id]` | buyer | 견적 비교 + 채택 + 결제 | 12h |

### 3.4 Phase 6 — UDI 자동보고 + 분석 (2개)

| 경로 | 사용자 | 핵심 기능 | 작업 |
|---|---|---|---|
| `/seller/analytics` | vendor | 매출 분석 (시계열 차트) | 12h |
| `/admin/audit-logs` | admin | 감사 로그 검색·필터 | 6h |

Cloud Function 필요: `udi-monthly-report` (매월 말일 식약처 API 보고).

---

## 4. 📜 법적/시스템 미비 (6개) — Phase 1.x 백로그

> 이 페이지들은 **법적 의무** 또는 **사용자 경험의 기본**이라 Phase 진행과 무관하게 빠르게 작성 필요.

### 4.1 법적 의무 (3개) — 통신판매업·전자상거래법

| # | 경로 | 우선순위 | 작업 시간 | 의무 근거 |
|---|---|---|---|---|
| L1 | `/legal/terms` | **P0** | 4h | 서비스 이용약관 (전자상거래법 §13) |
| L2 | `/legal/privacy` | **P0** | 4h | 개인정보 처리방침 (개인정보보호법 §30) |
| L3 | `/legal/marketplace` | **P0** | 2h | 통신판매업 신고번호 표시 (전자상거래법 §10) |

⚠️ 현재 footer 에 placeholder ("사업자 등록 진행 중 · 통신판매업 신고 예정")만 있음. 실 운영 진입 시 필수.

### 4.2 사용자 계정 관리 (2개) — 모든 사용자 공통

| # | 경로 | 우선순위 | 작업 시간 | 기능 |
|---|---|---|---|---|
| L4 | `/account` | **P1** | 6h | 프로필 + 비밀번호 변경 + 알림 설정 |
| L5 | `/account/team` | **P1** | 8h | 팀원 초대 (BUYER 5명 한도, MVP) + role 관리 |

### 4.3 에러/시스템 (1개) — UX 기본

| # | 경로 | 우선순위 | 작업 시간 | 기능 |
|---|---|---|---|---|
| L6 | 커스텀 `not-found.tsx` + `error.tsx` | **P1** | 3h | 404·500 페이지 디자인 (현재 Next.js 기본) |

**법적/시스템 합계**: 약 **27시간**

---

## 5. 🛠 Cloud Functions / API webhooks (별도 — 페이지 아님)

> `functions/` 패키지에 골격만 있고 구현 안 됨. 페이지 작업과 병행 필요.

| 종류 | 이름 | Phase | 작업 |
|---|---|---|---|
| Firestore 트리거 | `on-order-created` | Phase 2 | 신규 주문 알림톡 |
| Firestore 트리거 | `on-suborder-shipped` | Phase 2 | 배송 시작 알림 |
| HTTPS Callable | `createOrder` | Phase 2 | 다중 벤더 카트 → orders + subOrders 트랜잭션 |
| HTTPS Callable | `settle-suborder` | Phase 2 | D+3 정산 트리거 |
| Cloud Scheduler | `subscription-runner` | Phase 3 | 매일 03:00 정기구독 발주 |
| Cloud Scheduler | `groupbuy-closer` | Phase 4 | 매분 공동구매 마감 정리 |
| HTTPS Callable | `finalize-groupbuy` | Phase 4 | 공동구매 capture/void 결정 |
| Cloud Scheduler | `udi-monthly-report` | Phase 6 | 매월 말일 식약처 보고 |
| Webhook | `/api/webhooks/portone` | Phase 2 | PortOne 결제 검증 |
| Webhook | `/api/webhooks/solapi` | Phase 2~ | 알림톡 발송 결과 콜백 |

---

## 6. 우선순위 종합 권장 순서

### 즉시 진행 권장 (외부 API 가입 대기 중에 가능) — P0 법적 3개

1. **L1 `/legal/terms`** + **L2 `/legal/privacy`** + **L3 `/legal/marketplace`** (총 10h)
   - 외부 API 의존 없음
   - 코드 + 운영 정책 결정만 필요
   - production 진입 전 필수

### Phase 2 진입 직후 (외부 API 가입 완료 후) — P0 15개

2. **C12 `/admin/products`** + **C13 `/admin/products/[id]`** (먼저 — 상품 등록 전 모더레이션 큐 준비, 11h)
3. **C7-C9 vendor 상품 등록** (24h)
4. **C1-C2 buyer 카탈로그 + 상품 상세** (20h)
5. **C3 `/cart`** (10h)
6. **C4 `/checkout`** (15h, PortOne 연동)
7. **C5-C6 주문 이력 + 상세** (11h)
8. **C10 `/seller/orders`** (8h, 받은 주문 처리)

### Phase 2 후반 — P1 4개

9. **C11 `/seller/settlement`** + **C14 `/admin/orders`** + **C15 `/admin/settlement`** (23h)
10. **L4 `/account`** + **L5 `/account/team`** + **L6 error pages** (17h)

### Phase 3+ — 단계별

11. Phase 3 정기구독 (30h)
12. Phase 4 공동구매 (34h)
13. Phase 5 RFQ (28h)
14. Phase 6 UDI + Analytics (18h)

---

## 7. 작업 시간 종합 추정

| 구간 | 작업 시간 |
|---|---|
| Phase 1.x 법적 (L1~L3) | 10h |
| **Phase 2 전체** | 122h |
| Phase 2 추가 (L4~L6) | 17h |
| Phase 3 정기구독 | 30h |
| Phase 4 공동구매 | 34h |
| Phase 5 RFQ | 28h |
| Phase 6 UDI + Analytics | 18h |
| **합계** | **약 259시간** |

풀타임 (1일 8h) 기준 **약 6~7주**.
파트타임 (1주 20h) 기준 **약 13주 (3개월)**.

---

## 8. 다음 결정 사항

사용자가 결정할 것:

### A. 즉시 진행 가능한 부분
- **L1~L3 법적 페이지 3개** 지금 작성 시작할까?
  - 외부 API 의존 없음
  - 운영 정책 (이용약관 문구) 사용자 결정 필요
  - 결정 후 ~10시간 작업

### B. 외부 API 가입 시작
- `docs/phase-2-prerequisites.md` 의 PortOne·Algolia·Solapi 가입 지금 시작
- 가입 완료까지 1~2주
- 가입 대기 중 L1~L3 + 그 외 디자인 폴리싱 가능

### C. Cloud Functions 부분 준비
- `functions/` 패키지에 골격 코드만 작성 (배포는 사용자가 직접 `firebase deploy`)
- Phase 2 본격 작업 전 인프라 준비

---

## 변경 이력

- 2026-05-21: 최초 작성 (Phase 1 + 디자인 보강 그룹 A/B 완료 시점)
