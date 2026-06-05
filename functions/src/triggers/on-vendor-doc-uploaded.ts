// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-vendor-doc-uploaded must be used only on the server side.");
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
import {verifyBizRegNo} from "../lib/nts";
// eslint-disable-next-line import/first
import {appendAuditLog} from "../lib/audit";
// eslint-disable-next-line import/first
import {enqueueRetry} from "../lib/retry-queue";

type VendorDoc = {
  bizRegNo?: string;
  bizRegImageUrl?: string;
  bizRegOcr?: {
    bizRegNo: string | null;
    companyName: string | null;
    ceoName: string | null;
    confidence: number;
    processedAt?: unknown;
  } | null;
};

/**
 * vendors/{vendorId} 문서가 생성/갱신되었을 때, bizRegImageUrl 이
 * 새로 설정되거나 변경된 경우 OCR + 국세청 진위확인을 수행하고
 * 결과를 같은 문서의 bizRegOcr / bizRegVerification 필드로 저장.
 *
 * 무한 루프 방지: bizRegImageUrl 의 before/after 가 다를 때만 실행하고,
 * 결과 저장은 별도 필드(bizRegOcr, bizRegVerification)에 하므로
 * 자기 자신을 다시 트리거하지 않는다.
 */
export const onVendorDocUploaded = onDocumentWritten(
  {
    document: "vendors/{vendorId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const vendorId = event.params.vendorId;
    const before = event.data?.before?.data() as VendorDoc | undefined;
    const after = event.data?.after?.data() as VendorDoc | undefined;

    // 삭제 이벤트 무시
    if (!after) return;

    const beforeUrl = before?.bizRegImageUrl ?? null;
    const afterUrl = after.bizRegImageUrl ?? null;

    // bizRegImageUrl 변경이 없으면 무시 (무한 루프 가드)
    if (beforeUrl === afterUrl) return;

    // bizRegImageUrl이 비어 있다면 무시
    if (!afterUrl) return;

    const ref = event.data?.after?.ref;
    if (!ref) return;

    logger.info("[on-vendor-doc-uploaded] processing", {
      vendorId,
      before: beforeUrl,
      after: afterUrl,
    });

    const update: Record<string, unknown> = {
      bizRegProcessedAt: FieldValue.serverTimestamp(),
    };

    // ── OCR 실행 ─────────────────────────────────────────────
    let ocrResult: Awaited<ReturnType<typeof extractFromBizRegImage>> = null;
    try {
      ocrResult = await extractFromBizRegImage(afterUrl);
      if (ocrResult) {
        update.bizRegOcr = {
          ...ocrResult,
          processedAt: FieldValue.serverTimestamp(),
        };
      } else {
        update.bizRegOcrError = "extraction returned null";
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error("[on-vendor-doc-uploaded] OCR failed", {vendorId, reason});
      update.bizRegOcrError = reason;
      await enqueueRetry({
        type: "ALGOLIA", // 재시도 타입 — 추후 OCR 전용 type 도 추가 가능
        payload: {vendorId, imageUrl: afterUrl, kind: "OCR"},
        reason,
      });
    }

    // ── 국세청 진위확인 실행 ────────────────────────────────────
    const bizRegNo = ocrResult?.bizRegNo ?? after.bizRegNo ?? null;
    if (bizRegNo) {
      try {
        const ntsResult = await verifyBizRegNo(bizRegNo);
        if (ntsResult) {
          update.bizRegVerification = {
            ...ntsResult,
            verifiedAt: FieldValue.serverTimestamp(),
            bizRegNo,
          };
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logger.error("[on-vendor-doc-uploaded] NTS failed", {vendorId, reason});
        update.bizRegVerificationError = reason;
      }
    }

    // ── Firestore 업데이트 (가드 필드 포함) ────────────────────
    try {
      await ref.update(update);
    } catch (err) {
      logger.error("[on-vendor-doc-uploaded] update failed", {
        vendorId,
        err: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // ── auditLogs 기록 ──────────────────────────────────────────
    try {
      await appendAuditLog({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "VENDOR_DOC_PROCESSED",
        targetType: "Vendor",
        targetId: vendorId,
        after: {
          ocrSuccess: !!ocrResult,
          ntsVerified: !!update.bizRegVerification,
        },
      });
    } catch (err) {
      logger.warn("[on-vendor-doc-uploaded] audit log failed", {
        vendorId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[on-vendor-doc-uploaded] completed", {
      vendorId,
      ocrSuccess: !!ocrResult,
      ntsVerified: !!update.bizRegVerification,
    });
  },
);
