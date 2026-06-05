"use client";

import { ProductForm } from "@/components/vendor/product-form";

/**
 * Wave P1 — vendor 신규 상품 등록 페이지.
 *
 * "초안 저장" 또는 "심사 제출" 두 가지 액션 모두 ProductForm 안에서 처리.
 * 성공 후 /seller/products 로 리다이렉트.
 */
export default function NewProductPage() {
  return <ProductForm mode="create" />;
}
