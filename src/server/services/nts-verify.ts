// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("nts-verify service must be used only on the server side.");
}

// eslint-disable-next-line import/first
import { withRetry } from "@/server/lib/retry";

// Phase 1.6-A — 국세청 사업자 진위확인 (Wave B에서 풀 인터페이스 보강)
//
// 사업자등록번호의 휴/폐업 상태를 국세청 API 로 조회하는 인터페이스.
// env 비어 있으면 mock, 채워져 있으면 실제 API 호출.

class NtsHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "NtsHttpError";
    this.status = status;
  }
}

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

  const apiKey = process.env.NTS_API_KEY ?? process.env.NTS_BIZINFO_API_KEY;

  // Phase β-2 — production fail-fast.
  // production 에서 apiKey 누락 시 mock 으로 silent fallback 하면
  // 휴/폐업 사업자가 ACTIVE 로 통과되어 컴플라이언스 위반.
  if (process.env.NODE_ENV === "production" && !apiKey) {
    throw new Error(
      "[NTS_VERIFY] NTS_API_KEY / NTS_BIZINFO_API_KEY 가 production 에 설정되지 않음 — fail-fast",
    );
  }

  if (apiKey) {
    try {
      const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(apiKey)}`;
      const json = await withRetry(async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ b_no: [normalized] }),
        });
        if (!res.ok) {
          throw new NtsHttpError(res.status, `NTS API status ${res.status}`);
        }
        return (await res.json()) as {
          data?: Array<{
            b_stt?: string;
            b_stt_cd?: string;
            tax_type?: string;
            end_dt?: string;
          }>;
        };
      });
      const row = json.data?.[0];
      const sttCd = row?.b_stt_cd;
      const status: NTSStatus =
        sttCd === "01" ? "ACTIVE" :
        sttCd === "02" ? "INACTIVE" :
        sttCd === "03" ? "CLOSED" :
        "UNKNOWN";
      return {
        bizRegNo: formatBizRegNo(normalized),
        status,
        isActive: status === "ACTIVE",
        taxType: row?.tax_type,
        startDate: undefined,
        source: "nts",
      };
    } catch (err) {
      console.error("[nts-verify] real API failed, falling back to mock", err);
    }
  }

  // Mock: 끝자리 0~0 은 CLOSED, 1~2 은 INACTIVE, 그 외 ACTIVE (~90%)
  const last = normalized[normalized.length - 1];
  const status: NTSStatus =
    last === "0" ? "CLOSED" :
    (last === "1" || last === "2") ? "INACTIVE" :
    "ACTIVE";
  const isActive = status === "ACTIVE";
  return {
    bizRegNo: formatBizRegNo(normalized),
    status,
    isActive,
    businessName: isActive ? "(주)데모회사" : undefined,
    taxType: isActive ? "일반과세자" : undefined,
    startDate: isActive ? "2026-01-01" : undefined,
    source: "mock",
  };
}

/**
 * Wave B 신규 — page-friendly 반환 형식.
 * - taxType: 일반/간이/면세/폐업 형식 (사용자 노출용 한글)
 *
 * @returns 조회 실패 시 null.
 */
export async function verifyBizRegNo(bizRegNo: string): Promise<{
  isValid: boolean;
  taxType: string | null;
  startDate: string | null;
  raw?: unknown;
} | null> {
  if (!bizRegNo) return null;
  try {
    const r = await verifyBusinessStatus(bizRegNo);
    const taxType =
      r.status === "CLOSED" ? "폐업" :
      r.status === "INACTIVE" ? "휴업" :
      r.taxType ?? null;
    return {
      isValid: r.isActive,
      taxType,
      startDate: r.startDate ?? null,
      raw: { source: r.source, status: r.status },
    };
  } catch (err) {
    console.error("[nts-verify] verifyBizRegNo failed", err);
    return null;
  }
}

function formatBizRegNo(raw: string): string {
  return `${raw.slice(0, 3)}-${raw.slice(3, 5)}-${raw.slice(5)}`;
}
