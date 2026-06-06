// Wave 1 — 진료과(specialty) 기준 카테고리 트리 v2 시드.
//
// 실행:
//   pnpm seed:catalog-v2
//
// 동작:
//   - 진료과 기준 10 대분류 + 소분류를 결정적 ID (cat-{slug}) 로 /categories 에 적재.
//   - 기존 seed-categories.ts(76 nanoid) / seed-dev.ts(9 cat-*) 카테고리는 그대로 둠.
//     새 진료과 카테고리(cat-oriental·cat-dental ...)를 "추가"만 한다.
//   - idempotent: 동일 ID 는 set 으로 덮어쓰기 (재실행 안전).
//   - 모든 카테고리 commissionRate = 0.05.
//   - server-only guard.

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

if (typeof window !== "undefined") {
  throw new Error("seed-catalog-v2 must be used only on the server side.");
}

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../src/server/firebase/admin";
import { COLLECTIONS } from "../src/server/firebase/collections";

// ─────────────────────────────────────────────────────────────
// 카테고리 트리 정의 (진료과 기준)
// ─────────────────────────────────────────────────────────────

type SubCat = { slug: string; name: string };
type TopCat = {
  slug: string; // 대분류 slug (id = cat-{slug})
  name: string;
  icon: string; // lucide 아이콘명 (대분류만)
  children: SubCat[]; // 소분류 (id = cat-{slug}-{subslug})
};

// slug 는 cat- prefix 없이 정의. id 는 `cat-${slug}` / `cat-${slug}-${subslug}`.
const TREE: TopCat[] = [
  {
    slug: "oriental",
    name: "한방",
    icon: "Sparkles",
    children: [
      { slug: "needle", name: "침구류" },
      { slug: "moxa", name: "뜸·부항" },
      { slug: "herb", name: "조제·탕전" },
      { slug: "physio", name: "한방 물리치료" },
      { slug: "chuna", name: "추나·수기" },
    ],
  },
  {
    slug: "dental",
    name: "치과",
    icon: "Smile",
    children: [
      { slug: "handpiece", name: "핸드피스·모터" },
      { slug: "implant", name: "임플란트" },
      { slug: "impression", name: "인상·충전재" },
      { slug: "bur", name: "버·기구" },
      { slug: "rubber", name: "방습·수복보조" },
      { slug: "consum", name: "치과 소모품" },
    ],
  },
  {
    slug: "internal",
    name: "내과·가정의학",
    icon: "Stethoscope",
    children: [
      { slug: "diagnostic", name: "진단기기" },
      { slug: "respiratory", name: "호흡치료" },
      { slug: "injection", name: "주사·수액" },
    ],
  },
  {
    slug: "ortho",
    name: "정형·재활",
    icon: "Bone",
    children: [
      { slug: "physio", name: "물리치료기" },
      { slug: "cast", name: "깁스재료" },
      { slug: "brace", name: "보조기" },
    ],
  },
  {
    slug: "surgery",
    name: "외과",
    icon: "Scissors",
    children: [
      { slug: "suture", name: "봉합사" },
      { slug: "instrument", name: "수술기구" },
      { slug: "electro", name: "전기수술" },
      { slug: "dressing", name: "드레싱·소독" },
    ],
  },
  {
    slug: "obgyn",
    name: "산부인과",
    icon: "Baby",
    children: [
      { slug: "exam", name: "검사기구" },
      { slug: "surgery", name: "수술·분만" },
    ],
  },
  {
    slug: "ophthal",
    name: "안과",
    icon: "Eye",
    children: [
      { slug: "exam", name: "검안기기" },
      { slug: "consum", name: "점안·수술소모품" },
    ],
  },
  {
    slug: "ent",
    name: "이비인후과",
    icon: "Ear",
    children: [
      { slug: "scope", name: "내시경·검사" },
      { slug: "suction", name: "흡인·소모품" },
    ],
  },
  {
    slug: "derma",
    name: "피부·성형",
    icon: "Syringe",
    children: [
      { slug: "injection", name: "주사·시술소모품" },
      { slug: "material", name: "시술재료" },
      { slug: "laser", name: "레이저 소모품" },
    ],
  },
  {
    slug: "common",
    name: "공통소모품",
    icon: "Package",
    children: [
      { slug: "glove", name: "장갑" },
      { slug: "mask", name: "마스크" },
      { slug: "injection", name: "주사용품" },
      { slug: "antiseptic", name: "소독제" },
      { slug: "dressing", name: "드레싱" },
      { slug: "sterile", name: "멸균용품" },
      { slug: "waste", name: "폐기물" },
      { slug: "gown", name: "가운·수술포" },
    ],
  },
];

const DEFAULT_COMMISSION_RATE = 0.05;

async function seed() {
  console.log("=== seeding /categories v2 (진료과 트리) ===");
  console.log(`  project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  const db = adminDb();
  const now = Timestamp.now();

  type Write = { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> };
  const writes: Write[] = [];

  let topCount = 0;
  let subCount = 0;

  for (let i = 0; i < TREE.length; i++) {
    const top = TREE[i];
    const topId = `cat-${top.slug}`;

    writes.push({
      ref: db.collection(COLLECTIONS.categories).doc(topId),
      data: {
        id: topId,
        slug: topId, // id 와 동일 — 진료과 카테고리는 cat-* slug 사용
        name: top.name,
        parentId: null,
        depth: 1,
        path: [top.name],
        sortOrder: i,
        commissionRate: DEFAULT_COMMISSION_RATE,
        icon: top.icon,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    topCount++;

    for (let j = 0; j < top.children.length; j++) {
      const sub = top.children[j];
      const subId = `cat-${top.slug}-${sub.slug}`;
      writes.push({
        ref: db.collection(COLLECTIONS.categories).doc(subId),
        data: {
          id: subId,
          slug: subId,
          name: sub.name,
          parentId: topId,
          depth: 2,
          path: [top.name, sub.name],
          sortOrder: j,
          commissionRate: DEFAULT_COMMISSION_RATE,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      });
      subCount++;
    }
  }

  // batch commit (Firestore 한 batch 당 500 doc 한계)
  for (let i = 0; i < writes.length; i += 400) {
    const slice = writes.slice(i, i + 400);
    const batch = db.batch();
    for (const w of slice) batch.set(w.ref, w.data, { merge: true });
    await batch.commit();
    console.log(`  committed batch ${Math.floor(i / 400) + 1} (${slice.length} docs)`);
  }

  console.log(
    `✓ seeded catalog v2 — 대분류=${topCount}, 소분류=${subCount}, 총=${topCount + subCount} (cat-* 진료과)`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
