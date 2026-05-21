// 사업자등록번호 공통 헬퍼 — hospital + vendor 양쪽에서 재사용.

export const BIZ_REG_NO_PATTERN = /^\d{3}-\d{2}-\d{5}$/;

/**
 * 사업자등록번호 자동 포맷팅 — 123-45-67890.
 * 숫자만 추출 후 10자리 안에서 하이픈 삽입.
 */
export function formatBizRegNo(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}
