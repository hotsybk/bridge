// Phase 1.4-B 시드 스크립트 — bridge-dev Firestore에 더미 데이터 16개 doc 작성
// 실행: pnpm seed:dev
//
// 범위: categories(9) + vendors(1) + hospitals(1) + products(3) + users(2) = 16 doc
// users의 Auth UID는 임시 nanoid — Phase 1.5에서 실제 Firebase Auth 와 연동 시 재시드.

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

import { Timestamp } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { adminDb } from "../src/server/firebase/admin";
import { COLLECTIONS } from "../src/server/firebase/collections";

async function seed() {
  console.log("=== seeding Firestore (bridge-dev) ===");
  console.log(`  project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  const db = adminDb();
  const batch = db.batch();
  const now = Timestamp.now();
  let docCount = 0;

  // 1. categories — 대분류 3 + 중분류 6 = 9
  const categories = [
    { id: "cat-medsupply",              slug: "medical-supply", name: "의료소모품",   depth: 1, sortOrder: 1, path: ["의료소모품"] },
    { id: "cat-meddevice",              slug: "medical-device", name: "의료기기",     depth: 1, sortOrder: 2, path: ["의료기기"] },
    { id: "cat-etc",                    slug: "etc",            name: "기타",         depth: 1, sortOrder: 3, path: ["기타"] },
    { id: "cat-medsupply-disposable",   slug: "disposable",     name: "일회용 의료용품", parentId: "cat-medsupply", depth: 2, sortOrder: 1, path: ["의료소모품", "일회용 의료용품"] },
    { id: "cat-medsupply-dressing",     slug: "dressing",       name: "드레싱",        parentId: "cat-medsupply", depth: 2, sortOrder: 2, path: ["의료소모품", "드레싱"] },
    { id: "cat-meddevice-diagnostic",   slug: "diagnostic",     name: "진단기기",      parentId: "cat-meddevice", depth: 2, sortOrder: 1, path: ["의료기기", "진단기기"] },
    { id: "cat-meddevice-monitor",      slug: "monitor",        name: "모니터링 장비", parentId: "cat-meddevice", depth: 2, sortOrder: 2, path: ["의료기기", "모니터링 장비"] },
    { id: "cat-etc-oriental",           slug: "oriental",       name: "한방용품",      parentId: "cat-etc",       depth: 2, sortOrder: 1, path: ["기타", "한방용품"] },
    { id: "cat-etc-dental",             slug: "dental",         name: "치과용품",      parentId: "cat-etc",       depth: 2, sortOrder: 2, path: ["기타", "치과용품"] },
  ];
  for (const c of categories) {
    batch.set(db.collection(COLLECTIONS.categories).doc(c.id), c);
    docCount++;
  }

  // 2. vendor — 1개 (APPROVED, DISTRIBUTOR)
  const vendorId = "vendor-seed-001";
  const vendorName = "더미 의료기기 유한회사";
  batch.set(db.collection(COLLECTIONS.vendors).doc(vendorId), {
    id: vendorId,
    bizRegNo: "123-45-67890",
    bizRegImageUrl: "",
    companyName: vendorName,
    ceoName: "최대표",
    phone: "02-1234-5678",
    email: "vendor@example.com",
    zipcode: "06236",
    address: "서울시 강남구 테헤란로 100",
    addressDetail: "5층 501호",
    vendorType: "DISTRIBUTOR",
    salesLicenseNo: "제2026-서울강남-001호",
    salesLicenseImageUrl: "",
    status: "APPROVED",
    approvedAt: now,
    defaultCommissionRate: 0.05,
    fastSettlementEnabled: false,
    categories: ["MED_DEVICE", "MED_SUPPLY"],
    productCount: 3,
    totalGmv: 0,
    reviewCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  docCount++;

  // 3. hospital — 1개 (CLINIC, approvalEnabled=false)
  const hospitalId = "hospital-seed-001";
  const hospitalName = "강남 김원장의원";
  batch.set(db.collection(COLLECTIONS.hospitals).doc(hospitalId), {
    id: hospitalId,
    bizRegNo: "987-65-43210",
    name: hospitalName,
    type: "CLINIC",
    ceoName: "김원장",
    phone: "02-9876-5432",
    email: "buyer@example.com",
    zipcode: "06234",
    address: "서울시 강남구 강남대로 200",
    approvalEnabled: false,
    memberCount: 1,
    createdAt: now,
    updatedAt: now,
  });
  docCount++;

  // 4. products — 3개 (각각 다른 카테고리, 모두 vendor-seed-001)
  const products = [
    {
      id: "product-seed-001",
      vendorId, vendorName,
      categoryId: "cat-medsupply-disposable",
      categoryPath: ["의료소모품", "일회용 의료용품"],
      name: "라텍스 글러브 (M) 100개입",
      brand: "더미브랜드",
      manufacturer: "더미제조",
      origin: "Vietnam",
      udiCode: "08801234567890",
      mfdsLicenseNo: "수신 26-1234",
      deviceClass: "CLASS_1",
      images: [] as string[],
      thumbnail: "https://placehold.co/400x400/png",
      basePrice: 8000,
      unit: "BOX",
      moq: 5,
      shippingFee: 3000,
      description: "일회용 라텍스 글러브, 100개입 박스. 의료용 인증.",
      status: "ACTIVE",
      subscribable: true,
      groupBuyable: false,
      viewCount: 0,
      orderCount: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "product-seed-002",
      vendorId, vendorName,
      categoryId: "cat-meddevice-diagnostic",
      categoryPath: ["의료기기", "진단기기"],
      name: "디지털 혈압계 (상완식)",
      brand: "더미브랜드",
      udiCode: "08801234567906",
      mfdsLicenseNo: "수허 26-5678",
      deviceClass: "CLASS_2",
      images: [] as string[],
      thumbnail: "https://placehold.co/400x400/png",
      basePrice: 85000,
      unit: "EA",
      moq: 1,
      shippingFee: 3000,
      description: "병원용 디지털 혈압계. WHO 인증.",
      status: "ACTIVE",
      subscribable: false,
      groupBuyable: true,
      viewCount: 0,
      orderCount: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "product-seed-003",
      vendorId, vendorName,
      categoryId: "cat-medsupply-dressing",
      categoryPath: ["의료소모품", "드레싱"],
      name: "멸균거즈 4x4 100매",
      brand: "더미브랜드",
      udiCode: "08801234567913",
      mfdsLicenseNo: "수신 26-1235",
      deviceClass: "NON_DEVICE",
      images: [] as string[],
      thumbnail: "https://placehold.co/400x400/png",
      basePrice: 12000,
      priceTiers: [
        { minQty: 10, price: 11000 },
        { minQty: 50, price: 10000 },
      ],
      unit: "BOX",
      moq: 5,
      shippingFee: 3000,
      description: "병원용 멸균거즈, 4x4cm 100매.",
      status: "ACTIVE",
      subscribable: true,
      groupBuyable: true,
      viewCount: 0,
      orderCount: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  ];
  for (const p of products) {
    batch.set(db.collection(COLLECTIONS.products).doc(p.id), p);
    docCount++;
  }

  // 5. users — 2명 (BUYER_OWNER + VENDOR_OWNER, 임시 nanoid UID)
  // Phase 1.5에서 실제 Firebase Auth 가입 시 setCustomClaims 와 함께 재시드.
  const buyerUid = `seed-buyer-${nanoid(10)}`;
  const vendorUid = `seed-vendor-${nanoid(10)}`;
  batch.set(db.collection(COLLECTIONS.users).doc(buyerUid), {
    uid: buyerUid,
    email: "buyer@example.com",
    emailVerified: true,
    name: "김원장",
    phone: "010-1234-5678",
    role: "BUYER_OWNER",
    hospitalId,
    hospitalName,
    createdAt: now,
    updatedAt: now,
  });
  docCount++;
  batch.set(db.collection(COLLECTIONS.users).doc(vendorUid), {
    uid: vendorUid,
    email: "vendor@example.com",
    emailVerified: true,
    name: "최대표",
    phone: "010-9876-5432",
    role: "VENDOR_OWNER",
    vendorId,
    vendorName,
    createdAt: now,
    updatedAt: now,
  });
  docCount++;

  await batch.commit();

  console.log(`  ✓ committed ${docCount} docs`);
  console.log(`  ✓ categories(${categories.length}) + vendors(1) + hospitals(1) + products(${products.length}) + users(2)`);
  console.log(`  Firestore Console:`);
  console.log(`    https://console.firebase.google.com/project/${process.env.FIREBASE_ADMIN_PROJECT_ID}/firestore`);
  return docCount;
}

seed()
  .then((count) => {
    console.log(`=== seed complete (${count} docs) ===`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("=== seed failed ===");
    console.error(err);
    process.exit(1);
  });
