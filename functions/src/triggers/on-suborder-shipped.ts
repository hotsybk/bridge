// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-suborder-shipped must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {appendAuditLog} from "../lib/audit";

type SubOrderDoc = {
  status?: string;
  vendorId?: string;
  vendorName?: string;
  hospitalId?: string;
  hospitalName?: string;
  trackingNo?: string;
  trackingCarrier?: string;
  orderId?: string;
  orderNo?: string;
  // Wave N UDI 보고 큐 enrichment
  lotNo?: string;
  expiry?: string;
  shippedAt?: FirebaseFirestore.Timestamp;
};

/**
 * orders/{orderId}/subOrders/{subOrderId} onUpdate.
 *
 * 조건: status before != "SHIPPED" && after == "SHIPPED"
 *
 * - hospital 에 배송 시작 알림 (운송장 번호 포함)
 * - UDI 자동보고 큐 push (Phase 6 전 단계 — _udiReportQueue 엔트리만 추가)
 * - auditLog SUBORDER_SHIPPED
 */
export const onSubOrderShipped = onDocumentUpdated(
  {
    document: "orders/{orderId}/subOrders/{subOrderId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const {orderId, subOrderId} = event.params;
    const before = event.data?.before?.data() as SubOrderDoc | undefined;
    const after = event.data?.after?.data() as SubOrderDoc | undefined;
    if (!after) return;

    if (after.status !== "SHIPPED") return;
    if (before?.status === "SHIPPED") return;

    logger.info("[on-suborder-shipped] processing", {orderId, subOrderId});

    // 1) hospital 알림 (parent order 에서 hospitalId 조회)
    try {
      const orderSnap = await db
        .collection(COLLECTIONS.orders)
        .doc(orderId)
        .get();
      const hospitalId =
        (orderSnap.data() as {hospitalId?: string} | undefined)?.hospitalId ??
        after.hospitalId;
      if (hospitalId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "HOSPITAL",
          targetId: hospitalId,
          type: "SUBORDER_SHIPPED",
          title: "배송이 시작되었습니다",
          body: `${after.vendorName ?? "공급업체"} — 운송장 ${after.trackingCarrier ?? ""} ${
            after.trackingNo ?? ""
          }`.trim(),
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      logger.warn("[on-suborder-shipped] hospital notification failed", {
        orderId,
        subOrderId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 2) UDI 자동보고 큐 push — Wave N 월말 cron 이 식약처 e-MEDI 로 일괄 보고.
    //    SubOrder + parent Order + Vendor + Hospital + 첫 번째 item snapshot 까지
    //    enrich 해서 한 doc 으로 자가완결.
    try {
      const orderSnap = await db
        .collection(COLLECTIONS.orders)
        .doc(orderId)
        .get();
      const order = orderSnap.data() as
        | {hospitalId?: string; hospitalName?: string; createdAt?: FirebaseFirestore.Timestamp}
        | undefined;

      const hospitalId = order?.hospitalId ?? after.hospitalId ?? null;
      const hospitalName = order?.hospitalName ?? after.hospitalName ?? null;

      // vendor·hospital bizRegNo 조회 (보고 필수)
      let vendorBizRegNo: string | null = null;
      let hospitalBizRegNo: string | null = null;
      if (after.vendorId) {
        try {
          const vSnap = await db
            .collection(COLLECTIONS.vendors)
            .doc(after.vendorId)
            .get();
          const v = vSnap.data() as {bizRegNo?: string} | undefined;
          vendorBizRegNo = v?.bizRegNo ?? null;
        } catch {/* ignore */}
      }
      if (hospitalId) {
        try {
          const hSnap = await db
            .collection(COLLECTIONS.hospitals)
            .doc(hospitalId)
            .get();
          const h = hSnap.data() as {bizRegNo?: string} | undefined;
          hospitalBizRegNo = h?.bizRegNo ?? null;
        } catch {/* ignore */}
      }

      // SubOrder items (첫 번째 의료기기 item 사용)
      let productId: string | null = null;
      let productName: string | null = null;
      let udiCode: string | null = null;
      let unitPrice = 0;
      let quantity = 0;
      let mfdsLicenseNo: string | null = null;
      try {
        const itemsSnap = await db
          .collection(COLLECTIONS.orders)
          .doc(orderId)
          .collection("subOrders")
          .doc(subOrderId)
          .collection("items")
          .limit(1)
          .get();
        const first = itemsSnap.docs[0]?.data() as
          | {
              productId?: string;
              productName?: string;
              udiCode?: string;
              unitPrice?: number;
              qty?: number;
            }
          | undefined;
        if (first) {
          productId = first.productId ?? null;
          productName = first.productName ?? null;
          udiCode = first.udiCode ?? null;
          unitPrice = first.unitPrice ?? 0;
          quantity = first.qty ?? 0;
        }

        // product 에서 mfdsLicenseNo 조회
        if (productId) {
          try {
            const pSnap = await db
              .collection(COLLECTIONS.products)
              .doc(productId)
              .get();
            const p = pSnap.data() as
              | {mfdsLicenseNo?: string; udiCode?: string}
              | undefined;
            mfdsLicenseNo = p?.mfdsLicenseNo ?? null;
            if (!udiCode) udiCode = p?.udiCode ?? null;
          } catch {/* ignore */}
        }
      } catch (err) {
        logger.warn("[on-suborder-shipped] item snapshot failed", {
          orderId,
          subOrderId,
          err: err instanceof Error ? err.message : String(err),
        });
      }

      const shippedAt = after.shippedAt ?? FieldValue.serverTimestamp();
      const saleDate = (() => {
        const ts = after.shippedAt;
        const d = ts?.toDate ? ts.toDate() : new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0",
        )}-${String(d.getDate()).padStart(2, "0")}`;
      })();

      await db.collection("_udiReportQueue").add({
        orderId,
        subOrderId,
        vendorId: after.vendorId ?? null,
        vendorName: after.vendorName ?? null,
        vendorBizRegNo,
        hospitalId,
        hospitalName,
        hospitalBizRegNo,
        productId,
        productName,
        udiCode,
        udi: udiCode, // alias for legacy reads
        lotNo: after.lotNo ?? null,
        expiry: after.expiry ?? null,
        mfdsLicenseNo,
        quantity,
        unitPrice,
        saleDate,
        status: "PENDING",
        shippedAt,
        enqueuedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[on-suborder-shipped] udi queue push failed", {
        orderId,
        subOrderId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 3) auditLog
    try {
      await appendAuditLog({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "SUBORDER_SHIPPED",
        targetType: "SubOrder",
        targetId: subOrderId,
        before: {status: before?.status ?? null},
        after: {
          status: "SHIPPED",
          trackingNo: after.trackingNo ?? null,
          trackingCarrier: after.trackingCarrier ?? null,
        },
      });
    } catch (err) {
      logger.warn("[on-suborder-shipped] audit log failed", {
        orderId,
        subOrderId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[on-suborder-shipped] completed", {orderId, subOrderId});
  },
);
