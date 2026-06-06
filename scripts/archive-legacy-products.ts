// 카탈로그 v2 — 구 상품 정리 (일회성, idempotent).
//
// 실행:
//   pnpm archive:legacy           # 실제 처리 (dry-run 로그 먼저 출력 후 처리)
//   pnpm archive:legacy --dry     # dry-run 만 (실제 쓰기 없음)
//
// 배경:
//   Wave 1 에서 진료과 카테고리 + 120 신규 상품(prod-v2-*) 을 적재했으나
//   구 상품 60여개(demo-prod-* / product-seed-*)가 ACTIVE 로 카탈로그에 섞여 노출됨.
//   이 구 상품을 ARCHIVED 로 전환해 카탈로그에서 제외한다.
//   (삭제 아님 — status 변경. 기존 order 의 denormalized 데이터 안전, 복구 가능)
//
// 식별 규칙 (안전 우선):
//   - 신규 = id 가 "prod-v2-" 로 시작 → 절대 건드리지 않음 (ACTIVE 유지)
//   - 구 상품 = status === "ACTIVE" 이고 id 가 "prod-v2-" 로 시작하지 않는 것
//     · 보조 신호로 categoryPath[0] 가 진료과 10 대분류명에 없으면 legacy 로 재확인 로깅
//   - ARCHIVED 또는 그 외 status 인 상품은 이미 처리됨 → skip
//
// 안전장치:
//   - prod-v2- prefix 가드를 명시적으로 두 번 확인 (실수로 신규 archive 방지)
//   - batch 500 docs 제한 준수 (chunk 분할 commit)
//   - dry-run 먼저 로그 출력 후 실제 처리
//
// server-only guard.

import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

loadDotenv({ path: resolve(process.cwd(), ".env.local") });

if (typeof window !== "undefined") {
  throw new Error("archive-legacy-products must be used only on the server side.");
}

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../src/server/firebase/admin";
import { COLLECTIONS } from "../src/server/firebase/collections";

// 신규 상품 prefix — 이 prefix 로 시작하면 절대 archive 금지.
const NEW_PRODUCT_PREFIX = "prod-v2-";

// 진료과 10 대분류명 (seed-catalog-v2.ts 트리 / verify-catalog-v2.ts 와 일치).
const SPECIALTY_TOP_NAMES = new Set<string>([
  "한방",
  "치과",
  "내과·가정의학",
  "정형·재활",
  "외과",
  "산부인과",
  "안과",
  "이비인후과",
  "피부·성형",
  "공통소모품",
]);

const ARCHIVE_REASON = "카탈로그 v2 진료과 개편";
const FIRESTORE_BATCH_LIMIT = 500;

// CLI flag: --dry / --dry-run → 쓰기 없이 로그만.
const DRY_RUN =
  process.argv.includes("--dry") || process.argv.includes("--dry-run");

interface ProdDoc {
  id: string;
  status?: string;
  categoryId?: string;
  categoryPath?: string[];
  name?: string;
}

function legacyKind(id: string): "demo" | "product-seed" | "other" {
  if (id.startsWith("demo-prod-")) return "demo";
  if (id.startsWith("product-seed-")) return "product-seed";
  return "other";
}

async function main() {
  const db = adminDb();
  console.log("=== archive legacy products ===");
  console.log(`  project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
  console.log(`  mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "LIVE (will write)"}`);

  // ── 전체 상품 로드 ────────────────────────────────────────
  const snap = await db.collection(COLLECTIONS.products).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProdDoc);

  const newProds = all.filter((p) => p.id.startsWith(NEW_PRODUCT_PREFIX));
  const newActive = newProds.filter((p) => p.status === "ACTIVE");

  // ── 구 상품 식별 ──────────────────────────────────────────
  // 1차 가드: prod-v2- 로 시작하지 않는 ACTIVE 상품.
  const legacyActive = all.filter(
    (p) => p.status === "ACTIVE" && !p.id.startsWith(NEW_PRODUCT_PREFIX),
  );

  // 분류 카운트
  let demoCount = 0;
  let productSeedCount = 0;
  let otherCount = 0;
  let noSpecialtyPath = 0; // 보조 신호: categoryPath[0] 가 진료과 대분류에 없음
  for (const p of legacyActive) {
    const kind = legacyKind(p.id);
    if (kind === "demo") demoCount++;
    else if (kind === "product-seed") productSeedCount++;
    else otherCount++;

    const path0 = p.categoryPath?.[0];
    if (!path0 || !SPECIALTY_TOP_NAMES.has(path0)) noSpecialtyPath++;
  }

  console.log("\n[처리 전 카운트]");
  console.log(`  전체 products: ${all.length}`);
  console.log(`  ${NEW_PRODUCT_PREFIX}* (신규): ${newProds.length} (ACTIVE ${newActive.length})`);
  console.log(`  구 상품 (ACTIVE, non-${NEW_PRODUCT_PREFIX}): ${legacyActive.length}`);
  console.log(`    - demo-prod-*: ${demoCount}`);
  console.log(`    - product-seed-*: ${productSeedCount}`);
  console.log(`    - 기타: ${otherCount}`);
  console.log(`    (이 중 진료과 categoryPath 없음: ${noSpecialtyPath})`);

  // ── dry-run 로그: 처리 대상 미리보기 ──────────────────────
  console.log("\n[ARCHIVED 처리 대상 미리보기 (최대 60)]");
  for (const p of legacyActive.slice(0, 60)) {
    console.log(
      `  - ${p.id} | "${p.name ?? "(no name)"}" | path0=${p.categoryPath?.[0] ?? "(none)"}`,
    );
  }
  if (legacyActive.length > 60) {
    console.log(`  ... 외 ${legacyActive.length - 60}건`);
  }

  if (legacyActive.length === 0) {
    console.log("\n처리할 구 상품이 없습니다. (이미 정리됨)");
    await printFinalState(db);
    return;
  }

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] 실제 쓰기 없이 종료. 실제 처리는 --dry 없이 재실행.");
    return;
  }

  // ── 실제 처리: batch 500 chunk 분할 ───────────────────────
  const now = Timestamp.now();
  let archived = 0;
  for (let i = 0; i < legacyActive.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = legacyActive.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = db.batch();
    for (const p of chunk) {
      // 2차 가드 — 신규 prefix 면 절대 처리 금지 (이중 안전).
      if (p.id.startsWith(NEW_PRODUCT_PREFIX)) {
        console.warn(`  ! SKIP (신규 prefix 보호): ${p.id}`);
        continue;
      }
      batch.update(db.collection(COLLECTIONS.products).doc(p.id), {
        status: "ARCHIVED",
        archivedAt: FieldValue.serverTimestamp(),
        archivedReason: ARCHIVE_REASON,
        updatedAt: now,
      });
      archived++;
    }
    await batch.commit();
    console.log(
      `  ✓ batch commit: ${Math.min(i + FIRESTORE_BATCH_LIMIT, legacyActive.length)}/${legacyActive.length}`,
    );
  }

  console.log(`\n[처리 완료] ARCHIVED: ${archived}건`);
  await printFinalState(db);
}

async function printFinalState(db: FirebaseFirestore.Firestore) {
  const snap = await db.collection(COLLECTIONS.products).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProdDoc);

  const active = all.filter((p) => p.status === "ACTIVE");
  const archived = all.filter((p) => p.status === "ARCHIVED");
  const activeV2 = active.filter((p) => p.id.startsWith(NEW_PRODUCT_PREFIX));
  const activeNonV2 = active.filter((p) => !p.id.startsWith(NEW_PRODUCT_PREFIX));

  console.log("\n[최종 상태]");
  console.log(`  전체 products: ${all.length}`);
  console.log(`  ACTIVE: ${active.length}`);
  console.log(`    - ${NEW_PRODUCT_PREFIX}*: ${activeV2.length}`);
  console.log(`    - non-${NEW_PRODUCT_PREFIX} (남은 구 상품 — 0 이어야 함): ${activeNonV2.length}`);
  if (activeNonV2.length) {
    activeNonV2.slice(0, 20).forEach((p) => console.log(`        ! ${p.id}`));
  }
  console.log(`  ARCHIVED: ${archived.length}`);

  const ok = activeNonV2.length === 0 && activeV2.length === 120;
  console.log(
    `\n=== 결론: ${ok ? "PASS ✓ (ACTIVE = 120 prod-v2-* only)" : `점검 필요 (ACTIVE prod-v2-*=${activeV2.length}, 남은 구상품=${activeNonV2.length})`} ===`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
