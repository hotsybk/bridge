import { z } from "zod";

import { BIZ_REG_NO_PATTERN } from "./biz-reg";

export const VendorTypeEnum = z.enum(["DISTRIBUTOR", "MANUFACTURER", "IMPORTER"]);

/**
 * 영업 카테고리 — vendor가 다루는 도메인. 다중 선택.
 * 시드/카테고리 트리와 별개의 거시 분류로, 신청 시 선언용.
 */
export const VendorCategoryEnum = z.enum([
  "MED_DEVICE", // 의료기기
  "MED_SUPPLY", // 의료소모품
  "ORIENTAL",   // 한방
  "DENTAL",     // 치과
  "EMERGENCY",  // 응급/구급
  "OFFICE",     // 사무/청구
]);

const baseVendorSchema = z.object({
  bizRegNo: z
    .string()
    .regex(BIZ_REG_NO_PATTERN, "사업자등록번호 형식이 올바르지 않습니다 (예: 123-45-67890)"),
  bizRegImageUrl: z.string().url("사업자등록증 이미지가 필요합니다"),

  companyName: z.string().min(2, "회사명은 2자 이상").max(100),
  ceoName: z.string().min(1, "대표자명을 입력해주세요").max(50),
  phone: z.string().min(7, "전화번호를 입력해주세요").max(20),
  email: z.string().email("이메일 형식이 올바르지 않습니다"),
  zipcode: z.string().regex(/^\d{5}$/, "우편번호는 5자리 숫자"),
  address: z.string().min(5, "주소를 입력해주세요"),
  addressDetail: z.string().max(100).optional().or(z.literal("")),

  vendorType: VendorTypeEnum,

  // 의료기기법 §17 — DISTRIBUTOR 일 때 필수
  salesLicenseNo: z.string().max(100).optional().or(z.literal("")),
  salesLicenseImageUrl: z.string().url().optional().or(z.literal("")),

  // MANUFACTURER / IMPORTER 일 때 필수
  manufactureLicenseUrl: z.string().url().optional().or(z.literal("")),

  // 영업 카테고리 (다중)
  categories: z.array(VendorCategoryEnum).min(1, "최소 1개 카테고리를 선택해주세요"),

  // 정산 계좌
  payoutBankCode: z.string().min(2, "은행을 선택해주세요").max(10),
  payoutBankAccount: z
    .string()
    .min(5, "계좌번호를 입력해주세요")
    .max(30)
    .regex(/^[0-9\-]+$/, "계좌번호는 숫자와 하이픈만 입력"),
  payoutAccountHolder: z.string().min(1, "예금주명을 입력해주세요").max(50),

  // 약관 동의 (전부 true 여야 가입)
  agreedTerms: z.literal(true, { message: "입점 약관에 동의해주세요" }),
  agreedPrivacy: z.literal(true, { message: "개인정보 처리방침에 동의해주세요" }),
  agreedCommission: z.literal(true, { message: "수수료 정책에 동의해주세요" }),
});

/**
 * Vendor 온보딩 입력 — vendorType 별 conditional validation.
 *
 *  - DISTRIBUTOR  : salesLicenseNo + salesLicenseImageUrl 필수
 *  - MANUFACTURER : manufactureLicenseUrl 필수 (판매업 신고 면제, 의료기기법 §17)
 *  - IMPORTER     : manufactureLicenseUrl 필수 (동일)
 */
export const vendorOnboardSchema = baseVendorSchema.superRefine((data, ctx) => {
  if (data.vendorType === "DISTRIBUTOR") {
    if (!data.salesLicenseNo) {
      ctx.addIssue({
        code: "custom",
        path: ["salesLicenseNo"],
        message: "판매업 신고번호를 입력해주세요 (의료기기 판매업자 필수)",
      });
    }
    if (!data.salesLicenseImageUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["salesLicenseImageUrl"],
        message: "판매업 신고증 이미지를 업로드해주세요",
      });
    }
  } else {
    if (!data.manufactureLicenseUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["manufactureLicenseUrl"],
        message: "제조·수입업 허가증을 업로드해주세요",
      });
    }
  }
});

export type VendorOnboardInput = z.infer<typeof vendorOnboardSchema>;

/** UI 옵션 — vendorType 라디오 카드 표시용. */
export const VENDOR_TYPE_OPTIONS: Array<{
  value: "DISTRIBUTOR" | "MANUFACTURER" | "IMPORTER";
  label: string;
  description: string;
}> = [
  {
    value: "DISTRIBUTOR",
    label: "판매업자",
    description: "의료기기 판매업 신고증 보유 (의료기기법 §17)",
  },
  {
    value: "MANUFACTURER",
    label: "제조업자",
    description: "직접 제조한 의료기기를 판매 (판매업 신고 면제)",
  },
  {
    value: "IMPORTER",
    label: "수입업자",
    description: "수입한 의료기기를 판매 (판매업 신고 면제)",
  },
];

export const VENDOR_CATEGORY_OPTIONS: Array<{
  value: z.infer<typeof VendorCategoryEnum>;
  label: string;
}> = [
  { value: "MED_DEVICE", label: "의료기기" },
  { value: "MED_SUPPLY", label: "의료소모품" },
  { value: "ORIENTAL", label: "한방" },
  { value: "DENTAL", label: "치과" },
  { value: "EMERGENCY", label: "응급/구급" },
  { value: "OFFICE", label: "사무/청구" },
];

/** 정산 계좌용 은행 옵션 (Phase 2+ PortOne 검증 시 확장). */
export const BANK_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "004", label: "국민은행" },
  { code: "088", label: "신한은행" },
  { code: "020", label: "우리은행" },
  { code: "081", label: "하나은행" },
  { code: "003", label: "기업은행" },
  { code: "011", label: "농협은행" },
  { code: "090", label: "카카오뱅크" },
  { code: "089", label: "케이뱅크" },
  { code: "092", label: "토스뱅크" },
];
