# DESIGN_SYSTEM.md — MedPlace 디자인 시스템 (v2)

> 이 문서는 어떻게 보일 것인지를 정의한다.
> 무엇을 만들지는 `PRD.md`, 어떻게 동작할지는 `ARCHITECTURE.md`에 있다.
>
> **v2 변경**: 디자인 시스템은 백엔드 스택과 무관하므로 변경 없음. 모든 토큰·컴포넌트 규칙 그대로.

---

## 1. 디자인 원칙

### 1.1 5가지 핵심 원칙

1. **여백이 곧 신뢰** — Apple Korea처럼 큰 여백·소수의 큰 타이포·중앙 정렬. 의료 컨텍스트에서 "혼란 없이 정확함"을 표현.
2. **그라데이션은 절제** — Hero 1곳, CTA 1곳 정도로 제한. 의료 = 신뢰감이므로 화려한 그라데이션은 금물.
3. **Liquid Glass** — 카드는 살짝 떠 있게, 호버 시 미세 그림자 변화. 콘텐츠 위에 떠 있지만 시선을 빼앗지 않게.
4. **데이터는 정확하게** — 가격·재고·UDI 같은 핵심 데이터는 표 또는 카드로 명확하게. 장식 금지.
5. **모바일이 1순위** — 60%+ 트래픽 예상. 데스크탑은 모바일 디자인의 확장으로 본다.

### 1.2 안티패턴 (피해야 할 것)

- ❌ 화려한 일러스트 배경 (B2B 신뢰감 저하)
- ❌ 진한 그림자 + 진한 테두리 동시 사용
- ❌ 색상 채도 80%↑ 강조색 (의료 = 차분함)
- ❌ 한글 5자 이상 또는 띄어쓰기 포함 텍스트에 gradient text 적용
- ❌ 이모지 (Lucide 아이콘만)
- ❌ 사이드바·탭 스트립을 깊이 있는 페이지에 배치

---

## 2. 컬러 시스템

### 2.1 코어 팔레트

```css
/* Light Mode */
--color-bg-primary: #FFFFFF;        /* 메인 배경 */
--color-bg-secondary: #F5F5F7;      /* 카드·섹션 배경 (Apple gray) */
--color-bg-tertiary: #FAFAFA;       /* 더 옅은 회색 */

--color-text-primary: #1D1D1F;      /* Apple 흑 */
--color-text-secondary: #6E6E73;    /* Apple 부텍스트 */
--color-text-tertiary: #86868B;     /* 가장 옅은 텍스트 */

--color-border: #D2D2D7;            /* 기본 경계선 */
--color-border-light: #E5E5EA;      /* 옅은 경계선 */

--color-accent: #0066CC;            /* Apple 블루 — Primary CTA */
--color-accent-hover: #0052A3;
--color-accent-light: #E8F2FF;      /* 배경에 사용 */

/* Semantic */
--color-success: #00A86B;           /* 승인·완료 */
--color-warning: #FF9500;           /* 경고·재고 부족 */
--color-error: #FF3B30;             /* 에러·취소 */
--color-info: #5AC8FA;
```

```css
/* Dark Mode */
--color-bg-primary: #000000;
--color-bg-secondary: #1C1C1E;
--color-bg-tertiary: #2C2C2E;

--color-text-primary: #F5F5F7;
--color-text-secondary: #98989D;
--color-text-tertiary: #636366;

--color-border: #38383A;
--color-border-light: #2C2C2E;

--color-accent: #0A84FF;            /* 다크모드용 더 밝은 블루 */
--color-accent-hover: #409CFF;
--color-accent-light: #1A2333;

--color-success: #30D158;
--color-warning: #FF9F0A;
--color-error: #FF453A;
--color-info: #64D2FF;
```

### 2.2 의료 컨텍스트 보조색

```css
/* 등급 표시 (의료기기 등급 1~4) */
--color-class-1: #34C759;     /* 1등급 - 안전 */
--color-class-2: #5AC8FA;     /* 2등급 */
--color-class-3: #FF9500;     /* 3등급 */
--color-class-4: #FF3B30;     /* 4등급 - 고위험 */

/* 주문 상태 */
--color-status-pending: #FF9500;
--color-status-paid: #5AC8FA;
--color-status-shipped: #007AFF;
--color-status-delivered: #34C759;
--color-status-cancelled: #8E8E93;
```

### 2.3 사용 가이드

| 용도 | 색상 |
|---|---|
| 페이지 배경 | `bg-primary` |
| 카드 배경 | `bg-secondary` (light) / `bg-tertiary` (dark) |
| 본문 텍스트 | `text-primary` |
| 보조 텍스트 (라벨·메타) | `text-secondary` |
| 비활성 텍스트 | `text-tertiary` |
| Primary CTA | `bg-accent text-white` |
| Secondary 버튼 | `bg-secondary text-primary border-border` |
| Hover 상태 | 색상 + 10% darken 또는 lighten |

**색상만으로 상태 표현 금지** — 항상 아이콘 또는 텍스트와 병행 (접근성).

---

## 3. 타이포그래피

### 3.1 폰트 — Pretendard Variable

**왜 Pretendard?**
- Apple SD Gothic Neo + Inter 기반 설계 → iOS 사용자에게 익숙한 인상
- Variable Font 1파일에 9 weights → CLS 최소화
- 한국어 + 영문 + 숫자 모두 균형 잡힘
- 무료 (SIL Open Font License)

### 3.2 셋업 (Next.js 16)

**1단계: 폰트 파일 다운로드**
- https://github.com/orioncactus/pretendard/releases 에서 최신 릴리즈
- `PretendardVariable.woff2`를 `/public/fonts/`에 배치

**2단계: `next/font/local` 설정**
```ts
// src/lib/fonts.ts
import localFont from "next/font/local";

export const pretendard = localFont({
  src: "../../public/fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",          // Variable font의 실제 weight 범위
  variable: "--font-pretendard",
});
```

**3단계: `layout.tsx`에 적용**
```tsx
import { pretendard } from "@/lib/fonts";

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

**4단계: Tailwind 설정**
```ts
// tailwind.config.ts
fontFamily: {
  sans: ["var(--font-pretendard)", "system-ui", "sans-serif"],
}
```

### 3.3 타이포 위계

```css
/* Display - 랜딩 Hero */
.text-display { 
  font-size: clamp(48px, 6vw, 80px);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

/* H1 - 페이지 타이틀 */
.text-h1 {
  font-size: clamp(36px, 4vw, 48px);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

/* H2 - 섹션 헤더 */
.text-h2 {
  font-size: clamp(24px, 2.5vw, 32px);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

/* H3 - 카드·서브섹션 */
.text-h3 {
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

/* Body Large - 본문 강조 */
.text-body-lg {
  font-size: 17px;
  font-weight: 400;
  line-height: 1.5;
}

/* Body - 기본 본문 */
.text-body {
  font-size: 15px;
  font-weight: 400;
  line-height: 1.5;
}

/* Caption - 메타데이터 */
.text-caption {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

/* Mono - 가격·숫자 (tnum 적용) */
.text-mono {
  font-feature-settings: 'tnum';
  font-variant-numeric: tabular-nums;
}
```

### 3.4 한글 타이포 주의사항

**그라데이션 텍스트는 짧은 영문/숫자에만:**
```tsx
{/* ✅ OK */}
<h1 className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
  M5 Pro
</h1>

{/* ❌ 금지 - 한글 5자+ */}
<h1 className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
  병원 운영의 모든 것
</h1>

{/* ✅ 대안 - 솔리드 컬러 */}
<h1 className="text-[#0066CC]">병원 운영의 모든 것</h1>
```

**숫자 정렬** (가격·수량 표):
```tsx
<span className="tabular-nums">₩1,234,567</span>
```

**자간**: 한글은 `letter-spacing: -0.01em ~ -0.02em` 정도 가볍게 적용 권장.

---

## 4. 레이아웃 & 그리드

### 4.1 컨테이너

```css
/* Apple 스타일 max-width */
.container-narrow { max-width: 980px; }     /* 본문 중심 */
.container-wide { max-width: 1280px; }      /* 일반 페이지 */
.container-full { max-width: 1440px; }      /* 대시보드 */

/* 좌우 패딩 */
.px-page { padding-left: 24px; padding-right: 24px; }
@media (min-width: 768px) { .px-page { padding: 0 48px; } }
@media (min-width: 1024px) { .px-page { padding: 0 64px; } }
```

### 4.2 섹션 간격

```css
/* Apple 식 큰 여백 */
.section-padding-sm { padding-top: 64px; padding-bottom: 64px; }
.section-padding-md { padding-top: 96px; padding-bottom: 96px; }
.section-padding-lg { padding-top: 128px; padding-bottom: 128px; }
```

### 4.3 모바일 우선 브레이크포인트

Tailwind 기본 사용:
- `sm:` 640px
- `md:` 768px (태블릿)
- `lg:` 1024px (데스크탑)
- `xl:` 1280px
- `2xl:` 1440px

**컴포넌트는 모바일부터 디자인 → md+에서 확장**.

---

## 5. 컴포넌트 패턴

### 5.1 Card

```tsx
// 기본 카드 (Apple 스타일)
<div className="
  rounded-2xl 
  bg-[var(--color-bg-secondary)]
  p-6
  transition-shadow duration-300
  hover:shadow-md
">
  ...
</div>

// 글래스 카드 (Hero 전용)
<div className="
  rounded-3xl
  bg-white/70 dark:bg-black/40
  backdrop-blur-xl
  border border-white/20
  p-8
">
  ...
</div>
```

### 5.2 Button

```tsx
// Primary CTA
<button className="
  inline-flex items-center justify-center
  h-12 px-8
  rounded-full
  bg-[#0066CC] text-white
  text-base font-medium
  transition-all duration-200
  hover:bg-[#0052A3]
  active:scale-[0.98]
  disabled:opacity-50 disabled:cursor-not-allowed
">
  구입하기
</button>

// Secondary
<button className="
  inline-flex items-center justify-center
  h-12 px-8
  rounded-full
  bg-transparent text-[#0066CC]
  border border-[#0066CC]
  text-base font-medium
  hover:bg-[#E8F2FF]
">
  더 알아보기
</button>

// Ghost (작은 액션)
<button className="
  text-[#0066CC]
  text-sm font-medium
  hover:underline
">
  자세히 →
</button>
```

### 5.3 Input

```tsx
<input className="
  w-full
  h-12
  px-4
  rounded-xl
  bg-[var(--color-bg-secondary)]
  border border-transparent
  text-base
  placeholder:text-[var(--color-text-tertiary)]
  focus:bg-white focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/20
  transition-all
" />
```

### 5.4 Data Table (B2B 필수 — Stripe Dashboard 스타일)

```tsx
<table className="w-full">
  <thead>
    <tr className="border-b border-[var(--color-border-light)]">
      <th className="text-left py-3 text-sm font-medium text-[var(--color-text-secondary)]">
        주문번호
      </th>
      ...
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors">
      <td className="py-4 text-sm tabular-nums">ORD-20260520-00001</td>
      ...
    </tr>
  </tbody>
</table>
```

### 5.5 Badge (상태 표시)

```tsx
function StatusBadge({ status }: { status: SubOrderStatus }) {
  const config = {
    ACCEPTED: { label: '접수', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    PACKING: { label: '포장 중', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    SHIPPED: { label: '배송 중', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    DELIVERED: { label: '배송 완료', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CANCELLED: { label: '취소됨', color: 'bg-gray-50 text-gray-700 border-gray-200' },
  }[status];
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
}
```

### 5.6 Hero Section (랜딩)

```tsx
<section className="py-24 md:py-32 text-center container-narrow mx-auto px-page">
  <h1 className="text-display mb-4">
    병원 운영의 모든 것,<br />
    한 곳에서.
  </h1>
  <p className="text-body-lg text-[var(--color-text-secondary)] mb-8 max-w-2xl mx-auto">
    의료기기·소모품을 가장 빠르게, 가장 투명하게.
    전국 공급업체와 연결됩니다.
  </p>
  <div className="flex gap-3 justify-center">
    <Button>지금 시작하기</Button>
    <Button variant="outline">더 알아보기</Button>
  </div>
  
  {/* 이미지·일러스트 영역 */}
  <div className="mt-16">
    <img src="/hero.png" alt="" className="mx-auto" />
  </div>
</section>
```

---

## 6. 인터랙션 & 모션

### 6.1 트랜지션 기본

```css
/* 표준 easing */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
--ease-emphasized: cubic-bezier(0.32, 0.72, 0, 1);

/* 표준 duration */
--duration-fast: 150ms;
--duration-default: 200ms;
--duration-slow: 300ms;
```

### 6.2 호버 효과

- 카드: `hover:shadow-md transition-shadow duration-300`
- 버튼: `active:scale-[0.98] transition-transform duration-150`
- 링크: `hover:underline` 또는 `hover:text-accent`

### 6.3 페이지 전환

Next.js App Router의 `loading.tsx`로 skeleton 표시. 화려한 페이지 트랜지션은 사용 금지 (B2B = 빠른 인식).

### 6.4 토스트 (알림)

`sonner` 사용:
```tsx
toast.success('주문이 접수되었습니다', { 
  description: '주문번호: ORD-20260520-00001',
  duration: 4000,
});
```

---

## 7. 아이콘 시스템

**Lucide React 단일 소스 사용**.

```tsx
import { ShoppingCart, Package, FileText, Settings } from 'lucide-react';

<ShoppingCart className="w-5 h-5" />
```

- 기본 크기: `w-5 h-5` (20px)
- 작은 인라인: `w-4 h-4` (16px)
- 큰 카드: `w-6 h-6` (24px)
- Hero/Empty State: `w-12 h-12` (48px)

**커스텀 SVG 아이콘이 필요한 경우** `/public/icons/` 에 배치, `next/image`로 사용.

---

## 8. 페이지별 디자인 가이드

### 8.1 랜딩 페이지
- Apple Korea 홈을 직접 참고
- Hero → 핵심 가치 3개 카드 → 공급업체 로고 그리드 → 공동구매 진행 중 → CTA
- 큰 여백, 큰 타이포, 1~2개의 화려한 비주얼

### 8.2 상품 목록 (검색 결과)
- 좌측 필터(데스크탑) / 상단 필터(모바일 드로어)
- 그리드 4열(데스크탑) → 2열(모바일)
- 상품 카드: 이미지 + 이름 + 가격(티어 있으면 from) + 공동구매 배지

### 8.3 상품 상세
- Apple 제품 상세를 참고
- 왼쪽: 큰 이미지 갤러리, 오른쪽: 정보 + CTA
- 아래: 상세 설명을 큰 섹션으로 (Hero-스타일)
- 인증서·UDI는 별도 "신뢰" 섹션으로 그룹핑

### 8.4 셀러센터 / 관리자
- Stripe Dashboard / Linear 스타일
- 좌측 사이드바 OK (이 컨텍스트만 예외)
- 데이터 테이블 + 카드 통계 + 필터
- 여백 적당히, 정보 밀도 중간

### 8.5 결제 페이지
- 토스 결제 / Apple Pay 스타일
- 단계 표시 명확 (1. 장바구니 → 2. 배송지 → 3. 결제)
- 벤더별 분할 명세 명확하게 표시

---

## 9. 접근성 (WCAG 2.1 AA)

### 9.1 컬러 대비
- 본문 텍스트: 대비 4.5:1+
- 큰 텍스트(18px+ Bold): 대비 3:1+
- UI 요소(버튼·아이콘): 대비 3:1+

### 9.2 키보드 네비
- 모든 인터랙티브 요소 Tab 가능
- Focus visible (`focus-visible:ring-2 focus-visible:ring-[#0066CC]`)
- Modal/Drawer 열림 시 trap focus + Esc 닫기

### 9.3 ARIA
- 아이콘만 있는 버튼: `aria-label`
- 토스트: `role="status"` 또는 `role="alert"`
- 폼 에러: `aria-invalid` + `aria-describedby`

### 9.4 모션 감소
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## 10. shadcn/ui 활용 가이드

### 10.1 설치
```bash
pnpm dlx shadcn@latest init
```

기본 설정:
- Style: New York
- Base color: Zinc
- CSS variables: Yes

### 10.2 사용할 컴포넌트 (MVP)
- Button, Input, Label, Textarea, Select
- Card, Badge, Separator
- Dialog, Sheet, Popover, Tooltip
- Table, Tabs
- Form (react-hook-form 연동)
- Toast (sonner 추천)
- Skeleton

### 10.3 커스터마이즈 원칙
- shadcn 원본 파일 직접 수정 금지
- 필요 시 `components/shared/`에 wrapper 작성
- 색상은 CSS variable로 통일 (위 2. 컬러 시스템 참조)

### 10.4 globals.css에 추가할 CSS Variables

```css
@layer base {
  :root {
    /* shadcn 기본 + MedPlace 오버라이드 */
    --background: 0 0% 100%;
    --foreground: 220 9% 13%;       /* #1D1D1F */
    
    --card: 0 0% 100%;
    --card-foreground: 220 9% 13%;
    
    --primary: 211 100% 40%;         /* #0066CC */
    --primary-foreground: 0 0% 100%;
    
    --secondary: 240 5% 96%;         /* #F5F5F7 */
    --secondary-foreground: 220 9% 13%;
    
    --muted: 240 5% 96%;
    --muted-foreground: 220 4% 44%;  /* #6E6E73 */
    
    --accent: 211 100% 91%;          /* #E8F2FF */
    --accent-foreground: 211 100% 40%;
    
    --destructive: 4 100% 59%;       /* #FF3B30 */
    --destructive-foreground: 0 0% 100%;
    
    --border: 240 6% 84%;            /* #D2D2D7 */
    --input: 240 6% 84%;
    --ring: 211 100% 40%;
    
    --radius: 0.75rem;               /* 12px */
  }
  
  .dark {
    --background: 0 0% 0%;
    --foreground: 240 5% 96%;
    /* ... 위 다크모드 색상으로 매핑 */
  }
}
```

---

## 11. Don't Do List (이미지 자산 관련)

- ❌ Apple 공식 이미지·제품 사진 직접 사용 (저작권)
- ❌ Apple SF Pro / San Francisco 폰트 사용 (라이선스)
- ❌ Apple 아이콘(앱 아이콘 등) 그대로 차용
- ❌ "MacBook Neo", "iPad air" 같은 Apple 제품명 마케팅 카피
- ✅ Apple **스타일·레이아웃·여백 원칙**은 차용 가능 (디자인 언어는 저작권 대상 아님)
- ✅ Pretendard는 자유 사용 가능 (SIL OFL)
- ✅ Lucide 아이콘은 자유 사용 가능 (ISC)

---

## 12. 디자인 토큰 통합 파일 (Tailwind v4 기준)

```css
/* src/styles/globals.css */
@import "tailwindcss";

@theme {
  /* Colors */
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F5F5F7;
  --color-bg-tertiary: #FAFAFA;
  
  --color-text-primary: #1D1D1F;
  --color-text-secondary: #6E6E73;
  --color-text-tertiary: #86868B;
  
  --color-border: #D2D2D7;
  --color-border-light: #E5E5EA;
  
  --color-accent: #0066CC;
  --color-accent-hover: #0052A3;
  --color-accent-light: #E8F2FF;
  
  --color-success: #00A86B;
  --color-warning: #FF9500;
  --color-error: #FF3B30;
  
  /* Typography */
  --font-sans: var(--font-pretendard), system-ui, sans-serif;
  
  /* Spacing */
  --spacing-page-x: 24px;
  --spacing-page-x-md: 48px;
  --spacing-page-x-lg: 64px;
  
  /* Radius */
  --radius-card: 16px;
  --radius-button: 9999px;       /* Apple 식 full pill */
  --radius-input: 12px;
  
  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-card-hover: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-modal: 0 24px 48px rgba(0,0,0,0.18);
}
```

---

## 13. 살아있는 컴포넌트 라이브러리

**Storybook 또는 자체 `/design-system` 페이지 권장** (Phase 2 후반):
- 모든 컴포넌트의 variant·상태·반응형 보기
- 디자이너가 직접 토큰 변경하며 확인 가능
- 신규 합류자 온보딩 시 1순위 학습 자료

---

**이 문서는 디자인 변경, 새 컴포넌트 추가, Apple 스타일 가이드 업데이트 시마다 갱신한다.**
