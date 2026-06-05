// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-product-submitted must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentWritten} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {FieldValue} from "../lib/firestore";
// eslint-disable-next-line import/first
import {extractFromBizRegImage} from "../lib/ocr";
// eslint-disable-next-line import/first
import {appendAuditLog} from "../lib/audit";

type Verification = {
  udiValid?: boolean | null;
  udiCheckedAt?: unknown;
  licenseOcr?: { number: string | null; confidence: number } | null;
  licenseOcrAt?: unknown;
  categoryMismatch?: boolean | null;
};

type ProductDoc = {
  udiCode?: string;
  certificateUrl?: string;
  moderation?: {
    status?: string;
  };
  verification?: Verification;
};

/**
 * 단순화된 UDI 형식 검증 — GS1 정식 알고리즘은 Phase 4+ 도입.
 * 현재: 12~14자리 숫자만 허용.
 * @param {string} udi UDI 코드 문자열.
 * @return {boolean} 형식 유효 여부.
 */
function validateUdi(udi: string): boolean {
  return /^\d{12,14}$/.test(udi);
}

/**
 * products/{productId} onWritten.
 *
 * 조건: moderation.status 가 DRAFT 또는 null → PENDING_REVIEW 로 전환된 경우만 동작.
 * - UDI 형식 검증
 * - certificateUrl 가 있으면 Clova OCR 호출
 * - verification 필드에 결과 저장
 *
 * 무한 루프 방지: verification 필드가 이미 채워져 있고 verification.udiCheckedAt
 * 가 존재하면 skip.
 */
export const onProductSubmitted = onDocumentWritten(
  {
    document: "products/{productId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const productId = event.params.productId;
    const before = event.data?.before?.data() as ProductDoc | undefined;
    const after = event.data?.after?.data() as ProductDoc | undefined;
    if (!after) return;

    const beforeStatus = before?.moderation?.status ?? null;
    const afterStatus = after?.moderation?.status ?? null;

    // PENDING_REVIEW 진입 이벤트만 처리
    if (afterStatus !== "PENDING_REVIEW") return;
    if (beforeStatus === "PENDING_REVIEW") return; // 이미 처리됨

    // 무한 루프 가드 — 이미 검증 완료된 문서면 skip
    if (after.verification?.udiCheckedAt) return;

    const ref = event.data?.after?.ref;
    if (!ref) return;

    logger.info("[on-product-submitted] processing", {productId});

    const update: Record<string, unknown> = {
      "verification.udiCheckedAt": FieldValue.serverTimestamp(),
      "verification.categoryMismatch": null, // Phase 4+
    };

    // 1) UDI 형식 검증
    const udi = after.udiCode ?? "";
    update["verification.udiValid"] = udi ? validateUdi(udi) : null;

    // 2) 인증서 OCR (선택)
    if (after.certificateUrl) {
      try {
        const ocr = await extractFromBizRegImage(after.certificateUrl);
        if (ocr) {
          update["verification.licenseOcr"] = {
            number: ocr.bizRegNo ?? null,
            confidence: ocr.confidence,
          };
          update["verification.licenseOcrAt"] = FieldValue.serverTimestamp();
        }
      } catch (err) {
        logger.warn("[on-product-submitted] license OCR failed", {
          productId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    try {
      await ref.update(update);
    } catch (err) {
      logger.error("[on-product-submitted] update failed", {
        productId,
        err: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    try {
      await appendAuditLog({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "PRODUCT_AUTO_VERIFIED",
        targetType: "Product",
        targetId: productId,
        after: {
          udiValid: update["verification.udiValid"],
          hasOcr: !!update["verification.licenseOcr"],
        },
      });
    } catch (err) {
      logger.warn("[on-product-submitted] audit log failed", {
        productId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[on-product-submitted] completed", {productId});
  },
);
