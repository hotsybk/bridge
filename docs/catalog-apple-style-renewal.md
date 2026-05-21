# 카탈로그 페이지 (/search) — Apple 스타일 리뉴얼 기획안

> Apple Korea 의 product category 페이지 (apple.com/kr/watch/ 등) 의 디자인 언어를 차용한 카탈로그 페이지 전면 리뉴얼.
> 좌측 카테고리 사이드바 제거 → 상단 가로 카테고리 nav + 큰 이미지 hero + 큰 제품 카드 + 혜택 캐러셀.

---

## 0. 참고 분석 — Apple Watch 페이지 구조

스크린샷 분석:

| 영역 | Apple Watch | MedPlace 적용 |
|---|---|---|
| 1. 상단 글로벌 nav | 검은색 sticky bar — 스토어·Mac·iPad·iPhone·Watch... | 우리는 검색바 sticky 유지 |
| 2. **카테고리 가로 nav** | watchOS Series11·SE3·Ultra3·Nike·Hermès·비교·밴드... (아이콘 + 라벨) | **전체·소모품·기기·드레싱·진단·한방·치과** (Lucide 아이콘 + 라벨) |
| 3. **Hero 배너** | 큰 인물 이미지 + "손쉬운 사용" + 부제 + "더 알아보기" pill | 큰 의료환경 배경 + 캐치프레이즈 + CTA |
| 4. **추천 상품 (3-col)** | Series 11 · SE 3 · Ultra 3 — 큰 이미지 + 컬러 dots + 가격 + 2 CTA | 시드 3개 상품 동일 패턴 (큰 카드 + 색상 dots simulated + "더 알아보기" + "구입하기") |
| 5. **혜택 캐러셀** | 할부·Trade In·교육·무료배송 4개 카드 가로 | **5% 수수료·3일 입금·자동 발주·공동구매** 4개 카드 |
| 6. **"알면 알수록" 섹션** | 건강·피트니스·안전 큰 카드들 | **카테고리 hero 카드** (의료소모품·진단기기·드레싱·위생용품) |
| 7. 전체 상품 그리드 | (Watch 페이지엔 없음, 별도 쇼핑) | 큰 그리드 (sm 2-col / xl 3-col) |
| 8. Footer | Apple 통합 footer | 우리 기존 footer |

---

## 1. 디자인 컨셉

### 1.1 톤 & 매너
- **Apple Korea 절제된 럭셔리** — 큰 여백, 큰 타이포, 절제된 컬러
- **흰 배경 우선** + 미세 accent 그라데이션
- **이미지 풍부** — 모든 섹션에 product/scene 이미지 anchor
- **카드 그림자 = 미세** — 깊이감은 여백·크기·hover 로

### 1.2 헌법 §1.2 디자인 금기 재검증
| 금기 | 대응 |
|---|---|
| 한글 5자+ gradient text | accent solid 유지 |
| 이모지 | Lucide 아이콘만 |
| Apple 공식 자산 | Pretendard + Unsplash/placehold.co + Lucide 만 |
| 화려한 일러스트 배경 | 의료 사진은 OK (Unsplash medical) — 일러스트 아님 |
| 진한 그림자+테두리 동시 | `border-light + shadow-sm` 또는 `shadow-md` 만 |
| 사이드바·탭 스트립 깊이 페이지 금지 | 카탈로그는 상단 가로 nav 만 (사이드바 X) |

---

## 2. 페이지 레이아웃 — 6개 섹션

### Section 1 — 상단 검색바 (기존 유지)
- sticky · backdrop-blur
- 좌: MedPlace 워드마크
- 중앙: 검색 input (placeholder "장갑·거즈·소독제 검색")
- 우: 장바구니 · 주문 이력 · 로그인

### Section 2 — 카테고리 가로 nav (NEW)
```
┌────────────────────────────────────────────────────────────┐
│  [전체]  [소모품]  [의료기기]  [드레싱]  [진단기기]  ...  │
│   (아이콘 + 라벨, 활성 시 underline + accent)               │
└────────────────────────────────────────────────────────────┘
```
- Apple 의 watchOS 시리즈 nav 패턴
- 각 항목: Lucide 아이콘 + 한글 라벨
- 활성 카테고리는 accent underline + bold
- 모바일: 가로 스크롤 가능
- 8~10개 카테고리 (대분류 + 인기 중분류)

### Section 3 — Hero 배너 (NEW)
```
┌────────────────────────────────────────────────────────────┐
│  [큰 의료환경 사진 - Unsplash]                              │
│                                                              │
│         정품 인증, 100%                                       │
│         믿을 수 있는 의료 용품                                │
│                                                              │
│         [둘러보기 →]                                          │
└────────────────────────────────────────────────────────────┘
```
- 큰 (height ~600px) 풀폭 배경 이미지 — Unsplash 의료 환경 사진
- 어두운 overlay (gradient 0~50%) + 흰 텍스트
- 큰 타이포 (text-7xl/8xl) + CTA pill
- 모바일: height 축소 + 텍스트 가독성 유지

### Section 4 — 추천 상품 큰 카드 (3-col)
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  [큰 이미지] │ │  [큰 이미지] │ │  [큰 이미지] │
│             │ │             │ │             │
│             │ │             │ │             │
│  • • • •    │ │  • •        │ │  •          │
│             │ │             │ │             │
│ 라텍스 글러브│ │ 디지털혈압계 │ │ 멸균거즈     │
│ 100개입 박스 │ │ 상완식       │ │ 4x4 100매    │
│ ₩8,000부터  │ │ ₩85,000부터 │ │ ₩10,000부터  │
│             │ │             │ │             │
│ [더 알아보기] [구입하기 →]  ...각 카드 동일      │
└─────────────┘ └─────────────┘ └─────────────┘
```
- 시드 product 3개 (라텍스 글러브 · 디지털 혈압계 · 멸균거즈) 큰 카드로 전시
- 정사각 큰 이미지 (aspect-square, 400px+)
- 컬러 dots (가짜 variant — 의료기기 등급 표시: ●(1) ●(2) ○ ○)
- 큰 제품명 (text-2xl semibold)
- 한 줄 서브타이틀 (브랜드 + 카테고리)
- 큰 가격 (text-xl, "₩8,000부터")
- 2 CTA: "더 알아보기" (accent pill) + "구입하기 →" (link)

### Section 5 — 혜택 캐러셀 4개 (NEW)
```
MedPlace 에서 주문하면 가장 좋은 이유.
                                      [둘러보기 →]
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ 결제     │ │ 정산     │ │ 자동     │ │ 공동구매 │
│         │ │         │ │         │ │         │
│ 5% 수수료│ │ 3일 입금 │ │ 자동 주문│ │ 모이면   │
│ 투명한   │ │ 4~6개월→ │ │ 매달    │ │ 단가 ↓   │
│ 거래     │ │ 3일로    │ │ 자동발주 │ │         │
│         │ │         │ │         │ │         │
│ [이미지] │ │ [이미지] │ │ [이미지] │ │ [이미지] │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```
- Apple "Apple Watch, Apple 에서 사면 가장 좋은 이유" 패턴
- 4개 카드 (모바일 가로 스크롤 / 데스크탑 4-col)
- 각 카드: 큰 텍스트 (혜택명) + 부제 + 일러스트 또는 placeholder 이미지
- 우측 상단 "Apple Watch 쇼핑하기" → 우리는 "전체 둘러보기 →"

### Section 6 — 카테고리 hero 카드 (NEW)
```
알면 알수록, 의료 용품.

┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ [의료소모품 이미지]│ [진단기기 이미지]│ [드레싱 이미지]   │
│                  │                  │                  │
│ 의료소모품         │ 진단기기          │ 드레싱           │
│                  │                  │                  │
└────────────────┘ └────────────────┘ └────────────────┘
```
- Apple "알면 알수록, Apple Watch" 의 건강·피트니스·안전 카드 패턴
- 4~6개 카테고리 큰 hero 카드 (각 카드 = 대표 이미지 + 카테고리명)
- 카드 hover 시 미세 lift + 카테고리명 색상 전환
- 클릭 시 `/search?categoryId=...` 이동

### Section 7 — 전체 상품 그리드 (확장된 기존)
- 큰 그리드 (sm 2-col, lg 3-col, xl 4-col)
- 카드 디자인 — 현재 카드 기반 + 이미지 크기 키움 + 호버 강화
- 카테고리 nav 또는 검색 변경 시 이 그리드만 갱신

### Section 8 — Footer (기존 유지)
- 메인 페이지 Footer 재사용 (워드마크 + 4-column + 사업자 정보)

---

## 3. 이미지 전략

### 3.1 Hero 배경 (1장)
- Unsplash 무료 라이선스: 의료/병원 환경 사진
- URL 예: `https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=2000&q=80` (병원 복도)
- 또는 `photo-1579684385127-1ef15d508118` (의료기기)
- 다크 overlay (`bg-gradient-to-b from-black/50 to-black/30`) + 흰 텍스트

### 3.2 추천 상품 카드 (시드 3개)
- 현재 시드: `https://placehold.co/400x400/png` — 너무 단조로움
- 변경: 각 상품별 placehold.co 색상 + 텍스트, 또는 Unsplash 의료품 이미지:
  - 라텍스 글러브: `https://images.unsplash.com/photo-1583912267550-bb6e1c7c4baa?w=800` (의료 장갑)
  - 디지털 혈압계: `https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=800` (혈압계)
  - 멸균거즈: `https://images.unsplash.com/photo-1584515933487-779824d29309?w=800` (의료용품)
- 시드 데이터의 thumbnail 필드 업데이트 (마이그레이션 1회)

### 3.3 혜택 카드 4개
- 각 카드별 일러스트 또는 아이콘 강조
- 옵션 A: Lucide 아이콘 큰 사이즈 (h-24)
- 옵션 B: placeholder 이미지 (`https://placehold.co/600x800/0066CC/FFFFFF/png?text=5%25`)

### 3.4 카테고리 hero 카드
- 의료소모품: Unsplash 의료 용품 사진
- 진단기기: 청진기/혈압계 사진
- 드레싱: 거즈/붕대 사진
- 위생용품: 소독제 사진
- 각 ~800x800 정사각

### 3.5 이미지 라이선스 안전성
- **Unsplash Free License** — 상업용 사용 가능, 출처 표기 권장 (footer 에 한 줄)
- placeholder.co — 무료 (라이선스 무관)
- **AI 생성 이미지** — 추후 직접 의뢰 또는 사용자 업로드 (Phase 2 후반)

---

## 4. 카테고리 가로 nav — 항목 정의

시드 categories 9개 기반 + 인기 정렬:

| # | 라벨 | Lucide 아이콘 | 링크 |
|---|---|---|---|
| 1 | 전체 | `Grid` | `/search` |
| 2 | 의료소모품 | `Package` | `/search?categoryId=cat-medsupply` |
| 3 | 의료기기 | `Activity` | `/search?categoryId=cat-meddevice` |
| 4 | 일회용 의료용품 | `Shield` | `/search?categoryId=cat-medsupply-disposable` |
| 5 | 드레싱 | `Bandage` | `/search?categoryId=cat-medsupply-dressing` |
| 6 | 진단기기 | `Stethoscope` | `/search?categoryId=cat-meddevice-diagnostic` |
| 7 | 모니터링 | `Monitor` | `/search?categoryId=cat-meddevice-monitor` |
| 8 | 한방 | `Leaf` | `/search?categoryId=cat-etc-oriental` |
| 9 | 치과 | `Smile` | `/search?categoryId=cat-etc-dental` |

(Lucide 에 없는 아이콘 = 가장 유사한 것 또는 inline SVG)

---

## 5. 인터랙션 + 애니메이션

### 5.1 카테고리 nav
- 활성 카테고리: accent underline 4px + bold
- 비활성: gray 60% text + hover 시 accent 50% 색
- 클릭 시 부드러운 underline 이동 (`transition-all 220ms`)

### 5.2 Hero
- 배경 이미지 lazy load + fade-in (300ms)
- 텍스트 stagger fade-up (기존 `.landing-fade-up` 재사용)
- CTA hover 시 glow

### 5.3 추천 상품 카드
- hover 시 이미지 `scale-105` + 카드 미세 lift
- 색상 dots hover 시 ring 표시 (실제 variant 없으니 visual only)
- "구입하기 →" 호버 시 `translate-x-1`

### 5.4 혜택 카드 캐러셀
- 모바일: 가로 스크롤 (snap-x)
- 데스크탑: 4-col grid, hover 시 미세 lift
- 우측 화살표 (Apple 패턴) — 추가 카드가 있으면 페이지네이션 (현재 4개 fixed)

### 5.5 카테고리 hero 카드
- hover 시 이미지 `scale-105` + 카테고리명 `text-accent` 전환
- click 시 search 페이지로 이동 (Link)

---

## 6. 작업 분해 — 8 단계

| Step | 내용 | 시간 |
|---|---|---|
| 1 | 시드 product thumbnail 업데이트 (Unsplash URL) | 0.5h |
| 2 | 좌측 사이드바 제거 + 레이아웃 grid → 단일 컬럼 | 0.5h |
| 3 | **카테고리 가로 nav** 신규 컴포넌트 | 1h |
| 4 | **Hero 배너** 신규 컴포넌트 (큰 이미지 + 텍스트 stagger) | 1.5h |
| 5 | **추천 상품 큰 카드 (3-col)** — 시드 3개 표시 | 2h |
| 6 | **혜택 캐러셀 4개** | 1h |
| 7 | **카테고리 hero 카드** (4~6개) | 1.5h |
| 8 | 전체 상품 그리드 — 카드 크기 키우고 호버 강화 + 빌드/배포 | 1.5h |

**총 ~9시간**

---

## 7. 시드 데이터 보강

### 현재 시드 (3개)
- 라텍스 글러브 100개입 (8,000원)
- 디지털 혈압계 상완식 (85,000원)
- 멸균거즈 4x4 100매 (12,000원, 티어 있음)

### 추천 추가 시드 (이미지 풍부함 위해 6~9개 추가)
- 알코올 솜 100매 (위생용품)
- 1회용 마스크 50매 (소모품)
- 청진기 (진단기기)
- 일회용 주사기 (소모품)
- SpO2 측정기 (모니터링)
- 살균 알코올 1L (위생용품)

총 9~12개 상품 → 그리드 더 풍부함.

**옵션 A**: `scripts/seed-products-extra.ts` 신규 작성 + 사용자가 실행
**옵션 B**: 기존 3개 + 클라이언트에서 mock 표시 (Firestore 안 건드림)

권장: **옵션 A** — Firestore 에 실제 데이터 추가가 검색·필터 동작 검증에 도움

---

## 8. 사용자 결정 사항

### A. 진행 방향
- 이 기획안 그대로 진행할까?
- 일부 수정 (예: Hero 배너 X, 혜택 캐러셀 X) 한 채 진행?

### B. 이미지 출처
- Unsplash 자유 사용 OK? (출처 표기는 Footer에)
- 또는 placehold.co 만 (라이선스 100% 안전)?
- 또는 AI 생성 후 사용자가 업로드?

### C. 시드 데이터 보강
- 6~9개 추가 시드 작성할까? (옵션 A)
- 또는 현재 3개만으로 진행? (옵션 B)

### D. 카테고리 가로 nav 의 항목 수
- 9개 (전체 + 대분류 2 + 중분류 6) — 데스크탑 OK, 모바일 가로 스크롤
- 또는 5~6개로 축소 (전체 + 인기 4~5개) — 모바일 UX 우선

---

## 9. 합의 후 진행 권장

1. **A: 진행** + **B: Unsplash** + **C: 시드 9개 추가** + **D: 9개 nav** — 가장 풍부
2. **A: 진행** + **B: placehold.co** + **C: 현재 3개** + **D: 5개 nav** — 가장 빠름
3. 사용자 변형

### 추천: **옵션 1 (풍부)**
- 시각적으로 진짜 Apple 스타일 카탈로그 느낌
- 이미지 풍부, 카테고리 다양
- 단점: Unsplash CDN 의존 + 시드 데이터 추가 9개

---

## 변경 이력

- 2026-05-21: Apple Watch 페이지 스크린샷 분석 기반 최초 작성
