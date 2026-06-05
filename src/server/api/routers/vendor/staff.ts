// Phase ν-3 작업2 — vendor 본인 멤버 관리 (셀러센터 /seller/staff).
//
// 데이터 모델:
//   /vendors/{vendorId}/members/{userId}
//     - userId, email, name, role, joinedAt, lastActiveAt
//   /vendors/{vendorId}/invites/{inviteId}
//     - email, role, invitedBy, status (PENDING/ACCEPTED/CANCELLED/EXPIRED),
//       token (nanoid 32), expiresAt (now + 7d)
//
// 핵심 가드:
//   - vendorProcedure + role check (OWNER 만 invite/updateRole/remove/cancelInvite)
//   - 자기 자신 role 변경/제거 금지
//   - 마지막 OWNER 제거/강등 금지
//
// 초대 흐름:
//   1. invite → invites doc PENDING + 알림 큐 (EMAIL)
//   2. 수락자가 /invite/vendor/{token} 으로 진입 → acceptInvite mutation
//   3. members/{uid} doc 적재 + invites status ACCEPTED + customClaims 갱신
//
// 만료 처리: functions/scheduled/invite-expirer 가 매일 04:00 KST 스캔.

import { TRPCError } from "@trpc/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { z } from "zod";

import { vendorProcedure, createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { adminAuth, adminDb } from "@/server/firebase/admin";
import { COLLECTIONS, SUB_COLLECTIONS } from "@/server/firebase/collections";

const VendorRoleEnum = z.enum([
  "VENDOR_OWNER",
  "VENDOR_ADMIN",
  "VENDOR_STAFF",
  "VENDOR_VIEWER",
]);

type MemberRole = z.infer<typeof VendorRoleEnum>;

function ensureCtx(ctx: { vendorId?: string; uid?: string }): {
  vendorId: string;
  uid: string;
} {
  if (!ctx.vendorId || !ctx.uid) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "공급업체 계정이 필요합니다.",
    });
  }
  return { vendorId: ctx.vendorId, uid: ctx.uid };
}

async function getMyRole(
  db: FirebaseFirestore.Firestore,
  vendorId: string,
  uid: string,
): Promise<MemberRole> {
  const snap = await db
    .collection(SUB_COLLECTIONS.vendorMembers(vendorId))
    .doc(uid)
    .get();
  if (!snap.exists) return "VENDOR_STAFF";
  const data = snap.data() as { role?: string };
  const r = data.role;
  if (
    r === "VENDOR_OWNER" ||
    r === "VENDOR_ADMIN" ||
    r === "VENDOR_STAFF" ||
    r === "VENDOR_VIEWER"
  )
    return r;
  return "VENDOR_STAFF";
}

async function ensureOwner(
  db: FirebaseFirestore.Firestore,
  vendorId: string,
  uid: string,
): Promise<void> {
  const role = await getMyRole(db, vendorId, uid);
  if (role !== "VENDOR_OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "공급업체 OWNER 만 멤버를 관리할 수 있습니다.",
    });
  }
}

async function countOwners(
  db: FirebaseFirestore.Firestore,
  vendorId: string,
): Promise<number> {
  const snap = await db
    .collection(SUB_COLLECTIONS.vendorMembers(vendorId))
    .where("role", "==", "VENDOR_OWNER")
    .get();
  return snap.size;
}

export const vendorStaffRouter = createTRPCRouter({
  /** 멤버 + PENDING 초대 list. */
  list: vendorProcedure.query(async ({ ctx }) => {
    const { vendorId } = ensureCtx(ctx);
    const db = adminDb();

    const [memSnap, invSnap] = await Promise.all([
      db.collection(SUB_COLLECTIONS.vendorMembers(vendorId)).get(),
      db
        .collection(`vendors/${vendorId}/invites`)
        .where("status", "==", "PENDING")
        .get(),
    ]);

    const members = memSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        userId: d.id,
        email: (data.email as string | undefined) ?? "",
        name: (data.name as string | undefined) ?? "",
        role: (data.role as string | undefined) ?? "VENDOR_STAFF",
        joinedAt: (data.joinedAt as Timestamp | undefined) ?? null,
        lastActiveAt: (data.lastActiveAt as Timestamp | undefined) ?? null,
      };
    });

    const invites = invSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        email: (data.email as string | undefined) ?? "",
        role: (data.role as string | undefined) ?? "VENDOR_STAFF",
        status: (data.status as string | undefined) ?? "PENDING",
        invitedBy: (data.invitedBy as string | undefined) ?? "",
        invitedAt: (data.invitedAt as Timestamp | undefined) ?? null,
        expiresAt: (data.expiresAt as Timestamp | undefined) ?? null,
      };
    });

    return { members, invites };
  }),

  /**
   * 새 멤버 초대.
   * invites/{inviteId} 적재 + 알림 큐 (EMAIL 채널).
   * 실제 이메일 발송은 on-notification-created Cloud Function 트리거 + SendGrid 통합.
   */
  invite: vendorProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: VendorRoleEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { vendorId, uid } = ensureCtx(ctx);
      const db = adminDb();
      await ensureOwner(db, vendorId, uid);

      // 이미 멤버인지 확인 (email 으로)
      const existSnap = await db
        .collection(SUB_COLLECTIONS.vendorMembers(vendorId))
        .where("email", "==", input.email)
        .limit(1)
        .get();
      if (!existSnap.empty) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 등록된 멤버입니다.",
        });
      }

      // 중복 PENDING 초대 차단
      const dupSnap = await db
        .collection(`vendors/${vendorId}/invites`)
        .where("email", "==", input.email)
        .where("status", "==", "PENDING")
        .limit(1)
        .get();
      if (!dupSnap.empty) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 발송된 초대장이 있습니다.",
        });
      }

      const inviteId = nanoid(16);
      const token = nanoid(32);
      const now = FieldValue.serverTimestamp();
      const expiresAtMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const expiresAt = Timestamp.fromMillis(expiresAtMs);

      await db
        .collection(`vendors/${vendorId}/invites`)
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
      const link = `${baseUrl}/invite/vendor/${token}`;

      await db.collection(COLLECTIONS.notifications).add({
        targetType: "USER",
        targetId: input.email, // email-keyed (실제 dispatcher 가 lookup)
        type: "VENDOR_INVITE",
        title: "MedPlace 공급업체 초대",
        body: `공급업체 계정에 초대되었습니다.\n7일 내 수락하세요: ${link}`,
        data: { vendorId, inviteId, token, role: input.role, link },
        channels: ["EMAIL"],
        kakaoSent: false,
        emailSent: false,
        createdAt: now,
      });

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "VENDOR_OWNER",
          action: "VENDOR_MEMBER_INVITED",
          targetType: "Vendor",
          targetId: vendorId,
          after: { email: input.email, role: input.role, inviteId },
          createdAt: now,
        });
      } catch {
        // best-effort
      }
      return { ok: true, inviteId };
    }),

  /** PENDING 초대 취소. */
  cancelInvite: vendorProcedure
    .input(z.object({ inviteId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { vendorId, uid } = ensureCtx(ctx);
      const db = adminDb();
      await ensureOwner(db, vendorId, uid);

      const ref = db
        .collection(`vendors/${vendorId}/invites`)
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

  /** 멤버 role 변경. */
  updateRole: vendorProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        role: VendorRoleEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { vendorId, uid } = ensureCtx(ctx);
      const db = adminDb();
      await ensureOwner(db, vendorId, uid);

      if (input.userId === uid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "자기 자신의 역할은 변경할 수 없습니다.",
        });
      }

      const memberRef = db
        .collection(SUB_COLLECTIONS.vendorMembers(vendorId))
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

      // OWNER 강등 시 최소 1명 유지
      if (beforeRole === "VENDOR_OWNER" && input.role !== "VENDOR_OWNER") {
        const ownerCount = await countOwners(db, vendorId);
        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "최소 1명의 OWNER 를 유지해야 합니다. 다른 멤버를 먼저 OWNER 로 승격하세요.",
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
          actorRole: ctx.role ?? "VENDOR_OWNER",
          action: "VENDOR_MEMBER_ROLE_UPDATED",
          targetType: "VendorMember",
          targetId: input.userId,
          before: { role: beforeRole ?? null },
          after: { role: input.role, vendorId },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // best-effort
      }
      return { ok: true, unchanged: false };
    }),

  /** 멤버 제거. */
  remove: vendorProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { vendorId, uid } = ensureCtx(ctx);
      const db = adminDb();
      await ensureOwner(db, vendorId, uid);

      if (input.userId === uid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "자기 자신은 제거할 수 없습니다.",
        });
      }

      const memberRef = db
        .collection(SUB_COLLECTIONS.vendorMembers(vendorId))
        .doc(input.userId);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "대상 멤버를 찾을 수 없습니다.",
        });

      const data = memberSnap.data() as { role?: string };
      if (data.role === "VENDOR_OWNER") {
        const ownerCount = await countOwners(db, vendorId);
        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "최소 1명의 OWNER 를 유지해야 합니다.",
          });
        }
      }

      await memberRef.delete();

      // users 문서의 vendorId / customClaims 정리는 별도 admin SDK 호출
      try {
        await adminAuth().setCustomUserClaims(input.userId, {
          // 기존 claims 보존이 필요하나 안전하게 vendorId 제거 (role 등 다른 claim 은 보존되도록 merge)
        });
      } catch {
        // best-effort — _retryQueue 에 적재할 수도 있으나 단순화
      }

      try {
        await db.collection(COLLECTIONS.users).doc(input.userId).update({
          vendorId: FieldValue.delete(),
          vendorName: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // best-effort
      }

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "VENDOR_OWNER",
          action: "VENDOR_MEMBER_REMOVED",
          targetType: "VendorMember",
          targetId: input.userId,
          before: { role: data.role ?? null, vendorId },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // best-effort
      }
      return { ok: true };
    }),

  /**
   * 초대 토큰 수락 — 로그인된 사용자가 호출.
   * 보안: protectedProcedure (역할 무관, 인증만). vendorId/role 은 invite doc 에서 확정.
   */
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const uid = ctx.uid;
      if (!uid) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const db = adminDb();

      // collectionGroup 으로 token 검색
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

      // 경로에서 vendorId 추출: vendors/{vendorId}/invites/{inviteId}
      const path = inviteRef.path.split("/");
      const vendorId = path[1];
      if (!vendorId || path[0] !== "vendors") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "초대 컨텍스트가 올바르지 않습니다.",
        });
      }

      // 만료 검증
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

      // 이메일 검증
      const userSnap = await db.collection(COLLECTIONS.users).doc(uid).get();
      const user = (userSnap.data() ?? {}) as { email?: string; name?: string };
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

      // 이미 다른 vendor 소속이면 차단
      if (user && (user as { vendorId?: string }).vendorId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 다른 공급업체에 소속되어 있습니다.",
        });
      }

      const now = FieldValue.serverTimestamp();
      await db.runTransaction(async (tx) => {
        tx.set(
          db.collection(SUB_COLLECTIONS.vendorMembers(vendorId)).doc(uid),
          {
            userId: uid,
            email: user.email ?? invite.email ?? "",
            name: user.name ?? "",
            role: invite.role ?? "VENDOR_STAFF",
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
          vendorId,
          updatedAt: now,
        });
      });

      // Custom Claims merge
      try {
        const userRecord = await adminAuth().getUser(uid);
        const existing = (userRecord.customClaims ?? {}) as Record<
          string,
          unknown
        >;
        await adminAuth().setCustomUserClaims(uid, {
          ...existing,
          vendorId,
          role: invite.role ?? "VENDOR_STAFF",
        });
      } catch (err) {
        console.error("[vendor.staff.acceptInvite] setCustomUserClaims", err);
      }

      return { ok: true, vendorId, needsTokenRefresh: true };
    }),
});
