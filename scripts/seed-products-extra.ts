// Phase 2 카탈로그 — 추가 시드 9개 + 기존 3개 thumbnail Unsplash URL 로 업데이트.
//
//   pnpm tsx scripts/seed-products-extra.ts
//
// 결과: /products 컬렉션이 총 12개 product (기존 3 + 새 9)

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../src/server/firebase/admin";
import { COLLECTIONS } from "../src/server/firebase/collections";

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?w=800&h=800&fit=crop&q=80`;

const VENDOR_ID = "vendor-seed-001";
const VENDOR_NAME = "더미 의료기기 유한회사";

async function main() {
  const db = adminDb();
  const now = Timestamp.now();
  const batch = db.batch();

  // 1) 기존 3개 thumbnail 업데이트
  const updates: Array<{ id: string; photo: string }> = [
    { id: "product-seed-001", photo: "photo-1583912267550-bb6e1c7c4baa" }, // gloves
    { id: "product-seed-002", photo: "photo-1559757175-5700dde675bc" }, // stethoscope/cuff
    { id: "product-seed-003", photo: "photo-1584515933487-779824d29309" }, // gauze
  ];
  for (const u of updates) {
    batch.update(db.collection(COLLECTIONS.products).doc(u.id), {
      thumbnail: IMG(u.photo),
      images: [IMG(u.photo)],
      updatedAt: now,
    });
  }

  // 2) 새 9개
  const extra = [
    {
      id: "product-seed-004",
      name: "알코올 솜 100매",
      brand: "더미브랜드",
      manufacturer: "더미제조",
      origin: "Korea",
      categoryId: "cat-medsupply-disposable",
      categoryPath: ["의료소모품", "일회용 의료용품"],
      deviceClass: "NON_DEVICE",
      basePrice: 4500,
      unit: "BOX",
      moq: 10,
      shippingFee: 3000,
      subscribable: true,
      groupBuyable: true,
      photo: "photo-1584362917165-526a968579e8",
      description: "일회용 알코올 솜 100매. 75% 이소프로필 알코올.",
    },
    {
      id: "product-seed-005",
      name: "일회용 마스크 KF94 50매",
      brand: "더미브랜드",
      manufacturer: "더미제조",
      origin: "Korea",
      categoryId: "cat-medsupply-disposable",
      categoryPath: ["의료소모품", "일회용 의료용품"],
      deviceClass: "NON_DEVICE",
      basePrice: 15000,
      priceTiers: [
        { minQty: 10, price: 13500 },
        { minQty: 50, price: 12000 },
      ],
      unit: "BOX",
      moq: 1,
      shippingFee: 3000,
      subscribable: true,
      groupBuyable: true,
      photo: "photo-1605845328644-43c1e95f8076",
      description: "KF94 인증 일회용 마스크 50매 박스. 식약처 허가.",
    },
    {
      id: "product-seed-006",
      name: "디지털 청진기 (블루투스)",
      brand: "더미브랜드",
      manufacturer: "더미제조",
      origin: "Germany",
      categoryId: "cat-meddevice-diagnostic",
      categoryPath: ["의료기기", "진단기기"],
      deviceClass: "CLASS_2",
      udiCode: "08801234567920",
      mfdsLicenseNo: "수허 26-5701",
      basePrice: 350000,
      unit: "EA",
      moq: 1,
      shippingFee: 0,
      subscribable: false,
      groupBuyable: true,
      photo: "photo-1559757175-5700dde675bc",
      description: "블루투스 디지털 청진기. 노이즈 캔슬링 + 음성 녹음.",
    },
    {
      id: "product-seed-007",
      name: "일회용 주사기 1ml 100개입",
      brand: "더미브랜드",
      manufacturer: "더미제조",
      origin: "Korea",
      categoryId: "cat-medsupply-disposable",
      categoryPath: ["의료소모품", "일회용 의료용품"],
      deviceClass: "CLASS_1",
      udiCode: "08801234567937",
      mfdsLicenseNo: "수신 26-1240",
      basePrice: 7500,
      unit: "BOX",
      moq: 5,
      shippingFee: 3000,
      subscribable: true,
      groupBuyable: false,
      photo: "photo-1632053002434-c7c30b6f3236",
      description: "1ml 일회용 주사기, 27G 침. 멸균 포장.",
    },
    {
      id: "product-seed-008",
      name: "SpO2 측정기 (휴대용)",
      brand: "더미브랜드",
      manufacturer: "더미제조",
      origin: "USA",
      categoryId: "cat-meddevice-monitor",
      categoryPath: ["의료기기", "모니터링 장비"],
      deviceClass: "CLASS_2",
      udiCode: "08801234567944",
      mfdsLicenseNo: "수허 26-5712",
      basePrice: 45000,
      unit: "EA",
      moq: 1,
      shippingFee: 0,
      subscribable: false,
      groupBuyable: true,
      photo: "photo-1576091160550-2173dba999ef",
      description: "휴대용 펄스 옥시미터. 산소포화도 + 맥박 동시 측정.",
    },
    {
      id: "product-seed-009",
      name: "살균 알코올 1L",
      brand: "더미브랜드",
      manufacturer: "더미제조",
      origin: "Korea",
      categoryId: "cat-medsupply-disposable",
      categoryPath: ["의료소모품", "일회용 의료용품"],
      deviceClass: "NON_DEVICE",
      basePrice: 8500,
      priceTiers: [{ minQty: 12, price: 7800 }],
      unit: "EA",
      moq: 6,
      shippingFee: 3000,
      subscribable: true,
      groupBuyable: true,
      photo: "photo-1583912267550-bb6e1c7c4baa",
      description: "70% 에탄올 살균용. 1L PE 보틀.",
    },
    {
      id: "product-seed-010",
      name: "수술용 가운 (멸균) 5매",
      brand: "더미브랜드",
      manufacturer: "더미제조",
      origin: "Korea",
      categoryId: "cat-medsupply-disposable",
      categoryPath: ["의료소모품", "일회용 의료용품"],
      deviceClass: "CLASS_1",
      udiCode: "08801234567951",
      mfdsLicenseNo: "수신 26-1248",
      basePrice: 28000,
      unit: "BOX",
      moq: 2,
      shippingFee: 0,
      subscribable: false,
      groupBuyable: true,
      photo: "photo-1530497610245-94d3c16cda28",
      description: "EO 멸균 수술 가운, 5매. SMS 부직포.",
    },
    {
      id: "product-seed-011",
      name: "수술용 메스 (No.11) 100개",
      brand: "더미브랜드",
      manufacturer: "더미제조",
      origin: "Korea",
      categoryId: "cat-medsupply-disposable",
      categoryPath: ["의료소모품", "일회용 의료용품"],
      deviceClass: "CLASS_1",
      udiCode: "08801234567968",
      mfdsLicenseNo: "수신 26-1252",
      basePrice: 18000,
      unit: "BOX",
      moq: 1,
      shippingFee: 3000,
      subscribable: false,
      groupBuyable: false,
      photo: "photo-1551601651-bc60f254d532",
      description: "스테인리스 스틸 일회용 메스, No.11 100개입.",
    },
    {
      id: "product-seed-012",
      name: "임시 충전재 (치과용) 30g",
      brand: "더미브랜드",
      manufacturer: "더미제조",
      origin: "Germany",
      categoryId: "cat-etc-dental",
      categoryPath: ["기타", "치과용품"],
      deviceClass: "CLASS_2",
      udiCode: "08801234567975",
      mfdsLicenseNo: "수허 26-5720",
      basePrice: 42000,
      unit: "EA",
      moq: 1,
      shippingFee: 0,
      subscribable: false,
      groupBuyable: false,
      photo: "photo-1606811971618-4486d14f3f99",
      description: "치과용 임시 충전재 30g 튜브. ZOE 베이스.",
    },
  ];

  for (const p of extra) {
    const { photo, ...rest } = p;
    batch.set(db.collection(COLLECTIONS.products).doc(p.id), {
      ...rest,
      vendorId: VENDOR_ID,
      vendorName: VENDOR_NAME,
      images: [IMG(photo)],
      thumbnail: IMG(photo),
      status: "ACTIVE",
      viewCount: 0,
      orderCount: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  console.log(`✓ updated 3 thumbnails + added ${extra.length} products`);
  console.log(`  total in /products: ${updates.length + extra.length} = 12`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
