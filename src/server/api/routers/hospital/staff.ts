// Phase ν-3 작업3 — 병원 본인 멤버 관리 (/account/team).
//
// 데이터 모델:
//   /hospitals/{hospitalId}/members/{userId}
//     - userId, email, name, role, joinedAt, lastActiveAt
//     - isApprover: 결재 가능 여부 (boolean)
//     - approvalLimit: 결재 가능 금액 상한 (KRW, optional)
//   /hospitals/{hospitalId}/invites/{inviteId}
//     - email, role, invitedBy, status, token, expiresAt
//
// 가드: BUYER_OWNER 만 invite/updateRole/remove/cancelInvite/setApprover.

import { TRPCError } from "@trpc/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { z } from "zod";

import {
  buyerProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { adminAuth, adminDb } from "@/server/firebase/admin";
import { COLLECTIONS, SUB_COLLECTIONS } from "@/server/firebase/collections";

const BuyerRoleEnum = z.enum([
  "BUYER_OWNER",
  "BUYER_STAFF",
  "BUYER_VIEWER",
]);

type MemberRole = z.infer<typeof BuyerRoleEnum>;

function ensureCtx(ctx: { hospitalId?: string; uid?: string }): {
  hospitalId: string;
  uid: string;
} {
  if (!ctx.hospitalId || !ctx.uid) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "병원 계정이 필요합니다.",
    });
  }
  return { hospitalId: ctx.hospitalId, uid: ctx.uid };
}

async function getMyRole(
  db: FirebaseFirestore.Firestore,
  hospitalId: string,
  uid: string,
): Promise<MemberRole> {
  const snap = await db
    .collection(SUB_COLLECTIONS.hospitalMembers(hospitalId))
    .doc(uid)
    .get();
  if (!snap.exists) return "BUYER_STAFF";
  const data = snap.data() as { role?: string };
  const r = data.role;
  if (r === "BUYER_OWNER" || r === "BUYER_STAFF" || r === "BUYER_VIEWER")
    return r;
  return "BUYER_STAFF";
}

async function ensureOwner(
  db: FirebaseFirestore.Firestore,
  hospitalId: string,
  uid: string,
): Promise<void> {
  const role = await getMyRole(db, hospitalId, uid);
  if (role !== "BUYER_OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "병원 OWNER 만 멤버를 관리할 수 있습니다.",
    });
  }
}

async function countOwners(
  db: FirebaseFirestore.Firestore,
  hospitalId: string,
): Promise<number> {
  const snap = await db
    .collection(SUB_COLLECTIONS.hospitalMembers(hospitalId))
    .where("role", "==", "BUYER_OWNER")
    .get();
  return snap.size;
}

export const hospitalStaffRouter = createTRPCRouter({
  list: buyerProcedure.query(async ({ ctx }) => {
    const { hospitalId } = ensureCtx(ctx);
    const db = adminDb();
    const [memSnap, invSnap] = await Promise.all([
      db.collection(SUB_COLLECTIONS.hospitalMembers(hospitalId)).get(),
      db
        .collection(`hospitals/${hospitalId}/invites`)
        .where("status", "==", "PENDING")
        .get(),
    ]);
    const members = memSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        userId: d.id,
        email: (data.email as string | undefined) ?? "",
        name: (data.name as string | undefined) ?? "",
        role: (data.role as string | undefined) ?? "BUYER_STAFF",
        joinedAt: (data.joinedAt as Timestamp | undefined) ?? null,
        lastActiveAt: (data.lastActiveAt as Timestamp | undefined) ?? null,
        isApprover: Boolean((data as { isApprover?: boolean }).isApprover),
        approvalLimit:
          ((data as { approvalLimit?: number }).approvalLimit as
            | number
            | undefined) ?? null,
      };
    });
    const invites = invSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        email: (data.email as string | undefined) ?? "",
        role: (data.role as string | undefined) ?? "BUYER_STAFF",
        status: (data.status as string | undefined) ?? "PENDING",
        invitedBy: (data.invitedBy as string | undefined) ?? "",
        invitedAt: (data.invitedAt as Timestamp | undefined) ?? null,
        expiresAt: (data.expiresAt as Timestamp | undefined) ?? null,
      };
    });
    return { members, invites };
  }),

  invite: buyerProcedure
    .input(z.object({ email: z.string().email(), role: BuyerRoleEnum }))
    .mutation(async ({ ctx, input }) => {
      const { hospitalId, uid } = ensureCtx(ctx);
      const db = adminDb();
      await ensureOwner(db, hospitalId, uid);

      const existSnap = await db
        .collection(SUB_COLLECTIONS.hospitalMembers(hospitalId))
        .where("email", "==", input.email)
        .limit(1)
        .get();
      if (!existSnap.empty)
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 등록된 멤버입니다.",
        });

      const dupSnap = await db
        .collection(`hospitals/${hospitalId}/invites`)
        .where("email", "==", input.email)
        .where("status", "==", "PENDING")
        .limit(1)
        .get();
      if (!dupSnap.empty)
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 발송된 초대장이 있습니다.",
        });

      const inviteId = nanoid(16);
      const token = nanoid(32);
      const now = FieldValue.serverTimestamp();
      const expiresAt = Timestamp.fromMillis(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      );

      await db
        .collection(`hospitals/${hospitalId}/invites`)
        .doc(inviteId)
        .set({
          id: inviteId,
          email: input.email,
          role: input.role,
          invitedBy: uid,
          invitedAt: now,
          expiresAt,
          status: "PENDING",
          token,
        });

      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "https://medplace.kr";
      const link = `${baseUrl}/invite/hospital/${token}`;

      await db.collection(COLLECTIONS.notifications).add({
        targetType: "USER",
        targetId: input.email,
        type: "HOSPITAL_INVITE",
        title: "MedPlace 병원 멤버 초대",
        body: `병원 계정에 초대되었습니다.\n7일 내 수락하세요: ${link}`,
        data: { hospitalId, inviteId, token, role: input.role, link },
        channels: ["EMAIL"],
        kakaoSent: false,
        emailSent: false,
        createdAt: now,
      });

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "HOSPITAL_MEMBER_INVITED",
          targetType: "Hospital",
          targetId: hospitalId,
          after: { email: input.email, role: input.role, inviteId },
          createdAt: now,
        });
      } catch {
        // best-effort
      }
      return { ok: true, inviteId };
    }),

  cancelInvite: buyerProcedure
    .input(z.object({ inviteId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { hospitalId, uid } = ensureCtx(ctx);
      const db = adminDb();
      await ensureOwner(db, hospitalId, uid);
      const ref = db
        .collection(`hospitals/${hospitalId}/invites`)
        .doc(input.inviteId);
      const snap = await ref.get();
      if (!snap.exists)
        throw new TRPCError({ code: "NOT_FOUND", message: "초대를 찾을 수 없습니다." });
      const data = snap.data() as { status?: string };
      if (data.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 처리된 초대입니다.",
        });
      }
      await ref.update({
        status: "CANCELLED",
        cancelledAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }),

  updateRole: buyerProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        role: BuyerRoleEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { hospitalId, uid } = ensureCtx(ctx);
      const db = adminDb();
      await ensureOwner(db, hospitalId, uid);
      if (input.userId === uid)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "자기 자신의 역할은 변경할 수 없습니다.",
        });

      const memberRef = db
        .collection(SUB_COLLECTIONS.hospitalMembers(hospitalId))
        .doc(input.userId);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "대상 멤버를 찾을 수 없습니다.",
        });
      const before = memberSnap.data() as { role?: string };
      const beforeRole = before.role;
      if (beforeRole === input.role) return { ok: true, unchanged: true };

      if (beforeRole === "BUYER_OWNER" && input.role !== "BUYER_OWNER") {
        const ownerCount = await countOwners(db, hospitalId);
        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "최소 1명의 OWNER 를 유지해야 합니다.",
          });
        }
      }

      await memberRef.update({
        role: input.role,
        updatedAt: FieldValue.serverTimestamp(),
      });

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "HOSPITAL_MEMBER_ROLE_UPDATED",
          targetType: "HospitalMember",
          targetId: input.userId,
          before: { role: beforeRole ?? null },
          after: { role: input.role, hospitalId },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // best-effort
      }
      return { ok: true, unchanged: false };
    }),

  remove: buyerProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { hospitalId, uid } = ensureCtx(ctx);
      const db = adminDb();
      await ensureOwner(db, hospitalId, uid);
      if (input.userId === uid)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "자기 자신은 제거할 수 없습니다.",
        });
      const memberRef = db
        .collection(SUB_COLLECTIONS.hospitalMembers(hospitalId))
        .doc(input.userId);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "대상 멤버를 찾을 수 없습니다.",
        });
      const data = memberSnap.data() as { role?: string };
      if (data.role === "BUYER_OWNER") {
        const ownerCount = await countOwners(db, hospitalId);
        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "최소 1명의 OWNER 를 유지해야 합니다.",
          });
        }
      }
      await memberRef.delete();

      try {
        await db.collection(COLLECTIONS.users).doc(input.userId).update({
          hospitalId: FieldValue.delete(),
          hospitalName: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // best-effort
      }

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "HOSPITAL_MEMBER_REMOVED",
          targetType: "HospitalMember",
          targetId: input.userId,
          before: { role: data.role ?? null, hospitalId },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // best-effort
      }
      return { ok: true };
    }),

  /** 결재자 지정/해제. OWNER 만. */
  setApprover: buyerProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        isApprover: z.boolean(),
        approvalLimit: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { hospitalId, uid } = ensureCtx(ctx);
      const db = adminDb();
      await ensureOwner(db, hospitalId, uid);

      const memberRef = db
        .collection(SUB_COLLECTIONS.hospitalMembers(hospitalId))
        .doc(input.userId);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "대상 멤버를 찾을 수 없습니다.",
        });

      const patch: Record<string, unknown> = {
        isApprover: input.isApprover,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (input.isApprover) {
        if (typeof input.approvalLimit === "number") {
          patch.approvalLimit = input.approvalLimit;
        }
      } else {
        patch.approvalLimit = FieldValue.delete();
      }

      await memberRef.update(patch);

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "HOSPITAL_APPROVER_UPDATED",
          targetType: "HospitalMember",
          targetId: input.userId,
          after: {
            hospitalId,
            isApprover: input.isApprover,
            approvalLimit: input.approvalLimit ?? null,
          },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // best-effort
      }
      return { ok: true };
    }),

  /** 초대 토큰 수락 — 로그인된 사용자가 호출. */
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const uid = ctx.uid;
      if (!uid) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = adminDb();

      const snap = await db
        .collectionGroup("invites")
        .where("token", "==", input.token)
        .where("status", "==", "PENDING")
        .limit(1)
        .get();
      if (snap.empty) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "유효하지 않거나 만료된 초대장입니다.",
        });
      }
      const inviteDoc = snap.docs[0];
      const inviteRef = inviteDoc.ref;
      const invite = inviteDoc.data() as {
        email?: string;
        role?: string;
        expiresAt?: Timestamp;
      };

      const path = inviteRef.path.split("/");
      const hospitalId = path[1];
      if (!hospitalId || path[0] !== "hospitals") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "초대 컨텍스트가 올바르지 않습니다.",
        });
      }

      if (
        invite.expiresAt &&
        invite.expiresAt.toMillis &&
        invite.expiresAt.toMillis() < Date.now()
      ) {
        await inviteRef.update({ status: "EXPIRED" });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "만료된 초대장입니다.",
        });
      }

      const userSnap = await db.collection(COLLECTIONS.users).doc(uid).get();
      const user = (userSnap.data() ?? {}) as {
        email?: string;
        name?: string;
        hospitalId?: string;
      };
      if (
        invite.email &&
        user.email &&
        invite.email.toLowerCase() !== user.email.toLowerCase()
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "초대받은 이메일과 로그인 이메일이 일치하지 않습니다.",
        });
      }
      if (user.hospitalId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 다른 병원에 소속되어 있습니다.",
        });
      }

      const now = FieldValue.serverTimestamp();
      await db.runTransaction(async (tx) => {
        tx.set(
          db.collection(SUB_COLLECTIONS.hospitalMembers(hospitalId)).doc(uid),
          {
            userId: uid,
            email: user.email ?? invite.email ?? "",
            name: user.name ?? "",
            role: invite.role ?? "BUYER_STAFF",
            joinedAt: now,
            invitedBy: (invite as { invitedBy?: string }).invitedBy ?? null,
          },
        );
        tx.update(inviteRef, {
          status: "ACCEPTED",
          acceptedAt: now,
          acceptedBy: uid,
        });
        tx.update(db.collection(COLLECTIONS.users).doc(uid), {
          hospitalId,
          updatedAt: now,
        });
      });

      try {
        const userRecord = await adminAuth().getUser(uid);
        const existing = (userRecord.customClaims ?? {}) as Record<
          string,
          unknown
        >;
        await adminAuth().setCustomUserClaims(uid, {
          ...existing,
          hospitalId,
          role: invite.role ?? "BUYER_STAFF",
        });
      } catch (err) {
        console.error("[hospital.staff.acceptInvite] setCustomUserClaims", err);
      }

      return { ok: true, hospitalId, needsTokenRefresh: true };
    }),
});
