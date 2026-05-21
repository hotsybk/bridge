import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import { sendKakaoAlimtalk, type KakaoTemplateId } from "@/server/services/solapi";
import type { Vendor } from "@/lib/types";

const VendorStatusEnum = z.enum([
  "PENDING_DOCS",
  "PENDING_REVIEW",
  "APPROVED",
  "SUSPENDED",
  "REJECTED",
]);

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
