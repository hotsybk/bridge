import { TRPCError } from "@trpc/server";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import { sendKakaoAlimtalk, type KakaoTemplateId } from "@/server/services/solapi";
import type { Vendor } from "@/lib/types";

export type VendorMemo = {
  id: string;
  actorId: string;
  body: string;
  createdAt: Timestamp | null;
};

const VendorStatusEnum = z.enum([
  "PENDING_DOCS",
  "PENDING_REVIEW",
  "APPROVED",
  "SUSPENDED",
  "REJECTED",
]);

const VendorTypeEnum = z.enum(["DISTRIBUTOR", "MANUFACTURER", "IMPORTER"]);
const VendorGradeEnum = z.enum(["STANDARD", "PLUS", "PREMIUM", "DIRECT"]);

// 등급별 디폴트 수수료율
const GRADE_RATES: Record<z.infer<typeof VendorGradeEnum>, number> = {
  STANDARD: 0.05,
  PLUS: 0.045,
  PREMIUM: 0.04,
  DIRECT: 0.035,
};

export const adminVendorRouter = createTRPCRouter({
  /**
   * 심사 큐 / 상태별 vendor 목록.
   * 기본 status: PENDING_REVIEW, createdAt desc, pageSize 20.
   * cursor 기반 페이지네이션 — 마지막 doc id 를 다음 호출에 전달.
   */
  list: adminProcedure
    .input(
      z.object({
        status: VendorStatusEnum.optional().default("PENDING_REVIEW"),
        pageSize: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{ vendors: Vendor[]; hasMore: boolean; nextCursor?: string }> => {
        const db = adminDb();
        let q = db
          .collection(COLLECTIONS.vendors)
          .where("status", "==", input.status)
          .orderBy("createdAt", "desc")
          .limit(input.pageSize + 1);

        if (input.cursor) {
          const cursorSnap = await db
            .collection(COLLECTIONS.vendors)
            .doc(input.cursor)
            .get();
          if (cursorSnap.exists) {
            q = q.startAfter(cursorSnap);
          }
        }

        const snap = await q.get();
        const hasMore = snap.docs.length > input.pageSize;
        const trimmed = hasMore ? snap.docs.slice(0, -1) : snap.docs;
        const items = trimmed.map((d) => {
          const data = d.data() as Omit<Vendor, "id">;
          return { id: d.id, ...data } satisfies Vendor;
        });
        const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;
        return { vendors: items, hasMore, nextCursor };
      },
    ),

  /** 상세 페이지용 단건 조회. */
  getById: adminProcedure
    .input(z.object({ vendorId: z.string() }))
    .query(async ({ input }): Promise<Vendor | null> => {
      const snap = await adminDb()
        .collection(COLLECTIONS.vendors)
        .doc(input.vendorId)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<Vendor, "id">;
      return { id: snap.id, ...data };
    }),

  /** 승인 — PENDING_REVIEW → APPROVED. statusReason 클리어 + approvedAt/approvedById 기록. */
  approve: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      mutateVendorStatus({
        actorUid: ctx.uid,
        vendorId: input.vendorId,
        newStatus: "APPROVED",
        statusReason: null,
        notificationType: "VENDOR_APPROVED",
        notificationTitle: "입점이 승인되었습니다",
        notificationBody: "셀러센터에서 상품 등록을 시작할 수 있습니다.",
      }),
    ),

  /** 반려 — PENDING_REVIEW → REJECTED. 반려 사유 필수. */
  reject: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        reason: z.string().min(1, "반려 사유를 입력해주세요").max(500),
      }),
    )
    .mutation(({ ctx, input }) =>
      mutateVendorStatus({
        actorUid: ctx.uid,
        vendorId: input.vendorId,
        newStatus: "REJECTED",
        statusReason: input.reason,
        notificationType: "VENDOR_REJECTED",
        notificationTitle: "입점 신청이 반려되었습니다",
        notificationBody: input.reason,
      }),
    ),

  /** 일시정지 — APPROVED → SUSPENDED. 사유 필수. */
  suspend: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        reason: z.string().min(1, "정지 사유를 입력해주세요").max(500),
      }),
    )
    .mutation(({ ctx, input }) =>
      mutateVendorStatus({
        actorUid: ctx.uid,
        vendorId: input.vendorId,
        newStatus: "SUSPENDED",
        statusReason: input.reason,
        notificationType: "VENDOR_SUSPENDED",
        notificationTitle: "이용이 일시 정지되었습니다",
        notificationBody: input.reason,
      }),
    ),

  /** 정지 해제 — SUSPENDED → APPROVED. */
  reopen: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      mutateVendorStatus({
        actorUid: ctx.uid,
        vendorId: input.vendorId,
        newStatus: "APPROVED",
        statusReason: null,
        notificationType: "VENDOR_REOPENED",
        notificationTitle: "이용 정지가 해제되었습니다",
        notificationBody: "셀러센터 접근이 다시 가능합니다.",
      }),
    ),

  /** 운영자 메모 목록 — vendors/{id}/memos 서브컬렉션. */
  listMemos: adminProcedure
    .input(z.object({ vendorId: z.string() }))
    .query(async ({ input }): Promise<VendorMemo[]> => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.vendors)
        .doc(input.vendorId)
        .collection("memos")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      return snap.docs.map((d) => {
        const data = d.data() as Omit<VendorMemo, "id">;
        return { id: d.id, ...data };
      });
    }),

  /** 운영자 메모 추가. */
  addMemo: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        body: z.string().min(1, "메모 내용을 입력해주세요").max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const now = FieldValue.serverTimestamp();

      // 존재 확인
      const vRef = db.collection(COLLECTIONS.vendors).doc(input.vendorId);
      const vSnap = await vRef.get();
      if (!vSnap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 vendor를 찾을 수 없습니다.",
        });
      }

      await vRef.collection("memos").add({
        actorId: ctx.uid,
        body: input.body,
        createdAt: now,
      });

      // auditLog
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "VENDOR_MEMO_ADDED",
        targetType: "Vendor",
        targetId: input.vendorId,
        createdAt: now,
      });

      return { ok: true };
    }),

  /**
   * 승인된 vendor 목록 (vendors-list 페이지용).
   * vendorType / grade / search 필터 + cursor 페이지네이션.
   * grade·search 는 클라이언트 사이드 필터 (Firestore 인덱스 부담 회피).
   */
  listApproved: adminProcedure
    .input(
      z.object({
        vendorType: VendorTypeEnum.optional(),
        grade: VendorGradeEnum.optional(),
        search: z.string().optional(),
        pageSize: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{ vendors: Vendor[]; hasMore: boolean; nextCursor?: string }> => {
        const db = adminDb();
        let q = db
          .collection(COLLECTIONS.vendors)
          .where("status", "==", "APPROVED")
          .orderBy("createdAt", "desc")
          .limit(input.pageSize + 1);

        if (input.vendorType) {
          q = q.where("vendorType", "==", input.vendorType);
        }
        if (input.cursor) {
          const cursorSnap = await db
            .collection(COLLECTIONS.vendors)
            .doc(input.cursor)
            .get();
          if (cursorSnap.exists) {
            q = q.startAfter(cursorSnap);
          }
        }

        const snap = await q.get();
        let items = snap.docs.map((d) => {
          const data = d.data() as Omit<Vendor, "id">;
          return { id: d.id, ...data } satisfies Vendor;
        });

        if (input.grade) {
          items = items.filter(
            (v) => (v.grade ?? "STANDARD") === input.grade,
          );
        }
        if (input.search) {
          const k = input.search.toLowerCase();
          items = items.filter(
            (v) =>
              v.companyName?.toLowerCase().includes(k) ||
              v.bizRegNo?.includes(input.search!),
          );
        }

        const hasMore = items.length > input.pageSize;
        const trimmed = hasMore ? items.slice(0, -1) : items;
        const nextCursor = hasMore
          ? trimmed[trimmed.length - 1]?.id
          : undefined;
        return { vendors: trimmed, hasMore, nextCursor };
      },
    ),

  /** vendors-list KPI — 총/유형별/이번달 신규/정지 카운트. */
  listApprovedCounts: adminProcedure.query(async () => {
    const db = adminDb();
    const [approvedSnap, suspendedSnap] = await Promise.all([
      db.collection(COLLECTIONS.vendors).where("status", "==", "APPROVED").get(),
      db.collection(COLLECTIONS.vendors).where("status", "==", "SUSPENDED").get(),
    ]);
    const items = approvedSnap.docs.map((d) => d.data() as Vendor);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartSec = Math.floor(monthStart.getTime() / 1000);

    const total = items.length;
    const distributor = items.filter((v) => v.vendorType === "DISTRIBUTOR").length;
    const manufacturer = items.filter((v) => v.vendorType === "MANUFACTURER").length;
    const importer = items.filter((v) => v.vendorType === "IMPORTER").length;
    const newThisMonth = items.filter((v) => {
      const ts = v.createdAt as unknown as { seconds?: number; _seconds?: number } | undefined;
      const sec = ts?.seconds ?? ts?._seconds ?? 0;
      return sec >= monthStartSec;
    }).length;

    return {
      total,
      distributor,
      manufacturer,
      importer,
      newThisMonth,
      suspended: suspendedSnap.size,
    };
  }),

  /** 등급 변경 — defaultCommissionRate 자동 갱신 + 알림 + audit log. */
  updateGrade: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        grade: VendorGradeEnum,
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.vendors).doc(input.vendorId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 vendor를 찾을 수 없습니다.",
        });
      }
      const before = snap.data() ?? {};
      const beforeGrade = (before.grade as string | undefined) ?? "STANDARD";
      const newRate = GRADE_RATES[input.grade];

      const now = FieldValue.serverTimestamp();
      await ref.update({
        grade: input.grade,
        defaultCommissionRate: newRate,
        gradeUpdatedAt: now,
        gradeUpdatedById: ctx.uid,
        gradeNote: input.note ?? null,
        updatedAt: now,
      });

      // vendor 알림
      await db.collection(COLLECTIONS.notifications).add({
        targetType: "VENDOR",
        targetId: input.vendorId,
        type: "VENDOR_GRADE_UPDATED",
        title: `등급이 ${input.grade}로 변경되었습니다`,
        body: `수수료율: ${(newRate * 100).toFixed(1)}%${input.note ? `\n사유: ${input.note}` : ""}`,
        channels: ["KAKAO", "IN_APP"],
        kakaoSent: false,
        emailSent: false,
        createdAt: now,
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "VENDOR_GRADE_UPDATED",
        targetType: "Vendor",
        targetId: input.vendorId,
        before: {
          grade: beforeGrade,
          rate: (before.defaultCommissionRate as number | undefined) ?? null,
        },
        after: { grade: input.grade, rate: newRate },
        createdAt: now,
      });

      return { ok: true };
    }),

  /** 수수료율 직접 변경 — 등급과 무관하게 override. */
  updateCommissionRate: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        rate: z.number().min(0).max(0.5),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.vendors).doc(input.vendorId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 vendor를 찾을 수 없습니다.",
        });
      }
      const before = snap.data() ?? {};

      const now = FieldValue.serverTimestamp();
      await ref.update({
        defaultCommissionRate: input.rate,
        updatedAt: now,
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "VENDOR_COMMISSION_RATE_UPDATED",
        targetType: "Vendor",
        targetId: input.vendorId,
        before: {
          rate: (before.defaultCommissionRate as number | undefined) ?? null,
        },
        after: { rate: input.rate, reason: input.reason ?? null },
        createdAt: now,
      });

      return { ok: true };
    }),

  /** 영업 카테고리 갱신. */
  updateCategories: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        categories: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db.collection(COLLECTIONS.vendors).doc(input.vendorId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 vendor를 찾을 수 없습니다.",
        });
      }
      const now = FieldValue.serverTimestamp();
      await ref.update({
        categories: input.categories,
        updatedAt: now,
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "VENDOR_CATEGORIES_UPDATED",
        targetType: "Vendor",
        targetId: input.vendorId,
        after: { categories: input.categories },
        createdAt: now,
      });
      return { ok: true };
    }),

  /** 알림톡 임의 발송 — notifications 큐 + audit log. */
  sendAlimtalk: adminProcedure
    .input(
      z.object({
        vendorId: z.string(),
        template: z.string(),
        body: z.string().min(1).max(1000),
        title: z.string().min(1).max(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.vendors)
        .doc(input.vendorId)
        .get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 vendor를 찾을 수 없습니다.",
        });
      }

      const now = FieldValue.serverTimestamp();
      await db.collection(COLLECTIONS.notifications).add({
        targetType: "VENDOR",
        targetId: input.vendorId,
        type: input.template,
        title: input.title,
        body: input.body,
        channels: ["KAKAO", "IN_APP"],
        kakaoSent: false,
        emailSent: false,
        sentByAdminId: ctx.uid,
        createdAt: now,
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "VENDOR_ALIMTALK_SENT",
        targetType: "Vendor",
        targetId: input.vendorId,
        after: { template: input.template, title: input.title },
        createdAt: now,
      });

      return { ok: true };
    }),

  /** 일괄 승인 — 최대 50건. 트랜잭션은 단건 단위. */
  bulkApprove: adminProcedure
    .input(
      z.object({
        vendorIds: z.array(z.string()).min(1).max(50),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.allSettled(
        input.vendorIds.map((vendorId) =>
          mutateVendorStatus({
            actorUid: ctx.uid,
            vendorId,
            newStatus: "APPROVED",
            statusReason: null,
            notificationType: "VENDOR_APPROVED",
            notificationTitle: "입점이 승인되었습니다",
            notificationBody: "셀러센터에서 상품 등록을 시작할 수 있습니다.",
          }),
        ),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      const failures = results
        .map((r, i) => ({ vendorId: input.vendorIds[i], result: r }))
        .filter((x) => x.result.status === "rejected")
        .map((x) => ({
          vendorId: x.vendorId,
          reason:
            x.result.status === "rejected"
              ? String((x.result as PromiseRejectedResult).reason)
              : "",
        }));
      return { succeeded, failed, total: results.length, failures };
    }),
});

async function mutateVendorStatus(args: {
  actorUid: string;
  vendorId: string;
  newStatus: "APPROVED" | "REJECTED" | "SUSPENDED";
  statusReason: string | null;
  notificationType: KakaoTemplateId;
  notificationTitle: string;
  notificationBody: string;
}) {
  const db = adminDb();
  const now = FieldValue.serverTimestamp();

  const vendorRef = db.collection(COLLECTIONS.vendors).doc(args.vendorId);
  const snap = await vendorRef.get();
  if (!snap.exists) {
    throw new TRPCError({ code: "NOT_FOUND", message: "해당 vendor를 찾을 수 없습니다." });
  }
  const before = snap.data() ?? {};

  // 1) vendors/{id} 갱신
  const update: Record<string, unknown> = {
    status: args.newStatus,
    statusReason: args.statusReason,
    updatedAt: now,
  };
  if (args.newStatus === "APPROVED") {
    update.approvedAt = now;
    update.approvedById = args.actorUid;
  }
  await vendorRef.update(update);

  // 2) notifications 큐 등록 (kakaoSent=false — Phase 2 Cloud Function이 처리)
  await db.collection(COLLECTIONS.notifications).add({
    targetType: "VENDOR",
    targetId: args.vendorId,
    type: args.notificationType,
    title: args.notificationTitle,
    body: args.notificationBody,
    channels: ["KAKAO", "IN_APP"],
    kakaoSent: false,
    emailSent: false,
    createdAt: now,
  });

  // 3) solapi mock 호출 (실제 발송은 Phase 2 Cloud Function — 여기서는 인터페이스 검증용)
  try {
    await sendKakaoAlimtalk({
      template: args.notificationType,
      to: (before.phone as string | undefined) ?? "",
      params: {
        vendorName: (before.companyName as string | undefined) ?? "",
        reason: args.statusReason ?? "",
      },
    });
  } catch {
    /* mock 실패는 status 갱신을 막지 않음 */
  }

  // 4) auditLogs 기록
  await db.collection(COLLECTIONS.auditLogs).add({
    actorId: args.actorUid,
    actorRole: "ADMIN",
    action: `VENDOR_${args.newStatus}`,
    targetType: "Vendor",
    targetId: args.vendorId,
    before: {
      status: (before.status as string | undefined) ?? null,
      statusReason: (before.statusReason as string | undefined) ?? null,
    },
    after: { status: args.newStatus, statusReason: args.statusReason },
    createdAt: now,
  });

  return { ok: true, vendorId: args.vendorId, newStatus: args.newStatus };
}
