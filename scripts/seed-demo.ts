// Wave X — 데모 시드 스크립트.
//
// 실행:
//   pnpm seed:demo            # idempotent (existing skip)
//   pnpm seed:demo:reset      # 모든 demo doc 삭제 후 재생성
//
// 범위:
//   - vendors (8) + hospitals (12) + products (~48) + orders (30) + groupBuys (5)
//   - coupons (8) + subscriptions (12) + disputes (4) + settlements (15)
//   - 각 컬렉션 cleanup option + verbose 로깅 + 통계 출력
//
// 주의:
//   - Cloud Function trigger 발화 가능 (정상)
//   - categories 는 미리 seed-categories.ts 로 시드되어 있다고 가정
//   - server-only guard

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

if (typeof window !== "undefined") {
  throw new Error("seed-demo must be used only on the server side.");
}

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../src/server/firebase/admin";
import { COLLECTIONS, SUB_COLLECTIONS } from "../src/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// 공통 유틸
// ─────────────────────────────────────────────────────────────

const RESET = process.argv.includes("--reset");
const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?w=800&h=800&fit=crop&q=80`;

const now = () => Timestamp.now();
const daysFromNow = (d: number) =>
  Timestamp.fromMillis(Date.now() + d * 24 * 60 * 60 * 1000);
const daysAgo = (d: number) =>
  Timestamp.fromMillis(Date.now() - d * 24 * 60 * 60 * 1000);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type Stats = { created: number; skipped: number };

function fmtStat(label: string, s: Stats, total: number): string {
  return `  ${label}: created=${s.created}, skipped=${s.skipped} (총 ${total})`;
}

// ─────────────────────────────────────────────────────────────
// DEMO DATA — VENDORS
// ─────────────────────────────────────────────────────────────

interface VendorSeed {
  id: string;
  companyName: string;
  bizRegNo: string;
  vendorType: "DISTRIBUTOR" | "MANUFACTURER" | "IMPORTER";
  grade?: "STANDARD" | "PLUS" | "PREMIUM" | "DIRECT";
  status: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
  statusReason?: string;
  categories: string[];
  ceoName: string;
  phone: string;
  email: string;
  address: string;
}

const VENDORS: VendorSeed[] = [
  {
    id: "demo-vendor-medsupply",
    companyName: "(주)메디서플라이",
    bizRegNo: "123-45-67890",
    vendorType: "DISTRIBUTOR",
    grade: "PREMIUM",
    status: "APPROVED",
    categories: ["MED_DEVICE", "MED_SUPPLY"],
    ceoName: "이정훈",
    phone: "02-1100-2200",
    email: "ceo@medsupply.co.kr",
    address: "서울특별시 강남구 테헤란로 152",
  },
  {
    id: "demo-vendor-hanbit",
    companyName: "한빛메디칼(주)",
    bizRegNo: "201-86-44512",
    vendorType: "MANUFACTURER",
    grade: "PLUS",
    status: "APPROVED",
    categories: ["DIAGNOSTIC"],
    ceoName: "박지선",
    phone: "031-2200-3300",
    email: "info@hanbitmedical.com",
    address: "경기도 성남시 분당구 판교로 230",
  },
  {
    id: "demo-vendor-carestore",
    companyName: "케어스토어",
    bizRegNo: "445-21-08812",
    vendorType: "IMPORTER",
    grade: "STANDARD",
    status: "APPROVED",
    categories: ["MED_SUPPLY"],
    ceoName: "정민호",
    phone: "02-3300-4400",
    email: "sales@carestore.kr",
    address: "서울특별시 마포구 월드컵북로 100",
  },
  {
    id: "demo-vendor-seoulhealth",
    companyName: "서울헬스케어",
    bizRegNo: "120-81-55621",
    vendorType: "DISTRIBUTOR",
    grade: "DIRECT",
    status: "APPROVED",
    categories: ["MONITORING", "INFECTION_CONTROL"],
    ceoName: "김태영",
    phone: "02-4400-5500",
    email: "contact@seoulhealth.co.kr",
    address: "서울특별시 영등포구 여의대로 24",
  },
  {
    id: "demo-vendor-gsmedical",
    companyName: "GS메디칼",
    bizRegNo: "211-87-44782",
    vendorType: "MANUFACTURER",
    grade: "PREMIUM",
    status: "APPROVED",
    categories: ["MED_DEVICE"],
    ceoName: "이상우",
    phone: "02-5500-6600",
    email: "biz@gsmedical.com",
    address: "서울특별시 송파구 올림픽로 300",
  },
  {
    id: "demo-vendor-lifecare",
    companyName: "라이프케어솔루션",
    bizRegNo: "311-22-67891",
    vendorType: "DISTRIBUTOR",
    grade: "PLUS",
    status: "APPROVED",
    categories: ["DIAGNOSTIC"],
    ceoName: "최승민",
    phone: "051-6600-7700",
    email: "office@lifecaresol.kr",
    address: "부산광역시 해운대구 센텀중앙로 79",
  },
  {
    id: "demo-vendor-meditech",
    companyName: "메디테크",
    bizRegNo: "211-22-12345",
    vendorType: "MANUFACTURER",
    grade: "STANDARD",
    status: "PENDING_REVIEW",
    categories: [],
    ceoName: "한지원",
    phone: "02-7700-8800",
    email: "hi@meditech.co.kr",
    address: "서울특별시 강남구 봉은사로 524",
  },
  {
    id: "demo-vendor-gooddoctor",
    companyName: "굿닥터",
    bizRegNo: "555-44-11111",
    vendorType: "IMPORTER",
    grade: "STANDARD",
    status: "REJECTED",
    statusReason: "통신판매업 신고증 미제출",
    categories: [],
    ceoName: "송예린",
    phone: "02-8800-9900",
    email: "hello@gooddoctor.kr",
    address: "서울특별시 중구 세종대로 110",
  },
];

// ─────────────────────────────────────────────────────────────
// DEMO DATA — HOSPITALS
// ─────────────────────────────────────────────────────────────

interface HospitalSeed {
  id: string;
  name: string;
  bizRegNo: string;
  type: "CLINIC" | "SMALL_HOSPITAL" | "GENERAL_HOSPITAL" | "TERTIARY" | "DENTAL" | "ORIENTAL";
  ceoName: string;
  phone: string;
  email: string;
  address: string;
  zipcode: string;
}

const HOSPITALS: HospitalSeed[] = [
  { id: "demo-hosp-seoulmed",   name: "서울메디컬의원",       bizRegNo: "120-81-55621", type: "CLINIC",            ceoName: "박원장", phone: "02-1234-5678", email: "admin@seoulmed.kr",     address: "서울특별시 강남구 강남대로 200",      zipcode: "06234" },
  { id: "demo-hosp-gangnam",    name: "강남종합병원",         bizRegNo: "121-81-66732", type: "GENERAL_HOSPITAL",  ceoName: "김원장", phone: "02-2345-6789", email: "admin@gangnam-h.kr",    address: "서울특별시 강남구 봉은사로 100",      zipcode: "06122" },
  { id: "demo-hosp-bundang",    name: "분당메디플렉스",       bizRegNo: "122-81-77843", type: "TERTIARY",          ceoName: "이원장", phone: "031-3456-7890", email: "admin@bundangmed.kr",   address: "경기도 성남시 분당구 야탑로 59",       zipcode: "13496" },
  { id: "demo-hosp-ddm",        name: "동대문가정의학",       bizRegNo: "123-81-88954", type: "CLINIC",            ceoName: "최원장", phone: "02-4567-8901", email: "admin@ddmfam.kr",       address: "서울특별시 동대문구 왕산로 19",        zipcode: "02478" },
  { id: "demo-hosp-songpa",     name: "송파메디케어",         bizRegNo: "124-81-99065", type: "SMALL_HOSPITAL",    ceoName: "정원장", phone: "02-5678-9012", email: "admin@songpamed.kr",    address: "서울특별시 송파구 송파대로 100",       zipcode: "05854" },
  { id: "demo-hosp-busan",      name: "부산해운대종합",       bizRegNo: "125-81-10176", type: "GENERAL_HOSPITAL",  ceoName: "장원장", phone: "051-6789-0123", email: "admin@busanhd.kr",     address: "부산광역시 해운대구 좌동순환로 30",    zipcode: "48094" },
  { id: "demo-hosp-daejeon",    name: "대전유성치과",         bizRegNo: "126-81-11287", type: "DENTAL",            ceoName: "박치과", phone: "042-7890-1234", email: "admin@djdental.kr",    address: "대전광역시 유성구 대학로 99",          zipcode: "34141" },
  { id: "demo-hosp-incheon",    name: "인천한방의원",         bizRegNo: "127-81-12398", type: "ORIENTAL",          ceoName: "한원장", phone: "032-8901-2345", email: "admin@ichoriental.kr", address: "인천광역시 남동구 인주대로 20",        zipcode: "21565" },
  { id: "demo-hosp-anyang",     name: "경기안양정형외과",     bizRegNo: "128-81-13409", type: "CLINIC",            ceoName: "안원장", phone: "031-9012-3456", email: "admin@anyangortho.kr", address: "경기도 안양시 동안구 시민대로 200",    zipcode: "14066" },
  { id: "demo-hosp-gwangju",    name: "광주성형외과",         bizRegNo: "129-81-14510", type: "CLINIC",            ceoName: "성원장", phone: "062-0123-4567", email: "admin@gjplastic.kr",   address: "광주광역시 서구 상무중앙로 80",        zipcode: "61949" },
  { id: "demo-hosp-daegu",      name: "대구피부과",           bizRegNo: "130-81-15621", type: "CLINIC",            ceoName: "피원장", phone: "053-1234-5678", email: "admin@dgskin.kr",      address: "대구광역시 중구 동성로 50",             zipcode: "41940" },
  { id: "demo-hosp-suwon",      name: "수원어린이병원",       bizRegNo: "131-81-16732", type: "SMALL_HOSPITAL",    ceoName: "어원장", phone: "031-2345-6789", email: "admin@suwonkids.kr",   address: "경기도 수원시 영통구 영통로 200",      zipcode: "16690" },
];

// ─────────────────────────────────────────────────────────────
// DEMO DATA — PRODUCTS
// ─────────────────────────────────────────────────────────────
// 카테고리 — seed-categories.ts 의 slug 와 일치해야 함.
// path[] 는 categories doc 의 path 와 동일.

interface ProductTemplate {
  name: string;
  brand: string;
  origin: string;
  categorySlug: string;
  categoryPath: string[];
  deviceClass: "CLASS_1" | "CLASS_2" | "CLASS_3" | "CLASS_4" | "NON_DEVICE";
  basePrice: number;
  unit: string;
  moq: number;
  shippingFee: number;
  description: string;
  photo: string;
  hasUdi?: boolean;
  priceTiers?: Array<{ minQty: number; price: number }>;
  subscribable?: boolean;
  groupBuyable?: boolean;
}

// vendor → 카테고리 매핑별 상품 풀. 각 vendor 에 8개씩 부여.
const PRODUCT_TEMPLATES: Record<string, ProductTemplate[]> = {
  "demo-vendor-medsupply": [
    { name: "라텍스 글러브 (M) 100매", brand: "메디서플라이", origin: "Vietnam", categorySlug: "latex-gloves", categoryPath: ["일회용 소모품", "장갑", "라텍스 장갑"], deviceClass: "CLASS_1", basePrice: 9800,  unit: "BOX", moq: 5,  shippingFee: 3000, description: "병원용 일회용 라텍스 글러브 100매. 식약처 인증.", photo: "photo-1583912267550-bb6e1c7c4baa", hasUdi: true, subscribable: true,  groupBuyable: true,  priceTiers: [{ minQty: 10, price: 8900 }, { minQty: 50, price: 7900 }] },
    { name: "니트릴 글러브 (M) 100매", brand: "메디서플라이", origin: "Malaysia", categorySlug: "nitrile-gloves", categoryPath: ["일회용 소모품", "장갑", "니트릴 장갑"], deviceClass: "CLASS_1", basePrice: 14500, unit: "BOX", moq: 5,  shippingFee: 3000, description: "고탄력 니트릴 글러브 100매. 라텍스 알러지 안전.", photo: "photo-1584515933487-779824d29309", hasUdi: true, subscribable: true,  groupBuyable: true },
    { name: "수술용 멸균 글러브 7.5", brand: "메디서플라이", origin: "Malaysia", categorySlug: "sterile-surgical-gloves", categoryPath: ["일회용 소모품", "장갑", "수술용 멸균 장갑"], deviceClass: "CLASS_2", basePrice: 32000, unit: "BOX", moq: 1, shippingFee: 0,    description: "EO 멸균 수술용 글러브, 사이즈 7.5. 50쌍.", photo: "photo-1631815589968-fdb09a223b1e", hasUdi: true, subscribable: false, groupBuyable: true },
    { name: "멸균거즈 4x4 100매",      brand: "메디서플라이", origin: "Korea",   categorySlug: "sterile-gauze", categoryPath: ["일회용 소모품", "거즈·붕대", "멸균 거즈"], deviceClass: "CLASS_1", basePrice: 12000, unit: "BOX", moq: 5, shippingFee: 3000, description: "병원용 멸균 거즈 4x4cm 100매.", photo: "photo-1584634731339-252c581abfc5", hasUdi: true, subscribable: true,  groupBuyable: true, priceTiers: [{ minQty: 10, price: 11000 }, { minQty: 50, price: 10000 }] },
    { name: "탄력 붕대 5cm 12롤",      brand: "메디서플라이", origin: "Korea",   categorySlug: "elastic-bandages", categoryPath: ["일회용 소모품", "거즈·붕대", "탄력 붕대"], deviceClass: "NON_DEVICE", basePrice: 15000, unit: "BOX", moq: 1, shippingFee: 3000, description: "고무사 함유 탄력 붕대 5cm × 4.5m, 12롤.", photo: "photo-1583912267550-bb6e1c7c4baa", subscribable: true, groupBuyable: false },
    { name: "1ml 일회용 주사기 100개",  brand: "메디서플라이", origin: "Korea",   categorySlug: "syringe-1ml", categoryPath: ["일회용 소모품", "주사기·바늘", "1ml 주사기"], deviceClass: "CLASS_1", basePrice: 8500, unit: "BOX", moq: 5, shippingFee: 3000, description: "1ml 일회용 주사기 100개입, 27G 침. 멸균 포장.", photo: "photo-1632053002434-c7c30b6f3236", hasUdi: true, subscribable: true, groupBuyable: false },
    { name: "수술용 메스 No.11 100개", brand: "메디서플라이", origin: "Korea",  categorySlug: "surgical-scalpels", categoryPath: ["의료기기", "수술 기구", "수술용 칼"], deviceClass: "CLASS_1", basePrice: 19000, unit: "BOX", moq: 1, shippingFee: 3000, description: "스테인리스 일회용 메스 No.11, 100개입.", photo: "photo-1551601651-bc60f254d532", hasUdi: true, subscribable: false, groupBuyable: false },
    { name: "수술용 가위 (직선) 15cm", brand: "메디서플라이", origin: "Germany", categorySlug: "surgical-scissors", categoryPath: ["의료기기", "수술 기구", "수술용 가위"], deviceClass: "CLASS_1", basePrice: 48000, unit: "EA",  moq: 1, shippingFee: 0,   description: "독일산 스테인리스 수술용 가위, 직선형 15cm.", photo: "photo-1606811971618-4486d14f3f99", hasUdi: true, subscribable: false, groupBuyable: true },
  ],
  "demo-vendor-hanbit": [
    { name: "디지털 혈압계 (상완식)",   brand: "한빛메디칼", origin: "Korea",  categorySlug: "automatic-bp", categoryPath: ["진단 기기", "혈압계", "자동 혈압계"], deviceClass: "CLASS_2", basePrice: 92000, unit: "EA", moq: 1, shippingFee: 0, description: "병원용 디지털 혈압계, 상완식. WHO 인증.", photo: "photo-1631815589968-fdb09a223b1e", hasUdi: true, groupBuyable: true },
    { name: "전자식 청진기 (블루투스)", brand: "한빛메디칼", origin: "Germany", categorySlug: "electronic-stethoscope", categoryPath: ["진단 기기", "청진기", "전자식 청진기"], deviceClass: "CLASS_2", basePrice: 380000, unit: "EA", moq: 1, shippingFee: 0, description: "블루투스 전자식 청진기. 노이즈 캔슬링.", photo: "photo-1666214280165-c3e7c9b6f7a4", hasUdi: true, groupBuyable: true },
    { name: "기계식 청진기 (성인용)",   brand: "한빛메디칼", origin: "USA",     categorySlug: "acoustic-stethoscope", categoryPath: ["진단 기기", "청진기", "기계식 청진기"], deviceClass: "CLASS_1", basePrice: 75000, unit: "EA", moq: 1, shippingFee: 0, description: "Littmann 동급 기계식 청진기. 성인용.", photo: "photo-1666214280165-c3e7c9b6f7a4", hasUdi: true, groupBuyable: true },
    { name: "비접촉 적외선 체온계",     brand: "한빛메디칼", origin: "Korea",  categorySlug: "non-contact-thermometer", categoryPath: ["진단 기기", "체온계", "비접촉 체온계"], deviceClass: "CLASS_2", basePrice: 38000, unit: "EA", moq: 1, shippingFee: 3000, description: "이마 비접촉 적외선 체온계, ±0.2°C 정밀도.", photo: "photo-1576091160550-2173dba999ef", hasUdi: true, subscribable: false, groupBuyable: true },
    { name: "고막 체온계 + 일회용 캡 20개", brand: "한빛메디칼", origin: "Korea", categorySlug: "ear-thermometer", categoryPath: ["진단 기기", "체온계", "고막 체온계"], deviceClass: "CLASS_2", basePrice: 65000, unit: "SET", moq: 1, shippingFee: 0, description: "고막 체온계 본체 + 일회용 프로브 캡 20개.", photo: "photo-1576091160550-2173dba999ef", hasUdi: true, groupBuyable: false },
    { name: "혈당계 본체 + 검사지 50매", brand: "한빛메디칼", origin: "Korea", categorySlug: "glucose-meter-device", categoryPath: ["진단 기기", "혈당계", "혈당 측정기"], deviceClass: "CLASS_2", basePrice: 85000, unit: "SET", moq: 1, shippingFee: 0, description: "혈당 측정기 본체 + 검사지 50매 + 채혈기.", photo: "photo-1631815589968-fdb09a223b1e", hasUdi: true, subscribable: true, groupBuyable: true },
    { name: "혈당 검사지 50매",         brand: "한빛메디칼", origin: "Korea", categorySlug: "glucose-test-strips", categoryPath: ["진단 기기", "혈당계", "혈당 검사지"], deviceClass: "CLASS_1", basePrice: 28000, unit: "BOX", moq: 5, shippingFee: 3000, description: "혈당 측정기 호환 검사지 50매.", photo: "photo-1631815589968-fdb09a223b1e", hasUdi: true, subscribable: true, groupBuyable: false, priceTiers: [{ minQty: 10, price: 26000 }] },
    { name: "수동 아네로이드 혈압계",   brand: "한빛메디칼", origin: "Germany", categorySlug: "manual-bp", categoryPath: ["진단 기기", "혈압계", "수동 혈압계"], deviceClass: "CLASS_2", basePrice: 110000, unit: "EA", moq: 1, shippingFee: 0, description: "독일산 수동 아네로이드 혈압계 + 청진기.", photo: "photo-1631815589968-fdb09a223b1e", hasUdi: true, groupBuyable: true },
  ],
  "demo-vendor-carestore": [
    { name: "KF94 마스크 (개별포장) 50매", brand: "케어스토어", origin: "Korea", categorySlug: "kf94-masks", categoryPath: ["일회용 소모품", "마스크", "KF94 마스크"], deviceClass: "NON_DEVICE", basePrice: 15500, unit: "BOX", moq: 1, shippingFee: 3000, description: "식약처 허가 KF94 마스크, 개별포장 50매.", photo: "photo-1584634731339-252c581abfc5", subscribable: true, groupBuyable: true, priceTiers: [{ minQty: 10, price: 13800 }, { minQty: 50, price: 12500 }] },
    { name: "덴탈 마스크 (3겹) 50매",      brand: "케어스토어", origin: "Korea", categorySlug: "dental-masks", categoryPath: ["일회용 소모품", "마스크", "덴탈 마스크"], deviceClass: "NON_DEVICE", basePrice: 7000, unit: "BOX", moq: 5, shippingFee: 3000, description: "치과·일반 진료용 덴탈 마스크 50매.", photo: "photo-1584634731339-252c581abfc5", subscribable: true, groupBuyable: true },
    { name: "수술용 마스크 (벨크로) 50매", brand: "케어스토어", origin: "Korea", categorySlug: "surgical-masks", categoryPath: ["일회용 소모품", "마스크", "수술용 마스크"], deviceClass: "CLASS_1", basePrice: 11500, unit: "BOX", moq: 2, shippingFee: 3000, description: "수술실용 벨크로 마스크 50매.", photo: "photo-1584634731339-252c581abfc5", hasUdi: true, subscribable: true, groupBuyable: false },
    { name: "N95 마스크 (헤드밴드) 20매",  brand: "케어스토어", origin: "USA",   categorySlug: "n95-masks", categoryPath: ["일회용 소모품", "마스크", "N95 마스크"], deviceClass: "NON_DEVICE", basePrice: 38000, unit: "BOX", moq: 1, shippingFee: 0, description: "3M N95 마스크 20매, 헤드밴드형.", photo: "photo-1584634731339-252c581abfc5", subscribable: false, groupBuyable: true },
    { name: "알코올 솜 (개별포장) 100매",  brand: "케어스토어", origin: "Korea", categorySlug: "alcohol-swabs", categoryPath: ["감염 관리", "살균 알코올", "알코올 솜"], deviceClass: "NON_DEVICE", basePrice: 4800, unit: "BOX", moq: 10, shippingFee: 3000, description: "75% 이소프로필 알코올 솜 100매.", photo: "photo-1584362917165-526a968579e8", subscribable: true, groupBuyable: true },
    { name: "비닐 글러브 (M) 100매",       brand: "케어스토어", origin: "Vietnam", categorySlug: "vinyl-gloves", categoryPath: ["일회용 소모품", "장갑", "비닐 글러브"], deviceClass: "NON_DEVICE", basePrice: 5500, unit: "BOX", moq: 10, shippingFee: 3000, description: "처치·검진용 비닐 글러브 100매. PVC.", photo: "photo-1583912267550-bb6e1c7c4baa", subscribable: true, groupBuyable: true },
    { name: "주사 바늘 23G 100개",         brand: "케어스토어", origin: "Korea", categorySlug: "needles", categoryPath: ["일회용 소모품", "주사기·바늘", "주사 바늘"], deviceClass: "CLASS_1", basePrice: 6000, unit: "BOX", moq: 5, shippingFee: 3000, description: "일회용 주사 바늘 23G × 1″ 100개.", photo: "photo-1632053002434-c7c30b6f3236", hasUdi: true, subscribable: true, groupBuyable: false },
    { name: "압박 붕대 10cm 6롤",          brand: "케어스토어", origin: "Korea", categorySlug: "compression-bandages", categoryPath: ["일회용 소모품", "거즈·붕대", "압박 붕대"], deviceClass: "NON_DEVICE", basePrice: 13500, unit: "BOX", moq: 1, shippingFee: 3000, description: "수술 후 압박용 탄력 붕대 10cm × 4.5m, 6롤.", photo: "photo-1584634731339-252c581abfc5", subscribable: false, groupBuyable: false },
  ],
  "demo-vendor-seoulhealth": [
    { name: "휴대용 SpO2 측정기",          brand: "서울헬스케어", origin: "USA",   categorySlug: "portable-spo2", categoryPath: ["환자 모니터링", "산소포화도", "휴대용 SpO2"], deviceClass: "CLASS_2", basePrice: 48000,  unit: "EA", moq: 1, shippingFee: 0, description: "휴대용 펄스 옥시미터. 산소포화도 + 맥박.", photo: "photo-1576091160550-2173dba999ef", hasUdi: true, groupBuyable: true },
    { name: "환자 침상용 SpO2 모니터",     brand: "서울헬스케어", origin: "Japan", categorySlug: "bedside-spo2", categoryPath: ["환자 모니터링", "산소포화도", "환자 침상용 SpO2"], deviceClass: "CLASS_2", basePrice: 480000, unit: "EA", moq: 1, shippingFee: 0, description: "병상용 SpO2 모니터, 5인치 LCD + 알람.", photo: "photo-1576091160550-2173dba999ef", hasUdi: true, groupBuyable: true },
    { name: "12채널 심전도",                brand: "서울헬스케어", origin: "Japan", categorySlug: "ecg-12-channel", categoryPath: ["환자 모니터링", "심전도 (ECG)", "12채널 심전도"], deviceClass: "CLASS_2", basePrice: 1850000, unit: "EA", moq: 1, shippingFee: 0, description: "12채널 심전도 + 출력. 인텔리전트 분석.", photo: "photo-1631815589968-fdb09a223b1e", hasUdi: true, groupBuyable: true },
    { name: "휴대용 심전도",                brand: "서울헬스케어", origin: "Korea", categorySlug: "portable-ecg", categoryPath: ["환자 모니터링", "심전도 (ECG)", "휴대용 심전도"], deviceClass: "CLASS_2", basePrice: 420000, unit: "EA", moq: 1, shippingFee: 0, description: "휴대용 단일 채널 심전도. 부정맥 스크리닝.", photo: "photo-1631815589968-fdb09a223b1e", hasUdi: true, groupBuyable: true },
    { name: "멀티파라미터 모니터",          brand: "서울헬스케어", origin: "Japan", categorySlug: "multiparameter-monitor", categoryPath: ["환자 모니터링", "환자 침상 모니터", "멀티파라미터 모니터"], deviceClass: "CLASS_2", basePrice: 2200000, unit: "EA", moq: 1, shippingFee: 0, description: "다파라미터 환자 모니터, ECG/NIBP/SpO2/Temp.", photo: "photo-1631815589968-fdb09a223b1e", hasUdi: true, groupBuyable: false },
    { name: "알코올 손소독제 500ml",        brand: "서울헬스케어", origin: "Korea", categorySlug: "alcohol-hand-sanitizer", categoryPath: ["감염 관리", "손소독제", "알코올 손소독제"], deviceClass: "NON_DEVICE", basePrice: 6500, unit: "EA", moq: 6, shippingFee: 3000, description: "75% 알코올 손소독제 펌프 500ml.", photo: "photo-1583912267550-bb6e1c7c4baa", subscribable: true, groupBuyable: true, priceTiers: [{ minQty: 12, price: 5900 }] },
    { name: "환경 표면 살균제 1L",          brand: "서울헬스케어", origin: "Korea", categorySlug: "surface-sanitizer", categoryPath: ["감염 관리", "환경 표면 클리너", "표면 살균제"], deviceClass: "NON_DEVICE", basePrice: 9800, unit: "EA", moq: 6, shippingFee: 3000, description: "병원 표면 살균제, 4급 암모늄 1L.", photo: "photo-1583912267550-bb6e1c7c4baa", subscribable: true, groupBuyable: true },
    { name: "70% 에탄올 1L",                brand: "서울헬스케어", origin: "Korea", categorySlug: "ethanol-70", categoryPath: ["감염 관리", "살균 알코올", "70% 에탄올"], deviceClass: "NON_DEVICE", basePrice: 8500, unit: "EA", moq: 6, shippingFee: 3000, description: "병원용 70% 에탄올 1L PE 보틀.", photo: "photo-1583912267550-bb6e1c7c4baa", subscribable: true, groupBuyable: true },
  ],
  "demo-vendor-gsmedical": [
    { name: "수술용 견인기 (Senn)",         brand: "GS메디칼", origin: "Korea",  categorySlug: "surgical-retractors", categoryPath: ["의료기기", "수술 기구", "수술용 견인기"], deviceClass: "CLASS_2", basePrice: 95000,  unit: "EA", moq: 1, shippingFee: 0, description: "Senn 형태 수술용 견인기. 스테인리스.", photo: "photo-1551601651-bc60f254d532", hasUdi: true, groupBuyable: true },
    { name: "니들 홀더 (Mayo-Hegar) 15cm",  brand: "GS메디칼", origin: "Germany", categorySlug: "needle-holders", categoryPath: ["의료기기", "수술 기구", "수술용 니들 홀더"], deviceClass: "CLASS_2", basePrice: 78000, unit: "EA", moq: 1, shippingFee: 0, description: "Mayo-Hegar 니들 홀더 15cm. 텅스텐 카바이드.", photo: "photo-1551601651-bc60f254d532", hasUdi: true, groupBuyable: false },
    { name: "수술용 겸자 (Allis) 16cm",     brand: "GS메디칼", origin: "Germany", categorySlug: "surgical-forceps", categoryPath: ["의료기기", "수술 기구", "수술용 겸자"], deviceClass: "CLASS_2", basePrice: 68000, unit: "EA", moq: 1, shippingFee: 0, description: "Allis Tissue Forceps 16cm. 스테인리스.", photo: "photo-1551601651-bc60f254d532", hasUdi: true, groupBuyable: true },
    { name: "골 고정 플레이트 세트",        brand: "GS메디칼", origin: "Korea",   categorySlug: "bone-fixation", categoryPath: ["의료기기", "정형외과 임플란트", "골 고정용 나사·플레이트"], deviceClass: "CLASS_3", basePrice: 380000, unit: "SET", moq: 1, shippingFee: 0, description: "골절 고정용 티타늄 플레이트 + 나사 세트.", photo: "photo-1606811971618-4486d14f3f99", hasUdi: true, groupBuyable: false },
    { name: "인공 슬관절 (스탠다드)",       brand: "GS메디칼", origin: "Korea",   categorySlug: "artificial-joints", categoryPath: ["의료기기", "정형외과 임플란트", "인공 관절"], deviceClass: "CLASS_4", basePrice: 1850000, unit: "SET", moq: 1, shippingFee: 0, description: "스탠다드 슬관절 치환술용 임플란트.", photo: "photo-1606811971618-4486d14f3f99", hasUdi: true, groupBuyable: false },
    { name: "척추 임플란트 (Pedicle 나사)",  brand: "GS메디칼", origin: "Korea",  categorySlug: "spine-implants", categoryPath: ["의료기기", "정형외과 임플란트", "척추 임플란트"], deviceClass: "CLASS_3", basePrice: 580000, unit: "EA", moq: 1, shippingFee: 0, description: "척추 고정 Pedicle 나사. 티타늄.", photo: "photo-1606811971618-4486d14f3f99", hasUdi: true, groupBuyable: false },
    { name: "위내시경 검사 키트",            brand: "GS메디칼", origin: "Japan",  categorySlug: "gastroscope", categoryPath: ["의료기기", "내시경", "위내시경"], deviceClass: "CLASS_2", basePrice: 8500000, unit: "EA", moq: 1, shippingFee: 0, description: "고해상도 위내시경 본체 (시연용).", photo: "photo-1606811971618-4486d14f3f99", hasUdi: true, groupBuyable: false },
    { name: "내시경 부속품 (생검 겸자) 10개", brand: "GS메디칼", origin: "Japan", categorySlug: "endoscopy-accessories", categoryPath: ["의료기기", "내시경", "내시경 부속품"], deviceClass: "CLASS_2", basePrice: 220000, unit: "BOX", moq: 1, shippingFee: 0, description: "일회용 생검 겸자 10개. 멸균 포장.", photo: "photo-1606811971618-4486d14f3f99", hasUdi: true, groupBuyable: true },
  ],
  "demo-vendor-lifecare": [
    { name: "휴대용 디지털 혈압계",          brand: "라이프케어", origin: "Korea", categorySlug: "portable-bp", categoryPath: ["진단 기기", "혈압계", "휴대용 혈압계"], deviceClass: "CLASS_2", basePrice: 65000, unit: "EA", moq: 1, shippingFee: 0, description: "휴대용 손목형 디지털 혈압계.", photo: "photo-1631815589968-fdb09a223b1e", hasUdi: true, groupBuyable: true },
    { name: "전자 체온계 (스틱형)",          brand: "라이프케어", origin: "Korea", categorySlug: "digital-thermometer", categoryPath: ["진단 기기", "체온계", "전자 체온계"], deviceClass: "CLASS_2", basePrice: 8500, unit: "EA", moq: 5, shippingFee: 3000, description: "구강·겨드랑이 전자 체온계, 30초.", photo: "photo-1576091160550-2173dba999ef", hasUdi: true, subscribable: true, groupBuyable: true, priceTiers: [{ minQty: 10, price: 7800 }] },
    { name: "ICU 중환자 모니터",             brand: "라이프케어", origin: "USA",   categorySlug: "icu-monitor", categoryPath: ["환자 모니터링", "환자 침상 모니터", "중환자실 모니터"], deviceClass: "CLASS_2", basePrice: 4200000, unit: "EA", moq: 1, shippingFee: 0, description: "중환자실 전용 모니터, 8 파라미터.", photo: "photo-1631815589968-fdb09a223b1e", hasUdi: true, groupBuyable: false },
    { name: "기구 소독제 5L",                brand: "라이프케어", origin: "Korea", categorySlug: "instrument-disinfectant", categoryPath: ["감염 관리", "소독제", "기구 소독제"], deviceClass: "NON_DEVICE", basePrice: 38000, unit: "EA", moq: 2, shippingFee: 3000, description: "수술 기구 화학 소독제 5L. 글루타르알데하이드.", photo: "photo-1583912267550-bb6e1c7c4baa", subscribable: true, groupBuyable: true },
    { name: "광범위 소독제 1L",              brand: "라이프케어", origin: "Korea", categorySlug: "broad-spectrum-disinfectant", categoryPath: ["감염 관리", "소독제", "광범위 소독제"], deviceClass: "NON_DEVICE", basePrice: 12000, unit: "EA", moq: 6, shippingFee: 3000, description: "광범위 항균·항바이러스 소독제 1L.", photo: "photo-1583912267550-bb6e1c7c4baa", subscribable: true, groupBuyable: true },
    { name: "이소프로필 알코올 1L",          brand: "라이프케어", origin: "Korea", categorySlug: "isopropyl-alcohol", categoryPath: ["감염 관리", "살균 알코올", "이소프로필 알코올"], deviceClass: "NON_DEVICE", basePrice: 7500, unit: "EA", moq: 6, shippingFee: 3000, description: "70% 이소프로필 알코올 1L.", photo: "photo-1583912267550-bb6e1c7c4baa", subscribable: true, groupBuyable: true },
    { name: "살균 와이프 100매",             brand: "라이프케어", origin: "Korea", categorySlug: "sanitizing-wipes", categoryPath: ["감염 관리", "환경 표면 클리너", "살균 와이프"], deviceClass: "NON_DEVICE", basePrice: 8500, unit: "BOX", moq: 6, shippingFee: 3000, description: "병원 표면용 살균 와이프 100매. 70% 이소프로필.", photo: "photo-1583912267550-bb6e1c7c4baa", subscribable: true, groupBuyable: true },
    { name: "무알코올 손소독제 500ml",       brand: "라이프케어", origin: "Korea", categorySlug: "alcohol-free-hand-sanitizer", categoryPath: ["감염 관리", "손소독제", "무알코올 손소독제"], deviceClass: "NON_DEVICE", basePrice: 7800, unit: "EA", moq: 6, shippingFee: 3000, description: "민감 피부용 무알코올 손소독제 500ml.", photo: "photo-1583912267550-bb6e1c7c4baa", subscribable: true, groupBuyable: true },
  ],
};

// ─────────────────────────────────────────────────────────────
// 시드 함수 — VENDORS
// ─────────────────────────────────────────────────────────────

async function seedVendors(): Promise<Stats> {
  const db = adminDb();
  const stats: Stats = { created: 0, skipped: 0 };
  const ts = now();

  const existingSnap = await db.collection(COLLECTIONS.vendors).get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  for (const v of VENDORS) {
    if (existingIds.has(v.id) && !RESET) {
      stats.skipped++;
      continue;
    }
    await db.collection(COLLECTIONS.vendors).doc(v.id).set({
      id: v.id,
      bizRegNo: v.bizRegNo,
      bizRegImageUrl: "",
      bizVerifiedAt: v.status === "APPROVED" ? daysAgo(60) : null,
      companyName: v.companyName,
      ceoName: v.ceoName,
      phone: v.phone,
      email: v.email,
      zipcode: "06236",
      address: v.address,
      addressDetail: "1층",
      vendorType: v.vendorType,
      salesLicenseNo: v.status === "APPROVED" ? `제2026-${v.id.slice(-4)}호` : null,
      salesLicenseImageUrl: "",
      status: v.status,
      statusReason: v.statusReason ?? null,
      approvedAt: v.status === "APPROVED" ? daysAgo(45) : null,
      defaultCommissionRate:
        v.grade === "PREMIUM" ? 0.04 :
        v.grade === "PLUS"    ? 0.045 :
        v.grade === "DIRECT"  ? 0.035 : 0.05,
      fastSettlementEnabled: v.grade === "PREMIUM" || v.grade === "DIRECT",
      categories: v.categories,
      productCount: 0,
      totalGmv: 0,
      reviewCount: 0,
      rating: v.status === "APPROVED" ? 4.0 + Math.random() * 1.0 : null,
      grade: v.grade ?? null,
      gradeUpdatedAt: v.grade ? daysAgo(30) : null,
      payoutBankCode: v.status === "APPROVED" ? "088" : null,
      payoutBankAccount: v.status === "APPROVED" ? "110-123-456789" : null,
      payoutAccountHolder: v.status === "APPROVED" ? v.companyName : null,
      createdAt: daysAgo(90),
      updatedAt: ts,
    });
    stats.created++;
    console.log(`  + vendor: ${v.companyName} (${v.status})`);
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────
// 시드 함수 — HOSPITALS
// ─────────────────────────────────────────────────────────────

async function seedHospitals(): Promise<Stats> {
  const db = adminDb();
  const stats: Stats = { created: 0, skipped: 0 };
  const ts = now();

  const existingSnap = await db.collection(COLLECTIONS.hospitals).get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  for (const h of HOSPITALS) {
    if (existingIds.has(h.id) && !RESET) {
      stats.skipped++;
      continue;
    }
    await db.collection(COLLECTIONS.hospitals).doc(h.id).set({
      id: h.id,
      bizRegNo: h.bizRegNo,
      bizVerifiedAt: daysAgo(120),
      name: h.name,
      type: h.type,
      ceoName: h.ceoName,
      phone: h.phone,
      email: h.email,
      zipcode: h.zipcode,
      address: h.address,
      addressDetail: "",
      approvalEnabled: h.type === "GENERAL_HOSPITAL" || h.type === "TERTIARY",
      approvalLimit: h.type === "TERTIARY" ? 5000000 : null,
      memberCount: randInt(1, 8),
      status: "ACTIVE",
      kpi: {
        orderCount: 0,
        orderAmount: 0,
      },
      createdAt: daysAgo(150),
      updatedAt: ts,
    });
    stats.created++;
    console.log(`  + hospital: ${h.name} (${h.type})`);
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────
// 시드 함수 — PRODUCTS
// ─────────────────────────────────────────────────────────────

interface CreatedProduct {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  thumbnail: string;
  basePrice: number;
  categoryId: string;
  groupBuyable: boolean;
  subscribable: boolean;
}

async function seedProducts(): Promise<{ stats: Stats; products: CreatedProduct[] }> {
  const db = adminDb();
  const stats: Stats = { created: 0, skipped: 0 };
  const ts = now();
  const created: CreatedProduct[] = [];

  // categories slug → docId 매핑
  const catSnap = await db.collection(COLLECTIONS.categories).get();
  const slugToId = new Map<string, string>();
  for (const d of catSnap.docs) {
    const data = d.data() as { slug?: string };
    if (data.slug) slugToId.set(data.slug, d.id);
  }

  // 기존 demo product 확인
  const existingSnap = await db.collection(COLLECTIONS.products).get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  for (const vendorId of Object.keys(PRODUCT_TEMPLATES)) {
    const vendor = VENDORS.find((v) => v.id === vendorId);
    if (!vendor) continue;

    const templates = PRODUCT_TEMPLATES[vendorId];
    let idx = 1;
    for (const t of templates) {
      const productId = `demo-prod-${vendorId.replace("demo-vendor-", "")}-${String(idx).padStart(2, "0")}`;
      idx++;

      // categoryId 매핑 — slug 미발견 시 fallback (skip 대신 placeholder)
      const categoryId = slugToId.get(t.categorySlug) ?? "cat-unknown";

      if (existingIds.has(productId) && !RESET) {
        stats.skipped++;
        // 기존 product 도 created 배열에 추가 (order seeding 시 참조 가능)
        created.push({
          id: productId,
          vendorId,
          vendorName: vendor.companyName,
          name: t.name,
          thumbnail: IMG(t.photo),
          basePrice: t.basePrice,
          categoryId,
          groupBuyable: t.groupBuyable ?? false,
          subscribable: t.subscribable ?? false,
        });
        continue;
      }

      const udiCode = t.hasUdi
        ? `0880${randInt(1000000, 9999999)}${randInt(100, 999)}`
        : null;

      await db.collection(COLLECTIONS.products).doc(productId).set({
        id: productId,
        vendorId,
        vendorName: vendor.companyName,
        categoryId,
        categoryPath: t.categoryPath,
        name: t.name,
        brand: t.brand,
        manufacturer: t.brand,
        origin: t.origin,
        udiCode,
        mfdsLicenseNo: t.hasUdi ? `수허 26-${randInt(1000, 9999)}` : null,
        deviceClass: t.deviceClass,
        images: [IMG(t.photo)],
        thumbnail: IMG(t.photo),
        basePrice: t.basePrice,
        priceTiers: t.priceTiers ?? null,
        unit: t.unit,
        moq: t.moq,
        shippingFee: t.shippingFee,
        description: t.description,
        status: "ACTIVE",
        moderation: {
          status: "ACTIVE",
          reviewedAt: daysAgo(30),
          submittedAt: daysAgo(35),
        },
        subscribable: t.subscribable ?? false,
        groupBuyable: t.groupBuyable ?? false,
        viewCount: randInt(50, 500),
        orderCount: randInt(0, 50),
        reviewCount: randInt(0, 20),
        avgRating: 3.5 + Math.random() * 1.5,
        createdAt: daysAgo(randInt(30, 80)),
        updatedAt: ts,
      });

      created.push({
        id: productId,
        vendorId,
        vendorName: vendor.companyName,
        name: t.name,
        thumbnail: IMG(t.photo),
        basePrice: t.basePrice,
        categoryId,
        groupBuyable: t.groupBuyable ?? false,
        subscribable: t.subscribable ?? false,
      });
      stats.created++;
    }
  }

  console.log(`  + products (vendor 6개 × 8개): ${stats.created} created, ${stats.skipped} skipped`);
  return { stats, products: created };
}

// ─────────────────────────────────────────────────────────────
// 시드 함수 — ORDERS (+ SubOrders + items)
// ─────────────────────────────────────────────────────────────

async function seedOrders(products: CreatedProduct[]): Promise<Stats> {
  const db = adminDb();
  const stats: Stats = { created: 0, skipped: 0 };

  const existingSnap = await db.collection(COLLECTIONS.orders).get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id).filter((id) => id.startsWith("demo-order-")));

  // 30개 order — status 분포
  const ORDER_STATUSES: Array<{ status: "PAID" | "PARTIALLY_SHIPPED" | "SHIPPED" | "COMPLETED" | "CANCELLED"; count: number; subStatus: "ACCEPTED" | "PACKING" | "SHIPPED" | "DELIVERED" | "CANCELLED" }> = [
    { status: "PAID",              count: 10, subStatus: "ACCEPTED" },
    { status: "PAID",              count: 8,  subStatus: "PACKING" },   // "PREPARING" 의도
    { status: "PARTIALLY_SHIPPED", count: 6,  subStatus: "SHIPPED"  },
    { status: "COMPLETED",         count: 5,  subStatus: "DELIVERED" },
    { status: "CANCELLED",         count: 1,  subStatus: "CANCELLED" },
  ];

  let orderIdx = 0;
  for (const dist of ORDER_STATUSES) {
    for (let i = 0; i < dist.count; i++) {
      orderIdx++;
      const orderNo = `DEMO-ORD-${String(orderIdx).padStart(5, "0")}`;
      const orderId = `demo-order-${String(orderIdx).padStart(5, "0")}`;

      if (existingIds.has(orderId) && !RESET) {
        stats.skipped++;
        continue;
      }

      const hospital = pick(HOSPITALS);
      const subOrderCount = randInt(1, 3);

      // SubOrder 별 vendor 선택 (중복 없이)
      const usedVendors = new Set<string>();
      const subOrderVendors: string[] = [];
      while (subOrderVendors.length < subOrderCount) {
        const vId = pick(products).vendorId;
        if (!usedVendors.has(vId)) {
          usedVendors.add(vId);
          subOrderVendors.push(vId);
        }
      }

      let orderSubtotal = 0;
      let orderShipping = 0;
      const vendorIds: string[] = [];

      // 임시 sub-order 데이터 생성
      const subOrderPayloads: Array<{
        subOrderId: string;
        vendorId: string;
        vendorName: string;
        subtotal: number;
        shippingFee: number;
        items: Array<{
          id: string;
          productId: string;
          productName: string;
          productImage: string;
          unitPrice: number;
          qty: number;
          amount: number;
          udiCode?: string;
          lotNo?: string;
        }>;
      }> = [];

      for (let s = 0; s < subOrderCount; s++) {
        const vendorId = subOrderVendors[s];
        const vendorProducts = products.filter((p) => p.vendorId === vendorId);
        if (vendorProducts.length === 0) continue;

        const itemCount = randInt(2, 5);
        const items: typeof subOrderPayloads[number]["items"] = [];
        const usedProducts = new Set<string>();
        let subSubtotal = 0;

        for (let it = 0; it < itemCount; it++) {
          const product = pick(vendorProducts);
          if (usedProducts.has(product.id)) continue;
          usedProducts.add(product.id);

          const qty = randInt(1, 10);
          const unitPrice = product.basePrice;
          const amount = unitPrice * qty;
          subSubtotal += amount;

          items.push({
            id: `item-${orderIdx}-${s}-${it}`,
            productId: product.id,
            productName: product.name,
            productImage: product.thumbnail,
            unitPrice,
            qty,
            amount,
            udiCode: `0880${randInt(1000000, 9999999)}${randInt(100, 999)}`,
            lotNo: `LOT-${daysAgo(randInt(10, 60)).toMillis().toString().slice(-6)}`,
          });
        }

        const subOrderId = `sub-${orderIdx}-${s}`;
        const shipping = subSubtotal > 100000 ? 0 : 3000;

        subOrderPayloads.push({
          subOrderId,
          vendorId,
          vendorName: products.find((p) => p.vendorId === vendorId)?.vendorName ?? vendorId,
          subtotal: subSubtotal,
          shippingFee: shipping,
          items,
        });

        orderSubtotal += subSubtotal;
        orderShipping += shipping;
        vendorIds.push(vendorId);
      }

      const subtotal = orderSubtotal;
      const shippingAmount = orderShipping;
      const vat = Math.round(subtotal * 0.1);
      const total = subtotal + shippingAmount + vat;

      const createdAt = daysAgo(randInt(1, 30));

      // Order doc
      await db.collection(COLLECTIONS.orders).doc(orderId).set({
        id: orderId,
        orderNo,
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        userId: `demo-user-${hospital.id}`,
        userName: hospital.ceoName,
        status: dist.status,
        subtotalAmount: subtotal,
        shippingAmount,
        discountAmount: 0,
        vatAmount: vat,
        totalAmount: total,
        paymentMethod: pick(["CARD", "NET_30"]),
        paymentKey: dist.status !== "CANCELLED" ? `paykey-${orderIdx}` : null,
        paidAt: dist.status !== "CANCELLED" ? createdAt : null,
        approvalStatus: hospital.type === "TERTIARY" ? "APPROVED" : "NOT_REQUIRED",
        shippingZipcode: hospital.zipcode,
        shippingAddress: hospital.address,
        shippingRecipient: hospital.ceoName,
        shippingPhone: hospital.phone,
        invoiceRequested: true,
        invoiceEmail: hospital.email,
        subOrderCount: subOrderPayloads.length,
        vendorIds,
        createdAt,
        updatedAt: now(),
      });

      // SubOrder + items
      for (const so of subOrderPayloads) {
        const commissionRate = 0.05;
        const commission = Math.round(so.subtotal * commissionRate);
        const commissionVat = Math.round(commission * 0.1);
        const soVat = Math.round(so.subtotal * 0.1);
        const soTotal = so.subtotal + so.shippingFee + soVat;
        const payoutAmount = so.subtotal - commission - commissionVat;

        await db.doc(`${COLLECTIONS.orders}/${orderId}/subOrders/${so.subOrderId}`).set({
          id: so.subOrderId,
          subOrderNo: `${orderNo}-${String.fromCharCode(65 + subOrderPayloads.indexOf(so))}`,
          orderId,
          orderNo,
          vendorId: so.vendorId,
          vendorName: so.vendorName,
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          status: dist.subStatus,
          subtotal: so.subtotal,
          shippingFee: so.shippingFee,
          vat: soVat,
          total: soTotal,
          commissionRate,
          commission,
          commissionVat,
          payoutAmount,
          trackingCarrier: dist.subStatus === "SHIPPED" || dist.subStatus === "DELIVERED" ? "CJ대한통운" : null,
          trackingNo: dist.subStatus === "SHIPPED" || dist.subStatus === "DELIVERED" ? `CJ${randInt(100000000000, 999999999999)}` : null,
          shippedAt: dist.subStatus === "SHIPPED" || dist.subStatus === "DELIVERED" ? daysAgo(randInt(1, 5)) : null,
          deliveredAt: dist.subStatus === "DELIVERED" ? daysAgo(randInt(1, 3)) : null,
          udiReported: dist.subStatus === "DELIVERED",
          udiReportedAt: dist.subStatus === "DELIVERED" ? daysAgo(1) : null,
          itemCount: so.items.length,
          createdAt,
          updatedAt: now(),
        });

        for (const item of so.items) {
          await db.doc(`${COLLECTIONS.orders}/${orderId}/subOrders/${so.subOrderId}/items/${item.id}`).set(item);
        }
      }

      stats.created++;
    }
  }

  console.log(`  + orders (with subOrders + items): ${stats.created} created, ${stats.skipped} skipped`);
  return stats;
}

// ─────────────────────────────────────────────────────────────
// 시드 함수 — GROUP BUYS (+ counterShards)
// ─────────────────────────────────────────────────────────────

async function seedGroupBuys(products: CreatedProduct[]): Promise<Stats> {
  const db = adminDb();
  const stats: Stats = { created: 0, skipped: 0 };

  const groupBuyable = products.filter((p) => p.groupBuyable);
  if (groupBuyable.length === 0) {
    console.log(`  ! groupBuy: skipped (no groupBuyable products)`);
    return stats;
  }

  const existingSnap = await db.collection(COLLECTIONS.groupBuys).get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id).filter((id) => id.startsWith("demo-gb-")));

  const CONFIGS = [
    { id: "demo-gb-01", title: "DEMO 라텍스 글러브 공동구매",       status: "OPEN" as const,       progress: 0.30, endsInDays: 7,  targetQty: 100, productIdx: 0 },
    { id: "demo-gb-02", title: "DEMO KF94 마스크 마감임박 공동구매", status: "OPEN" as const,       progress: 0.75, endsInDays: 2,  targetQty: 200, productIdx: 1 },
    { id: "demo-gb-03", title: "DEMO 디지털 청진기 100% 달성",       status: "TARGET_MET" as const, progress: 1.00, endsInDays: 0,  targetQty: 30,  productIdx: 2 },
    { id: "demo-gb-04", title: "DEMO 멸균거즈 완료",                 status: "FULFILLED" as const,  progress: 1.20, endsInDays: -5, targetQty: 150, productIdx: 3 },
    { id: "demo-gb-05", title: "DEMO 손소독제 미달 종료",            status: "FAILED" as const,     progress: 0.40, endsInDays: -3, targetQty: 100, productIdx: 4 },
  ];

  for (const cfg of CONFIGS) {
    if (existingIds.has(cfg.id) && !RESET) {
      stats.skipped++;
      continue;
    }

    const product = groupBuyable[cfg.productIdx % groupBuyable.length];
    const currentQty = Math.round(cfg.targetQty * cfg.progress);
    const startsAt = daysAgo(7);
    const endsAt = daysFromNow(cfg.endsInDays);
    const tierPricing = [
      { minQty: 1, price: Math.round(product.basePrice * 0.95) },
      { minQty: 50, price: Math.round(product.basePrice * 0.90) },
      { minQty: 100, price: Math.round(product.basePrice * 0.85) },
    ];

    await db.collection(COLLECTIONS.groupBuys).doc(cfg.id).set({
      id: cfg.id,
      productId: product.id,
      productName: product.name,
      productImage: product.thumbnail,
      vendorId: product.vendorId,
      vendorName: product.vendorName,
      title: cfg.title,
      description: `${product.name} 공동구매 캠페인. 목표 ${cfg.targetQty}개 달성 시 최대 15% 할인.`,
      startsAt,
      endsAt,
      targetQty: cfg.targetQty,
      currentQty,
      tierPricing,
      status: cfg.status,
      participationCount: Math.round(currentQty / 5),
      createdAt: daysAgo(8),
      updatedAt: now(),
    });

    // counterShards (10 shards)
    const perShard = Math.floor(currentQty / 10);
    const remainder = currentQty % 10;
    for (let s = 0; s < 10; s++) {
      const count = s < remainder ? perShard + 1 : perShard;
      await db.doc(`${COLLECTIONS.groupBuys}/${cfg.id}/counterShards/${s}`).set({ count });
    }

    stats.created++;
    console.log(`  + groupBuy: ${cfg.title} (${cfg.status}, ${currentQty}/${cfg.targetQty})`);
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────
// 시드 함수 — COUPONS
// ─────────────────────────────────────────────────────────────

async function seedCoupons(): Promise<Stats> {
  const db = adminDb();
  const stats: Stats = { created: 0, skipped: 0 };
  const ts = now();

  const existingSnap = await db.collection(COLLECTIONS.coupons).get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  const COUPONS = [
    { id: "demo-coupon-welcome",      code: "WELCOME10",   name: "신규 가입 10% 할인",       discountType: "PERCENT" as const, discountValue: 10, maxDiscountAmount: 50000, minOrderAmount: 30000, targetType: "FIRST_PURCHASE" as const, status: "ACTIVE" as const,    startsInDays: -30, expiresInDays: 60 },
    { id: "demo-coupon-spring",       code: "SPRING5K",    name: "봄맞이 5천원 할인",         discountType: "FIXED" as const,   discountValue: 5000,                          minOrderAmount: 50000, targetType: "ALL" as const,            status: "ACTIVE" as const,    startsInDays: -7,  expiresInDays: 14 },
    { id: "demo-coupon-gloves",       code: "GLOVES20",    name: "장갑 카테고리 20% 할인",    discountType: "PERCENT" as const, discountValue: 20, maxDiscountAmount: 100000,                       targetType: "CATEGORY" as const,        status: "ACTIVE" as const,    startsInDays: -3,  expiresInDays: 30, targetIds: ["latex-gloves", "nitrile-gloves"] },
    { id: "demo-coupon-medsupply",    code: "MEDSUPPLY15", name: "메디서플라이 15% 할인",     discountType: "PERCENT" as const, discountValue: 15, maxDiscountAmount: 70000,                        targetType: "VENDOR" as const,          status: "ACTIVE" as const,    startsInDays: -14, expiresInDays: 45, targetIds: ["demo-vendor-medsupply"] },
    { id: "demo-coupon-summer-soon",  code: "SUMMER25",    name: "여름 시즌 25% (예정)",      discountType: "PERCENT" as const, discountValue: 25, maxDiscountAmount: 150000, minOrderAmount: 100000, targetType: "ALL" as const,           status: "SCHEDULED" as const, startsInDays: 14,  expiresInDays: 60 },
    { id: "demo-coupon-vip-3k",       code: "VIP3K",       name: "VIP 3천원 할인",            discountType: "FIXED" as const,   discountValue: 3000,                          minOrderAmount: 20000, targetType: "ALL" as const,            status: "ACTIVE" as const,    startsInDays: -1,  expiresInDays: 7 },
    { id: "demo-coupon-expired-1",    code: "WINTER20",    name: "겨울 20% (만료)",           discountType: "PERCENT" as const, discountValue: 20, maxDiscountAmount: 80000,                        targetType: "ALL" as const,            status: "EXPIRED" as const,   startsInDays: -90, expiresInDays: -5 },
    { id: "demo-coupon-disabled",     code: "TESTOFF",     name: "테스트 쿠폰 (중단)",        discountType: "FIXED" as const,   discountValue: 1000,                          minOrderAmount: 10000, targetType: "ALL" as const,            status: "DISABLED" as const,  startsInDays: -10, expiresInDays: 30 },
  ];

  for (const c of COUPONS) {
    if (existingIds.has(c.id) && !RESET) {
      stats.skipped++;
      continue;
    }
    await db.collection(COLLECTIONS.coupons).doc(c.id).set({
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.name,
      discountType: c.discountType,
      discountValue: c.discountValue,
      maxDiscountAmount: c.maxDiscountAmount ?? null,
      minOrderAmount: c.minOrderAmount ?? null,
      targetType: c.targetType,
      targetIds: "targetIds" in c ? c.targetIds : null,
      startsAt: daysFromNow(c.startsInDays),
      expiresAt: daysFromNow(c.expiresInDays),
      issueLimit: 1000,
      perUserLimit: 1,
      usedCount: c.status === "EXPIRED" ? randInt(50, 200) : randInt(0, 30),
      status: c.status,
      createdAt: daysAgo(Math.abs(c.startsInDays) + 5),
      updatedAt: ts,
      createdById: "demo-admin",
    });
    stats.created++;
    console.log(`  + coupon: ${c.code} (${c.status})`);
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────
// 시드 함수 — SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────

async function seedSubscriptions(products: CreatedProduct[]): Promise<Stats> {
  const db = adminDb();
  const stats: Stats = { created: 0, skipped: 0 };
  const ts = now();

  const existingSnap = await db.collection(COLLECTIONS.subscriptions).get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id).filter((id) => id.startsWith("demo-sub-")));

  const subscribable = products.filter((p) => p.subscribable);
  if (subscribable.length === 0) {
    console.log(`  ! subscriptions: skipped (no subscribable products)`);
    return stats;
  }

  const STATUSES: Array<{ status: "ACTIVE" | "PAUSED" | "CANCELLED"; count: number }> = [
    { status: "ACTIVE", count: 8 },
    { status: "PAUSED", count: 3 },
    { status: "CANCELLED", count: 1 },
  ];
  const CADENCES: Array<"WEEKLY" | "BIWEEKLY" | "MONTHLY"> = ["WEEKLY", "BIWEEKLY", "MONTHLY"];

  let idx = 0;
  for (const dist of STATUSES) {
    for (let i = 0; i < dist.count; i++) {
      idx++;
      const subId = `demo-sub-${String(idx).padStart(2, "0")}`;
      if (existingIds.has(subId) && !RESET) {
        stats.skipped++;
        continue;
      }

      const hospital = pick(HOSPITALS);
      const itemCount = randInt(1, 3);
      const usedProducts = new Set<string>();
      const items: Array<{ productId: string; productName: string; vendorId: string; qty: number }> = [];

      for (let it = 0; it < itemCount; it++) {
        const p = pick(subscribable);
        if (usedProducts.has(p.id)) continue;
        usedProducts.add(p.id);
        items.push({
          productId: p.id,
          productName: p.name,
          vendorId: p.vendorId,
          qty: randInt(1, 10),
        });
      }

      const cadence = pick(CADENCES);
      const cadenceDays = cadence === "WEEKLY" ? 7 : cadence === "BIWEEKLY" ? 14 : 30;

      await db.collection(COLLECTIONS.subscriptions).doc(subId).set({
        id: subId,
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        name: `DEMO ${hospital.name} 정기구독 #${idx}`,
        status: dist.status,
        cadence,
        startsAt: daysAgo(60),
        nextRunAt: dist.status === "ACTIVE" ? daysFromNow(cadenceDays) : daysFromNow(cadenceDays * 2),
        lastRunAt: daysAgo(cadenceDays),
        autoApprove: hospital.type !== "TERTIARY",
        paymentMethod: "CARD",
        maxPriceChangePercent: 5.0,
        items,
        createdAt: daysAgo(70),
        updatedAt: ts,
      });

      stats.created++;
    }
  }

  console.log(`  + subscriptions: ${stats.created} created, ${stats.skipped} skipped`);
  return stats;
}

// ─────────────────────────────────────────────────────────────
// 시드 함수 — DISPUTES (+ messages)
// ─────────────────────────────────────────────────────────────

async function seedDisputes(): Promise<Stats> {
  const db = adminDb();
  const stats: Stats = { created: 0, skipped: 0 };
  const ts = now();

  const existingSnap = await db.collection(COLLECTIONS.disputes).get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  const DISPUTES: Array<{
    id: string;
    orderIdx: number;
    type: "REFUND" | "RETURN" | "NOT_DELIVERED" | "QUALITY";
    status: "OPEN" | "IN_PROGRESS" | "NEEDS_ADMIN_RESPONSE" | "RESOLVED";
    amount: number;
    reason: string;
    messages: Array<{ role: "BUYER" | "VENDOR" | "ADMIN"; body: string }>;
  }> = [
    {
      id: "demo-dispute-01",
      orderIdx: 1,
      type: "QUALITY",
      status: "OPEN",
      amount: 120000,
      reason: "글러브 박스 일부가 찢어진 채로 도착했습니다. 사용 불가능한 제품이 30매 가량 발견되었습니다.",
      messages: [
        { role: "BUYER", body: "수령한 박스 중 3박스가 손상되어 있었습니다. 사진 첨부합니다." },
        { role: "VENDOR", body: "확인 후 회신 드리겠습니다. 손상 사진 메일로도 보내주실 수 있을까요?" },
        { role: "BUYER", body: "메일로 송부했습니다. 빠른 처리 부탁드립니다." },
      ],
    },
    {
      id: "demo-dispute-02",
      orderIdx: 5,
      type: "NOT_DELIVERED",
      status: "IN_PROGRESS",
      amount: 380000,
      reason: "주문 후 7일이 경과했으나 배송이 시작되지 않았습니다.",
      messages: [
        { role: "BUYER", body: "주문번호 DEMO-ORD-00005 배송이 너무 늦습니다." },
        { role: "VENDOR", body: "확인해보니 배송업체 측 지연입니다. 내일 출고 예정입니다." },
        { role: "BUYER", body: "추적 가능한 송장번호 부탁드립니다." },
        { role: "VENDOR", body: "송장: CJ123456789012. 운영자님 중재 부탁드립니다." },
        { role: "ADMIN", body: "운영자 개입합니다. 양측 정보 검토 중입니다." },
      ],
    },
    {
      id: "demo-dispute-03",
      orderIdx: 8,
      type: "REFUND",
      status: "NEEDS_ADMIN_RESPONSE",
      amount: 85000,
      reason: "주문 직후 동일 제품을 다른 경로로 더 저렴하게 발견하여 환불 요청합니다.",
      messages: [
        { role: "BUYER", body: "단순 변심 환불 가능한가요?" },
        { role: "VENDOR", body: "이미 출고 완료되었습니다. 회수 비용 5천원 부담 시 환불 가능합니다." },
        { role: "BUYER", body: "운영자 중재 요청합니다. 출고 전 취소 요청했었습니다." },
      ],
    },
    {
      id: "demo-dispute-04",
      orderIdx: 12,
      type: "RETURN",
      status: "RESOLVED",
      amount: 250000,
      reason: "사이즈 오발주. 7.5 주문했으나 8.0 배송됨.",
      messages: [
        { role: "BUYER", body: "사이즈가 다릅니다. 교환 또는 반품 가능한가요?" },
        { role: "VENDOR", body: "확인했습니다. 회수 후 정확한 사이즈로 재발송 드리겠습니다." },
        { role: "BUYER", body: "감사합니다. 회수 송장 부탁드립니다." },
        { role: "ADMIN", body: "분쟁 종결 처리되었습니다." },
      ],
    },
  ];

  for (const d of DISPUTES) {
    if (existingIds.has(d.id) && !RESET) {
      stats.skipped++;
      continue;
    }

    const orderId = `demo-order-${String(d.orderIdx).padStart(5, "0")}`;
    const orderSnap = await db.collection(COLLECTIONS.orders).doc(orderId).get();
    if (!orderSnap.exists) {
      console.log(`  ! dispute ${d.id} skipped — order ${orderId} not found`);
      continue;
    }
    const order = orderSnap.data() as { hospitalId: string; hospitalName: string; vendorIds: string[] };
    const vendorId = order.vendorIds[0];
    const vendorName = VENDORS.find((v) => v.id === vendorId)?.companyName ?? vendorId;

    const openedAt = daysAgo(randInt(1, 14));
    const deadlineAt = Timestamp.fromMillis(openedAt.toMillis() + 48 * 3600 * 1000);
    const resolvedAt = d.status === "RESOLVED" ? daysAgo(1) : null;

    await db.collection(COLLECTIONS.disputes).doc(d.id).set({
      id: d.id,
      orderId,
      subOrderId: null,
      hospitalId: order.hospitalId,
      hospitalName: order.hospitalName,
      vendorId,
      vendorName,
      type: d.type,
      amount: d.amount,
      reason: d.reason,
      status: d.status,
      resolution: d.status === "RESOLVED" ? {
        type: "REFUND",
        refundAmount: d.amount,
        refundPercent: 100,
        payoutAdjustment: -d.amount,
        reason: "사이즈 오발주에 따른 전액 환불",
        decidedById: "demo-admin",
        decidedAt: resolvedAt,
      } : null,
      openedAt,
      deadlineAt,
      resolvedAt,
      createdAt: openedAt,
      updatedAt: ts,
    });

    // messages
    let msgIdx = 0;
    for (const m of d.messages) {
      msgIdx++;
      const messageId = `${d.id}-msg-${msgIdx}`;
      const msgAt = Timestamp.fromMillis(openedAt.toMillis() + msgIdx * 3600 * 1000);
      await db.doc(`${COLLECTIONS.disputes}/${d.id}/messages/${messageId}`).set({
        id: messageId,
        authorRole: m.role,
        authorId: m.role === "ADMIN" ? "demo-admin" : m.role === "VENDOR" ? vendorId : order.hospitalId,
        authorName: m.role === "ADMIN" ? "운영자" : m.role === "VENDOR" ? vendorName : order.hospitalName,
        body: m.body,
        attachments: [],
        createdAt: msgAt,
      });
    }

    stats.created++;
    console.log(`  + dispute: ${d.id} (${d.status}, ${d.messages.length} msgs)`);
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────
// 시드 함수 — SETTLEMENTS
// ─────────────────────────────────────────────────────────────

async function seedSettlements(): Promise<Stats> {
  const db = adminDb();
  const stats: Stats = { created: 0, skipped: 0 };
  const ts = now();

  const existingSnap = await db.collection(COLLECTIONS.settlements).get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  const approvedVendors = VENDORS.filter((v) => v.status === "APPROVED");

  const STATUSES: Array<{ status: "PENDING" | "REQUESTED" | "APPROVED" | "PAID" | "HOLD"; count: number }> = [
    { status: "PENDING",   count: 4 },
    { status: "REQUESTED", count: 3 },
    { status: "APPROVED",  count: 2 },
    { status: "PAID",      count: 5 },
    { status: "HOLD",      count: 1 },
  ];

  let idx = 0;
  for (const dist of STATUSES) {
    for (let i = 0; i < dist.count; i++) {
      idx++;
      const settleId = `demo-settle-${String(idx).padStart(3, "0")}`;
      if (existingIds.has(settleId) && !RESET) {
        stats.skipped++;
        continue;
      }

      const vendor = pick(approvedVendors);
      const periodStart = daysAgo(randInt(30, 60));
      const periodEnd = Timestamp.fromMillis(periodStart.toMillis() + 7 * 24 * 3600 * 1000);

      const grossAmount = randInt(500000, 5000000);
      const paymentFee = Math.round(grossAmount * 0.022);
      const paymentFeeVat = Math.round(paymentFee * 0.1);
      const commissionRate =
        vendor.grade === "PREMIUM" ? 0.04 :
        vendor.grade === "PLUS"    ? 0.045 :
        vendor.grade === "DIRECT"  ? 0.035 : 0.05;
      const commission = Math.round(grossAmount * commissionRate);
      const commissionVat = Math.round(commission * 0.1);
      const netPayout = grossAmount - paymentFee - paymentFeeVat - commission - commissionVat;
      const isFast = vendor.grade === "PREMIUM" || vendor.grade === "DIRECT";
      const fastFee = isFast ? Math.round(netPayout * 0.00012 * 4) : 0;
      const finalPayout = netPayout - fastFee;

      await db.collection(COLLECTIONS.settlements).doc(settleId).set({
        id: settleId,
        vendorId: vendor.id,
        vendorName: vendor.companyName,
        periodStart,
        periodEnd,
        grossAmount,
        paymentFeeAmount: paymentFee,
        paymentFeeVatAmount: paymentFeeVat,
        commissionAmount: commission,
        commissionVatAmount: commissionVat,
        refundDeductAmount: 0,
        couponDeductAmount: 0,
        netPayout,
        isFastSettlement: isFast,
        fastSettlementDays: isFast ? 4 : 0,
        fastSettlementFee: fastFee,
        finalPayout,
        subOrderRefs: [],
        status: dist.status,
        statusReason: dist.status === "HOLD" ? "분쟁 진행 중으로 보류" : null,
        scheduledPayoutAt: daysFromNow(dist.status === "PAID" ? -5 : 3),
        approvedById: ["APPROVED", "PAID"].includes(dist.status) ? "demo-admin" : null,
        approvedAt: ["APPROVED", "PAID"].includes(dist.status) ? daysAgo(3) : null,
        paidAt: dist.status === "PAID" ? daysAgo(1) : null,
        createdAt: daysAgo(randInt(7, 20)),
        updatedAt: ts,
      });

      stats.created++;
    }
  }

  console.log(`  + settlements: ${stats.created} created, ${stats.skipped} skipped`);
  return stats;
}

// ─────────────────────────────────────────────────────────────
// RESET 헬퍼 — 모든 demo doc 삭제
// ─────────────────────────────────────────────────────────────

async function resetDemoData(): Promise<void> {
  const db = adminDb();
  console.log("=== RESET MODE — 기존 demo doc 삭제 중 ===");

  async function deletePrefix(coll: string, prefix: string): Promise<number> {
    const snap = await db.collection(coll).get();
    let deleted = 0;
    const batchSize = 400;
    let batch = db.batch();
    let inBatch = 0;
    for (const d of snap.docs) {
      if (!d.id.startsWith(prefix)) continue;
      batch.delete(d.ref);
      deleted++;
      inBatch++;
      if (inBatch >= batchSize) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
    if (inBatch > 0) await batch.commit();
    return deleted;
  }

  async function deleteSubcollections(parentColl: string, parentPrefix: string, subColls: string[]): Promise<number> {
    const snap = await db.collection(parentColl).get();
    let deleted = 0;
    for (const d of snap.docs) {
      if (!d.id.startsWith(parentPrefix)) continue;
      for (const sub of subColls) {
        const subSnap = await d.ref.collection(sub).get();
        for (const sd of subSnap.docs) {
          // depth 2 — items under subOrders
          if (sub === "subOrders") {
            const itemSnap = await sd.ref.collection("items").get();
            for (const it of itemSnap.docs) {
              await it.ref.delete();
              deleted++;
            }
          }
          await sd.ref.delete();
          deleted++;
        }
      }
    }
    return deleted;
  }

  console.log(`  vendors: ${await deletePrefix(COLLECTIONS.vendors, "demo-vendor-")} deleted`);
  console.log(`  hospitals: ${await deletePrefix(COLLECTIONS.hospitals, "demo-hosp-")} deleted`);
  console.log(`  products: ${await deletePrefix(COLLECTIONS.products, "demo-prod-")} deleted`);
  console.log(`  orders (subcoll): ${await deleteSubcollections(COLLECTIONS.orders, "demo-order-", ["subOrders"])} sub-docs deleted`);
  console.log(`  orders: ${await deletePrefix(COLLECTIONS.orders, "demo-order-")} deleted`);
  console.log(`  groupBuys (subcoll): ${await deleteSubcollections(COLLECTIONS.groupBuys, "demo-gb-", ["counterShards", "participations"])} sub-docs deleted`);
  console.log(`  groupBuys: ${await deletePrefix(COLLECTIONS.groupBuys, "demo-gb-")} deleted`);
  console.log(`  coupons: ${await deletePrefix(COLLECTIONS.coupons, "demo-coupon-")} deleted`);
  console.log(`  subscriptions: ${await deletePrefix(COLLECTIONS.subscriptions, "demo-sub-")} deleted`);
  console.log(`  disputes (subcoll): ${await deleteSubcollections(COLLECTIONS.disputes, "demo-dispute-", ["messages", "activity"])} sub-docs deleted`);
  console.log(`  disputes: ${await deletePrefix(COLLECTIONS.disputes, "demo-dispute-")} deleted`);
  console.log(`  settlements: ${await deletePrefix(COLLECTIONS.settlements, "demo-settle-")} deleted`);

  // SUB_COLLECTIONS path 사용 확인 (lint 회피)
  void SUB_COLLECTIONS;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

async function main() {
  const start = Date.now();
  console.log("=== seed-demo 시작 ===");
  console.log(`  project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
  console.log(`  mode: ${RESET ? "RESET (모든 demo doc 삭제 후 재생성)" : "IDEMPOTENT (기존 doc skip)"}`);
  console.log("");

  if (RESET) {
    await resetDemoData();
    console.log("");
  }

  console.log("[1/9] vendors 시드 중...");
  const vendorStats = await seedVendors();
  console.log(fmtStat("vendors", vendorStats, VENDORS.length));

  console.log("\n[2/9] hospitals 시드 중...");
  const hospitalStats = await seedHospitals();
  console.log(fmtStat("hospitals", hospitalStats, HOSPITALS.length));

  console.log("\n[3/9] products 시드 중...");
  const { stats: productStats, products } = await seedProducts();
  const totalProductCount = Object.values(PRODUCT_TEMPLATES).reduce((sum, arr) => sum + arr.length, 0);
  console.log(fmtStat("products", productStats, totalProductCount));

  console.log("\n[4/9] orders + subOrders + items 시드 중...");
  const orderStats = await seedOrders(products);
  console.log(fmtStat("orders", orderStats, 30));

  console.log("\n[5/9] groupBuys + counterShards 시드 중...");
  const gbStats = await seedGroupBuys(products);
  console.log(fmtStat("groupBuys", gbStats, 5));

  console.log("\n[6/9] coupons 시드 중...");
  const couponStats = await seedCoupons();
  console.log(fmtStat("coupons", couponStats, 8));

  console.log("\n[7/9] subscriptions 시드 중...");
  const subStats = await seedSubscriptions(products);
  console.log(fmtStat("subscriptions", subStats, 12));

  console.log("\n[8/9] disputes + messages 시드 중...");
  const disputeStats = await seedDisputes();
  console.log(fmtStat("disputes", disputeStats, 4));

  console.log("\n[9/9] settlements 시드 중...");
  const settleStats = await seedSettlements();
  console.log(fmtStat("settlements", settleStats, 15));

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== seed-demo 완료 (${elapsed}s) ===`);
  console.log(`  Firestore: https://console.firebase.google.com/project/${process.env.FIREBASE_ADMIN_PROJECT_ID}/firestore`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("=== seed-demo 실패 ===");
    console.error(err);
    process.exit(1);
  });
