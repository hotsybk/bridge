// Wave Q2 — vendor 본인 RFQ(견적 요청) 조회/응답 tRPC router.
//
// Endpoints:
//   - list({status?, pageSize}) — 받은 RFQ list (public + invited)
//   - getById({rfqId})          — 단건 + 본인 견적 포함
//   - submitQuote({rfqId,...})  — 신규 견적 또는 기존 갱신
//
// 보안:
//   - vendorProcedure
//   - public + invitedVendorIds 만 접근 허용
//   - 1 vendor 1 quote (있으면 update)

import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { formatKRW } from "@/lib/format";
import { createTRPCRouter, vendorProcedure } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

type RfqDoc = {
  hospitalId?: string;
  hospitalName?: string;
  title?: string;
  description?: string;
  category?: string;
  spec?: string;
  qty?: number;
  unit?: string;
  deliveryDeadline?: unknown;
  deadline?: unknown;
  isPublic?: boolean;
  invitedVendorIds?: string[];
  status?: string;
  quoteCount?: number;
  createdAt?: unknown;
};

export const vendorRfqRouter = createTRPCRouter({
  /** 받은 RFQ list — public OR invitedVendorIds 에 본인 포함. */
  list: vendorProcedure
    .input(
      z.object({
        status: z.enum(["OPEN", "CLOSED", "AWARDED", "CANCELLED"]).optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = adminDb();
      if (!ctx.vendorId) {
        return { rfqs: [], myQuoteCount: 0 };
      }

      try {
        let q = db
          .collection(COLLECTIONS.rfqs)
          .orderBy("createdAt", "desc")
          .limit(input.pageSize * 3); // public + invited 필터링 위해 여유 확보
        if (input.status) {
          q = db
            .collection(COLLECTIONS.rfqs)
            .where("status", "==", input.status)
            .orderBy("createdAt", "desc")
            .limit(input.pageSize * 3);
        }
        const snap = await q.get();
        const items = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as RfqDoc) }))
          .filter(
            (r) =>
              r.isPublic === true ||
              (r.invitedVendorIds ?? []).includes(ctx.vendorId!),
          )
          .slice(0, input.pageSize);
        return { rfqs: items, myQuoteCount: 0 };
      } catch {
        return { rfqs: [], myQuoteCount: 0 };
      }
    }),

  /** 단건 + 본인 견적. */
  getById: vendorProcedure
    .input(z.object({ rfqId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = adminDb();
      const snap = await db.collection(COLLECTIONS.rfqs).doc(input.rfqId).get();
      if (!snap.exists) return null;
      const data = snap.data() as RfqDoc;
      if (
        data.isPublic !== true &&
        !(data.invitedVendorIds ?? []).includes(ctx.vendorId ?? "")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 견적 요청에 대한 접근 권한이 없습니다.",
        });
      }
      const myQuoteSnap = await snap.ref
        .collection("quotes")
        .where("vendorId", "==", ctx.vendorId)
        .limit(1)
        .get();
      const myQuote = myQuoteSnap.empty
        ? null
        : { id: myQuoteSnap.docs[0].id, ...myQuoteSnap.docs[0].data() };
      return { id: snap.id, ...data, myQuote };
    }),

  /**
   * 견적 제출/갱신.
   *  - 기존 견적 있으면 update, 없으면 create + quoteCount++
   *  - hospital 에 알림 발송
   */
  submitQuote: vendorProcedure
    .input(
      z.object({
        rfqId: z.string(),
        unitPrice: z.number().positive(),
        totalPrice: z.number().positive(),
        deliveryDate: z.string().or(z.date()),
        validUntil: z.string().or(z.date()),
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const rfqRef = db.collection(COLLECTIONS.rfqs).doc(input.rfqId);
      const rfqSnap = await rfqRef.get();
      if (!rfqSnap.exists) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const rfq = rfqSnap.data() as RfqDoc;
      if (rfq.status !== "OPEN") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "마감된 견적 요청에는 응답할 수 없습니다.",
        });
      }
      if (
        rfq.isPublic !== true &&
        !(rfq.invitedVendorIds ?? []).includes(ctx.vendorId ?? "")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "초대된 공급업체만 응답할 수 있습니다.",
        });
      }

      // vendor 정보
      const vendorSnap = await db
        .collection(COLLECTIONS.vendors)
        .doc(ctx.vendorId!)
        .get();
      const vendor = vendorSnap.data() as { companyName?: string };

      const deliveryDate =
        typeof input.deliveryDate === "string"
          ? new Date(input.deliveryDate)
          : input.deliveryDate;
      const validUntil =
        typeof input.validUntil === "string"
          ? new Date(input.validUntil)
          : input.validUntil;

      const baseData = {
        rfqId: input.rfqId,
        vendorId: ctx.vendorId,
        vendorName: vendor?.companyName ?? "",
        unitPrice: input.unitPrice,
        totalPrice: input.totalPrice,
        deliveryDate,
        validUntil,
        note: input.note ?? null,
        attachments: [] as string[],
        updatedAt: FieldValue.serverTimestamp(),
      };

      // 기존 견적 있으면 update
      const existing = await rfqRef
        .collection("quotes")
        .where("vendorId", "==", ctx.vendorId)
        .limit(1)
        .get();

      let isNew = false;
      if (!existing.empty) {
        await existing.docs[0].ref.update(baseData);
      } else {
        await rfqRef.collection("quotes").add({
          ...baseData,
          createdAt: FieldValue.serverTimestamp(),
        });
        await rfqRef.update({
          quoteCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        isNew = true;
      }

      // hospital 알림
      if (rfq.hospitalId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "HOSPITAL",
          targetId: rfq.hospitalId,
          type: isNew ? "RFQ_QUOTE_RECEIVED" : "RFQ_QUOTE_UPDATED",
          title: isNew ? "견적이 도착했습니다" : "견적이 갱신되었습니다",
          body: `${vendor?.companyName ?? "공급업체"}에서 견적을 ${
            isNew ? "제출" : "갱신"
          }했습니다 (총 ${formatKRW(input.totalPrice)})`,
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: isNew ? "RFQ_QUOTE_SUBMITTED" : "RFQ_QUOTE_UPDATED",
        targetType: "RFQ",
        targetId: input.rfqId,
        after: {
          vendorId: ctx.vendorId,
          totalPrice: input.totalPrice,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, isNew };
    }),
});
