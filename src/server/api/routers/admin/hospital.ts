// Wave J — 병원 회원 관리 tRPC router (admin only).
//
// Endpoints:
//   - list({type,status,search,pageSize,cursor})
//   - counts()                              KPI: 총·신규(월)·활성(30d)·이탈위험(90d+)
//   - getById({hospitalId})
//   - listMembers({hospitalId})
//   - listOrders({hospitalId,pageSize})
//   - listSubscriptions({hospitalId})
//   - listMemos({hospitalId})
//   - addMemo({hospitalId,body})            — /hospitals/{id}/memos 서브컬렉션 + audit
//   - suspend({hospitalId,reason})          — status=SUSPENDED + notification + audit
//   - reactivate({hospitalId})              — status=ACTIVE + notification + audit
//   - sendAlimtalk({hospitalId,...})        — notifications 큐 + audit
//   - updateApprovalRule({hospitalId,enabled,limit})

import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { Hospital } from "@/lib/types";

const HospitalTypeEnum = z.enum([
  "CLINIC",
  "SMALL_HOSPITAL",
  "GENERAL_HOSPITAL",
  "TERTIARY",
  "ORIENTAL",
  "DENTAL",
]);
const HospitalStatusEnum = z.enum(["ACTIVE", "SUSPENDED"]);

export const adminHospitalRouter = createTRPCRouter({
  /** 병원 목록. type 필터 + 검색 + cursor pagination. status 는 in-memory filter. */
  list: adminProcedure
    .input(
      z.object({
        type: HospitalTypeEnum.optional(),
        status: HospitalStatusEnum.optional(),
        search: z.string().optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        input,
      }): Promise<{
        hospitals: Hospital[];
        hasMore: boolean;
        nextCursor?: string;
      }> => {
        const db = adminDb();
        let q: FirebaseFirestore.Query = db
          .collection(COLLECTIONS.hospitals)
          .orderBy("createdAt", "desc");
        if (input.type) {
          q = q.where("type", "==", input.type);
        }
        q = q.limit(input.pageSize + 1);
        if (input.cursor) {
          const c = await db
            .collection(COLLECTIONS.hospitals)
            .doc(input.cursor)
            .get();
          if (c.exists) q = q.startAfter(c);
        }
        const snap = await q.get();
        let items = snap.docs.map((d) => {
          const data = d.data() as Omit<Hospital, "id">;
          return { id: d.id, ...data } satisfies Hospital;
        });

        // status 는 옵션 필드 — 누락 시 ACTIVE 로 간주하고 in-memory 필터.
        if (input.status) {
          items = items.filter(
            (h) => (h.status ?? "ACTIVE") === input.status,
          );
        }

        if (input.search) {
          const k = input.search.toLowerCase();
          items = items.filter(
            (h) =>
              h.name?.toLowerCase().includes(k) ||
              h.bizRegNo?.includes(input.search ?? ""),
          );
        }

        const hasMore = items.length > input.pageSize;
        const hospitals = hasMore ? items.slice(0, -1) : items;
        const nextCursor = hasMore
          ? hospitals[hospitals.length - 1]?.id
          : undefined;
        return { hospitals, hasMore, nextCursor };
      },
    ),

  /** KPI counts. 컬렉션 전체 스캔 — 운영 초기 (~수천건) 가정. */
  counts: adminProcedure.query(async () => {
    const db = adminDb();
    const snap = await db.collection(COLLECTIONS.hospitals).get();
    const items = snap.docs.map((d) => d.data() as Hospital);

    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();
    const day30Ms = now - 30 * 86400 * 1000;
    const day90Ms = now - 90 * 86400 * 1000;

    const tsToMs = (ts: unknown): number => {
      const t = ts as { seconds?: number; _seconds?: number } | undefined;
      const s = t?.seconds ?? t?._seconds ?? 0;
      return s * 1000;
    };

    const total = items.length;
    const newThisMonth = items.filter(
      (h) => tsToMs(h.createdAt) >= monthStartMs,
    ).length;
    const active30d = items.filter((h) => {
      const last =
        tsToMs(h.kpi?.lastActiveAt) || tsToMs(h.createdAt);
      return last >= day30Ms;
    }).length;
    const churnRisk = items.filter((h) => {
      const last =
        tsToMs(h.kpi?.lastActiveAt) || tsToMs(h.createdAt);
      return last < day90Ms;
    }).length;

    return { total, active30d, newThisMonth, churnRisk };
  }),

  /** 단건 조회. */
  getById: adminProcedure
    .input(z.object({ hospitalId: z.string() }))
    .query(async ({ input }): Promise<Hospital | null> => {
      const snap = await adminDb()
        .collection(COLLECTIONS.hospitals)
        .doc(input.hospitalId)
        .get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<Hospital, "id">;
      return { id: snap.id, ...data };
    }),

  /** 병원 멤버 (서브컬렉션). */
  listMembers: adminProcedure
    .input(z.object({ hospitalId: z.string() }))
    .query(async ({ input }) => {
      const snap = await adminDb()
        .collection(COLLECTIONS.hospitals)
        .doc(input.hospitalId)
        .collection("members")
        .orderBy("joinedAt", "desc")
        .limit(50)
        .get();
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));
    }),

  /** 병원 최근 주문. */
  listOrders: adminProcedure
    .input(
      z.object({
        hospitalId: z.string(),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input }) => {
      try {
        const snap = await adminDb()
          .collection(COLLECTIONS.orders)
          .where("hospitalId", "==", input.hospitalId)
          .orderBy("createdAt", "desc")
          .limit(input.pageSize)
          .get();
        return snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }));
      } catch {
        return [];
      }
    }),

  /** 병원 활성 정기구독. (인덱스 없을 가능성 → catch 후 빈 배열) */
  listSubscriptions: adminProcedure
    .input(z.object({ hospitalId: z.string() }))
    .query(async ({ input }) => {
      try {
        const snap = await adminDb()
          .collection(COLLECTIONS.subscriptions)
          .where("hospitalId", "==", input.hospitalId)
          .where("status", "==", "ACTIVE")
          .limit(20)
          .get();
        return snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }));
      } catch {
        return [];
      }
    }),

  /** 메모 ledger 조회. */
  listMemos: adminProcedure
    .input(z.object({ hospitalId: z.string() }))
    .query(async ({ input }) => {
      const snap = await adminDb()
        .collection(COLLECTIONS.hospitals)
        .doc(input.hospitalId)
        .collection("memos")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));
    }),

  /** 메모 추가. */
  addMemo: adminProcedure
    .input(
      z.object({
        hospitalId: z.string(),
        body: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.hospitals)
        .doc(input.hospitalId);
      const exists = await ref.get();
      if (!exists.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "병원을 찾을 수 없습니다.",
        });
      }
      await ref.collection("memos").add({
        actorId: ctx.uid,
        body: input.body,
        createdAt: FieldValue.serverTimestamp(),
      });
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "HOSPITAL_MEMO_ADDED",
        targetType: "Hospital",
        targetId: input.hospitalId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /** 일시 정지. status=SUSPENDED + 알림 + audit. */
  suspend: adminProcedure
    .input(
      z.object({
        hospitalId: z.string(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.hospitals)
        .doc(input.hospitalId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "병원을 찾을 수 없습니다.",
        });
      }
      const before = snap.data() as Hospital;

      await ref.update({
        status: "SUSPENDED",
        statusReason: input.reason,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.notifications).add({
        targetType: "HOSPITAL",
        targetId: input.hospitalId,
        type: "HOSPITAL_SUSPENDED",
        title: "이용이 일시 정지되었습니다",
        body: input.reason,
        channels: ["KAKAO", "IN_APP"],
        kakaoSent: false,
        emailSent: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "HOSPITAL_SUSPENDED",
        targetType: "Hospital",
        targetId: input.hospitalId,
        before: { status: before.status ?? "ACTIVE" },
        after: { status: "SUSPENDED", reason: input.reason },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true };
    }),

  /** 정지 해제. status=ACTIVE + 알림 + audit. */
  reactivate: adminProcedure
    .input(z.object({ hospitalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.hospitals)
        .doc(input.hospitalId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "병원을 찾을 수 없습니다.",
        });
      }

      await ref.update({
        status: "ACTIVE",
        statusReason: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.notifications).add({
        targetType: "HOSPITAL",
        targetId: input.hospitalId,
        type: "HOSPITAL_REACTIVATED",
        title: "이용 정지가 해제되었습니다",
        body: "다시 정상 이용 가능합니다.",
        channels: ["KAKAO", "IN_APP"],
        kakaoSent: false,
        emailSent: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "HOSPITAL_REACTIVATED",
        targetType: "Hospital",
        targetId: input.hospitalId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  /** 알림톡 발송 — notifications 큐 enqueue. */
  sendAlimtalk: adminProcedure
    .input(
      z.object({
        hospitalId: z.string(),
        template: z.string().min(1).max(60),
        body: z.string().min(1).max(1000),
        title: z.string().min(1).max(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const snap = await db
        .collection(COLLECTIONS.hospitals)
        .doc(input.hospitalId)
        .get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "병원을 찾을 수 없습니다.",
        });
      }

      await db.collection(COLLECTIONS.notifications).add({
        targetType: "HOSPITAL",
        targetId: input.hospitalId,
        type: input.template,
        title: input.title,
        body: input.body,
        channels: ["KAKAO", "IN_APP"],
        kakaoSent: false,
        emailSent: false,
        sentByAdminId: ctx.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "HOSPITAL_ALIMTALK_SENT",
        targetType: "Hospital",
        targetId: input.hospitalId,
        after: { template: input.template, title: input.title },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true };
    }),

  /** 결재 규칙 갱신. */
  updateApprovalRule: adminProcedure
    .input(
      z.object({
        hospitalId: z.string(),
        approvalEnabled: z.boolean(),
        approvalLimit: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.hospitals)
        .doc(input.hospitalId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "병원을 찾을 수 없습니다.",
        });
      }
      const before = snap.data() as Hospital;

      await ref.update({
        approvalEnabled: input.approvalEnabled,
        approvalLimit: input.approvalLimit ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "ADMIN",
        action: "HOSPITAL_APPROVAL_RULE_UPDATED",
        targetType: "Hospital",
        targetId: input.hospitalId,
        before: {
          approvalEnabled: before.approvalEnabled,
          approvalLimit: before.approvalLimit ?? null,
        },
        after: {
          approvalEnabled: input.approvalEnabled,
          approvalLimit: input.approvalLimit ?? null,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),
});
