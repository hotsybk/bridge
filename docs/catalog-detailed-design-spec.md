# 카탈로그 페이지 — Apple 스타일 상세 디자인 명세

> 1차 기획안(`catalog-apple-style-renewal.md`) 채택 후 픽셀-레벨 컴포넌트 명세 + 이미지 URL 매핑 + 시드 데이터 완전 설계.
> 옵션 A (Unsplash + 시드 9개 추가 + nav 9개) 기준.

---

## 0. Apple Watch 페이지 재분석 — 픽셀-레벨

스크린샷 3장 기반 정밀 분석:

### 0.1 레이아웃 spec (Apple)

| 영역 | 높이 | 패딩 | 폰트 크기 |
|---|---|---|---|
| 글로벌 nav (검은 띠) | 44px | 충분한 좌우 | text-xs (12px) |
| 로컬 nav (시리즈 nav) | 약 100px | py-4 | text-xs + icon |
| Hero "손쉬운 사용" | ~750px (viewport-1nav) | 중앙·하단 정렬 | 큰 headline ~64px |
| "iPhone" hero | ~600px | 텍스트 위쪽 정렬 | "iPhone" text-7xl |
| Apple Watch + 3 card | ~900px | 큰 여백 (py-32) | h2 "Apple Watch" text-9xl |
| 혜택 4 카드 | ~720px | py-24 | 카드 헤드라인 text-2xl |
| "알면 알수록" 카드 | ~900px | py-24 | h2 text-5xl |

### 0.2 색상 + 톤

- 배경: pure white (#FFFFFF) 또는 매우 옅은 회색 (#F5F5F7)
- 카드 배경: 흰색 + 미세 shadow (`shadow-sm` 정도)
- 텍스트: 검정 (#1D1D1F) — Apple 시그니처
- 가격·강조: accent blue (#0066CC)
- 카드 경계: **테두리 거의 없음**, 그림자만으로 분리

### 0.3 Apple의 시그니처 디테일

- **Pill button** — 둥근 끝 (`rounded-full`), 흰 배경 위 검은 텍스트 또는 그 반대
- **dot indicators** — 색상 variant 표시 (작은 원형 6px)
- **"+" floating button** — 카드 우상단, 클릭 시 expand (현재 안 구현, 시각적 hint만)
- **arrow → in text link** — "구입하기 →", "더 알아보기 →"

---

## 1. 페이지 구조 — 7 섹션 픽셀 명세

### Section 1 — TopBar (기존 sticky 검색바, 유지)

```
┌────────────────────────────────────────────────────────┐
│ [logo MedPlace]  [🔍 검색 input]   장바구니 주문이력  │
└────────────────────────────────────────────────────────┘
```

- 높이: `h-16` (64px)
- backdrop-blur-md
- sticky top-0 z-30
- (현재 코드 유지)

---

### Section 2 — Category Nav (NEW)

Apple Watch 페이지의 회색 띠 nav 패턴 차용.

```
┌────────────────────────────────────────────────────────┐
│ [Grid] [Package] [Activity] [Shield] [Bandage] ...     │
│  전체   소모품    의료기기   일회용     드레싱           │
│  ───────                                                │  ← 활성 underline
└────────────────────────────────────────────────────────┘
```

**Spec**:
- 높이: `h-20` (80px) — 아이콘 + 라벨 + underline 공간
- 배경: `bg-bg-primary` + `border-b border-border-light`
- sticky 위치: `top-16` (TopBar 바로 아래)
- 각 항목: 세로 stack
  - 아이콘: `h-5 w-5` (Lucide)
  - 라벨: `text-xs font-medium`
  - 활성: `text-accent` + `border-b-2 border-accent` (아이콘·라벨 위로 색상 변경)
  - 비활성: `text-text-secondary` hover `text-text-primary`
- 항목 간격: `gap-8` 데스크탑, `gap-5` 모바일
- 컨테이너: `max-w-6xl mx-auto` + `overflow-x-auto`
- 모바일: scrollbar 숨김 (`scrollbar-hidden`)

**9개 항목**:

| # | 라벨 | Lucide 아이콘 | href |
|---|---|---|---|
| 1 | 전체 | `Grid3x3` | `/search` |
| 2 | 의료소모품 | `Package` | `/search?categoryId=cat-medsupply` |
| 3 | 의료기기 | `Activity` | `/search?categoryId=cat-meddevice` |
| 4 | 일회용 | `Shield` | `/search?categoryId=cat-medsupply-disposable` |
| 5 | 드레싱 | `Bandage` (없으면 `Cross`) | `/search?categoryId=cat-medsupply-dressing` |
| 6 | 진단기기 | `Stethoscope` | `/search?categoryId=cat-meddevice-diagnostic` |
| 7 | 모니터링 | `Monitor` (or `HeartPulse`) | `/search?categoryId=cat-meddevice-monitor` |
| 8 | 한방 | `Leaf` | `/search?categoryId=cat-etc-oriental` |
| 9 | 치과 | `Smile` (or `Sparkles`) | `/search?categoryId=cat-etc-dental` |

---

### Section 3 — Hero Banner (NEW)

Apple "손쉬운 사용" 패턴:

```
┌────────────────────────────────────────────────────────┐
│ [큰 의료 환경 사진 — Unsplash]                          │
│                                                          │
│                                                          │
│                                                          │
│                                                          │
│              [Phase 1 베타 배지]                          │
│                                                          │
│              정품 인증, 100%                              │
│              믿을 수 있는 의료 용품                        │
│                                                          │
│              병원과 공급업체를 바로 연결합니다.            │
│                                                          │
│              [둘러보기 →]                                  │
│                                                          │
└────────────────────────────────────────────────────────┘
```

**Spec**:
- 높이: `h-[600px]` 데스크탑, `h-[500px]` 모바일
- 배경 이미지: Unsplash `photo-1631815589968-fdb09a223b1e` (수술실 분위기)
  - 또는 `photo-1576091160399-112ba8d25d1d` (의료 용품 트레이)
  - URL: `https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=2000&q=80`
- 이미지 위 overlay: `bg-gradient-to-t from-black/60 via-black/30 to-black/20`
- 텍스트 정렬: 중앙·하단 (`items-center justify-end pb-24`)
- 텍스트 색: 흰색
- 헤드라인: `text-5xl md:text-7xl font-semibold tracking-[-0.04em]`
- 부제: `text-base md:text-xl text-white/90`
- CTA: 흰 배경 pill (`bg-white text-accent hover:bg-white/90`), `h-12 px-7`, `rounded-full`
- 텍스트 stagger animation 적용 (`landing-fade-up`)

---

### Section 4 — Featured Products (NEW, 핵심)

Apple "Apple Watch" 큰 헤드라인 + 3 카드 패턴:

```
┌────────────────────────────────────────────────────────┐
│                                                          │
│   인기 상품                                               │
│                                                          │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│ │          │  │          │  │          │                │
│ │ [큰 이미지]│  │ [큰 이미지]│  │ [큰 이미지]│                │
│ │          │  │          │  │          │                │
│ │          │  │          │  │          │                │
│ │ ● ● ● ○  │  │ ● ○      │  │ ● ●      │                │
│ │          │  │          │  │          │                │
│ │ 라텍스    │  │ 디지털    │  │ 멸균     │                │
│ │ 글러브    │  │ 혈압계    │  │ 거즈     │                │
│ │ 100개입    │  │ 상완식    │  │ 4x4      │                │
│ │ 박스      │  │           │  │ 100매     │                │
│ │           │  │           │  │           │                │
│ │ ₩8,000부터 │  │ ₩85,000   │  │ ₩10,000   │                │
│ │           │  │ 부터       │  │ 부터       │                │
│ │           │  │           │  │           │                │
│ │ [더 알아   │  │ [더 알아   │  │ [더 알아   │                │
│ │  보기]    │  │  보기]    │  │  보기]    │                │
│ │ 구입하기→ │  │ 구입하기→ │  │ 구입하기→ │                │
│ └──────────┘  └──────────┘  └──────────┘                │
│                                                          │
└────────────────────────────────────────────────────────┘
```

**Spec**:
- 컨테이너: `max-w-6xl mx-auto px-6 py-32`
- 헤드라인: `text-4xl md:text-6xl font-semibold tracking-[-0.04em] mb-14`
- 그리드: `grid md:grid-cols-3 gap-6`
- 각 카드:
  - 배경: `bg-bg-secondary` (옅은 회색)
  - 패딩: `p-8 md:p-10`
  - radius: `rounded-3xl`
  - 그림자: 없음 (Apple 스타일 — 그림자 대신 회색 배경으로 분리)
  - **이미지 영역** (`aspect-square`):
    - Unsplash 의료품 이미지 (구체적 URL 아래 §3 매핑)
    - hover 시 `scale-105` 전환 (transition 500ms)
  - **컬러 dots** (대체: 의료기기 등급 표시):
    - 4개 원형 dots (`h-2 w-2 rounded-full`)
    - 활성 등급 색 + 다른 등급 옅게
    - 예: 1등급 제품 → ● 녹 ○ 하 ○ 주 ○ 빨
  - **제품명**: `text-xl font-semibold tracking-tight`
  - **부제** (한 줄): `text-sm text-text-secondary mt-1`
  - **가격**: `mt-4 text-lg font-semibold`
    - 가격 티어 있으면: `from {basePrice}` 또는 가장 낮은 티어
    - 단위: `text-sm font-normal text-text-tertiary` (예: "원/BOX")
  - **CTA 영역** (`mt-8 flex items-center gap-4`):
    - Primary: "더 알아보기" pill (`bg-accent text-white h-10 px-5 rounded-full text-sm font-medium`)
    - Secondary: "구입하기 →" (`text-accent text-sm font-medium hover:underline`)

---

### Section 5 — Benefit Cards (NEW)

Apple "Apple Watch, Apple에서 사면 가장 좋은 이유" 패턴:

```
┌────────────────────────────────────────────────────────┐
│                                                          │
│  MedPlace 에서 주문하면        [전체 둘러보기 →]          │
│  가장 좋은 이유.                                         │
│                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │  결제     │ │  정산     │ │  자동     │ │ 공동구매  │    │
│ │          │ │          │ │          │ │          │    │
│ │  5% 수수료│ │  3일 입금 │ │  자동    │ │  여러     │    │
│ │  단일.    │ │  4~6개월→ │ │  주문    │ │  병원이   │    │
│ │          │ │  3일      │ │          │ │  모이면   │    │
│ │          │ │          │ │          │ │          │    │
│ │          │ │          │ │          │ │          │    │
│ │  [큰     │ │  [큰     │ │  [큰     │ │  [큰     │    │
│ │   image] │ │   image] │ │   image] │ │   image] │    │
│ │     [+]  │ │     [+]  │ │     [+]  │ │     [+]  │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                          │
└────────────────────────────────────────────────────────┘
```

**Spec**:
- 컨테이너: `max-w-7xl mx-auto px-6 py-24 bg-bg-secondary`
- 헤드라인 영역:
  - 좌측: `text-3xl md:text-5xl font-semibold tracking-[-0.04em]` (2줄)
  - 우측: "전체 둘러보기 →" link (`text-accent text-base font-medium`)
- 4개 카드 그리드: `grid md:grid-cols-4 gap-4`
- 모바일: 가로 스크롤 (`overflow-x-auto snap-x snap-mandatory`)
- 각 카드:
  - `bg-bg-primary rounded-3xl p-8`
  - height: `min-h-[480px]` (정해진 높이)
  - 상단:
    - eyebrow: `text-xs font-medium text-text-secondary` (예: "결제")
    - 헤드라인: `text-2xl font-semibold mt-2` (예: "최대 18개월 무이자")
    - 부제: `text-sm text-text-secondary mt-3 leading-relaxed` (실제 내용)
  - 하단:
    - 이미지: `relative aspect-[4/3]` Lucide 큰 아이콘 또는 placeholder
  - 우상단 [+] 버튼: `absolute right-4 top-4 h-8 w-8 rounded-full bg-black/8 hover:bg-black/15`
    - Lucide `Plus` 아이콘
    - 클릭 시 — 일단 시각적 hint만 (실제 modal 없음)

**4개 카드 콘텐츠**:

| # | eyebrow | 헤드라인 | 부제 | 아이콘 |
|---|---|---|---|---|
| 1 | 결제 | 5% 단일 수수료 | 거래 규모 커지면 더 낮아집니다. 가입비·약정 없음. | `TrendingDown` |
| 2 | 정산 | 3일 만에 입금 | 기존 도매상 4~6개월 → 배송 완료 후 영업일 3일. | `Wallet` |
| 3 | 자동 | 매달 자동 주문 | 장갑·거즈·소독제. 한 번 설정, 자동 발주. | `Repeat` |
| 4 | 공동구매 | 모이면 단가 ↓ | 여러 병원이 함께 주문. 마감 시 자동 결제·발주. | `Users` |

---

### Section 6 — "알면 알수록" 카테고리 카드 (NEW)

Apple "알면 알수록, Apple Watch" 패턴:

```
┌────────────────────────────────────────────────────────┐
│                                                          │
│  알면 알수록, 의료 용품.                                 │
│                                                          │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────┐  │
│ │  [의료품   │ │  [진단기기 │ │  [드레싱   │ │ ...   │  │
│ │   사진]    │ │   사진]    │ │   사진]    │ │       │  │
│ │            │ │            │ │            │ │       │  │
│ │  의료소모품 │ │  진단기기   │ │  드레싱     │ │       │  │
│ │            │ │            │ │            │ │       │  │
│ │  Ultra 3   │ │  Series 11│ │  ...        │ │       │  │
│ └────────────┘ └────────────┘ └────────────┘ └──────┘  │
│                                                          │
└────────────────────────────────────────────────────────┘
```

**Spec**:
- 컨테이너: `max-w-7xl mx-auto px-6 py-32`
- 헤드라인: `text-4xl md:text-6xl font-semibold tracking-[-0.04em] mb-14`
- 4개 카드: `grid md:grid-cols-2 lg:grid-cols-4 gap-4`
- 각 카드:
  - `relative aspect-[3/4] rounded-3xl overflow-hidden`
  - 배경 이미지: Unsplash 카테고리별
  - 어두운 overlay: `bg-gradient-to-t from-black/70 to-transparent`
  - 텍스트 위치: 하단 (`absolute bottom-6 left-6 right-6`)
  - 카테고리명: `text-2xl text-white font-semibold`
  - hover 시: 이미지 `scale-105` (500ms)
  - 클릭 시: `/search?categoryId=...`

**4개 카드 매핑**:
| # | 카테고리 | categoryId | Unsplash 키워드 |
|---|---|---|---|
| 1 | 의료소모품 | cat-medsupply | medical supplies, gloves |
| 2 | 진단기기 | cat-meddevice-diagnostic | stethoscope, blood pressure |
| 3 | 드레싱 | cat-medsupply-dressing | gauze, bandage |
| 4 | 치과용품 | cat-etc-dental | dental, dentistry |

---

### Section 7 — All Products Grid (확장)

```
┌────────────────────────────────────────────────────────┐
│                                                          │
│  모든 상품                              정렬 [최신순 ▾]    │
│                                                          │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                    │
│ │      │ │      │ │      │ │      │                    │
│ │[img] │ │[img] │ │[img] │ │[img] │                    │
│ │      │ │      │ │      │ │      │                    │
│ │ 등급1 │ │ 등급2 │ │ 정기 │ │ 공구 │                    │
│ │ 라텍스│ │ 혈압계│ │ ...  │ │ ...  │                    │
│ │ ₩8K  │ │ ₩85K │ │ ...  │ │ ...  │                    │
│ └──────┘ └──────┘ └──────┘ └──────┘                    │
│ (12개 표시, 그리드 4-col)                                │
│                                                          │
└────────────────────────────────────────────────────────┘
```

**Spec**:
- 컨테이너: `max-w-7xl mx-auto px-6 py-24`
- 그리드: `grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5`
- 카드: 현재 디자인 유지 + 이미지 비율 + hover 강화
- 시드 12개 표시 (현재 3 + 추가 9 = 12)

---

### Section 8 — Footer (기존 유지)
- 메인 페이지 Footer 재사용

---

## 2. 이미지 URL 매핑 (Unsplash, w/h auto)

### 2.1 Hero
```
https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=2000&q=80
```
(수술실 / 의료 환경 / 흰 분위기)

대안: `photo-1538108149393-fbbd81895907` (의료기기 트레이)

### 2.2 추천 상품 3개

| 상품 | Unsplash photo ID |
|---|---|
| 라텍스 글러브 100개입 | `photo-1583912267550-bb6e1c7c4baa` (medical gloves) |
| 디지털 혈압계 | `photo-1559757175-5700dde675bc` (blood pressure cuff) |
| 멸균거즈 4x4 | `photo-1584515933487-779824d29309` (bandage/gauze) |

URL 형식:
```
https://images.unsplash.com/{photo-id}?w=800&h=800&fit=crop&q=80
```

### 2.3 추가 시드 9개

| 상품 | photo ID |
|---|---|
| 알코올 솜 100매 | `photo-1584362917165-526a968579e8` |
| 일회용 마스크 KF94 50매 | `photo-1605845328644-43c1e95f8076` |
| 디지털 청진기 | `photo-1559757175-5700dde675bc` (또는 다른) |
| 일회용 주사기 1ml | `photo-1632053002434-c7c30b6f3236` |
| SpO2 측정기 휴대용 | `photo-1576091160550-2173dba999ef` |
| 살균 알코올 1L | `photo-1583912267550-bb6e1c7c4baa` |
| 수술용 가운 멸균 5매 | `photo-1530497610245-94d3c16cda28` |
| 수술용 메스 No.11 100개 | `photo-1551601651-bc60f254d532` |
| 임시 충전재 치과용 30g | `photo-1606811971618-4486d14f3f99` |

### 2.4 카테고리 hero 4개

| 카테고리 | photo ID |
|---|---|
| 의료소모품 | `photo-1583912267550-bb6e1c7c4baa` (장갑 모음) |
| 진단기기 | `photo-1559757175-5700dde675bc` (청진기) |
| 드레싱 | `photo-1584515933487-779824d29309` (붕대) |
| 치과 | `photo-1606811971618-4486d14f3f99` (치과 도구) |

---

## 3. 시드 데이터 — 추가 9개 상세

`scripts/seed-products-extra.ts` 신규 작성.

```ts
const EXTRA_PRODUCTS = [
  {
    id: "product-seed-004",
    name: "알코올 솜 100매",
    brand: "더미브랜드",
    categoryId: "cat-medsupply-disposable",
    categoryPath: ["의료소모품", "일회용 의료용품"],
    deviceClass: "NON_DEVICE",
    basePrice: 4500,
    unit: "BOX",
    moq: 10,
    subscribable: true,
    groupBuyable: true,
    thumbnail: "https://images.unsplash.com/photo-1584362917165-526a968579e8?w=800&h=800&fit=crop&q=80",
    description: "일회용 알코올 솜 100매. 75% 이소프로필 알코올.",
  },
  {
    id: "product-seed-005",
    name: "일회용 마스크 KF94 50매",
    brand: "더미브랜드",
    categoryId: "cat-medsupply-disposable",
    categoryPath: ["의료소모품", "일회용 의료용품"],
    deviceClass: "NON_DEVICE",
    basePrice: 15000,
    priceTiers: [{ minQty: 10, price: 13500 }, { minQty: 50, price: 12000 }],
    unit: "BOX",
    moq: 1,
    subscribable: true,
    groupBuyable: true,
    thumbnail: "https://images.unsplash.com/photo-1605845328644-43c1e95f8076?w=800&h=800&fit=crop&q=80",
    description: "KF94 인증 일회용 마스크 50매 박스.",
  },
  {
    id: "product-seed-006",
    name: "디지털 청진기 (블루투스)",
    brand: "더미브랜드",
    categoryId: "cat-meddevice-diagnostic",
    categoryPath: ["의료기기", "진단기기"],
    deviceClass: "CLASS_2",
    udiCode: "08801234567920",
    mfdsLicenseNo: "수허 26-5701",
    basePrice: 350000,
    unit: "EA",
    moq: 1,
    subscribable: false,
    groupBuyable: true,
    thumbnail: "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&h=800&fit=crop&q=80",
    description: "블루투스 디지털 청진기. 노이즈 캔슬링.",
  },
  {
    id: "product-seed-007",
    name: "일회용 주사기 1ml 100개입",
    brand: "더미브랜드",
    categoryId: "cat-medsupply-disposable",
    categoryPath: ["의료소모품", "일회용 의료용품"],
    deviceClass: "CLASS_1",
    udiCode: "08801234567937",
    mfdsLicenseNo: "수신 26-1240",
    basePrice: 7500,
    unit: "BOX",
    moq: 5,
    subscribable: true,
    groupBuyable: false,
    thumbnail: "https://images.unsplash.com/photo-1632053002434-c7c30b6f3236?w=800&h=800&fit=crop&q=80",
    description: "1ml 일회용 주사기, 27G 침. 멸균 포장.",
  },
  {
    id: "product-seed-008",
    name: "SpO2 측정기 (휴대용)",
    brand: "더미브랜드",
    categoryId: "cat-meddevice-monitor",
    categoryPath: ["의료기기", "모니터링 장비"],
    deviceClass: "CLASS_2",
    udiCode: "08801234567944",
    mfdsLicenseNo: "수허 26-5712",
    basePrice: 45000,
    unit: "EA",
    moq: 1,
    subscribable: false,
    groupBuyable: true,
    thumbnail: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=800&fit=crop&q=80",
    description: "휴대용 펄스 옥시미터. 산소포화도 + 맥박 동시 측정.",
  },
  {
    id: "product-seed-009",
    name: "살균 알코올 1L",
    brand: "더미브랜드",
    categoryId: "cat-medsupply-disposable",
    categoryPath: ["의료소모품", "일회용 의료용품"],
    deviceClass: "NON_DEVICE",
    basePrice: 8500,
    priceTiers: [{ minQty: 12, price: 7800 }],
    unit: "EA",
    moq: 6,
    subscribable: true,
    groupBuyable: true,
    thumbnail: "https://images.unsplash.com/photo-1583912267550-bb6e1c7c4baa?w=800&h=800&fit=crop&q=80",
    description: "70% 에탄올 살균용. 1L PE 보틀.",
  },
  {
    id: "product-seed-010",
    name: "수술용 가운 (멸균) 5매",
    brand: "더미브랜드",
    categoryId: "cat-medsupply-disposable",
    categoryPath: ["의료소모품", "일회용 의료용품"],
    deviceClass: "CLASS_1",
    udiCode: "08801234567951",
    mfdsLicenseNo: "수신 26-1248",
    basePrice: 28000,
    unit: "BOX",
    moq: 2,
    subscribable: false,
    groupBuyable: true,
    thumbnail: "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?w=800&h=800&fit=crop&q=80",
    description: "EO 멸균 수술 가운, 5매. SMS 부직포.",
  },
  {
    id: "product-seed-011",
    name: "수술용 메스 (No.11) 100개",
    brand: "더미브랜드",
    categoryId: "cat-medsupply-disposable",
    categoryPath: ["의료소모품", "일회용 의료용품"],
    deviceClass: "CLASS_1",
    udiCode: "08801234567968",
    mfdsLicenseNo: "수신 26-1252",
    basePrice: 18000,
    unit: "BOX",
    moq: 1,
    subscribable: false,
    groupBuyable: false,
    thumbnail: "https://images.unsplash.com/photo-1551601651-bc60f254d532?w=800&h=800&fit=crop&q=80",
    description: "스테인리스 스틸 일회용 메스, No.11 100개입.",
  },
  {
    id: "product-seed-012",
    name: "임시 충전재 (치과용) 30g",
    brand: "더미브랜드",
    categoryId: "cat-etc-dental",
    categoryPath: ["기타", "치과용품"],
    deviceClass: "CLASS_2",
    udiCode: "08801234567975",
    mfdsLicenseNo: "수허 26-5720",
    basePrice: 42000,
    unit: "EA",
    moq: 1,
    subscribable: false,
    groupBuyable: false,
    thumbnail: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=800&h=800&fit=crop&q=80",
    description: "치과용 임시 충전재 30g 튜브. ZOE 베이스.",
  },
];
```

추가로 시드 1·2·3의 thumbnail 도 Unsplash URL 로 업데이트.

---

## 4. 컴포넌트 분리

### 신규 컴포넌트

| 파일 | 역할 | 종류 |
|---|---|---|
| `src/components/buyer/catalog-nav.tsx` | 카테고리 가로 nav | client (active state) |
| `src/components/buyer/hero-banner.tsx` | Hero 배너 | server |
| `src/components/buyer/featured-product.tsx` | 추천 상품 큰 카드 (3개) | server |
| `src/components/buyer/benefit-card.tsx` | 혜택 카드 | server |
| `src/components/buyer/category-hero-card.tsx` | 카테고리 hero 카드 | server |
| `src/components/buyer/product-card.tsx` | 기존 그리드 카드 (move + 강화) | server |

기존 `/search/page.tsx` 는 layout 만 정의 + 위 컴포넌트 조합.

---

## 5. 작업 분해 — 10 단계

| Step | 내용 | 시간 |
|---|---|---|
| 1 | `seed-products-extra.ts` 작성 + 기존 thumbnail Unsplash URL로 업데이트 + 실행 | 1h |
| 2 | `<CatalogNav>` 컴포넌트 (9개 항목 가로 + sticky + active underline) | 1.5h |
| 3 | `<HeroBanner>` (Unsplash 배경 + overlay + stagger fade-up) | 1h |
| 4 | `<FeaturedProduct>` 큰 카드 (3개, dots + 2 CTA) | 2h |
| 5 | `<BenefitCard>` × 4 (콘텐츠 + + 버튼) | 1h |
| 6 | `<CategoryHeroCard>` × 4 (이미지 + overlay) | 1h |
| 7 | `<ProductCard>` 보강 (이미지 우선·hover 강화) | 0.5h |
| 8 | `/search/page.tsx` 전면 재작성 (좌측 사이드바 제거 + 7섹션 조립) | 1.5h |
| 9 | Tailwind config: `next.config.ts` 의 `images.remotePatterns` 에 unsplash 추가 (next/image 사용 시) | 0.5h |
| 10 | 빌드/배포/검증 | 1h |

**총 ~11시간**

---

## 6. next/image 도입 결정

현재 시드는 `<img>` 태그 사용 (lazy + object-cover). Unsplash 외부 이미지 + 성능 위해 `next/image` 권장:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
};
```

장점: 자동 lazy + responsive `srcset` + AVIF/WebP 변환

단점: 외부 도메인 등록 + Vercel Image Optimization 비용 (현재 free tier 충분)

권장: **도입** (Apple 스타일 카탈로그는 이미지 의존이 크므로 성능 최적화 필수)

---

## 7. 헌법 §1.2 디자인 금기 최종 재검증

| 금기 | 카탈로그 리뉴얼 적용 |
|---|---|
| 한글 5자+ gradient text | 없음 (accent solid 유지) |
| 이모지 | Lucide + inline SVG만 |
| Apple 공식 이미지·SF Pro | Pretendard + Unsplash medical 사진만 |
| 화려한 일러스트 배경 | 의료 사진은 일러스트 아님, 실 사진. OK |
| 진한 그림자+테두리 동시 | 카드는 회색 배경만 (그림자 거의 X), 테두리 없음 |
| 색상 채도 80%+ | accent #0066CC 유지 |
| 사이드바·탭 스트립 깊이 페이지 | **카탈로그 nav 는 OK** (대다수 카탈로그 패턴, B2B 표준) |

---

## 8. 모바일 대응

| 영역 | 모바일 대응 |
|---|---|
| TopBar | 검색 input 전폭, 카트·주문 버튼 축소 |
| CatalogNav | 가로 스크롤 (snap-x), 9개 모두 한 줄 |
| Hero | height 축소 (500px), 텍스트 크기 축소 (text-5xl) |
| Featured Product | 1-col 세로 스택, 카드 height 자동 |
| Benefit | 가로 스크롤 (snap-x), 카드 너비 90vw |
| Category Hero | 2-col |
| Product Grid | 2-col |
| Footer | 1-col |

---

## 9. 사용자 결정 사항 — 마지막 확인

이 상세 명세 그대로 진행하기 전 마지막 결정:

### a. 진행 방식
- ☐ 이 명세 그대로 10단계 자동 진행 (~11시간)
- ☐ 일부 섹션 제외 (어느 섹션?)

### b. next/image 도입
- ☐ Yes (권장 — 성능 최적화)
- ☐ No (그냥 `<img>` — 단순)

### c. 시드 추가 9개 작성 + 실행
- ☐ Yes (`pnpm tsx scripts/seed-products-extra.ts` 자동 실행)
- ☐ No — 현재 3개만 유지 (그리드 단순)

### d. 이 명세 외 추가 요청
- (자유)

---

## 변경 이력

- 2026-05-21: Apple Watch 페이지 픽셀-레벨 재분석 + 컴포넌트별 상세 spec + Unsplash URL 매핑 + 시드 9개 완전 설계
