// Wave L — 운영자 권한 관리 (SUPER_ADMIN 전용).
//
// 보안 핵심:
//  - 모든 procedure 는 superAdminProcedure 가드
//  - 자기 자신 권한 변경 / 비활성화 금지 (lockout 방지)
//  - 마지막 SUPER_ADMIN 강등 / 비활성화 금지 (count > 1 검증)
//  - 모든 액션은 auditLogs 에 강제 기록

import { TRPCError } from "@trpc/server";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { createTRPCRouter, superAdminProcedure } from "@/server/api/trpc";
import {
  adminAuth,
  adminDb,
  deactivateUser,
  reactivateUser,
  setUserRole,
} from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

const StaffRoleEnum = z.enum(["ADMIN", "SUPER_ADMIN"]);

export type StaffRow = {
  uid: string;
  email?: string;
  name?: string;
  role: "ADMIN" | "SUPER_ADMIN";
  status?: "ACTIVE" | "DISABLED";
  statusReason?: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  lastLoginAt?: Timestamp | null;
};

type RawDoc = Record<string, unknown> & {
  createdAt?: { seconds?: number } | null;
  lastLoginAt?: { seconds?: number } | null;
};

function tsSeconds(v: { seconds?: number } | null | undefined): number {
  return v?.seconds ?? 0;
}

export const adminStaffRouter = createTRPCRouter({
  /**
   * 운영자 전체 목록 (ADMIN + SUPER_ADMIN).
   * Firestore 에는 `role` 단일 등가 조건만 지원되므로 두 번 쿼리하여 합산.
   */
  list: superAdminProcedure.query(async (): Promise<StaffRow[]> => {
    const db = adminDb();
    const [adminSnap, superSnap] = await Promise.all([
      db.collection(COLLECTIONS.users).where("role", "==", "ADMIN").get(),
      db.collection(COLLECTIONS.users).where("role", "==", "SUPER_ADMIN").get(),
    ]);
    const all: StaffRow[] = [...adminSnap.docs, ...superSnap.docs].map((d) => {
      const data = d.data() as RawDoc;
      return { uid: d.id, ...(data as object) } as StaffRow;
    });
    return all.sort((a, b) => {
      const at = tsSeconds(a.lastLoginAt) || tsSeconds(a.createdAt);
      const bt = tsSeconds(b.lastLoginAt) || tsSeconds(b.createdAt);
      return bt - at;
    });
  }),

  /**
   * KPI 카운트 — 총 운영자 / SUPER_ADMIN / 일반 ADMIN / 지난 7일 로그인.
   */
  counts: superAdminProcedure.query(async () => {
    const db = adminDb();
    const [adminSnap, superSnap] = await Promise.all([
      db.collection(COLLECTIONS.users).where("role", "==", "ADMIN").get(),
      db.collection(COLLECTIONS.users).where("role", "==", "SUPER_ADMIN").get(),
    ]);
    const cutoff = Math.floor((Date.now() - 7 * 86400 * 1000) / 1000);
    const all = [...adminSnap.docs, ...superSnap.docs];
    const recentLogin = all.filter((d) => {
      const data = d.data() as RawDoc;
      const last = tsSeconds(data.lastLoginAt);
      return last >= cutoff;
    }).length;
    return {
      total: adminSnap.size + superSnap.size,
      superAdmin: superSnap.size,
      admin: adminSnap.size,
      recentLogin,
    };
  }),

  /**
   * 운영자 초대.
   * 신규 이메일이면 Firebase Auth 계정 생성 + 임시 비밀번호 발급, 기존 사용자는 role 만 승격.
   * 알림은 notifications 큐에 EMAIL 채널로 적재 (실제 전송은 on-notification-created trigger).
   */
  invite: superAdminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1).max(60),
        role: StaffRoleEnum,
        message: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const auth = adminAuth();
      const db = adminDb();

      let userRecord;
      let isNew = false;
      try {
        userRecord = await auth.getUserByEmail(input.email);
      } catch {
        // 신규 사용자 — 임시 비밀번호 부여, 사용자가 첫 로그인 시 변경 권장.
        const tempPassword = `Temp${Date.now()}${Math.random().toString(36).slice(2, 8)}!`;
        userRecord = await auth.createUser({
          email: input.email,
          displayName: input.name,
          password: tempPassword,
          emailVerified: false,
        });
        isNew = true;
      }

      // Custom Claims + users 문서 동기화
      await setUserRole(userRecord.uid, input.role);

      const now = FieldValue.serverTimestamp();
      await db
        .collection(COLLECTIONS.users)
        .doc(userRecord.uid)
        .set(
          {
            uid: userRecord.uid,
            email: input.email,
            name: input.name,
            role: input.role,
            status: "ACTIVE",
            emailVerified: userRecord.emailVerified ?? false,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true },
        );

      // 초대 알림 큐
      await db.collection(COLLECTIONS.notifications).add({
        targetType: "USER",
        targetId: userRecord.uid,
        type: "STAFF_INVITED",
        title: "MedPlace 운영자로 초대되었습니다",
        body: `역할: ${input.role}\n\n${input.message ?? "운영 콘솔에 로그인하여 권한을 확인해주세요."}`,
        channels: ["EMAIL"],
        kakaoSent: false,
        emailSent: false,
        sentByAdminId: ctx.uid,
        createdAt: now,
      });

      // 감사 로그
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "STAFF_INVITED",
        targetType: "User",
        targetId: userRecord.uid,
        after: {
          email: input.email,
          name: input.name,
          role: input.role,
          isNew,
        },
        createdAt: now,
      });

      return { uid: userRecord.uid, isNew };
    }),

  /**
   * 권한 변경 (ADMIN ↔ SUPER_ADMIN).
   * 가드:
   *  - 자기 자신 변경 차단
   *  - 마지막 SUPER_ADMIN 강등 차단
   */
  updateRole: superAdminProcedure
    .input(
      z.object({
        uid: z.string(),
        newRole: StaffRoleEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();

      if (input.uid === ctx.uid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "자기 자신의 권한은 변경할 수 없습니다. 다른 SUPER_ADMIN 에게 요청하세요.",
        });
      }

      const userRef = db.collection(COLLECTIONS.users).doc(input.uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists)
        throw new TRPCError({ code: "NOT_FOUND", message: "대상 사용자를 찾을 수 없습니다." });

      const before = userSnap.data() as { role?: string };
      const beforeRole = before.role;

      if (beforeRole === input.newRole) {
        return { ok: true, requiresLogout: false, unchanged: true };
      }

      // SUPER_ADMIN → ADMIN 강등 시 최소 1명 유지 검증
      if (beforeRole === "SUPER_ADMIN" && input.newRole === "ADMIN") {
        const superSnap = await db
          .collection(COLLECTIONS.users)
          .where("role", "==", "SUPER_ADMIN")
          .get();
        if (superSnap.size <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "최소 1명의 SUPER_ADMIN 을 유지해야 합니다. 다른 SUPER_ADMIN 을 먼저 추가하세요.",
          });
        }
      }

      await setUserRole(input.uid, input.newRole);

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "STAFF_ROLE_UPDATED",
        targetType: "User",
        targetId: input.uid,
        before: { role: beforeRole },
        after: { role: input.newRole },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, requiresLogout: true, unchanged: false };
    }),

  /**
   * 비활성화.
   * 가드:
   *  - 자기 자신 비활성화 차단
   *  - 마지막 활성 SUPER_ADMIN 비활성화 차단
   */
  deactivate: superAdminProcedure
    .input(
      z.object({
        uid: z.string(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();

      if (input.uid === ctx.uid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "자기 자신을 비활성화할 수 없습니다.",
        });
      }

      const userRef = db.collection(COLLECTIONS.users).doc(input.uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists)
        throw new TRPCError({ code: "NOT_FOUND", message: "대상 사용자를 찾을 수 없습니다." });
      const before = userSnap.data() as { role?: string; status?: string };

      if (before.role === "SUPER_ADMIN") {
        // 활성 SUPER_ADMIN 카운트 (Firestore "!=" 쿼리는 status 필드가 없는 doc 는 제외하므로
        // 두 쿼리로 안전 합산).
        const allSuperSnap = await db
          .collection(COLLECTIONS.users)
          .where("role", "==", "SUPER_ADMIN")
          .get();
        const activeSuper = allSuperSnap.docs.filter((d) => {
          const s = (d.data() as { status?: string }).status;
          return s !== "DISABLED";
        }).length;
        if (activeSuper <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "최소 1명의 SUPER_ADMIN 을 활성 유지해야 합니다.",
          });
        }
      }

      await deactivateUser(input.uid, input.reason);

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "STAFF_DEACTIVATED",
        targetType: "User",
        targetId: input.uid,
        before: { status: before.status ?? "ACTIVE", role: before.role },
        after: { status: "DISABLED", reason: input.reason },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true };
    }),

  /**
   * 재활성화.
   */
  reactivate: superAdminProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const userSnap = await db.collection(COLLECTIONS.users).doc(input.uid).get();
      if (!userSnap.exists)
        throw new TRPCError({ code: "NOT_FOUND", message: "대상 사용자를 찾을 수 없습니다." });
      const before = userSnap.data() as { status?: string; role?: string };

      await reactivateUser(input.uid);

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "SUPER_ADMIN",
        action: "STAFF_REACTIVATED",
        targetType: "User",
        targetId: input.uid,
        before: { status: before.status ?? "DISABLED", role: before.role },
        after: { status: "ACTIVE" },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true };
    }),

  /**
   * 운영자별 최근 활동 (감사 로그) — actorId 기준.
   */
  listActivity: superAdminProcedure
    .input(
      z.object({
        uid: z.string(),
        pageSize: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const snap = await adminDb()
        .collection(COLLECTIONS.auditLogs)
        .where("actorId", "==", input.uid)
        .orderBy("createdAt", "desc")
        .limit(input.pageSize)
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));
    }),
});
