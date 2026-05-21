# 메인 페이지 디자인 리뉴얼 기획안

> **주제**: 글래스모피즘 + 애니메이션 + 심플 고급 톤으로 메인페이지(`/`) 리뉴얼
> **회의 일자**: 2026-05-21
> **참석**: 아트 디렉터 / 인터랙션 디자이너 / 프론트엔드 엔지니어 / 브랜드 전략가 / 접근성 전문가
>
> 이 문서는 5인의 1차 분석 → 토론 → 합의 도출 → 구체 명세 → 구현 분해 → 위험 요소 검증 순으로 정리되었다.

---

## 0. 회의 개요

| 역할 | 이름(가상) | 관점 |
|---|---|---|
| 아트 디렉터 | **AD** | Apple Korea · Linear · Notion · Vercel 의 미니멀 럭셔리 톤. "여백이 곧 신뢰" |
| 인터랙션 디자이너 | **IX** | Framer Motion · scroll-triggered · micro-interactions · physics-based easing |
| 프론트엔드 엔지니어 | **FE** | Next.js 16 + Turbopack · 성능 (LCP < 2.5s) · 60fps · 번들 사이즈 |
| 브랜드 전략가 | **BR** | 의료 B2B 시장의 신뢰 vs 차별화. 김원장(의원)·최대표(공급업체) 1차 인상 |
| 접근성 전문가 | **A11Y** | WCAG 2.1 AA · prefers-reduced-motion · 색상 대비 4.5:1 |

---

## 1. 현재 메인페이지 분석 (각 전문가 1차 평가)

### 1.1 페이지 현황 (모두가 공유한 사실)

현재 `/` 페이지 구성:
1. TopNav (sticky backdrop-blur, z-30)
2. Hero — "Phase 1 베타" 배지 + 큰 타이포 + CTA 2개
3. Features — 3개 가치 카드 (TrendingDown · Repeat · Users)
4. Audience — 병원 · 공급업체 2-column
5. Steps — 3단계 회원가입 절차
6. Bottom CTA
7. Footer

### 1.2 AD (아트 디렉터) — 미니멀 럭셔리 관점

> "현재 페이지는 **기능적으로 정직**하지만, **2026년 기준 시각적 임팩트가 약하다**. Linear · Vercel · Stripe 의 최신 메인 페이지와 비교하면:
>
> - 강점: 큰 여백, Pretendard, 절제된 컬러 → 신뢰감 ✓
> - 약점:
>   1. **Hero 의 시각적 무게중심 부재** — 텍스트 + CTA 만. 시선을 사로잡는 visual anchor 없음
>   2. **카드들이 모두 같은 무게감** — `bg-secondary` 단일 톤. 깊이감 없음
>   3. **Steps 섹션이 평면적** — 3개 박스가 동일 패턴
>   4. **Top → Bottom 의 시각적 리듬 부족** — 같은 컨테이너 폭, 같은 패딩
>
> 제안 방향: **'Apple Korea의 약간 어두운 친구'** — `bg-primary` 위에 절제된 글래스 카드 + subtle gradient + 깊이감"

### 1.3 IX (인터랙션 디자이너) — 모션 관점

> "현재는 **완전 정적**이다. hover transition + active scale 정도만. 2026년 SaaS 랜딩은:
>
> - **scroll-triggered reveal**이 표준 (Linear, Vercel)
> - **Hero 의 number/character animation** (Notion, Framer)
> - **Card hover 시 3D tilt 또는 spotlight** (Vercel hardware)
> - **Stat counter animation** (Stripe)
>
> 우리 페이지에 적용 가능한 영역:
> 1. Hero 의 "한 곳에서." 글자가 1초 늦게 fade-in
> 2. Features 3개 카드가 스크롤 진입 시 stagger 등장
> 3. Steps 3단계가 순차적으로 active 표시
> 4. Bottom CTA 의 배경 그라데이션이 마우스 위치 따라 미세 이동
>
> **단, 화려한 페이지 트랜지션은 금지** (DESIGN_SYSTEM §6.3). micro-interactions 만."

### 1.4 FE (프론트엔드 엔지니어) — 성능 관점

> "글래스모피즘 + 애니메이션은 비싼 작업. 현실적 한계:
>
> 1. **`backdrop-filter: blur()`** 는 GPU 가속이 안 되는 environment 에서 LCP 영향 큼. iOS Safari OK, Android Chrome 65+ OK. 적용 영역 제한 필요
> 2. **scroll-triggered animation** — Intersection Observer API + `transform/opacity` 만 (layout 트리거 금지)
> 3. **번들 사이즈** — Framer Motion 추가 시 +30~50KB gzip. 대안: CSS-only animation + IntersectionObserver
> 4. **Server Component 유지** — 가능한 한 client-side JS 최소화. animation은 CSS `animation-delay` + viewport reveal 만
>
> 권장 구현 스택:
> - Framer Motion 도입 ❌ (번들 부담)
> - CSS animations + `@starting-style` (Next.js 16 + 최신 브라우저) ✓
> - 작은 hook (`useInView`) 또는 `<details>` 같은 native API ✓
> - GPU 가속 transform · opacity · backdrop-filter 만 ✓"

### 1.5 BR (브랜드 전략가) — 시장 관점

> "MedPlace 의 1차 방문자는 **김원장(의원)** 과 **최대표(공급업체)**. 둘의 공통점:
>
> - 40~60대, 모바일 사용 시간 많음
> - '엣지 디자인'에 의심 (사기 사이트로 보일까 봐)
> - **'안전해 보이는 + 다른 의료 사이트와 다른'** 의 미묘한 균형
>
> 의료 SaaS 벤치마크 (한국):
> - 닥터노트 (의약품 검색) — 무미건조한 흰 배경
> - 디파인넷 (의료기기 유통) — 진한 파랑 + 빽빽
> - 우리는 그 사이의 **'Apple 같은 의료 사이트'** 포지셔닝
>
> 글래스모피즘 적용 시 우려:
> - 너무 화려하면 → 사기 사이트 인상 (위험)
> - 적정선: **카드에만 글래스 + 배경은 거의 단색** 권장
>
> 애니메이션 적용 시 우려:
> - 김원장이 모바일 4G 환경에서 buttery smooth 안 되면 즉시 뒤로가기
> - **'있어도 없어도 콘텐츠 전달에 영향 없는'** 수준의 micro-interactions 만"

### 1.6 A11Y (접근성 전문가) — 사용자 관점

> "**`prefers-reduced-motion: reduce`** 가 켜진 사용자는 전 세계 약 3~5%. 60대 의원 원장 중에선 더 높음.
>
> 절대 규칙:
> 1. 모든 애니메이션 → `@media (prefers-reduced-motion: reduce) { animation: none; }` 필수
> 2. 글래스모피즘 카드 → 텍스트와 배경의 대비 4.5:1 유지 (`backdrop-blur` 만으로 부족하면 `bg-white/85` 같이 알파 채널 확보)
> 3. 스크롤 reveal → 진입 전 `opacity: 0` 상태에서 텍스트가 스크린리더에 정상 노출 (visibility/display 사용 금지, opacity 만)
> 4. focus visible — 키보드 사용자가 모든 인터랙티브 요소에 가시적 focus ring
> 5. 텍스트 위 backdrop-blur — 모션 줄이기 설정 시 평평한 색으로 fallback"

---

## 2. 토론 — 갈등 포인트 3개

### 2.1 갈등 ① — 글래스모피즘 강도

**AD 주장**: "Hero 와 카드 전부에 `backdrop-blur-xl + bg-white/60 + border-white/30` 적용. 깊이감 큼."

**BR 반박**: "의료 시장에 너무 화려. 김원장이 '제대로 된 회사인가?' 의심한다."

**FE 반박**: "전부 적용하면 모바일 4G 에서 paint 비용 큼. LCP 3s+ 위험."

**A11Y 반박**: "blur 가 강하면 대비 부족 우려."

**합의 (AD 양보)**:
- 글래스모피즘은 **Hero 의 floating widget 1개** + **Bottom CTA 의 큰 카드 1개** + **Audience 의 카드 2개** 까지로 한정 (총 4곳)
- 다른 영역은 솔리드 `bg-secondary` 유지
- 알파 채널은 `bg-white/85` (가독성 우선)
- backdrop-blur 강도는 `backdrop-blur-md` (16px) 까지만 — `xl` 금지

### 2.2 갈등 ② — 애니메이션 범위

**IX 주장**: "scroll reveal + stat counter + mouse-tracking gradient 모두 적용."

**FE 반박**: "Mouse-tracking은 매 frame 마다 re-render. 차라리 CSS conic-gradient + `@keyframes` 로 자동 회전이 더 가볍다."

**BR 반박**: "Mouse-tracking 은 데스크탑만. 모바일에선 무용지물 + 비용만."

**A11Y 반박**: "reduced-motion 사용자 고려해서 모든 animation 은 fallback 필수."

**합의 (IX 양보)**:
- ✅ **Scroll-triggered reveal** (stagger fade-up 250ms) — 카드 그룹에 한정
- ✅ **Hero 의 큰 글자 fade-up** (1회, 페이지 진입 시) — `@starting-style` CSS only
- ✅ **CTA 버튼 hover 시 subtle glow** — `box-shadow` transition
- ✅ **Footer 의 wordmark 미세 회전** (10초 cycle) — `@keyframes` CSS only
- ❌ Mouse-tracking gradient — **제거**
- ❌ Stat counter — **제거** (현재 페이지에 stat 없음)
- 모두 `prefers-reduced-motion: reduce` 시 정적 fallback

### 2.3 갈등 ③ — 톤 (다크 vs 라이트)

**AD 주장**: "Linear · Vercel 처럼 **다크 우선**. 의료의 차분함 + 럭셔리."

**BR 반박**: "한국 의료 사이트는 다크가 거의 없음. 40~60대 사용자 거부감 우려. 라이트 우선."

**FE 의견**: "DESIGN_SYSTEM 에 light + dark 토큰 둘 다 정의됨. `color-scheme: light dark` 로 자동 대응 가능."

**A11Y 의견**: "다크 모드의 대비는 라이트 모드보다 검증 어려움. 우선은 라이트."

**합의**:
- **라이트 모드를 메인 톤**으로 유지 (`bg-primary: #FFFFFF`)
- 다크 모드는 시스템 설정 따라 자동 (현재 토큰 구조 그대로)
- 글래스모피즘은 두 모드 모두에서 자연스럽게 작동 (`bg-white/85` ↔ `bg-black/40`)
- AD 의 '럭셔리' 요구는 **컬러 톤 대신 타이포·여백·미세 그라데이션**으로 달성

---

## 3. 헌법 §1.2 디자인 금기 vs 리뉴얼 방향 검증

| 헌법 §1.2 금기 | 리뉴얼 충돌? | 대응 |
|---|---|---|
| 한글 5자+ gradient text 금지 | 위험 | "한 곳에서." 4자는 accent solid 유지. 영문/숫자만 gradient 허용 |
| 이모지 금지 (Lucide만) | OK | 기존대로 Lucide |
| Apple 공식 자산 금지 | OK | Pretendard + 자체 아이콘만 |
| 화려한 일러스트 배경 금지 | **주의** | 글래스모피즘 ≠ 일러스트 배경. 단색 + subtle gradient + blur 만 |
| 진한 그림자 + 진한 테두리 동시 사용 금지 | **주의** | 글래스 카드는 `border-white/30` (옅음) + `shadow-xl` 정도. 두 개 동시 강함 금지 |
| 색상 채도 80%↑ 강조색 금지 | OK | accent `#0066CC` 그대로 |
| 사이드바·탭 스트립 깊이 페이지 금지 | OK | 메인은 해당 없음 |

**최종 검증**: 합의된 방향은 헌법 §1.2 와 충돌 없음. 단, 글래스 카드의 그림자 강도는 `shadow-md` 수준으로 제한.

---

## 4. 합의된 디자인 명세

### 4.1 전역 톤

- **배경 베이스**: `bg-primary` (#FFFFFF) 유지
- **세컨더리 배경**: `bg-secondary` (#F5F5F7) 유지
- **추가 톤 (NEW)**: 화면 전체에 깔리는 미세 `radial-gradient` (`from-accent-light/20 via-transparent to-transparent`) — 0.3 opacity, 화면 우상단 고정
- 다크 모드는 그대로 시스템 설정 따라 자동

### 4.2 글래스모피즘 적용 4곳

#### G1. Hero 의 floating widget (NEW)
- 위치: Hero 우측 (데스크탑) 또는 Hero 아래 (모바일)
- 내용: "이번 주 거래 통계" 가짜 미니 대시보드 (시각적 anchor)
  ```
  ┌─────────────────────┐
  │ 이번 주               │
  │                       │
  │  127 건                │
  │  ↑ 23%                │
  │                       │
  │  · 신규 가입 12        │
  │  · 평균 정산 D+2.8h   │
  └─────────────────────┘
  ```
- 스타일: `bg-white/85 backdrop-blur-md border border-white/40 shadow-md rounded-3xl`
- 모바일에선 hero CTA 아래에 작게 표시 (full-width)

#### G2. Bottom CTA 의 큰 카드
- 현재 평평한 배경 → 큰 글래스 카드로 감싸기
- `bg-white/70 backdrop-blur-md border-white/40 shadow-xl`
- 카드 안에 헤드라인 + CTA 2개

#### G3 & G4. Audience 의 병원·공급업체 카드
- 현재 `border-light + bg-primary`
- 변경: `bg-white/75 backdrop-blur-sm border-white/40 shadow-md`
- hover 시 `bg-white/90 shadow-lg` (glass intensity 증가)

### 4.3 애니메이션 5종

#### A1. Hero 글자 fade-up (페이지 진입 1회)
- "병원 운영의 모든 것," — 0ms delay
- "한 곳에서." (accent) — 250ms delay
- "의료기기와 소모품을…" body — 500ms delay
- CTA 버튼 — 750ms delay
- 모두 `transform: translateY(20px) → 0` + `opacity: 0 → 1`, duration 600ms, ease-out

#### A2. Features 3개 카드 stagger reveal (스크롤 진입)
- Intersection Observer 트리거
- 좌측 → 중앙 → 우측 순서로 150ms 간격
- `translateY(40px) → 0` + `opacity 0 → 1`, duration 500ms

#### A3. Audience 카드 hover 효과
- 현재 `shadow-sm` → `shadow-lg` + 미세 `scale-[1.02]`
- duration 200ms ease-emphasized
- 카드 내부 아이콘 box 가 `accent-light` → `accent` 색 전환

#### A4. CTA 버튼 hover glow
- Primary CTA: hover 시 `box-shadow: 0 0 24px var(--color-accent)/40`
- duration 300ms

#### A5. Footer wordmark subtle rotation
- "MedPlace" 옆 Stethoscope 아이콘이 10초 주기로 ±3도 회전
- `@keyframes` CSS only, infinite
- reduced-motion 사용자에겐 정적

### 4.4 타이포·여백 보강

- Hero display 크기 증가: `text-6xl md:text-8xl` (기존 5xl/7xl)
- letter-spacing tightening: `tracking-[-0.04em]` (기존 tracking-tight)
- 섹션 간 여백: `py-32 md:py-40` (기존 24/32)
- Hero 의 부제 색상: `text-[var(--color-text-secondary)]/85` 로 약간 더 흐림

### 4.5 컬러 미세 조정

- accent gradient (영문 한정): `from-[#0066CC] to-[#0052A3]` 로 "MedPlace" 워드마크에만 적용
- Hero 의 "한 곳에서." 는 **solid accent** 유지 (헌법 §1.2 한글 5자+ 금지)
- 새 token: `--color-glass-bg-light: rgba(255,255,255,0.85)`, `--color-glass-border: rgba(255,255,255,0.40)`

---

## 5. 구현 작업 분해 — 5단계

### Step 1 — 토큰 + 글로벌 effects (1h)
- `globals.css` 에 `--color-glass-bg-light/dark` 추가
- 전역 radial-gradient overlay (body::before)
- prefers-reduced-motion 미디어 쿼리 강화

### Step 2 — 공통 컴포넌트 신규 (2h)
- `src/components/shared/glass-card.tsx` — 글래스 카드 래퍼
- `src/components/shared/reveal.tsx` — Intersection Observer 기반 scroll reveal (작은 client component, ~30 lines)

### Step 3 — Hero 리뉴얼 (3h)
- 텍스트 stagger animation (CSS @keyframes + animation-delay)
- 우측 floating widget G1 추가 (가짜 dashboard mini)
- 모바일 대응 (widget을 CTA 아래로)

### Step 4 — Features + Audience + Steps 보강 (2h)
- Features 3개 카드를 `<Reveal>` 로 감싸기 (stagger)
- Audience 2개 카드를 GlassCard 로 (G3/G4)
- Steps 시각적 리듬 — 카드 사이에 connector dot/line 추가

### Step 5 — Bottom CTA + Footer 보강 (1h)
- Bottom CTA 영역을 GlassCard 로 (G2)
- Footer Stethoscope 아이콘 subtle rotation

### Step 6 — 검증 (1h)
- `pnpm build` TypeScript 통과
- Lighthouse mobile score (성능 90+, 접근성 95+)
- `prefers-reduced-motion: reduce` 사용자 검증 (DevTools → Rendering → Emulate)
- 다크 모드 대비 검증

**총 작업 시간**: 약 10시간 (~1.5 영업일)

---

## 6. 위험 요소 + 대응

### 6.1 성능 위험
- **위험**: backdrop-blur 4곳 + radial-gradient overlay = paint 비용 ↑
- **대응**:
  - 글래스 카드는 viewport 진입 시에만 blur 활성 (`content-visibility: auto`)
  - radial-gradient 는 single `<div>` fixed, `will-change` 미적용 (계속 그릴 필요 없음)
  - LCP element (Hero h1) 는 글래스 안에 두지 않음

### 6.2 가독성 위험
- **위험**: 글래스 카드 안 텍스트 대비 부족
- **대응**: 카드 내부 텍스트는 항상 `text-primary` (#1D1D1F) — 알파 채널 적용 안 함
- 디자인 검증: WCAG contrast checker 로 모든 텍스트 4.5:1 검증

### 6.3 모바일 4G 위험
- **위험**: scroll reveal animation 끊김
- **대응**:
  - Intersection Observer threshold 0.15 (얕은 트리거)
  - `requestAnimationFrame` 으로 batch 처리
  - reveal 안 되어도 콘텐츠는 정상 표시 (no-JS fallback)

### 6.4 브라우저 호환
- **위험**: `@starting-style` 은 Chrome 117+, Safari 17.5+ 만
- **대응**: CSS animation + animation-delay 로 대체 (모든 모던 브라우저 지원)

### 6.5 헌법 §1.2 재위반 위험
- 작업 시작 전 디자인 mock + 헌법 §1.2 체크리스트 다시 검증
- 한글 5자+ gradient text · 이모지 · Apple 자산 · 진한 그림자+테두리 동시 — 4가지 재확인

---

## 7. 검증 체크리스트 (사용자 검증용)

작업 완료 후 사용자가 확인할 항목:

- [ ] Hero 의 큰 글자가 페이지 진입 시 부드럽게 fade-up
- [ ] Hero 우측 (또는 아래) 의 통계 widget 이 글래스 효과로 떠 있음
- [ ] Features 3개 카드가 스크롤 진입 시 순차 등장
- [ ] Audience 카드 hover 시 그림자 + 아이콘 색 전환
- [ ] Bottom CTA 가 큰 글래스 카드로 감싸짐
- [ ] Footer 의 Stethoscope 아이콘이 미세하게 흔들림
- [ ] DevTools → Rendering → `prefers-reduced-motion: reduce` 설정 시 모든 애니메이션 비활성
- [ ] 모바일 (Chrome DevTools 모바일 모드) 에서도 자연스럽게 작동
- [ ] 다크 모드 (시스템 설정 변경) 에서도 글래스 효과 유지
- [ ] Lighthouse 성능 점수 90+ (모바일 기준)

---

## 8. 최종 합의 요약

전문가 5인의 합의:

> 글래스모피즘은 **4곳 한정** (Hero widget · Bottom CTA · Audience 2 카드), backdrop-blur 강도는 **`md` 까지**.
> 애니메이션은 **5종** (Hero stagger · Features reveal · Audience hover · CTA glow · Footer subtle rotation), 모두 CSS-only + reduced-motion fallback.
> 톤은 **라이트 우선, 다크 자동 대응**. 의료 시장의 신뢰감을 우선하되 절제된 깊이감으로 차별화.
>
> 전체 작업 ~10시간, 헌법 §1.2 디자인 금기 7개 모두 준수.

---

## 9. 사용자 결정 사항

이 기획안 진행 전 다음 결정 필요:

1. **이 합의된 방향 그대로 진행할까?**
   - 추천: Yes — 위험은 검토됐고 헌법 정합성 확보
2. **Hero floating widget 의 가짜 통계 (127건 / ↑23% / D+2.8h)** — 표시 OK?
   - 옵션 A: 그대로 사용 (Phase 1 베타라 분명히 가짜임을 표시)
   - 옵션 B: 다른 내용으로 (예: Lucide 아이콘 그리드, 또는 "곧 출시" placeholder)
   - 옵션 C: floating widget 자체 제거 (Hero 는 텍스트 중심으로 유지)
3. **다른 페이지로 리뉴얼 확장**할까?
   - 메인만 (`/`) → 권장
   - 메인 + about + pricing 전체 marketing 영역 → 4~6시간 추가
   - 그 너머 (login·register·onboarding) → 별도 묶음, Phase 2 진입 후

---

## 변경 이력

- 2026-05-21: 전문가 5인 토론 후 최초 작성
