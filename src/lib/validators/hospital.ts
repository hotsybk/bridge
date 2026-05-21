import { z } from "zod";

import { BIZ_REG_NO_PATTERN, formatBizRegNo } from "./biz-reg";

// 하위 호환 — Phase 1.6 진입 시점부터 외부에서 사용 중인 export 유지.
export { BIZ_REG_NO_PATTERN, formatBizRegNo };

export const HospitalTypeEnum = z.enum([
  "CLINIC",
  "SMALL_HOSPITAL",
  "GENERAL_HOSPITAL",
  "TERTIARY",
  "ORIENTAL",
  "DENTAL",
]);

/**
 * 병원 온보딩 입력 스키마.
 * client (form) + server (tRPC router) 모두 동일 스키마 사용.
 */
export const hospitalOnboardSchema = z.object({
  bizRegNo: z
    .string()
    .regex(BIZ_REG_NO_PATTERN, "사업자등록번호 형식이 올바르지 않습니다 (예: 123-45-67890)"),
  bizRegImageUrl: z.string().url("사업자등록증 이미지가 필요합니다"),
  name: z.string().min(2, "병원명은 2자 이상 입력해주세요").max(100, "병원명은 100자 이하"),
  ykiho: z
    .string()
    .regex(/^\d{8}$/, "요양기관번호는 8자리 숫자")
    .optional()
    .or(z.literal("")),
  type: HospitalTypeEnum,
  ceoName: z.string().min(1, "대표자명을 입력해주세요").max(50),
  phone: z.string().min(7, "전화번호를 입력해주세요").max(20),
  email: z.string().email("이메일 형식이 올바르지 않습니다"),
  zipcode: z.string().regex(/^\d{5}$/, "우편번호는 5자리 숫자"),
  address: z.string().min(5, "주소를 입력해주세요"),
  addressDetail: z.string().max(100, "상세주소는 100자 이하").optional().or(z.literal("")),
});

export type HospitalOnboardInput = z.infer<typeof hospitalOnboardSchema>;
