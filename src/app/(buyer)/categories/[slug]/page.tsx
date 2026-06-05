import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { trpcServer } from "@/lib/trpc/server";

/**
 * Phase ν-5 작업7 — /categories/[slug] SEO-friendly entry.
 *
 * 카테고리 슬러그(예: /categories/medical-gloves) 로 진입 시 해당 카테고리 id 를
 * 찾아 /search?categoryId=... 로 redirect.
 *
 * 향후 SEO 강화 시 진짜 SSG 페이지로 확장 가능 (generateStaticParams + ISR).
 * 현재는 단순 redirect 로 dead link 차단 + URL 안정성 확보.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `카테고리 · ${slug}`,
    description: `MedPlace 의 ${slug} 카테고리 상품 카탈로그.`,
  };
}

export default async function CategoryBySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trpc = await trpcServer();

  // categories 는 트리 전체를 한 번에 반환하므로 client side filter 와 동일하게 처리.
  const cats = await trpc.product.categories();
  const match = cats.find((c) => c.slug === slug);
  if (!match) notFound();

  redirect(`/search?categoryId=${match.id}`);
}
