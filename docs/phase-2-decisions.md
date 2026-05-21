# Phase 2 진입 시 결정할 3개 항목

> Phase 2 (Catalog · Cart · Multi-vendor Checkout) 코드 작성 전에 사용자가 명시적으로 결정해야 하는 운영·아키텍처 항목.
> 각 항목은 **권장 옵션 + 트레이드오프 + 결정 대기 마커**를 포함한다.
> 모든 항목이 확정되어야 Claude Code 가 Phase 2 첫 작업 (product router) 을 시작할 수 있다.

---

## 결정 #1 — Vercel Preview 시작 시점

**질문**: Vercel 프로젝트 연결과 Preview 배포를 언제 시작할 것인가?

### 옵션 A — Phase 2 진입 즉시 (적극 권장 ◎)
- Phase 2 코드 작성과 병행하여 첫 Vercel Preview 발행
- 장점:
  - PortOne webhook 등록 URL 을 일찍 확정 (PG 심사용)
  - Solapi 알림톡 콜백 URL 도 동일하게 일찍 확정
  - 외부 API 가입 → 키 발급 → Preview 검증 의 사이클이 짧아짐
  - PR 단위로 시각적 review 가능 → 헌법 §6.3 PR 워크플로우 강화
- 단점:
  - Vercel + Firebase staging 프로젝트 (`bridge-staging`) 사전 생성 작업 필요 (~1시간)
  - Vercel 환경변수 입력 작업 (Production / Preview / Development 3종 분리)

### 옵션 B — Phase 2 후반 (MVP 기능 완성 후)
- 첫 Vercel Preview 는 Phase 2.5 (multi-vendor checkout 완성) 시점
- 장점:
  - 초기 코드는 localhost 만으로 검증 → 외부 트래픽 노출 위험 최소
- 단점:
  - PortOne / Solapi webhook URL 확정이 늦어짐 → PG 심사 재신청 위험
  - production 진입 직전에야 staging 환경 처음 보게 됨 → 운영 리스크

### 권장
**옵션 A**. Phase 1 완료 시점이 외부 API 가입의 적기이고, webhook URL 확정 전제로 PortOne·Solapi 심사가 진행되어야 한다.

### 결정 (사용자 확정)
- 선택: ☐ A / ☐ B / ☐ 기타
- 결정 일자: ______
- 추가 조건: ______

---

## 결정 #2 — Cart 저장소: Firestore vs Upstash Redis

**질문**: 장바구니 (cart) 데이터를 어디에 저장할 것인가?

### 옵션 A — Firestore `/carts/{uid}` 도큐먼트 (권장 ◎)
- 사용자별 1 doc + cartItems 서브컬렉션 (또는 단일 도큐먼트 안에 items array)
- 장점:
  - 추가 SaaS 의존성 없음 → Phase 2 외부 API 부담 감소
  - Firebase Auth · Security Rules 와 자연스럽게 통합 (rules 로 격리)
  - 다중 디바이스 동기화 자동 (onSnapshot)
  - 무료 (Firestore free tier 충분)
- 단점:
  - 카트 변경마다 Firestore 쓰기 발생 → 비활성 카트도 storage 차지
  - hot-path 우려는 없음 (사용자별 1 doc)

### 옵션 B — Upstash Redis `cart:{uid}` 키 + TTL 30일
- 장점:
  - 카트 자동 만료 (TTL) — 30일 이상 미접근 시 청소 자동화
  - sub-millisecond 응답
- 단점:
  - 추가 SaaS 가입·과금 발생 (Upstash free tier 작음, prod 진입 시 유료 전환 가능성)
  - Firebase Auth 와 별도 ACL 관리 필요 (HMAC 또는 서명된 토큰 추가 작업)
  - 다중 디바이스 동기화는 REST 폴링 또는 별도 pubsub 구현 필요

### 옵션 C — `localStorage` only (MVP 임시)
- 장점: 외부 의존성 0
- 단점: 로그아웃 / 다른 디바이스 / 세션 종료 시 카트 소실 — B2B 사용자 경험 미흡

### 권장
**옵션 A (Firestore)**. NEXUS FATE 와 통일된 Firebase 스택을 따르고, Phase 2 단계에서 외부 의존성 추가를 미루는 것이 헌법 §1.1 ("스택 변경 사용자 명시적 승인 필요") 정신에 부합.

Upstash 는 Phase 4 (공동구매 hot-path) 또는 Phase 6 (rate limiting) 시점에 별도 결정 항목으로 도입 검토.

### 결정 (사용자 확정)
- 선택: ☐ A (Firestore) / ☐ B (Upstash) / ☐ C (localStorage MVP) / ☐ 기타
- 결정 일자: ______
- 추가 조건: ______

---

## 결정 #3 — Algolia 활성화 시점

**질문**: 상품 검색을 Algolia 로 인덱싱하기 시작할 시점은 언제인가?

### 옵션 A — Phase 2 진입 즉시 활성화
- product CRUD + Algolia sync 트리거를 동시에 개발
- 장점:
  - 상품 검색 UX 가 초기부터 매끄러움 (typo-tolerance, facet)
  - Algolia 인덱스가 일찍 구축되어 production 진입 시 안정적
- 단점:
  - 외부 API 1개 추가 → Phase 2 코드 복잡도 상승
  - Free tier 한도 모니터링 추가

### 옵션 B — Firestore 단순 쿼리로 MVP, Algolia 는 Phase 2.5 (권장 ◎)
- Phase 2.0~2.4 까지는 `where("category", "==", x).where("status", "==", "ACTIVE")` 만으로 카탈로그 운영
- Phase 2.5 (multi-vendor checkout 완성 후) 에 Algolia 통합
- 장점:
  - 초기 코드 단순 → 빠른 iteration
  - Firestore composite index 만으로 카테고리 + 가격대 필터 충분 (상품 수 1,000 미만 단계)
  - Algolia sync 트리거는 Cloud Function 으로 별도 deploy → 본 Web 빌드와 격리
- 단점:
  - Phase 2.5 전환 시 검색 UI 부분 재작업 (`useProductSearch()` hook 의 백엔드 swap)

### 옵션 C — production 진입 직전까지 Firestore 만
- Algolia 가입은 production 직전에
- 장점: 외부 의존성 최소화
- 단점: production 진입 시 검색 UX 가 미흡 → 의료기기 카탈로그는 정확한 키워드 매칭이 비즈니스 가치이므로 부적합

### 권장
**옵션 B**. Phase 2 초기는 Firestore 단순 쿼리, Phase 2.5 시점에 Algolia sync trigger 추가.

전제 조건:
- `docs/phase-2-prerequisites.md` §2 의 Algolia 가입은 **Phase 2 진입 즉시 완료**해 두기 (10분 작업) — 인덱스 생성·sync 트리거 작성은 Phase 2.5 까지 미룸
- Firestore 의 `products` 컬렉션 design 시 Algolia friendly 한 필드 구조 채택 (flat fields, primitive types 위주, nested object 최소화)

### 결정 (사용자 확정)
- 선택: ☐ A (즉시) / ☐ B (Phase 2.5) / ☐ C (production 직전) / ☐ 기타
- 결정 일자: ______
- 추가 조건: ______

---

## 결정 요약 표

| # | 결정 항목 | 권장 | 사용자 선택 | 결정일 |
|---|---|---|---|---|
| 1 | Vercel Preview 시작 시점 | A (즉시) | ______ | ______ |
| 2 | Cart 저장소 | A (Firestore) | ______ | ______ |
| 3 | Algolia 활성화 시점 | B (Phase 2.5) | ______ | ______ |

---

## 결정 후 Claude Code 신호

세 항목 모두 확정 후 다음 형식으로 Claude Code 에게 신호:

```
Phase 2 결정 완료:
#1 Vercel Preview: {A/B}
#2 Cart 저장소: {A/B/C}
#3 Algolia 활성화: {A/B/C}

추가 조건: ...

Phase 2 진입.
```

Claude Code 는 위 결정을 받은 후:
1. ARCHITECTURE.md 에 결정 사항 반영 (cart 저장소 섹션, 검색 인프라 섹션)
2. CLAUDE.md §10 Phase 진행 현황에 Phase 1 `[x]` + Phase 2 진행 상태 갱신
3. Phase 2.1 (product router + admin 모더레이션) 첫 작업 착수

---

## 변경 이력

- 2026-05-21: 최초 작성 (Phase 1 완료 시점)
