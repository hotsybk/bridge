// Wave 1 — 진료과별 ~120 상품 v2 시드.
//
// 실행:
//   pnpm seed:products-v2
//
// 전제:
//   - seed-catalog-v2.ts 가 먼저 실행되어 cat-* (진료과) 카테고리가 존재.
//   - seed-demo.ts 의 demo vendor 가 존재(없어도 본 스크립트가 필요한 vendor 를 upsert).
//
// 동작:
//   - 진료과 전문 공급사 3개(동방메디칼·덴탈프로·더마서플라이) upsert.
//   - ~120 상품을 결정적 ID (prod-v2-{slug}) 로 /products 에 적재.
//   - 모든 상품 status=ACTIVE + moderation.status=APPROVED + 유효 thumbnail.
//   - priceTiers(대량 할인) · subscribable · groupBuyable 적용.
//   - idempotent: 동일 ID set 으로 덮어쓰기 (재실행 안전).
//   - server-only guard.

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

if (typeof window !== "undefined") {
  throw new Error("seed-products-v2 must be used only on the server side.");
}

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../src/server/firebase/admin";
import { COLLECTIONS } from "../src/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────

const now = () => Timestamp.now();
const daysAgo = (d: number) =>
  Timestamp.fromMillis(Date.now() - d * 24 * 60 * 60 * 1000);

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 1): number {
  const v = Math.random() * (max - min) + min;
  return Number(v.toFixed(decimals));
}

// 카테고리 path(한글) 매핑 — seed-catalog-v2.ts 트리와 일치해야 함.
const CAT_PATH: Record<string, string[]> = {
  "cat-oriental-needle": ["한방", "침구류"],
  "cat-oriental-moxa": ["한방", "뜸·부항"],
  "cat-oriental-herb": ["한방", "조제·탕전"],
  "cat-oriental-physio": ["한방", "한방 물리치료"],
  "cat-oriental-chuna": ["한방", "추나·수기"],
  "cat-dental-handpiece": ["치과", "핸드피스·모터"],
  "cat-dental-implant": ["치과", "임플란트"],
  "cat-dental-impression": ["치과", "인상·충전재"],
  "cat-dental-bur": ["치과", "버·기구"],
  "cat-dental-rubber": ["치과", "방습·수복보조"],
  "cat-dental-consum": ["치과", "치과 소모품"],
  "cat-internal-diagnostic": ["내과·가정의학", "진단기기"],
  "cat-internal-respiratory": ["내과·가정의학", "호흡치료"],
  "cat-internal-injection": ["내과·가정의학", "주사·수액"],
  "cat-ortho-physio": ["정형·재활", "물리치료기"],
  "cat-ortho-cast": ["정형·재활", "깁스재료"],
  "cat-ortho-brace": ["정형·재활", "보조기"],
  "cat-surgery-suture": ["외과", "봉합사"],
  "cat-surgery-instrument": ["외과", "수술기구"],
  "cat-surgery-electro": ["외과", "전기수술"],
  "cat-surgery-dressing": ["외과", "드레싱·소독"],
  "cat-obgyn-exam": ["산부인과", "검사기구"],
  "cat-obgyn-surgery": ["산부인과", "수술·분만"],
  "cat-ophthal-exam": ["안과", "검안기기"],
  "cat-ophthal-consum": ["안과", "점안·수술소모품"],
  "cat-ent-scope": ["이비인후과", "내시경·검사"],
  "cat-ent-suction": ["이비인후과", "흡인·소모품"],
  "cat-derma-injection": ["피부·성형", "주사·시술소모품"],
  "cat-derma-material": ["피부·성형", "시술재료"],
  "cat-derma-laser": ["피부·성형", "레이저 소모품"],
  "cat-common-glove": ["공통소모품", "장갑"],
  "cat-common-mask": ["공통소모품", "마스크"],
  "cat-common-injection": ["공통소모품", "주사용품"],
  "cat-common-antiseptic": ["공통소모품", "소독제"],
  "cat-common-dressing": ["공통소모품", "드레싱"],
  "cat-common-sterile": ["공통소모품", "멸균용품"],
  "cat-common-waste": ["공통소모품", "폐기물"],
  "cat-common-gown": ["공통소모품", "가운·수술포"],
};

// 카테고리(또는 대분류)별 대표 Unsplash 이미지 — 의료 관련.
const UNSPLASH: Record<string, string> = {
  oriental: "photo-1512290923902-8a9f81dc236c", // 한방/herbal
  dental: "photo-1606811841689-23dfddce3e95", // 치과
  internal: "photo-1631815589968-fdb09a223b1e", // 진단기기
  ortho: "photo-1576091160550-2173dba999ef", // 재활/의료기기
  surgery: "photo-1551601651-bc60f254d532", // 수술기구
  obgyn: "photo-1584515933487-779824d29309", // 검진/소모품
  ophthal: "photo-1577401239170-897942555fb3", // 안과/눈
  ent: "photo-1666214280165-c3e7c9b6f7a4", // 진료기기
  derma: "photo-1612349317150-e413f6a5b16d", // 피부/시술
  common: "photo-1583912267550-bb6e1c7c4baa", // 일회용 소모품
};

const IMG = (top: string) =>
  `https://images.unsplash.com/${UNSPLASH[top] ?? UNSPLASH.common}?w=800&h=800&fit=crop&q=80`;

// 카테고리 id → 대분류 키 (이미지 매핑용)
function topKey(categoryId: string): string {
  return categoryId.split("-")[1] ?? "common";
}

// ─────────────────────────────────────────────────────────────
// VENDORS — 진료과 전문 공급사 (기존 demo vendor 구조 참고)
// ─────────────────────────────────────────────────────────────

interface VendorSeed {
  id: string;
  companyName: string;
  bizRegNo: string;
  vendorType: "DISTRIBUTOR" | "MANUFACTURER" | "IMPORTER";
  grade: "STANDARD" | "PLUS" | "PREMIUM" | "DIRECT";
  categories: string[];
  ceoName: string;
  phone: string;
  email: string;
  address: string;
}

const VENDORS: VendorSeed[] = [
  {
    id: "demo-vendor-oriental",
    companyName: "동방메디칼(주)",
    bizRegNo: "215-81-33421",
    vendorType: "MANUFACTURER",
    grade: "PREMIUM",
    categories: ["MED_DEVICE", "MED_SUPPLY"],
    ceoName: "한동수",
    phone: "031-1100-7700",
    email: "sales@dongbang-medical.co.kr",
    address: "경기도 화성시 동탄첨단산업1로 27",
  },
  {
    id: "demo-vendor-dental",
    companyName: "덴탈프로(주)",
    bizRegNo: "129-86-55218",
    vendorType: "DISTRIBUTOR",
    grade: "PLUS",
    categories: ["MED_DEVICE", "MED_SUPPLY"],
    ceoName: "조현우",
    phone: "02-2200-8800",
    email: "biz@dentalpro.kr",
    address: "서울특별시 강남구 논현로 432",
  },
  {
    id: "demo-vendor-derma",
    companyName: "더마서플라이(주)",
    bizRegNo: "144-81-77903",
    vendorType: "IMPORTER",
    grade: "PLUS",
    categories: ["MED_DEVICE", "MED_SUPPLY"],
    ceoName: "윤서아",
    phone: "02-3300-9900",
    email: "contact@dermasupply.co.kr",
    address: "서울특별시 강남구 도산대로 215",
  },
];

const VENDOR_NAME: Record<string, string> = {
  "demo-vendor-oriental": "동방메디칼(주)",
  "demo-vendor-dental": "덴탈프로(주)",
  "demo-vendor-derma": "더마서플라이(주)",
  "demo-vendor-medsupply": "(주)메디서플라이",
  "demo-vendor-hanbit": "한빛메디칼(주)",
  "demo-vendor-seoulhealth": "서울헬스케어",
};

// ─────────────────────────────────────────────────────────────
// PRODUCT 정의
// ─────────────────────────────────────────────────────────────

type Klass = "CLASS_1" | "CLASS_2" | "CLASS_3" | "CLASS_4" | "NON_DEVICE";

interface P {
  slug: string; // id = prod-v2-{slug}
  name: string;
  vendorId: string;
  categoryId: string;
  basePrice: number;
  unit: string;
  deviceClass: Klass;
  brand?: string;
  manufacturer?: string;
  origin?: string;
  description?: string;
  usage?: string;
  caution?: string;
  spec?: Record<string, string>;
  // 명시 안하면 휴리스틱(소모품=true) 사용
  subscribable?: boolean;
  groupBuyable?: boolean;
}

// 기본 설명/사양 휴리스틱 — 명시 안한 상품용.
function defaultDesc(p: P): string {
  return `${p.name}. ${p.brand ?? p.manufacturer ?? "국내 인증"} 제품으로 의료기관 현장에서 검증된 품질입니다. 대량 구매 시 단가 할인이 적용됩니다.`;
}

const PRODUCTS: P[] = [
  // ── 한방 (13) — 동방메디칼 ──────────────────────────────
  { slug: "oriental-needle-hochim-025", name: "동방침 일회용 호침 (0.25×30mm, 1000본)", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-needle", basePrice: 15000, unit: "BOX", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "EO 멸균 일회용 호침, 0.25×30mm 규격 1000본. 균일한 침첨 가공으로 자입 통증을 최소화했습니다.", usage: "혈자리 소독 후 침관과 함께 사용.", caution: "1회 사용 후 의료폐기물로 폐기.", spec: { 규격: "0.25×30mm", 수량: "1000본", 멸균: "EO 멸균" } },
  { slug: "oriental-needle-jangchim-030", name: "일회용 장침 (0.30×60mm, 1000본)", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-needle", basePrice: 19000, unit: "BOX", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "심부 자극용 일회용 장침 0.30×60mm 1000본. 스테인리스 침체로 강성이 우수합니다.", spec: { 규격: "0.30×60mm", 수량: "1000본" } },
  { slug: "oriental-needle-ear-set", name: "일회용 이침·압봉 세트", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-needle", basePrice: 9000, unit: "팩", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "이혈 자극용 일회용 이침과 압봉(왕쌀)을 함께 구성한 세트입니다.", spec: { 구성: "이침 + 압봉" } },
  { slug: "oriental-needle-lancet", name: "일회용 사혈침(란셋) 200개입", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-needle", basePrice: 12000, unit: "BOX", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "부항 사혈용 일회용 란셋 200개입. 안전캡으로 자상 사고를 예방합니다.", spec: { 수량: "200개", 게이지: "28G" } },
  { slug: "oriental-needle-tube", name: "침관(가이드 튜브) 1000개", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-needle", basePrice: 6000, unit: "팩", deviceClass: "NON_DEVICE", brand: "동방메디칼", origin: "대한민국", description: "호침 자입 보조용 플라스틱 침관 1000개. 다양한 침 길이에 호환됩니다.", spec: { 수량: "1000개", 재질: "PP" } },
  { slug: "oriental-moxa-indirect", name: "일회용 간접구(쑥뜸) 200개입", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-moxa", basePrice: 22000, unit: "BOX", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "점착식 일회용 간접구 200개입. 피부 화상 위험을 낮춘 받침대 일체형입니다.", spec: { 수량: "200개", 형태: "점착 받침형" } },
  { slug: "oriental-moxa-electronic", name: "무연 전자뜸(온구기)", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-moxa", basePrice: 89000, unit: "EA", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "연기 없이 온열 자극을 전달하는 전자식 온구기. 온도 단계 조절이 가능합니다.", subscribable: false, spec: { 온도: "3단계", 전원: "USB-C" } },
  { slug: "oriental-moxa-king-set", name: "왕뜸 세트", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-moxa", basePrice: 35000, unit: "SET", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "복부·요부용 대형 왕뜸 세트. 받침대와 쑥봉이 함께 구성됩니다." },
  { slug: "oriental-moxa-glass-cup", name: "유리부항 컵 세트 (10컵)", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-moxa", basePrice: 28000, unit: "SET", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "내열 강화유리 부항 컵 10종 세트. 부위별 사이즈를 모두 포함합니다.", subscribable: false },
  { slug: "oriental-moxa-plastic-pump", name: "플라스틱 부항기 (핸드펌프 12컵)", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-moxa", basePrice: 45000, unit: "SET", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "핸드펌프식 플라스틱 부항기 12컵 세트. 음압 조절이 정밀합니다.", subscribable: false },
  { slug: "oriental-moxa-disposable-cup", name: "일회용 부항컵 100개", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-moxa", basePrice: 15000, unit: "BOX", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "교차 감염을 막는 일회용 부항컵 100개입. 사혈 부항에 적합합니다." },
  { slug: "oriental-herb-pouch", name: "한약 탕전 파우치 (100매)", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-herb", basePrice: 18000, unit: "묶음", deviceClass: "NON_DEVICE", brand: "동방메디칼", origin: "대한민국", description: "탕약 포장용 식품용 파우치 100매. 고온 충전과 밀봉에 견딥니다.", spec: { 용량: "120ml", 수량: "100매" } },
  { slug: "oriental-physio-infrared", name: "한방 적외선 치료기", vendorId: "demo-vendor-oriental", categoryId: "cat-oriental-physio", basePrice: 450000, unit: "EA", deviceClass: "CLASS_2", brand: "동방메디칼", origin: "대한민국", description: "심부 온열용 한방 적외선 치료기. 침 시술 후 온열 자극에 활용합니다.", subscribable: false, groupBuyable: false },

  // ── 치과 (15) — 덴탈프로 ────────────────────────────────
  { slug: "dental-handpiece-highspeed", name: "하이스피드 핸드피스 (NSK 호환)", vendorId: "demo-vendor-dental", categoryId: "cat-dental-handpiece", basePrice: 850000, unit: "EA", deviceClass: "CLASS_2", brand: "덴탈프로", origin: "대한민국", description: "세라믹 베어링 하이스피드 핸드피스. 저소음·저진동 설계로 시술 정밀도를 높입니다.", subscribable: false, groupBuyable: false, spec: { 회전수: "최대 400,000 rpm", 커플링: "NSK 호환" } },
  { slug: "dental-handpiece-lowspeed", name: "로우스피드 콘트라앵글", vendorId: "demo-vendor-dental", categoryId: "cat-dental-handpiece", basePrice: 420000, unit: "EA", deviceClass: "CLASS_2", brand: "덴탈프로", origin: "대한민국", description: "연마·발치 보조용 로우스피드 콘트라앵글. 1:1 기어비로 토크가 안정적입니다.", subscribable: false, groupBuyable: false },
  { slug: "dental-implant-fixture", name: "임플란트 픽스처 (오스템 호환)", vendorId: "demo-vendor-dental", categoryId: "cat-dental-implant", basePrice: 180000, unit: "EA", deviceClass: "CLASS_4", brand: "덴탈프로", origin: "대한민국", description: "SLA 표면처리 티타늄 임플란트 픽스처. 골유착 속도가 우수합니다.", subscribable: false, groupBuyable: false, spec: { 재질: "Ti-6Al-4V", 표면: "SLA" } },
  { slug: "dental-implant-abutment", name: "어버트먼트(지대주)", vendorId: "demo-vendor-dental", categoryId: "cat-dental-implant", basePrice: 95000, unit: "EA", deviceClass: "CLASS_4", brand: "덴탈프로", origin: "대한민국", description: "보철 연결용 티타늄 지대주. 다양한 각도와 높이를 지원합니다.", subscribable: false, groupBuyable: false },
  { slug: "dental-impression-alginate", name: "알지네이트 인상재 (GC 아로마파인 1kg)", vendorId: "demo-vendor-dental", categoryId: "cat-dental-impression", basePrice: 12000, unit: "봉", deviceClass: "CLASS_1", brand: "GC", manufacturer: "GC", origin: "일본", description: "정밀 인상 채득용 알지네이트 1kg. 향 첨가로 환자 거부감을 줄였습니다." },
  { slug: "dental-impression-silicone", name: "실리콘 인상재 세트(퍼티+라이트)", vendorId: "demo-vendor-dental", categoryId: "cat-dental-impression", basePrice: 68000, unit: "SET", deviceClass: "CLASS_2", brand: "덴탈프로", origin: "대한민국", description: "퍼티와 라이트바디로 구성된 실리콘 인상재 세트. 정밀도가 높은 부가중합형입니다.", subscribable: false },
  { slug: "dental-impression-resin", name: "광중합 레진 (컴포지트)", vendorId: "demo-vendor-dental", categoryId: "cat-dental-impression", basePrice: 45000, unit: "EA", deviceClass: "CLASS_2", brand: "덴탈프로", origin: "대한민국", description: "심미 수복용 광중합 컴포지트 레진. 자연치아와 유사한 색조를 재현합니다." },
  { slug: "dental-impression-gi", name: "글래스아이오노머(GI) 세트", vendorId: "demo-vendor-dental", categoryId: "cat-dental-impression", basePrice: 38000, unit: "SET", deviceClass: "CLASS_2", brand: "덴탈프로", origin: "대한민국", description: "불소 방출형 글래스아이오노머 충전재 세트. 베이스·라이닝에 적합합니다.", subscribable: false },
  { slug: "dental-bur-diamond", name: "다이아몬드 버 10개입", vendorId: "demo-vendor-dental", categoryId: "cat-dental-bur", basePrice: 18000, unit: "BOX", deviceClass: "CLASS_1", brand: "덴탈프로", origin: "대한민국", description: "치아 삭제용 다이아몬드 버 10개입. 균일한 입자 코팅으로 절삭력이 우수합니다." },
  { slug: "dental-bur-carbide", name: "카바이드 버 10개입", vendorId: "demo-vendor-dental", categoryId: "cat-dental-bur", basePrice: 22000, unit: "BOX", deviceClass: "CLASS_1", brand: "덴탈프로", origin: "대한민국", description: "보철 제거·연마용 텅스텐 카바이드 버 10개입. 내마모성이 뛰어납니다." },
  { slug: "dental-rubber-dam", name: "러버댐 시트 (36매)", vendorId: "demo-vendor-dental", categoryId: "cat-dental-rubber", basePrice: 24000, unit: "BOX", deviceClass: "CLASS_1", brand: "덴탈프로", origin: "대한민국", description: "근관치료 방습용 러버댐 시트 36매. 라텍스 프리 옵션으로 알러지 위험을 낮췄습니다." },
  { slug: "dental-rubber-matrix", name: "매트릭스 밴드·리테이너", vendorId: "demo-vendor-dental", categoryId: "cat-dental-rubber", basePrice: 18000, unit: "팩", deviceClass: "CLASS_1", brand: "덴탈프로", origin: "대한민국", description: "인접면 수복 보조용 매트릭스 밴드와 리테이너 구성품입니다." },
  { slug: "dental-consum-suction-tip", name: "일회용 석션팁 100개", vendorId: "demo-vendor-dental", categoryId: "cat-dental-consum", basePrice: 9000, unit: "BOX", deviceClass: "CLASS_1", brand: "덴탈프로", origin: "대한민국", description: "치과 진료용 일회용 석션팁 100개입. 끝단 라운드 가공으로 점막 손상을 줄입니다." },
  { slug: "dental-consum-tray", name: "일회용 인상 트레이 50개", vendorId: "demo-vendor-dental", categoryId: "cat-dental-consum", basePrice: 18000, unit: "BOX", deviceClass: "CLASS_1", brand: "덴탈프로", origin: "대한민국", description: "교차 감염 방지용 일회용 인상 트레이 50개. 상·하악 사이즈 혼합 구성입니다." },
  { slug: "dental-consum-anesthetic", name: "치과 마취 카트리지 (리도카인 50개)", vendorId: "demo-vendor-dental", categoryId: "cat-dental-consum", basePrice: 42000, unit: "BOX", deviceClass: "CLASS_2", brand: "덴탈프로", origin: "대한민국", description: "치과 국소마취용 리도카인 카트리지 50개입. 에피네프린 함유 제형입니다.", subscribable: false, caution: "전문의약품 — 처방·관리 기준 준수." },

  // ── 내과·가정의학 (10) — 메디서플라이/한빛 ──────────────
  { slug: "internal-diag-stetho-littmann", name: "리트만 청진기 Classic III", vendorId: "demo-vendor-hanbit", categoryId: "cat-internal-diagnostic", basePrice: 180000, unit: "EA", deviceClass: "CLASS_1", brand: "3M Littmann", manufacturer: "3M", origin: "미국", description: "양면 청진면을 갖춘 리트만 Classic III. 저주파·고주파 청진을 한 면에서 전환합니다.", subscribable: false },
  { slug: "internal-diag-bp", name: "병원용 전자 혈압계", vendorId: "demo-vendor-hanbit", categoryId: "cat-internal-diagnostic", basePrice: 120000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "외래 진료용 상완식 전자 혈압계. 부정맥 감지와 평균 측정 기능을 제공합니다.", subscribable: false },
  { slug: "internal-diag-ear-thermo", name: "고막 체온계", vendorId: "demo-vendor-hanbit", categoryId: "cat-internal-diagnostic", basePrice: 45000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "1초 측정 고막 체온계. 일회용 프로브 캡으로 위생적입니다.", subscribable: false },
  { slug: "internal-diag-spo2", name: "산소포화도 측정기 (SpO2)", vendorId: "demo-vendor-hanbit", categoryId: "cat-internal-diagnostic", basePrice: 85000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "손가락 클립형 펄스 옥시미터. 산소포화도와 맥박을 동시에 표시합니다.", subscribable: false },
  { slug: "internal-diag-glucose", name: "혈당측정기 + 스트립 50매", vendorId: "demo-vendor-medsupply", categoryId: "cat-internal-diagnostic", basePrice: 35000, unit: "SET", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "대한민국", description: "혈당측정기 본체와 검사지 50매, 채혈기를 포함한 세트입니다." },
  { slug: "internal-diag-ecg", name: "심전도기 (ECG 12채널)", vendorId: "demo-vendor-hanbit", categoryId: "cat-internal-diagnostic", basePrice: 2800000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "12채널 심전도기. 자동 분석 리포트와 PDF 출력을 지원합니다.", subscribable: false, groupBuyable: false },
  { slug: "internal-resp-nebulizer", name: "압축식 네뷸라이저 + 키트", vendorId: "demo-vendor-medsupply", categoryId: "cat-internal-respiratory", basePrice: 78000, unit: "SET", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "대한민국", description: "호흡기 치료용 압축식 네뷸라이저와 마스크·마우스피스 키트 구성입니다.", subscribable: false },
  { slug: "internal-inj-iv-set", name: "수액세트 (IV set) 100개", vendorId: "demo-vendor-medsupply", categoryId: "cat-internal-injection", basePrice: 15000, unit: "BOX", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "대한민국", description: "정맥 수액 투여용 IV 세트 100개입. 드립 챔버와 롤러 클램프 일체형입니다." },
  { slug: "internal-inj-catheter-22g", name: "IV 카테터 (22G) 50개", vendorId: "demo-vendor-medsupply", categoryId: "cat-internal-injection", basePrice: 32000, unit: "BOX", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "대한민국", description: "정맥 유치용 IV 카테터 22G 50개. 안전침 구조로 자상 사고를 예방합니다." },
  { slug: "internal-inj-syringe-3cc", name: "일회용 주사기 (3cc) 100개", vendorId: "demo-vendor-medsupply", categoryId: "cat-internal-injection", basePrice: 18000, unit: "BOX", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "대한민국", description: "EO 멸균 일회용 주사기 3cc 100개입. 23G 침 포함 구성입니다." },

  // ── 정형·재활 (9) — 메디서플라이/한빛 ───────────────────
  { slug: "ortho-physio-tens", name: "TENS 경피신경자극기", vendorId: "demo-vendor-hanbit", categoryId: "cat-ortho-physio", basePrice: 380000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "통증 완화용 TENS 경피신경자극기. 다채널·다모드 프로그램을 내장했습니다.", subscribable: false, groupBuyable: false },
  { slug: "ortho-physio-ultrasound", name: "초음파 치료기", vendorId: "demo-vendor-hanbit", categoryId: "cat-ortho-physio", basePrice: 850000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "심부 연조직 치료용 초음파 치료기. 1MHz·3MHz 주파수를 전환합니다.", subscribable: false, groupBuyable: false },
  { slug: "ortho-physio-traction", name: "요추 견인기", vendorId: "demo-vendor-hanbit", categoryId: "cat-ortho-physio", basePrice: 1800000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "요추 감압 치료용 견인기. 프로그램식 견인력 제어로 안전합니다.", subscribable: false, groupBuyable: false },
  { slug: "ortho-physio-infrared", name: "적외선 치료기", vendorId: "demo-vendor-hanbit", categoryId: "cat-ortho-physio", basePrice: 280000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "온열 물리치료용 적외선 치료기. 타이머와 거리 조절 암을 갖췄습니다.", subscribable: false },
  { slug: "ortho-cast-fiberglass", name: "글래스파이버 캐스트 (10cm)", vendorId: "demo-vendor-medsupply", categoryId: "cat-ortho-cast", basePrice: 6500, unit: "EA", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "경량 글래스파이버 캐스트 10cm. 빠른 경화와 높은 강도가 특징입니다." },
  { slug: "ortho-cast-plaster", name: "석고붕대 (15cm) 12개", vendorId: "demo-vendor-medsupply", categoryId: "cat-ortho-cast", basePrice: 24000, unit: "BOX", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "전통 석고붕대 15cm 12개입. 성형성이 우수해 정밀 고정에 적합합니다." },
  { slug: "ortho-cast-splint", name: "스플린트(반깁스)", vendorId: "demo-vendor-medsupply", categoryId: "cat-ortho-cast", basePrice: 12000, unit: "EA", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "응급 고정용 스플린트(반깁스). 재단이 쉬워 부위별 적용이 용이합니다." },
  { slug: "ortho-brace-knee", name: "관절 보조기(무릎)", vendorId: "demo-vendor-medsupply", categoryId: "cat-ortho-brace", basePrice: 45000, unit: "EA", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "무릎 안정화 보조기. 힌지로 가동 범위를 조절합니다.", subscribable: false },
  { slug: "ortho-brace-kwire", name: "K-wire 정형 와이어 세트", vendorId: "demo-vendor-medsupply", categoryId: "cat-ortho-brace", basePrice: 85000, unit: "BOX", deviceClass: "CLASS_3", brand: "메디서플라이", origin: "대한민국", description: "골 고정용 K-wire 와이어 세트. 다양한 직경을 혼합 구성했습니다.", subscribable: false, groupBuyable: false },

  // ── 외과 (8) — 메디서플라이/GS ───────────────────────────
  { slug: "surgery-suture-vicryl", name: "흡수성 봉합사 (Vicryl 호환 12개)", vendorId: "demo-vendor-medsupply", categoryId: "cat-surgery-suture", basePrice: 85000, unit: "BOX", deviceClass: "CLASS_4", brand: "메디서플라이", origin: "대한민국", description: "흡수성 합성 봉합사 12개입. 균일한 흡수 프로파일로 조직 반응이 적습니다.", subscribable: false, groupBuyable: false },
  { slug: "surgery-suture-nylon", name: "비흡수성 나일론 봉합사 (4/0, 12개)", vendorId: "demo-vendor-medsupply", categoryId: "cat-surgery-suture", basePrice: 42000, unit: "BOX", deviceClass: "CLASS_4", brand: "메디서플라이", origin: "대한민국", description: "피부 봉합용 비흡수성 나일론 봉합사 4/0 12개입입니다.", subscribable: false },
  { slug: "surgery-inst-blade-15", name: "메스날 (#15, 100개)", vendorId: "demo-vendor-medsupply", categoryId: "cat-surgery-instrument", basePrice: 12000, unit: "BOX", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "스테인리스 일회용 메스날 #15 100개입. 개별 멸균 포장입니다." },
  { slug: "surgery-inst-handle-3", name: "메스대 (handle #3)", vendorId: "demo-vendor-medsupply", categoryId: "cat-surgery-instrument", basePrice: 15000, unit: "EA", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "재사용 스테인리스 메스대 #3. 표준 메스날과 호환됩니다.", subscribable: false },
  { slug: "surgery-inst-mosquito", name: "모스키토 겸자", vendorId: "demo-vendor-medsupply", categoryId: "cat-surgery-instrument", basePrice: 28000, unit: "EA", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "독일", description: "미세 지혈용 모스키토 겸자. 곡선형 팁으로 정밀 조작이 가능합니다.", subscribable: false },
  { slug: "surgery-inst-needle-holder", name: "니들홀더", vendorId: "demo-vendor-medsupply", categoryId: "cat-surgery-instrument", basePrice: 35000, unit: "EA", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "독일", description: "봉합 바늘 파지용 니들홀더. 텅스텐 카바이드 인서트로 파지력이 강합니다.", subscribable: false },
  { slug: "surgery-electro-bovie", name: "전기소작기 (보비, ITC)", vendorId: "demo-vendor-medsupply", categoryId: "cat-surgery-electro", basePrice: 1200000, unit: "EA", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "대한민국", description: "절개·응고용 전기소작기 본체. 모노폴라·바이폴라 모드를 지원합니다.", subscribable: false, groupBuyable: false },
  { slug: "surgery-electro-handpiece", name: "일회용 보비 핸드피스·팁", vendorId: "demo-vendor-medsupply", categoryId: "cat-surgery-electro", basePrice: 18000, unit: "팩", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "대한민국", description: "전기소작기용 일회용 핸드피스와 블레이드 팁 구성입니다." },

  // ── 산부인과 (8) — 메디서플라이/세울헬스 ─────────────────
  { slug: "obgyn-exam-speculum-disposable", name: "일회용 질경 (멸균, 100개)", vendorId: "demo-vendor-medsupply", categoryId: "cat-obgyn-exam", basePrice: 60000, unit: "BOX", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "EO 멸균 일회용 질경 100개입. 측면 라이트 가이드 홈을 갖췄습니다." },
  { slug: "obgyn-exam-speculum-cusco", name: "스테인리스 Cusco 질경 (중)", vendorId: "demo-vendor-medsupply", categoryId: "cat-obgyn-exam", basePrice: 32000, unit: "EA", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "재사용 스테인리스 Cusco 질경 중형. 나사식 개폐로 고정이 견고합니다.", subscribable: false },
  { slug: "obgyn-exam-us-gel", name: "초음파 젤 (5L)", vendorId: "demo-vendor-seoulhealth", categoryId: "cat-obgyn-exam", basePrice: 9000, unit: "통", deviceClass: "NON_DEVICE", brand: "서울헬스케어", origin: "대한민국", description: "초음파 검사용 수용성 젤 5L. 무자극·무착색 제형입니다." },
  { slug: "obgyn-exam-probe-cover", name: "경질 초음파 프로브 커버 100개", vendorId: "demo-vendor-medsupply", categoryId: "cat-obgyn-exam", basePrice: 25000, unit: "BOX", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "경질 초음파 프로브 보호용 일회용 커버 100개입입니다." },
  { slug: "obgyn-surg-curette", name: "자궁 큐렛", vendorId: "demo-vendor-medsupply", categoryId: "cat-obgyn-surgery", basePrice: 38000, unit: "EA", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "소파술용 스테인리스 자궁 큐렛. 다양한 크기로 제공됩니다.", subscribable: false },
  { slug: "obgyn-surg-forceps", name: "소독 겸자", vendorId: "demo-vendor-medsupply", categoryId: "cat-obgyn-surgery", basePrice: 22000, unit: "EA", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "소독·드레싱 보조용 스테인리스 겸자입니다.", subscribable: false },
  { slug: "obgyn-surg-cord-clamp", name: "탯줄 클램프 100개", vendorId: "demo-vendor-medsupply", categoryId: "cat-obgyn-surgery", basePrice: 18000, unit: "BOX", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "대한민국", description: "분만용 일회용 탯줄 클램프 100개입. 단단한 잠금 구조입니다." },
  { slug: "obgyn-surg-hpv-kit", name: "HPV 검사 키트", vendorId: "demo-vendor-medsupply", categoryId: "cat-obgyn-surgery", basePrice: 120000, unit: "BOX", deviceClass: "CLASS_3", brand: "메디서플라이", origin: "대한민국", description: "자궁경부 HPV 검사용 채취·운송 키트입니다.", subscribable: false, groupBuyable: false },

  // ── 안과 (7) — 한빛/메디서플라이 ─────────────────────────
  { slug: "ophthal-exam-lcd-chart", name: "LCD 시력표", vendorId: "demo-vendor-hanbit", categoryId: "cat-ophthal-exam", basePrice: 680000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "다양한 시표를 표시하는 LCD 시력표. 거리 보정과 랜덤 시표 기능을 제공합니다.", subscribable: false, groupBuyable: false },
  { slug: "ophthal-exam-nct", name: "비접촉 안압계 (NCT)", vendorId: "demo-vendor-hanbit", categoryId: "cat-ophthal-exam", basePrice: 4500000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "공기 분사식 비접촉 안압계. 자동 정렬로 측정 재현성이 높습니다.", subscribable: false, groupBuyable: false },
  { slug: "ophthal-exam-slitlamp", name: "세극등 현미경 (슬릿램프)", vendorId: "demo-vendor-hanbit", categoryId: "cat-ophthal-exam", basePrice: 3800000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "전안부 정밀 검사용 세극등 현미경. LED 광원과 다단계 배율을 지원합니다.", subscribable: false, groupBuyable: false },
  { slug: "ophthal-consum-arttears", name: "일회용 인공눈물 (60개입)", vendorId: "demo-vendor-medsupply", categoryId: "cat-ophthal-consum", basePrice: 18000, unit: "BOX", deviceClass: "NON_DEVICE", brand: "메디서플라이", origin: "대한민국", description: "무방부제 일회용 인공눈물 60개입. 검사·시술 전후 안구 보습에 사용합니다." },
  { slug: "ophthal-consum-anesthetic", name: "점안 마취제", vendorId: "demo-vendor-medsupply", categoryId: "cat-ophthal-consum", basePrice: 24000, unit: "EA", deviceClass: "NON_DEVICE", brand: "메디서플라이", origin: "대한민국", description: "안과 검사·처치용 점안 마취제입니다.", caution: "전문의약품 — 보관 및 사용 기준 준수.", subscribable: false },
  { slug: "ophthal-consum-knife", name: "안과 수술 나이프", vendorId: "demo-vendor-medsupply", categoryId: "cat-ophthal-consum", basePrice: 85000, unit: "EA", deviceClass: "CLASS_3", brand: "메디서플라이", origin: "대한민국", description: "백내장 등 안과 수술용 미세 나이프. 절개 폭별 규격을 제공합니다.", subscribable: false, groupBuyable: false },
  { slug: "ophthal-consum-viscoelastic", name: "점탄물질 (안과 수술용)", vendorId: "demo-vendor-medsupply", categoryId: "cat-ophthal-consum", basePrice: 120000, unit: "EA", deviceClass: "CLASS_4", brand: "메디서플라이", origin: "대한민국", description: "전방 유지용 점탄물질(OVD). 백내장 수술 시 각막 내피를 보호합니다.", subscribable: false, groupBuyable: false },

  // ── 이비인후과 (8) — 한빛/메디서플라이 ───────────────────
  { slug: "ent-scope-otoscope", name: "오토스코프(이경)", vendorId: "demo-vendor-hanbit", categoryId: "cat-ent-scope", basePrice: 280000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "외이도·고막 검사용 오토스코프. LED 광원과 확대 렌즈를 갖췄습니다.", subscribable: false },
  { slug: "ent-scope-speculum", name: "비경(스펙큘럼)", vendorId: "demo-vendor-medsupply", categoryId: "cat-ent-scope", basePrice: 35000, unit: "EA", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "비강 검사용 스테인리스 비경. 부드러운 개폐 스프링 구조입니다.", subscribable: false },
  { slug: "ent-scope-laryngoscope", name: "맥킨토시 후두경 세트", vendorId: "demo-vendor-hanbit", categoryId: "cat-ent-scope", basePrice: 180000, unit: "SET", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "기도 확보용 맥킨토시 후두경 핸들과 블레이드 세트입니다.", subscribable: false, groupBuyable: false },
  { slug: "ent-scope-flexible", name: "연성 후두 내시경", vendorId: "demo-vendor-hanbit", categoryId: "cat-ent-scope", basePrice: 8500000, unit: "EA", deviceClass: "CLASS_2", brand: "한빛메디칼", origin: "대한민국", description: "후두·인두 관찰용 연성 내시경. 고해상 이미지와 부드러운 굴곡을 제공합니다.", subscribable: false, groupBuyable: false },
  { slug: "ent-suction-stationary", name: "거치형 의료용 흡인기", vendorId: "demo-vendor-medsupply", categoryId: "cat-ent-suction", basePrice: 220000, unit: "EA", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "대한민국", description: "처치실용 거치형 흡인기. 강한 흡입력과 정밀 음압 조절을 제공합니다.", subscribable: false, groupBuyable: false },
  { slug: "ent-suction-tip", name: "일회용 석션팁 100개", vendorId: "demo-vendor-medsupply", categoryId: "cat-ent-suction", basePrice: 9000, unit: "BOX", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "이비인후과 처치용 일회용 석션팁 100개입입니다." },
  { slug: "ent-suction-nasal-kit", name: "비염 세척 키트", vendorId: "demo-vendor-medsupply", categoryId: "cat-ent-suction", basePrice: 15000, unit: "팩", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "비강 세척용 키트. 세척병과 세척액 분말로 구성됩니다." },
  { slug: "ent-suction-applicator", name: "면봉 어플리케이터 500개", vendorId: "demo-vendor-medsupply", categoryId: "cat-ent-suction", basePrice: 8000, unit: "BOX", deviceClass: "NON_DEVICE", brand: "메디서플라이", origin: "대한민국", description: "처치용 면봉 어플리케이터 500개입. 긴 우드 스틱 타입입니다." },

  // ── 피부·성형 (8) — 더마서플라이 ────────────────────────
  { slug: "derma-inj-cannula-25g", name: "일회용 필러 캐뉼라 (25G, 20개)", vendorId: "demo-vendor-derma", categoryId: "cat-derma-injection", basePrice: 55000, unit: "BOX", deviceClass: "CLASS_2", brand: "더마서플라이", origin: "대한민국", description: "필러 시술용 일회용 마이크로 캐뉼라 25G 20개입. 둔단 처리로 출혈·멍을 줄입니다.", subscribable: false },
  { slug: "derma-inj-mesoneedle-32g", name: "메조니들 (32G, 100개)", vendorId: "demo-vendor-derma", categoryId: "cat-derma-injection", basePrice: 28000, unit: "BOX", deviceClass: "CLASS_2", brand: "더마서플라이", origin: "대한민국", description: "메조테라피용 초미세 32G 니들 100개입. 통증을 최소화한 박벽 가공입니다." },
  { slug: "derma-inj-insulin-31g", name: "인슐린 주사기 (31G, 100개)", vendorId: "demo-vendor-derma", categoryId: "cat-derma-injection", basePrice: 22000, unit: "BOX", deviceClass: "CLASS_2", brand: "더마서플라이", origin: "대한민국", description: "미용 시술 보조용 인슐린 주사기 31G 100개입. 데드 스페이스가 적습니다." },
  { slug: "derma-mat-botox", name: "보톡스 시술 바이알", vendorId: "demo-vendor-derma", categoryId: "cat-derma-material", basePrice: 95000, unit: "EA", deviceClass: "NON_DEVICE", brand: "더마서플라이", origin: "대한민국", description: "미용 시술용 보툴리눔 톡신 제제 바이알입니다.", caution: "전문의약품 — 냉장 보관·처방 기준 준수.", subscribable: false, groupBuyable: false },
  { slug: "derma-mat-ha-filler", name: "HA 필러 시린지 (1cc)", vendorId: "demo-vendor-derma", categoryId: "cat-derma-material", basePrice: 180000, unit: "EA", deviceClass: "CLASS_4", brand: "더마서플라이", origin: "대한민국", description: "히알루론산 필러 1cc 프리필드 시린지. 점탄성이 높아 윤곽 교정에 적합합니다.", subscribable: false, groupBuyable: false },
  { slug: "derma-laser-hifu", name: "HIFU 카트리지 (슈팅)", vendorId: "demo-vendor-derma", categoryId: "cat-derma-laser", basePrice: 850000, unit: "EA", deviceClass: "CLASS_3", brand: "더마서플라이", origin: "대한민국", description: "고강도 집속초음파(HIFU) 장비용 카트리지. 깊이별 라인업을 지원합니다.", subscribable: false, groupBuyable: false },
  { slug: "derma-laser-rf-tip", name: "RF 고주파 팁", vendorId: "demo-vendor-derma", categoryId: "cat-derma-laser", basePrice: 320000, unit: "EA", deviceClass: "CLASS_2", brand: "더마서플라이", origin: "대한민국", description: "고주파 장비용 마이크로니들 RF 팁. 시술 깊이를 정밀 제어합니다.", subscribable: false, groupBuyable: false },
  { slug: "derma-laser-foam-dressing", name: "시술 후 폼 드레싱 (10매)", vendorId: "demo-vendor-derma", categoryId: "cat-derma-laser", basePrice: 18000, unit: "BOX", deviceClass: "CLASS_1", brand: "더마서플라이", origin: "대한민국", description: "레이저·시술 후 진정용 폼 드레싱 10매. 삼출물 흡수와 습윤 환경을 유지합니다." },

  // ── 공통소모품 (13) — 메디서플라이/세울헬스 ──────────────
  { slug: "common-glove-nitrile-m", name: "니트릴 장갑 (M, 100매)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-glove", basePrice: 9000, unit: "BOX", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "말레이시아", description: "고탄력 니트릴 검진 장갑 M 100매. 라텍스 알러지 안전 제품입니다." },
  { slug: "common-glove-latex-m", name: "라텍스 장갑 (M, 100매)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-glove", basePrice: 8000, unit: "BOX", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "베트남", description: "착용감이 우수한 라텍스 검진 장갑 M 100매. 파우더 프리입니다." },
  { slug: "common-glove-sterile-surgical", name: "멸균 수술용 글러브 (50켤레)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-glove", basePrice: 35000, unit: "BOX", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "말레이시아", description: "EO 멸균 수술용 라텍스 글러브 50켤레. 해부학적 입체 성형입니다.", subscribable: false },
  { slug: "common-mask-kf94", name: "KF94 마스크 (50매)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-mask", basePrice: 18000, unit: "BOX", deviceClass: "NON_DEVICE", brand: "메디서플라이", origin: "대한민국", description: "식약처 허가 KF94 마스크 50매. 개별 포장으로 위생적입니다." },
  { slug: "common-mask-dental", name: "덴탈 마스크 3겹 (50매)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-mask", basePrice: 5000, unit: "BOX", deviceClass: "NON_DEVICE", brand: "메디서플라이", origin: "대한민국", description: "일반 진료용 3겹 덴탈 마스크 50매. 부드러운 귀끈과 노즈와이어 적용." },
  { slug: "common-mask-n95", name: "N95 마스크 (20매)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-mask", basePrice: 25000, unit: "BOX", deviceClass: "NON_DEVICE", brand: "메디서플라이", origin: "미국", description: "감염 관리용 N95 마스크 20매. 헤드밴드형 밀착 구조입니다.", subscribable: false },
  { slug: "common-inj-syringe-5cc", name: "일회용 주사기 (5cc, 100개)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-injection", basePrice: 20000, unit: "BOX", deviceClass: "CLASS_2", brand: "메디서플라이", origin: "대한민국", description: "EO 멸균 일회용 주사기 5cc 100개입. 23G 침 포함입니다." },
  { slug: "common-anti-alcohol-swab", name: "알코올 스왑 (200매)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-antiseptic", basePrice: 6000, unit: "BOX", deviceClass: "NON_DEVICE", brand: "메디서플라이", origin: "대한민국", description: "주사 부위 소독용 75% 알코올 스왑 200매. 개별 포장입니다." },
  { slug: "common-anti-povidone", name: "포비돈요오드 (베타딘 1L)", vendorId: "demo-vendor-seoulhealth", categoryId: "cat-common-antiseptic", basePrice: 12000, unit: "통", deviceClass: "NON_DEVICE", brand: "서울헬스케어", origin: "대한민국", description: "수술·창상 소독용 포비돈요오드 1L. 광범위 살균력을 제공합니다." },
  { slug: "common-dressing-gauze", name: "멸균 거즈 (10×10, 100매)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-dressing", basePrice: 9000, unit: "BOX", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "창상 처치용 멸균 거즈 10×10cm 100매. 흡수력이 우수합니다." },
  { slug: "common-sterile-pouch", name: "자가멸균 파우치 (200매)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-sterile", basePrice: 18000, unit: "BOX", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "기구 멸균용 자가밀봉 파우치 200매. 멸균 확인 인디케이터가 인쇄돼 있습니다." },
  { slug: "common-waste-container", name: "의료폐기물 전용 용기 (50L)", vendorId: "demo-vendor-seoulhealth", categoryId: "cat-common-waste", basePrice: 8500, unit: "EA", deviceClass: "NON_DEVICE", brand: "서울헬스케어", origin: "대한민국", description: "감염성 의료폐기물 전용 용기 50L. 규격 라벨과 잠금 뚜껑을 갖췄습니다.", subscribable: false },
  { slug: "common-gown-surgical", name: "일회용 수술 가운 (10개)", vendorId: "demo-vendor-medsupply", categoryId: "cat-common-gown", basePrice: 25000, unit: "BOX", deviceClass: "CLASS_1", brand: "메디서플라이", origin: "대한민국", description: "방수 처리 일회용 수술 가운 10개입. 통기성과 차단성을 동시에 확보했습니다." },
];

// ─────────────────────────────────────────────────────────────
// 변형 상품 (인기 품목 사이즈/색상) — ~120개로 확장
// ─────────────────────────────────────────────────────────────

interface Variant {
  baseSlug: string; // 원본 P.slug
  slug: string; // 새 변형 slug
  nameOverride: string;
  priceOverride?: number;
}

const VARIANTS: Variant[] = [
  // 니트릴 장갑 S/L
  { baseSlug: "common-glove-nitrile-m", slug: "common-glove-nitrile-s", nameOverride: "니트릴 장갑 (S, 100매)", priceOverride: 9000 },
  { baseSlug: "common-glove-nitrile-m", slug: "common-glove-nitrile-l", nameOverride: "니트릴 장갑 (L, 100매)", priceOverride: 9500 },
  // 라텍스 장갑 S/L
  { baseSlug: "common-glove-latex-m", slug: "common-glove-latex-s", nameOverride: "라텍스 장갑 (S, 100매)", priceOverride: 8000 },
  { baseSlug: "common-glove-latex-m", slug: "common-glove-latex-l", nameOverride: "라텍스 장갑 (L, 100매)", priceOverride: 8500 },
  // KF94 대형/소형
  { baseSlug: "common-mask-kf94", slug: "common-mask-kf94-large", nameOverride: "KF94 마스크 대형 (50매)", priceOverride: 19000 },
  { baseSlug: "common-mask-kf94", slug: "common-mask-kf94-small", nameOverride: "KF94 마스크 소형(어린이) (50매)", priceOverride: 18000 },
  // 호침 사이즈별
  { baseSlug: "oriental-needle-hochim-025", slug: "oriental-needle-hochim-020", nameOverride: "동방침 일회용 호침 (0.20×30mm, 1000본)", priceOverride: 15000 },
  { baseSlug: "oriental-needle-hochim-025", slug: "oriental-needle-hochim-025-40", nameOverride: "동방침 일회용 호침 (0.25×40mm, 1000본)", priceOverride: 16000 },
  { baseSlug: "oriental-needle-hochim-025", slug: "oriental-needle-hochim-030-50", nameOverride: "동방침 일회용 호침 (0.30×50mm, 1000본)", priceOverride: 17000 },
  // 주사기 사이즈별
  { baseSlug: "internal-inj-syringe-3cc", slug: "internal-inj-syringe-1cc", nameOverride: "일회용 주사기 (1cc) 100개", priceOverride: 16000 },
  { baseSlug: "internal-inj-syringe-3cc", slug: "internal-inj-syringe-10cc", nameOverride: "일회용 주사기 (10cc) 100개", priceOverride: 24000 },
  // IV 카테터 게이지별
  { baseSlug: "internal-inj-catheter-22g", slug: "internal-inj-catheter-20g", nameOverride: "IV 카테터 (20G) 50개", priceOverride: 33000 },
  { baseSlug: "internal-inj-catheter-22g", slug: "internal-inj-catheter-24g", nameOverride: "IV 카테터 (24G) 50개", priceOverride: 32000 },
  // 멸균 거즈 사이즈별
  { baseSlug: "common-dressing-gauze", slug: "common-dressing-gauze-5x5", nameOverride: "멸균 거즈 (5×5, 100매)", priceOverride: 7000 },
  // 봉합사 굵기별
  { baseSlug: "surgery-suture-nylon", slug: "surgery-suture-nylon-50", nameOverride: "비흡수성 나일론 봉합사 (5/0, 12개)", priceOverride: 42000 },
  { baseSlug: "surgery-suture-nylon", slug: "surgery-suture-nylon-30", nameOverride: "비흡수성 나일론 봉합사 (3/0, 12개)", priceOverride: 42000 },
  // 다이아몬드 버 모양별
  { baseSlug: "dental-bur-diamond", slug: "dental-bur-diamond-round", nameOverride: "다이아몬드 버 라운드형 10개입", priceOverride: 18000 },
  { baseSlug: "dental-bur-diamond", slug: "dental-bur-diamond-flat", nameOverride: "다이아몬드 버 플랫엔드형 10개입", priceOverride: 18000 },
  // 메조니들 게이지별
  { baseSlug: "derma-inj-mesoneedle-32g", slug: "derma-inj-mesoneedle-30g", nameOverride: "메조니들 (30G, 100개)", priceOverride: 27000 },
  { baseSlug: "derma-inj-mesoneedle-32g", slug: "derma-inj-mesoneedle-34g", nameOverride: "메조니들 (34G, 100개)", priceOverride: 29000 },
  // 알코올 스왑 대용량
  { baseSlug: "common-anti-alcohol-swab", slug: "common-anti-alcohol-swab-400", nameOverride: "알코올 스왑 (400매)", priceOverride: 11000 },
];

// ─────────────────────────────────────────────────────────────
// 시드 함수 — VENDORS upsert
// ─────────────────────────────────────────────────────────────

async function seedVendors(): Promise<number> {
  const db = adminDb();
  const ts = now();
  let count = 0;

  for (const v of VENDORS) {
    await db.collection(COLLECTIONS.vendors).doc(v.id).set(
      {
        id: v.id,
        bizRegNo: v.bizRegNo,
        bizRegImageUrl: "",
        bizVerifiedAt: daysAgo(60),
        companyName: v.companyName,
        ceoName: v.ceoName,
        phone: v.phone,
        email: v.email,
        zipcode: "06236",
        address: v.address,
        addressDetail: "1층",
        vendorType: v.vendorType,
        salesLicenseNo: `제2026-${v.id.slice(-4)}호`,
        salesLicenseImageUrl: "",
        status: "APPROVED",
        statusReason: null,
        approvedAt: daysAgo(45),
        defaultCommissionRate:
          v.grade === "PREMIUM" ? 0.04 :
          v.grade === "PLUS" ? 0.045 :
          v.grade === "DIRECT" ? 0.035 : 0.05,
        fastSettlementEnabled: v.grade === "PREMIUM" || v.grade === "DIRECT",
        categories: v.categories,
        productCount: 0,
        totalGmv: 0,
        reviewCount: 0,
        rating: randFloat(4.2, 4.9, 1),
        grade: v.grade,
        gradeUpdatedAt: daysAgo(30),
        payoutBankCode: "088",
        payoutBankAccount: "110-123-456789",
        payoutAccountHolder: v.companyName,
        createdAt: daysAgo(90),
        updatedAt: ts,
      },
      { merge: true },
    );
    count++;
    console.log(`  + vendor: ${v.companyName} (APPROVED, ${v.grade})`);
  }
  return count;
}

// ─────────────────────────────────────────────────────────────
// 시드 함수 — PRODUCTS upsert
// ─────────────────────────────────────────────────────────────

function buildPriceTiers(basePrice: number): Array<{ minQty: number; price: number }> {
  return [
    { minQty: 10, price: Math.round((basePrice * 0.92) / 100) * 100 },
    { minQty: 50, price: Math.round((basePrice * 0.85) / 100) * 100 },
  ];
}

// 소모품 판별 (휴리스틱) — unit 또는 device클래스 기반
function isConsumable(p: P): boolean {
  if (p.deviceClass === "CLASS_3" || p.deviceClass === "CLASS_4") return false;
  if (p.basePrice >= 200000) return false; // 고가 기기
  return ["BOX", "팩", "봉", "묶음", "통"].includes(p.unit);
}

async function seedProducts(): Promise<{ count: number; activeTotal: number }> {
  const db = adminDb();
  const ts = now();

  // 변형 → 완전한 P 로 확장
  const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));
  const allProducts: P[] = [...PRODUCTS];
  for (const v of VARIANTS) {
    const base = bySlug.get(v.baseSlug);
    if (!base) {
      console.warn(`  ! variant base not found: ${v.baseSlug}`);
      continue;
    }
    allProducts.push({
      ...base,
      slug: v.slug,
      name: v.nameOverride,
      basePrice: v.priceOverride ?? base.basePrice,
      description: undefined, // defaultDesc 로 생성
    });
  }

  let count = 0;
  type Write = { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> };
  const writes: Write[] = [];

  for (const p of allProducts) {
    const productId = `prod-v2-${p.slug}`;
    const categoryPath = CAT_PATH[p.categoryId] ?? ["기타"];
    const top = topKey(p.categoryId);
    const thumb = IMG(top);

    const consumable = isConsumable(p);
    const subscribable = p.subscribable ?? consumable;
    const groupBuyable = p.groupBuyable ?? consumable;
    const isDevice = !["NON_DEVICE"].includes(p.deviceClass);
    const moq = consumable ? 5 : 1;
    const stock = consumable ? randInt(300, 800) : randInt(5, 20);
    const shippingFee = p.basePrice >= 100000 ? 0 : 3000;

    const data: Record<string, unknown> = {
      id: productId,
      vendorId: p.vendorId,
      vendorName: VENDOR_NAME[p.vendorId] ?? p.vendorId,
      categoryId: p.categoryId,
      categoryPath,
      name: p.name,
      brand: p.brand ?? null,
      manufacturer: p.manufacturer ?? p.brand ?? null,
      origin: p.origin ?? "대한민국",
      udiCode: isDevice ? `0880${randInt(1000000, 9999999)}${randInt(100, 999)}` : null,
      mfdsLicenseNo: isDevice ? `수허 26-${randInt(1000, 9999)}` : null,
      deviceClass: p.deviceClass,
      images: [thumb],
      thumbnail: thumb,
      basePrice: p.basePrice,
      priceTiers: buildPriceTiers(p.basePrice),
      unit: p.unit,
      moq,
      stock,
      shippingFee,
      freeShippingAt: shippingFee > 0 ? 100000 : null,
      description: p.description ?? defaultDesc(p),
      usage: p.usage ?? null,
      caution: p.caution ?? null,
      spec: {
        제조사: p.manufacturer ?? p.brand ?? "—",
        원산지: p.origin ?? "대한민국",
        등급: p.deviceClass,
        ...(p.spec ?? {}),
      },
      status: "ACTIVE",
      moderation: {
        status: "APPROVED",
        reviewedAt: daysAgo(randInt(15, 40)),
        submittedAt: daysAgo(randInt(40, 60)),
      },
      verification: {
        udiValid: isDevice ? true : null,
        categoryMismatch: null,
      },
      subscribable,
      groupBuyable,
      viewCount: randInt(50, 500),
      orderCount: randInt(10, 200),
      avgRating: randFloat(4.0, 5.0, 1),
      reviewCount: randInt(3, 60),
      createdAt: daysAgo(randInt(20, 80)),
      updatedAt: ts,
    };

    writes.push({ ref: db.collection(COLLECTIONS.products).doc(productId), data });
    count++;
  }

  // batch commit (500 doc 한계 → 400 단위)
  for (let i = 0; i < writes.length; i += 400) {
    const slice = writes.slice(i, i + 400);
    const batch = db.batch();
    for (const w of slice) batch.set(w.ref, w.data, { merge: true });
    await batch.commit();
    console.log(`  committed batch ${Math.floor(i / 400) + 1} (${slice.length} docs)`);
  }

  // 검증 — products 컬렉션 ACTIVE 수
  const activeSnap = await db
    .collection(COLLECTIONS.products)
    .where("status", "==", "ACTIVE")
    .get();

  return { count, activeTotal: activeSnap.size };
}

// ─────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=== seeding products v2 (진료과 ~120 상품) ===");
  console.log(`  project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  const vendorCount = await seedVendors();
  const { count, activeTotal } = await seedProducts();

  // 진료과 카테고리 수 검증
  const db = adminDb();
  const catSnap = await db.collection(COLLECTIONS.categories).get();
  const specialtyCats = catSnap.docs.filter((d) => d.id.startsWith("cat-")).length;

  console.log("");
  console.log(`✓ vendors upserted: ${vendorCount}`);
  console.log(`✓ products upserted (v2): ${count}`);
  console.log(`✓ products ACTIVE (전체): ${activeTotal}`);
  console.log(`✓ cat-* 카테고리 (전체): ${specialtyCats}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
