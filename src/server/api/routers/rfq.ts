// Phase Φ-C 작업2 — buyer RFQ(견적 요청) 생성 tRPC router.
//
// 기존 RFQ 는 vendor 관점 read/submitQuote (vendor.rfq) 만 존재했다.
// 이 라우터는 buyer 가 견적 요청을 직접 생성하는 mutation 을 제공한다.
//
// Endpoint:
//   create — rfqs 컬렉션에 doc 생성 (status: OPEN, isPublic: true).
//            카테고리 기반 적격 공급사에게 알림 발송 (단순화: notifications doc).
//            audit log.
//
// 보안:
//   - buyerProcedure (role check + ctx.hospitalId 필요)
//   - hospitalId 미연결 시 FORBIDDEN

import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { z } from "zod";

import { buyerProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

const RfqItemSchema = z.object({
  name: z.string().min(1).max(120),
  qty: z.number().int().positive(),
  spec: z.string().max(200).optional(),
});

export const rfqRouter = createTRPCRouter({
  /**
   * 견적 요청 생성.
   *  - rfqs/{nanoid} doc 생성 (isPublic: true → 적격 공급사가 모두 응답 가능)
   *  - 카테고리 매칭 공급사에게 알림 (best-effort)
   *  - audit log
   */
  create: buyerProcedure
    .input(
      z.object({
        title: z.string().min(2).max(100),
        categoryId: z.string().optional(),
        items: z.array(RfqItemSchema).min(1).max(50),
        deadline: z.string().min(1), // 견적 마감일 (YYYY-MM-DD)
        deliveryDate: z.string().optional(), // 희망 납기 (YYYY-MM-DD)
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const hospitalId = ctx.hospitalId;
      const uid = ctx.uid;
      if (!hospitalId || !uid) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "병원 계정이 필요합니다.",
        });
      }

      // hospital 정보 (denormalize).
      const hospitalSnap = await db
        .collection(COLLECTIONS.hospitals)
        .doc(hospitalId)
        .get();
      const hospitalName =
        (hospitalSnap.data() as { name?: string } | undefined)?.name ?? "병원";

      // category 정보 (있으면 라벨 denormalize).
      let categoryName: string | null = null;
      if (input.categoryId) {
        try {
          const cSnap = await db
            .collection(COLLECTIONS.categories)
            .doc(input.categoryId)
            .get();
          if (cSnap.exists) {
            const c = cSnap.data() as { name?: string; path?: string[] };
            categoryName =
              (Array.isArray(c.path) && c.path.length > 0
                ? c.path.join(" / ")
                : null) ??
              c.name ??
              null;
          }
        } catch {
          /* ignore */
        }
      }

      const rfqId = nanoid(12);
      const now = FieldValue.serverTimestamp();
      const deadlineDate = new Date(input.deadline);
      const totalQty = input.items.reduce((s, i) => s + i.qty, 0);

      // 1) rfqs doc 생성.
      await db
        .collection(COLLECTIONS.rfqs)
        .doc(rfqId)
        .set({
          id: rfqId,
          hospitalId,
          hospitalName,
          userId: uid,
          title: input.title,
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(categoryName ? { category: categoryName } : {}),
          items: input.items.map((i) => ({
            name: i.name,
            qty: i.qty,
            spec: i.spec ?? null,
          })),
          totalQty,
          deadline: Number.isNaN(deadlineDate.getTime())
            ? input.deadline
            : deadlineDate,
          ...(input.deliveryDate ? { deliveryDate: input.deliveryDate } : {}),
          note: input.note ?? null,
          status: "OPEN",
          isPublic: true,
          invitedVendorIds: [],
          quoteCount: 0,
          createdAt: now,
          updatedAt: now,
        });

      // 2) 적격 공급사 알림 (카테고리 기반, best-effort, 단순화).
      //    categoryId 가 있으면 해당 카테고리를 취급하는 ACTIVE vendor 에게,
      //    없으면 알림 생략 (public RFQ 는 list 에서 노출됨).
      if (input.categoryId) {
        try {
          const vendorSnap = await db
            .collection(COLLECTIONS.vendors)
            .where("status", "==", "ACTIVE")
            .where("categories", "array-contains", input.categoryId)
            .limit(50)
            .get();
          const batch = db.batch();
          let notified = 0;
          for (const vDoc of vendorSnap.docs) {
            const notifRef = db.collection(COLLECTIONS.notifications).doc();
            batch.set(notifRef, {
              targetType: "VENDOR",
              targetId: vDoc.id,
              type: "RFQ_CREATED",
              title: "새 견적 요청이 도착했습니다",
              body: `${hospitalName}에서 "${input.title}" 견적을 요청했습니다.`,
              data: { rfqId },
              channels: ["IN_APP"],
              kakaoSent: false,
              emailSent: false,
              createdAt: now,
            });
            notified += 1;
            if (notified >= 50) break;
          }
          if (notified > 0) await batch.commit();
        } catch {
          // 인덱스 부재 / 필드 미존재 등 — 알림 실패해도 RFQ 생성은 성공.
        }
      }

      // 3) audit log.
      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "RFQ_CREATED",
          targetType: "RFQ",
          targetId: rfqId,
          after: {
            title: input.title,
            itemCount: input.items.length,
            categoryId: input.categoryId ?? null,
          },
          createdAt: now,
        });
      } catch {
        // best-effort
      }

      return { rfqId };
    }),
});
