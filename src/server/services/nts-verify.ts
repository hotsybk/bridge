// Phase 1.6-A — 국세청 사업자 진위확인 mock
//
// 사업자등록번호의 휴/폐업 상태를 국세청 API 로 조회하는 인터페이스.
// 1.6에서는 mock 구현. 실제 API 호출은 Phase 2 이후 NTS_BIZINFO_API_KEY 가 채워지면 활성화.

export type NTSStatus = "ACTIVE" | "INACTIVE" | "CLOSED" | "UNKNOWN";

export type NTSVerifyResult = {
  bizRegNo: string;
  status: NTSStatus;
  isActive: boolean;          // status === "ACTIVE" 의 편의 alias
  businessName?: string;      // 등록상 상호 (참고용)
  taxType?: string;           // 일반/간이/면세
  startDate?: string;         // YYYY-MM-DD
  source: "mock" | "nts";
};

/**
 * 사업자등록번호 진위 확인.
 *
 * @returns 조회 결과 (휴/폐업 정보 포함). API 자체 실패 시에만 throw.
 *          존재하지 않는 사업자도 throw 가 아니라 status: "UNKNOWN" 으로 반환.
 */
export async function verifyBusinessStatus(
  bizRegNo: string,
): Promise<NTSVerifyResult> {
  const normalized = bizRegNo.replace(/[^0-9]/g, "");
  if (normalized.length !== 10) {
    throw new Error(`사업자등록번호는 10자리여야 합니다: ${bizRegNo}`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // TODO: Phase 2 이후 실제 국세청 OpenAPI 활성화
  //
  // const apiKey = process.env.NTS_BIZINFO_API_KEY;
  // if (!apiKey) throw new Error("NTS env not configured");
  //
  // const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${apiKey}`;
  // const res = await fetch(url, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ b_no: [normalized] }),
  // });
  // const json = await res.json();
  // const row = json?.data?.[0];
  // const isActive = row?.b_stt_cd === "01";        // 01 = 계속사업자
  // return { source: "nts", ... };
  // ─────────────────────────────────────────────────────────────────────

  // Mock: 항상 ACTIVE 반환. 단, 끝자리 0~2 는 INACTIVE 로 처리해서 테스트 가능.
  const last = normalized[normalized.length - 1];
  const status: NTSStatus = last >= "3" ? "ACTIVE" : "INACTIVE";
  return {
    bizRegNo: formatBizRegNo(normalized),
    status,
    isActive: status === "ACTIVE",
    businessName: status === "ACTIVE" ? "더미 의료기관" : undefined,
    taxType: status === "ACTIVE" ? "일반과세자" : undefined,
    startDate: "2026-01-01",
    source: "mock",
  };
}

function formatBizRegNo(raw: string): string {
  return `${raw.slice(0, 3)}-${raw.slice(3, 5)}-${raw.slice(5)}`;
}
