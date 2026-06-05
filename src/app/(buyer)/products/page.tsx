import { redirect } from "next/navigation";

/**
 * Phase ν-5 작업6 — /products 진입 시 카탈로그(/search) 로 redirect.
 *
 * `/products/[productId]` 만 정식 라우트이고 `/products` 인덱스는 의도적으로 비어 있었다.
 * 사용자가 URL 잘라서 진입 시 404 가 노출되어 dead link 처럼 보였던 문제 해소.
 */
export default function ProductsIndexPage() {
  redirect("/search");
}
