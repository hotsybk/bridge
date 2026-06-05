// Wave G — 카테고리 관리 페이지 (Firestore + tRPC 풀 연동).
//
// 좌측: 재귀 트리 (depth 무관, sortOrder asc).
// 우측 sticky: 선택된 카테고리 편집 패널 (client island).

import { PageHeader } from "@/components/shared/page-header";
import { PreviewBadge } from "@/components/shared/preview-badge";
import { trpcServer } from "@/lib/trpc/server";
import type { Category } from "@/lib/types";

import { CategoriesClient } from "./edit-panel";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

// 비로그인 dev 환경 fallback — 시드 전이거나 권한 없을 때 보이는 mock.
const MOCK_CATEGORIES: Category[] = [
  {
    id: "mock-1",
    slug: "medical-devices",
    name: "의료기기",
    nameEn: "Medical Devices",
    depth: 1,
    sortOrder: 0,
    commissionRate: 0.05,
    path: ["의료기기"],
  },
  {
    id: "mock-1-1",
    slug: "diagnostic",
    name: "진단 기기",
    nameEn: "Diagnostic",
    parentId: "mock-1",
    depth: 2,
    sortOrder: 0,
    commissionRate: 0.05,
    path: ["의료기기", "진단 기기"],
  },
  {
    id: "mock-1-1-1",
    slug: "stethoscope",
    name: "청진기",
    nameEn: "Stethoscope",
    parentId: "mock-1-1",
    depth: 3,
    sortOrder: 0,
    commissionRate: 0.05,
    path: ["의료기기", "진단 기기", "청진기"],
  },
  {
    id: "mock-2",
    slug: "consumables",
    name: "일회용 소모품",
    nameEn: "Consumables",
    depth: 1,
    sortOrder: 1,
    commissionRate: 0.06,
    path: ["일회용 소모품"],
  },
  {
    id: "mock-2-1",
    slug: "gloves",
    name: "장갑",
    nameEn: "Gloves",
    parentId: "mock-2",
    depth: 2,
    sortOrder: 0,
    commissionRate: 0.06,
    path: ["일회용 소모품", "장갑"],
  },
];

export default async function AdminCategoriesPage() {
  let categories: Category[] = [];
  let usingMock = false;

  try {
    const trpc = await trpcServer();
    categories = await trpc.admin.category.tree();
    if (categories.length === 0 && PREVIEW_MODE) {
      categories = MOCK_CATEGORIES;
      usingMock = true;
    }
  } catch {
    if (PREVIEW_MODE) {
      categories = MOCK_CATEGORIES;
      usingMock = true;
    } else {
      throw new Error("관리자 권한이 필요합니다.");
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <PageHeader
        label="카탈로그 · 카테고리"
        title="카테고리 관리"
        description="카테고리 트리를 편집하고 수수료율을 설정합니다."
      />

      {usingMock && (
        <div className="mt-6 space-y-2">
          <PreviewBadge
            variant="banner"
            message="시드 데이터가 표시됩니다. 실제 데이터는 시드 후 표시됩니다."
          />
          <p className="px-1 text-[11px] text-[var(--color-text-tertiary)]">
            <code className="font-mono text-[var(--color-text-secondary)]">
              pnpm seed:categories
            </code>{" "}
            로 Firestore에 시드 후 실제 데이터로 전환됩니다.
          </p>
        </div>
      )}

      <CategoriesClient initialCategories={categories} readOnly={usingMock} />
    </div>
  );
}
