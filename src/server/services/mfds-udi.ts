// Wave N — 식약처 의료기기통합정보시스템 (e-MEDI) OPEN API 통합.
// 실제 API endpoint 는 공공데이터 포털 (data.go.kr) 신청 후 발급받은 serviceKey 사용.
// 의료기기법 §31 자동 보고 의무 — 매월 말일 일괄 보고.
//
// env 미설정 시 mock 응답으로 fallback (90% 성공 simulation).

// Server-only enforcement (CLAUDE.md §5.4).
// `server-only` 패키지는 tsx/Node 스크립트와 충돌하므로 runtime 가드로 대체.
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("mfds-udi.ts must be used only on the server side.");
}

const MFDS_API_BASE =
  process.env.MFDS_UDI_API_ENDPOINT ||
  "https://apis.data.go.kr/1471000/MdcinExprtRegistrySrvc";

export type UdiReportInput = {
  udiCode: string; // GS1 형식 UDI-DI
  lotNo: string;
  expiry: string; // YYYY-MM-DD
  vendorBizRegNo: string; // 판매업자 사업자번호
  hospitalBizRegNo: string; // 수요처 사업자번호
  hospitalName: string;
  quantity: number;
  unitPrice: number;
  saleDate: string; // YYYY-MM-DD
  productName: string;
  mfdsLicenseNo?: string;
};

export type UdiReportResult = {
  success: boolean;
  resultCode?: string;
  resultMessage?: string;
  receiptNo?: string; // 식약처 접수번호
  source: "mfds" | "mock";
  raw?: unknown;
  errorAt?: string;
};

/**
 * 식약처에 1건 보고. env 미설정 시 mock 응답.
 */
export async function reportToMfds(input: UdiReportInput): Promise<UdiReportResult> {
  const apiKey = process.env.MFDS_UDI_API_KEY;

  if (!apiKey) {
    // ── Mock fallback — 형식 검증만 수행
    if (!input.udiCode || input.udiCode.length < 8) {
      return {
        success: false,
        resultCode: "ERR_INVALID_UDI",
        resultMessage: "UDI 코드 형식 오류 (mock)",
        source: "mock",
      };
    }
    if (!input.hospitalBizRegNo || input.hospitalBizRegNo.length < 10) {
      return {
        success: false,
        resultCode: "ERR_INVALID_BIZ",
        resultMessage: "사업자번호 형식 오류 (mock)",
        source: "mock",
      };
    }
    // 90% 성공률 simulation
    const ok = Math.random() < 0.9;
    if (!ok) {
      return {
        success: false,
        resultCode: "ERR_NETWORK",
        resultMessage: "식약처 API 일시 장애 (mock)",
        source: "mock",
      };
    }
    return {
      success: true,
      resultCode: "00",
      resultMessage: "정상 처리 (mock)",
      receiptNo: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: "mock",
    };
  }

  // ── 실 호출
  try {
    const res = await fetch(
      `${MFDS_API_BASE}/registerSale?serviceKey=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          udi: input.udiCode,
          lot: input.lotNo,
          exp: input.expiry,
          sellerBiz: input.vendorBizRegNo,
          buyerBiz: input.hospitalBizRegNo,
          buyerName: input.hospitalName,
          qty: input.quantity,
          price: input.unitPrice,
          date: input.saleDate,
          product: input.productName,
          license: input.mfdsLicenseNo,
        }),
      },
    );

    if (!res.ok) {
      return {
        success: false,
        resultCode: String(res.status),
        resultMessage: `HTTP ${res.status}`,
        source: "mfds",
        errorAt: new Date().toISOString(),
      };
    }

    const json = (await res.json()) as {
      resultCode?: string;
      resultMsg?: string;
      receiptNo?: string;
    };
    return {
      success: json.resultCode === "00",
      resultCode: json.resultCode,
      resultMessage: json.resultMsg,
      receiptNo: json.receiptNo,
      source: "mfds",
      raw: json,
    };
  } catch (err) {
    return {
      success: false,
      resultCode: "EXCEPTION",
      resultMessage: err instanceof Error ? err.message : String(err),
      source: "mfds",
      errorAt: new Date().toISOString(),
    };
  }
}
