// Wave 3 — 카탈로그 v2 데이터 정합성 검증 (일회성).
//
// 실행:
//   npx tsx scripts/verify-catalog-v2.ts
//
// 검증 항목:
//   1. products 컬렉션에서 prod-v2-* 상품 카운트
//   2. 각 상품의 categoryId 가 실제 존재하는 카테고리인지 (고아 상품 검출)
//   3. 각 상품의 categoryPath[0] 가 진료과 대분류명과 일치하는지
//   4. thumbnail URL 누락 0건 확인
//   5. status ACTIVE + moderation.status APPROVED 확인
//   6. 진료과 대분류별 상품 수 집계
//   7. 고아 상품 (존재하지 않는 categoryId 참조) 검출
//
// server-only guard.

import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

loadDotenv({ path: resolve(process.cwd(), ".env.local") });

if (typeof window !== "undefined") {
  throw new Error("verify-catalog-v2 must be used only on the server side.");
}

import { adminDb } from "../src/server/firebase/admin";
import { COLLECTIONS } from "../src/server/firebase/collections";

interface CatDoc {
  id: string;
  name?: string;
  parentId?: string | null;
  depth?: number;
  icon?: string;
  path?: string[];
}

interface ProdDoc {
  id: string;
  categoryId?: string;
  categoryPath?: string[];
  thumbnail?: string;
  status?: string;
  moderation?: { status?: string };
  vendorName?: string;
  basePrice?: number;
  unit?: string;
  deviceClass?: string;
}

async function main() {
  const db = adminDb();
  console.log("=== verify catalog v2 ===");
  console.log(`  project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  // ── 카테고리 로드 ──────────────────────────────────────────
  const catSnap = await db.collection(COLLECTIONS.categories).get();
  const cats = catSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as CatDoc);
  const catById = new Map(cats.map((c) => [c.id, c]));

  // 진료과 대분류 (cat-* depth 1 + icon)
  const specialtyTops = cats.filter(
    (c) => c.id.startsWith("cat-") && c.depth === 1 && Boolean(c.icon),
  );
  // 대분류 id → 대분류명 (categoryPath[0] 비교용)
  const topNameById = new Map(specialtyTops.map((c) => [c.id, c.name ?? ""]));

  console.log(
    `\n[카테고리] 전체=${cats.length}, 진료과 대분류(cat-* depth1+icon)=${specialtyTops.length}`,
  );

  // ── 상품 로드 ─────────────────────────────────────────────
  const prodSnap = await db.collection(COLLECTIONS.products).get();
  const allProds = prodSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as ProdDoc,
  );
  const v2Prods = allProds.filter((p) => p.id.startsWith("prod-v2-"));

  console.log(
    `\n[상품] 전체=${allProds.length}, prod-v2-*=${v2Prods.length}`,
  );

  // ── 1) 고아 상품 (존재하지 않는 categoryId) ────────────────
  const orphans: string[] = [];
  // ── 2) categoryPath[0] != 대분류명 불일치 ──────────────────
  const pathMismatch: Array<{ id: string; catId: string; path0?: string; expected?: string }> = [];
  // ── 3) thumbnail 누락 ──────────────────────────────────────
  const noThumb: string[] = [];
  // ── 4) status / moderation 비정상 ──────────────────────────
  const notActive: string[] = [];
  const notApproved: string[] = [];
  // ── 진료과 대분류별 카운트 ─────────────────────────────────
  const byTop = new Map<string, number>();

  for (const p of v2Prods) {
    const catId = p.categoryId ?? "";

    // (1) 고아: 참조하는 categoryId 가 categories 에 없음
    if (!catId || !catById.has(catId)) {
      orphans.push(`${p.id} → ${catId || "(none)"}`);
    } else {
      // 대분류 id 도출 (소분류 cat-{top}-{sub} → cat-{top})
      const cat = catById.get(catId)!;
      const topId = cat.parentId ?? catId; // 소분류면 parentId, 대분류면 자기 자신
      const topName = topNameById.get(topId) ?? cat.path?.[0] ?? "기타";

      // 대분류별 카운트
      byTop.set(topName, (byTop.get(topName) ?? 0) + 1);

      // (3) categoryPath[0] 이 대분류명과 일치하는지
      const path0 = p.categoryPath?.[0];
      if (!path0 || path0 !== topName) {
        pathMismatch.push({
          id: p.id,
          catId,
          path0,
          expected: topName,
        });
      }
    }

    // (4) thumbnail
    if (!p.thumbnail || typeof p.thumbnail !== "string" || p.thumbnail.trim() === "") {
      noThumb.push(p.id);
    }

    // (5) status + moderation
    if (p.status !== "ACTIVE") notActive.push(`${p.id} (${p.status ?? "none"})`);
    if (p.moderation?.status !== "APPROVED")
      notApproved.push(`${p.id} (${p.moderation?.status ?? "none"})`);
  }

  // ── 결과 출력 ─────────────────────────────────────────────
  console.log("\n[진료과 대분류별 상품 수]");
  const sortedTops = [...byTop.entries()].sort((a, b) => b[1] - a[1]);
  let topSum = 0;
  for (const [name, n] of sortedTops) {
    console.log(`  ${name}: ${n}`);
    topSum += n;
  }
  console.log(`  (합계: ${topSum})`);

  console.log("\n[검증 결과]");
  console.log(`  고아 상품 (없는 categoryId): ${orphans.length}`);
  if (orphans.length) orphans.slice(0, 20).forEach((o) => console.log(`    - ${o}`));

  console.log(`  categoryPath[0] 불일치: ${pathMismatch.length}`);
  if (pathMismatch.length)
    pathMismatch
      .slice(0, 20)
      .forEach((m) =>
        console.log(
          `    - ${m.id} | catId=${m.catId} | path0="${m.path0}" | expected="${m.expected}"`,
        ),
      );

  console.log(`  thumbnail 누락: ${noThumb.length}`);
  if (noThumb.length) noThumb.slice(0, 20).forEach((id) => console.log(`    - ${id}`));

  console.log(`  status != ACTIVE: ${notActive.length}`);
  if (notActive.length) notActive.slice(0, 20).forEach((id) => console.log(`    - ${id}`));

  console.log(`  moderation != APPROVED: ${notApproved.length}`);
  if (notApproved.length)
    notApproved.slice(0, 20).forEach((id) => console.log(`    - ${id}`));

  // ── matchesCategory 시뮬레이션 (대→소 포함 검증) ───────────
  console.log("\n[matchesCategory 시뮬레이션 — 대분류 클릭 시 포함 상품 수]");
  function matchesCategory(productCategoryId: string, filterId: string): boolean {
    if (!productCategoryId) return false;
    return (
      productCategoryId === filterId ||
      productCategoryId.startsWith(`${filterId}-`)
    );
  }
  const activeV2 = v2Prods.filter((p) => p.status === "ACTIVE");
  for (const top of specialtyTops) {
    const n = activeV2.filter((p) =>
      matchesCategory(p.categoryId ?? "", top.id),
    ).length;
    console.log(`  ${top.id} (${top.name}): ${n}`);
  }

  // ── 구 카테고리 prefix 충돌 검사 ───────────────────────────
  console.log("\n[prefix 충돌 검사 — 대분류 id 로 시작하는 '다른 대분류' 있는지]");
  let collisions = 0;
  for (const top of specialtyTops) {
    for (const other of specialtyTops) {
      if (other.id === top.id) continue;
      if (other.id.startsWith(`${top.id}-`)) {
        console.log(`  ! 충돌: ${other.id} 가 ${top.id}- prefix 와 겹침`);
        collisions++;
      }
    }
  }
  console.log(`  대분류 간 prefix 충돌: ${collisions}`);

  const ok =
    orphans.length === 0 &&
    pathMismatch.length === 0 &&
    noThumb.length === 0 &&
    notActive.length === 0 &&
    notApproved.length === 0 &&
    collisions === 0;

  console.log(`\n=== 결론: ${ok ? "PASS ✓" : "이슈 발견 — 위 로그 확인"} ===`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
