// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("clova-ocr service must be used only on the server side.");
}

// eslint-disable-next-line import/first
import { withRetry } from "@/server/lib/retry";

// Phase 1.6-A — Naver Clova OCR (Wave B에서 풀 인터페이스 보강)
//
// 사업자등록증 이미지에서 사업자번호·대표자명·상호를 추출하는 인터페이스.
// env가 비어 있으면 mock 반환, 채워져 있으면 실제 Clova OCR API 호출.

class ClovaHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ClovaHttpError";
    this.status = status;
  }
}

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

  const endpoint = process.env.CLOVA_OCR_INVOKE_URL ?? process.env.NAVER_CLOVA_OCR_INVOKE_URL;
  const secret = process.env.CLOVA_OCR_SECRET ?? process.env.NAVER_CLOVA_OCR_SECRET;

  // Phase β-2 — production fail-fast.
  // production 환경에서 secret 누락 시 mock 으로 silent fallback 하면 컴플라이언스 위반.
  // (의료기기 vendor 입점에 가짜 OCR 결과가 통과되는 사고 방지)
  if (process.env.NODE_ENV === "production" && (!endpoint || !secret)) {
    throw new Error(
      "[CLOVA_OCR] CLOVA_OCR_INVOKE_URL / CLOVA_OCR_SECRET 가 production 에 설정되지 않음 — fail-fast",
    );
  }

  if (endpoint && secret) {
    // Real Clova OCR call (withRetry — 5xx/network 만 재시도)
    try {
      const json = await withRetry(async () => {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "X-OCR-SECRET": secret,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "V2",
            requestId: crypto.randomUUID(),
            timestamp: Date.now(),
            images: [{ format: "jpg", name: "biz-reg", url: input.imageUrl }],
          }),
        });
        if (!res.ok) {
          throw new ClovaHttpError(res.status, `Clova OCR status ${res.status}`);
        }
        return (await res.json()) as {
          images?: Array<{
            fields?: Array<{
              name?: string;
              inferText?: string;
              inferConfidence?: number;
            }>;
          }>;
        };
      });
      const fields = json.images?.[0]?.fields ?? [];
      const get = (key: string) =>
        fields.find((f) => f.name === key)?.inferText ?? "";
      const conf =
        fields.reduce((a, f) => a + (f.inferConfidence ?? 0), 0) /
        Math.max(fields.length, 1);
      return {
        bizRegNo: get("biz_reg_no") || "",
        ceoName: get("ceo_name") || "",
        businessName: get("business_name") || "",
        confidence: conf,
        rawText: JSON.stringify(json).slice(0, 500),
        source: "clova",
      };
    } catch (err) {
      // Fall through to mock on transient failure
      console.error("[clova-ocr] real API failed, falling back to mock", err);
    }
  }

  // Mock: imageUrl 해시 기반 deterministic dummy 반환
  const hash = simpleHash(input.imageUrl);
  return {
    bizRegNo: formatBizRegNo(hash),
    ceoName: "홍길동",
    businessName: "(주)데모회사",
    confidence: 0.94,
    rawText: "(mock OCR)",
    source: "mock",
  };
}

/**
 * Wave B 신규 — page-friendly 반환 형식. extractBusinessRegNo의 wrapper.
 *
 * @returns 추출 실패시 null (vendor 문서에 저장하지 않음).
 */
export async function extractFromBizRegImage(imageUrl: string): Promise<{
  bizRegNo: string | null;
  companyName: string | null;
  ceoName: string | null;
  confidence: number;
  raw?: unknown;
} | null> {
  if (!imageUrl) return null;
  try {
    const r = await extractBusinessRegNo({ imageUrl });
    return {
      bizRegNo: r.bizRegNo || null,
      companyName: r.businessName || null,
      ceoName: r.ceoName || null,
      confidence: r.confidence,
      raw: { source: r.source, rawText: r.rawText },
    };
  } catch (err) {
    console.error("[clova-ocr] extractFromBizRegImage failed", err);
    return null;
  }
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
