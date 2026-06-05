// Wave G — 카테고리 시드 스크립트.
//
// 실행:
//   pnpm tsx scripts/seed-categories.ts
//
// 동작:
//   - 5 대분류 × 3~5 중분류 × 3~6 소분류 = 약 70+ 카테고리를 Firestore /categories 에 idempotent 생성.
//   - 이미 동일 slug 가 존재하면 skip (재실행 안전).
//   - 모든 카테고리 default commissionRate = 0.05 (5%).
//   - server-only guard.

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

if (typeof window !== "undefined") {
  throw new Error("seed-categories must be used only on the server side.");
}

import { Timestamp } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { adminDb } from "../src/server/firebase/admin";
import { COLLECTIONS } from "../src/server/firebase/collections";

type TreeNode = {
  name: string;
  slug: string;
  nameEn?: string;
  children?: TreeNode[];
};

const TREE: TreeNode[] = [
  {
    name: "의료기기",
    slug: "medical-devices",
    nameEn: "Medical Devices",
    children: [
      {
        name: "수술 기구",
        slug: "surgical-instruments",
        nameEn: "Surgical Instruments",
        children: [
          { name: "수술용 가위", slug: "surgical-scissors", nameEn: "Surgical Scissors" },
          { name: "수술용 겸자", slug: "surgical-forceps", nameEn: "Surgical Forceps" },
          { name: "수술용 칼", slug: "surgical-scalpels", nameEn: "Surgical Scalpels" },
          { name: "수술용 니들 홀더", slug: "needle-holders", nameEn: "Needle Holders" },
          { name: "수술용 견인기", slug: "surgical-retractors", nameEn: "Surgical Retractors" },
        ],
      },
      {
        name: "내시경",
        slug: "endoscopy",
        nameEn: "Endoscopy",
        children: [
          { name: "위내시경", slug: "gastroscope", nameEn: "Gastroscope" },
          { name: "대장내시경", slug: "colonoscope", nameEn: "Colonoscope" },
          { name: "복강경", slug: "laparoscope", nameEn: "Laparoscope" },
          { name: "내시경 부속품", slug: "endoscopy-accessories", nameEn: "Endoscopy Accessories" },
        ],
      },
      {
        name: "정형외과 임플란트",
        slug: "ortho-implants",
        nameEn: "Orthopedic Implants",
        children: [
          { name: "인공 관절", slug: "artificial-joints", nameEn: "Artificial Joints" },
          { name: "골 고정용 나사·플레이트", slug: "bone-fixation", nameEn: "Bone Fixation" },
          { name: "척추 임플란트", slug: "spine-implants", nameEn: "Spine Implants" },
        ],
      },
    ],
  },
  {
    name: "일회용 소모품",
    slug: "consumables",
    nameEn: "Consumables",
    children: [
      {
        name: "장갑",
        slug: "gloves",
        nameEn: "Gloves",
        children: [
          { name: "라텍스 장갑", slug: "latex-gloves", nameEn: "Latex Gloves" },
          { name: "니트릴 장갑", slug: "nitrile-gloves", nameEn: "Nitrile Gloves" },
          { name: "수술용 멸균 장갑", slug: "sterile-surgical-gloves", nameEn: "Sterile Surgical Gloves" },
          { name: "비닐 장갑", slug: "vinyl-gloves", nameEn: "Vinyl Gloves" },
        ],
      },
      {
        name: "마스크",
        slug: "masks",
        nameEn: "Masks",
        children: [
          { name: "KF94 마스크", slug: "kf94-masks", nameEn: "KF94 Masks" },
          { name: "N95 마스크", slug: "n95-masks", nameEn: "N95 Masks" },
          { name: "수술용 마스크", slug: "surgical-masks", nameEn: "Surgical Masks" },
          { name: "덴탈 마스크", slug: "dental-masks", nameEn: "Dental Masks" },
        ],
      },
      {
        name: "주사기·바늘",
        slug: "syringes-needles",
        nameEn: "Syringes & Needles",
        children: [
          { name: "1ml 주사기", slug: "syringe-1ml", nameEn: "1ml Syringes" },
          { name: "3ml 주사기", slug: "syringe-3ml", nameEn: "3ml Syringes" },
          { name: "10ml 주사기", slug: "syringe-10ml", nameEn: "10ml Syringes" },
          { name: "인슐린 주사기", slug: "insulin-syringes", nameEn: "Insulin Syringes" },
          { name: "주사 바늘", slug: "needles", nameEn: "Needles" },
        ],
      },
      {
        name: "거즈·붕대",
        slug: "gauze-bandages",
        nameEn: "Gauze & Bandages",
        children: [
          { name: "멸균 거즈", slug: "sterile-gauze", nameEn: "Sterile Gauze" },
          { name: "탄력 붕대", slug: "elastic-bandages", nameEn: "Elastic Bandages" },
          { name: "압박 붕대", slug: "compression-bandages", nameEn: "Compression Bandages" },
          { name: "드레싱", slug: "dressings", nameEn: "Dressings" },
        ],
      },
    ],
  },
  {
    name: "진단 기기",
    slug: "diagnostic",
    nameEn: "Diagnostic",
    children: [
      {
        name: "청진기",
        slug: "stethoscope",
        nameEn: "Stethoscope",
        children: [
          { name: "기계식 청진기", slug: "acoustic-stethoscope", nameEn: "Acoustic Stethoscope" },
          { name: "전자식 청진기", slug: "electronic-stethoscope", nameEn: "Electronic Stethoscope" },
        ],
      },
      {
        name: "혈압계",
        slug: "blood-pressure",
        nameEn: "Blood Pressure Monitor",
        children: [
          { name: "수동 혈압계", slug: "manual-bp", nameEn: "Manual BP Monitor" },
          { name: "자동 혈압계", slug: "automatic-bp", nameEn: "Automatic BP Monitor" },
          { name: "휴대용 혈압계", slug: "portable-bp", nameEn: "Portable BP Monitor" },
        ],
      },
      {
        name: "체온계",
        slug: "thermometer",
        nameEn: "Thermometer",
        children: [
          { name: "비접촉 체온계", slug: "non-contact-thermometer", nameEn: "Non-contact Thermometer" },
          { name: "고막 체온계", slug: "ear-thermometer", nameEn: "Ear Thermometer" },
          { name: "전자 체온계", slug: "digital-thermometer", nameEn: "Digital Thermometer" },
        ],
      },
      {
        name: "혈당계",
        slug: "glucose-meter",
        nameEn: "Glucose Meter",
        children: [
          { name: "혈당 측정기", slug: "glucose-meter-device", nameEn: "Glucose Meter" },
          { name: "혈당 검사지", slug: "glucose-test-strips", nameEn: "Glucose Test Strips" },
        ],
      },
    ],
  },
  {
    name: "환자 모니터링",
    slug: "patient-monitoring",
    nameEn: "Patient Monitoring",
    children: [
      {
        name: "심전도 (ECG)",
        slug: "ecg",
        nameEn: "ECG",
        children: [
          { name: "12채널 심전도", slug: "ecg-12-channel", nameEn: "12-Channel ECG" },
          { name: "휴대용 심전도", slug: "portable-ecg", nameEn: "Portable ECG" },
        ],
      },
      {
        name: "산소포화도",
        slug: "spo2",
        nameEn: "SpO2",
        children: [
          { name: "휴대용 SpO2", slug: "portable-spo2", nameEn: "Portable SpO2" },
          { name: "환자 침상용 SpO2", slug: "bedside-spo2", nameEn: "Bedside SpO2" },
        ],
      },
      {
        name: "환자 침상 모니터",
        slug: "bedside-monitor",
        nameEn: "Bedside Monitor",
        children: [
          { name: "멀티파라미터 모니터", slug: "multiparameter-monitor", nameEn: "Multi-parameter Monitor" },
          { name: "중환자실 모니터", slug: "icu-monitor", nameEn: "ICU Monitor" },
        ],
      },
    ],
  },
  {
    name: "감염 관리",
    slug: "infection-control",
    nameEn: "Infection Control",
    children: [
      {
        name: "소독제",
        slug: "disinfectant",
        nameEn: "Disinfectant",
        children: [
          { name: "기구 소독제", slug: "instrument-disinfectant", nameEn: "Instrument Disinfectant" },
          { name: "광범위 소독제", slug: "broad-spectrum-disinfectant", nameEn: "Broad-spectrum Disinfectant" },
        ],
      },
      {
        name: "살균 알코올",
        slug: "alcohol",
        nameEn: "Alcohol",
        children: [
          { name: "70% 에탄올", slug: "ethanol-70", nameEn: "70% Ethanol" },
          { name: "이소프로필 알코올", slug: "isopropyl-alcohol", nameEn: "Isopropyl Alcohol" },
          { name: "알코올 솜", slug: "alcohol-swabs", nameEn: "Alcohol Swabs" },
        ],
      },
      {
        name: "환경 표면 클리너",
        slug: "surface-cleaner",
        nameEn: "Surface Cleaner",
        children: [
          { name: "표면 살균제", slug: "surface-sanitizer", nameEn: "Surface Sanitizer" },
          { name: "살균 와이프", slug: "sanitizing-wipes", nameEn: "Sanitizing Wipes" },
        ],
      },
      {
        name: "손소독제",
        slug: "hand-sanitizer",
        nameEn: "Hand Sanitizer",
        children: [
          { name: "알코올 손소독제", slug: "alcohol-hand-sanitizer", nameEn: "Alcohol Hand Sanitizer" },
          { name: "무알코올 손소독제", slug: "alcohol-free-hand-sanitizer", nameEn: "Alcohol-free Hand Sanitizer" },
        ],
      },
    ],
  },
];

const DEFAULT_COMMISSION_RATE = 0.05;

async function seed() {
  console.log("=== seeding /categories (Firestore) ===");
  console.log(`  project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  const db = adminDb();
  const now = Timestamp.now();

  // 1) 기존 카테고리 slug → docId 매핑
  const existingSnap = await db.collection(COLLECTIONS.categories).get();
  const slugToId = new Map<string, string>();
  for (const d of existingSnap.docs) {
    const data = d.data() as { slug?: string };
    if (data.slug) slugToId.set(data.slug, d.id);
  }
  console.log(`  existing categories: ${existingSnap.size}`);

  let created = 0;
  let skipped = 0;
  const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];

  /**
   * 재귀로 트리를 평탄화하면서 path[] 누적.
   */
  async function walk(
    nodes: TreeNode[],
    parentId: string | null,
    parentPath: string[],
    parentDepth: number,
  ) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const path = [...parentPath, node.name];
      const depth = parentDepth + 1; // depth 1 = 대분류
      const sortOrder = i;

      let id: string;
      if (slugToId.has(node.slug)) {
        // 이미 존재 — skip
        id = slugToId.get(node.slug)!;
        skipped++;
      } else {
        id = nanoid();
        slugToId.set(node.slug, id);
        const ref = db.collection(COLLECTIONS.categories).doc(id);
        writes.push({
          ref,
          data: {
            slug: node.slug,
            name: node.name,
            nameEn: node.nameEn ?? null,
            parentId: parentId ?? null,
            depth,
            sortOrder,
            commissionRate: DEFAULT_COMMISSION_RATE,
            path,
            createdAt: now,
            updatedAt: now,
          },
        });
        created++;
      }

      if (node.children && node.children.length > 0) {
        await walk(node.children, id, path, depth);
      }
    }
  }

  await walk(TREE, null, [], 0);

  // 2) batch commit — Firestore 한 batch 당 500 doc 한계
  console.log(`  to create: ${created} / skipped existing: ${skipped}`);
  if (writes.length === 0) {
    console.log("  nothing to write.");
    return;
  }

  for (let i = 0; i < writes.length; i += 400) {
    const slice = writes.slice(i, i + 400);
    const batch = db.batch();
    for (const w of slice) batch.set(w.ref, w.data);
    await batch.commit();
    console.log(`  committed batch ${Math.floor(i / 400) + 1} (${slice.length} docs)`);
  }

  console.log(`✓ seeded categories — created=${created}, skipped=${skipped}, total=${created + skipped}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
