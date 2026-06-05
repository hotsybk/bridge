// Wave N — UDI 보고 tRPC router (admin only).
//
// Endpoints:
//   - listReports()                     최근 12개월 마스터 doc 리스트 (timeline)
//   - counts({period?})                 KPI: 총건수·성공·실패·재시도 가능
//   - getReport({period})               마스터 doc
//   - listItems({period,status,...})    items 서브컬렉션 페이지네이션
//   - retryItem({period,subOrderId})    실패 항목 재시도 → reportToMfds 재호출

import {TRPCError} from "@trpc/server";
import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";

import {adminProcedure, createTRPCRouter} from "@/server/api/trpc";
import {adminDb} from "@/server/firebase/admin";
import {COLLECTIONS} from "@/server/firebase/collections";
import type {UdiReportItem, UdiReportMaster} from "@/lib/types";

type AdminUdiMaster = Partial<UdiReportMaster> & {id: string; period: string};
type AdminUdiItem = Partial<UdiReportItem> & {id: string};

export const adminUdiRouter = createTRPCRouter({
  /** 최근 12개월 master 리스트. 없는 월은 PENDING 빈 객체. */
  listReports: adminProcedure.query(async (): Promise<AdminUdiMaster[]> => {
    const now = new Date();
    const periods: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
    }

    const db = adminDb();
    const reports: AdminUdiMaster[] = [];
    for (const period of periods) {
      const snap = await db
        .collection(COLLECTIONS.udiReports)
        .doc(period)
        .get();
      if (snap.exists) {
        const data = snap.data() as Omit<UdiReportMaster, "id">;
        reports.push({
          ...data,
          id: snap.id,
          period,
        });
      } else {
        reports.push({
          id: period,
          period,
          status: "PENDING",
          totalCount: 0,
          successCount: 0,
          failCount: 0,
        });
      }
    }
    return reports.sort((a, b) => b.period.localeCompare(a.period));
  }),

  /** 단일 period KPI. */
  counts: adminProcedure
    .input(z.object({period: z.string().optional()}))
    .query(async ({input}) => {
      const period = input.period ?? new Date().toISOString().slice(0, 7);
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.udiReports)
        .doc(period)
        .get();
      if (!snap.exists) {
        return {
          totalCount: 0,
          successCount: 0,
          failCount: 0,
          retryAvailable: 0,
        };
      }
      const d = snap.data() as Partial<UdiReportMaster>;
      let retryAvailable = 0;
      try {
        const items = await db
          .collection(COLLECTIONS.udiReports)
          .doc(period)
          .collection("items")
          .where("result.success", "==", false)
          .limit(500)
          .get();
        retryAvailable = items.size;
      } catch {
        // composite index 미생성 시 fallback
        retryAvailable = 0;
      }
      return {
        totalCount: d.totalCount ?? 0,
        successCount: d.successCount ?? 0,
        failCount: d.failCount ?? 0,
        retryAvailable,
      };
    }),

  /** 마스터 doc 단건. */
  getReport: adminProcedure
    .input(z.object({period: z.string()}))
    .query(async ({input}): Promise<AdminUdiMaster | null> => {
      const snap = await adminDb()
        .collection(COLLECTIONS.udiReports)
        .doc(input.period)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<UdiReportMaster, "id">;
      return {
        ...data,
        id: snap.id,
        period: input.period,
      };
    }),

  /** items 서브컬렉션 페이지네이션. */
  listItems: adminProcedure
    .input(
      z.object({
        period: z.string(),
        status: z.enum(["ALL", "SUCCESS", "FAIL"]).default("ALL"),
        pageSize: z.number().int().min(1).max(200).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{
        items: AdminUdiItem[];
        hasMore: boolean;
        nextCursor?: string;
      }> => {
        const db = adminDb();
        const colRef = db
          .collection(COLLECTIONS.udiReports)
          .doc(input.period)
          .collection("items");

        let q: FirebaseFirestore.Query = colRef
          .orderBy("createdAt", "desc")
          .limit(input.pageSize + 1);
        if (input.status === "SUCCESS") {
          q = q.where("result.success", "==", true);
        } else if (input.status === "FAIL") {
          q = q.where("result.success", "==", false);
        }
        if (input.cursor) {
          const c = await colRef.doc(input.cursor).get();
          if (c.exists) q = q.startAfter(c);
        }

        let snap: FirebaseFirestore.QuerySnapshot;
        try {
          snap = await q.get();
        } catch (err) {
          // composite index 누락 등으로 실패 시 빈 결과
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              err instanceof Error
                ? err.message
                : "UDI items query 실패",
          });
        }
        const items = snap.docs.map(
          (d): AdminUdiItem => ({id: d.id, ...(d.data() as Omit<UdiReportItem, "id">)}),
        );
        const hasMore = items.length > input.pageSize;
        const trimmed = hasMore ? items.slice(0, -1) : items;
        return {
          items: trimmed,
          hasMore,
          nextCursor: hasMore ? trimmed[trimmed.length - 1]?.id : undefined,
        };
      },
    ),

  /** 실패 1건 재시도. */
  retryItem: adminProcedure
    .input(z.object({period: z.string(), subOrderId: z.string()}))
    .mutation(async ({ctx, input}) => {
      const db = adminDb();
      const itemRef = db
        .collection(COLLECTIONS.udiReports)
        .doc(input.period)
        .collection("items")
        .doc(input.subOrderId);
      const itemSnap = await itemRef.get();
      if (!itemSnap.exists) {
        throw new TRPCError({code: "NOT_FOUND", message: "Item not found"});
      }
      const item = itemSnap.data() as Partial<UdiReportItem>;

      const wasSuccessBefore = item.result?.success === true;

      const {reportToMfds} = await import("@/server/services/mfds-udi");
      const result = await reportToMfds({
        udiCode: item.udiCode ?? "",
        lotNo: item.lotNo ?? "",
        expiry: item.expiry ?? "",
        vendorBizRegNo: item.vendorBizRegNo ?? "",
        hospitalBizRegNo: item.hospitalBizRegNo ?? "",
        hospitalName: item.hospitalName ?? "",
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? 0,
        saleDate:
          item.saleDate ?? new Date().toISOString().slice(0, 10),
        productName: item.productName ?? "",
        mfdsLicenseNo: item.mfdsLicenseNo,
      });

      await itemRef.update({
        result,
        retryCount: FieldValue.increment(1),
        reportedAt: FieldValue.serverTimestamp(),
      });

      // master count 갱신 (실패 → 성공 전환 시만)
      if (result.success && !wasSuccessBefore) {
        await db
          .collection(COLLECTIONS.udiReports)
          .doc(input.period)
          .update({
            successCount: FieldValue.increment(1),
            failCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
      }

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: ctx.uid,
          actorRole: "ADMIN",
          action: "UDI_ITEM_RETRY",
          targetType: "UdiReport",
          targetId: `${input.period}/items/${input.subOrderId}`,
          after: {success: result.success, resultCode: result.resultCode},
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch {
        /* ignore */
      }

      return {result};
    }),
});
