// Phase 1.6-A — Naver Clova OCR mock
//
// 사업자등록증 이미지에서 사업자번호·대표자명·상호를 추출하는 인터페이스.
// 1.6에서는 mock 구현. 실제 Clova OCR API 호출은 Phase 2 이후 NAVER_CLOVA_OCR_INVOKE_URL
// + NAVER_CLOVA_OCR_SECRET 환경변수가 채워지면 활성화.

export type OCRBusinessRegResult = {
  bizRegNo: string;           // 123-45-67890 형식
  ceoName: string;
  businessName: string;
  confidence: number;         // 0~1
  rawText?: string;           // OCR 원본 텍스트 (debug)
  source: "mock" | "clova";
};

export type OCRInput = {
  /** Firebase Storage 의 다운로드 URL 또는 path */
  imageUrl: string;
};

/**
 * 사업자등록증 OCR 추출.
 *
 * @returns 추출 성공 시 결과, 실패 시 throw.
 */
export async function extractBusinessRegNo(
  input: OCRInput,
): Promise<OCRBusinessRegResult> {
  if (!input.imageUrl) {
    throw new Error("imageUrl is required");
  }

  // ─────────────────────────────────────────────────────────────────────
  // TODO: Phase 2 이후 실제 Clova OCR API 활성화
  //
  // const endpoint = process.env.NAVER_CLOVA_OCR_INVOKE_URL;
  // const secret = process.env.NAVER_CLOVA_OCR_SECRET;
  // if (!endpoint || !secret) throw new Error("Clova OCR env not configured");
  //
  // const res = await fetch(endpoint, {
  //   method: "POST",
  //   headers: { "X-OCR-SECRET": secret, "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     version: "V2",
  //     requestId: crypto.randomUUID(),
  //     timestamp: Date.now(),
  //     images: [{ format: "jpg", name: "biz-reg", url: input.imageUrl }],
  //   }),
  // });
  // const json = await res.json();
  // const fields = json?.images?.[0]?.fields ?? [];
  // // → biz_reg_no, ceo_name, business_name 필드 파싱
  // return { ... source: "clova" };
  // ─────────────────────────────────────────────────────────────────────

  // Mock: imageUrl 해시 기반 deterministic dummy 반환
  const hash = simpleHash(input.imageUrl);
  return {
    bizRegNo: formatBizRegNo(hash),
    ceoName: "홍길동",
    businessName: "더미 의료기관",
    confidence: 0.97,
    rawText: "(mock OCR)",
    source: "mock",
  };
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function formatBizRegNo(seed: number): string {
  const n1 = (100 + (seed % 900)).toString().padStart(3, "0");
  const n2 = (1 + ((seed >> 4) % 89)).toString().padStart(2, "0");
  const n3 = (10000 + ((seed >> 8) % 89999)).toString().padStart(5, "0");
  return `${n1}-${n2}-${n3}`;
}
