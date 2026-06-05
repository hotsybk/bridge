// Phase ν-3 작업3 — 병원 결재 워크플로우 설정.
//
// /hospitals/{hospitalId} 의 approvalEnabled / approvalLimit / approvalChain 필드를
// OWNER 가 수정. order.createOrder / prepareOrder 가 이 설정을 읽어 결재 분기.
//
// approvalChain: Array<{ level: number; userId: string }>
//   - level 1 부터 순서대로 결재. 결재자 본인이 isApprover=true 인 멤버에서 선택.
//
// approvalLimit: 결재 필요 최소 금액 (KRW). 주문 finalAmount >= approvalLimit 일 때 결재 필요.

import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { buyerProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS, SUB_COLLECTIONS } from "@/server/firebase/collections";

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

async function ensureOwner(
  db: FirebaseFirestore.Firestore,
  hospitalId: string,
  uid: string,
): Promise<void> {
  const memSnap = await db
    .collection(SUB_COLLECTIONS.hospitalMembers(hospitalId))
    .doc(uid)
    .get();
  const role = (memSnap.exists ? (memSnap.data() as { role?: string }).role : null);
  if (role !== "BUYER_OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "병원 OWNER 만 결재 설정을 변경할 수 있습니다.",
    });
  }
}

export const hospitalSettingsRouter = createTRPCRouter({
  getSettings: buyerProcedure.query(async ({ ctx }) => {
    const { hospitalId } = ensureCtx(ctx);
    const db = adminDb();
    const snap = await db
      .collection(COLLECTIONS.hospitals)
      .doc(hospitalId)
      .get();
    if (!snap.exists)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "병원 정보를 찾을 수 없습니다.",
      });
    const data = snap.data() ?? {};
    return {
      approvalEnabled: Boolean((data as { approvalEnabled?: boolean }).approvalEnabled),
      approvalLimit:
        ((data as { approvalLimit?: number }).approvalLimit as
          | number
          | undefined) ?? null,
      approvalChain:
        ((data as { approvalChain?: Array<{ level: number; userId: string }> })
          .approvalChain ?? []) as Array<{ level: number; userId: string }>,
    };
  }),

  updateSettings: buyerProcedure
    .input(
      z.object({
        approvalEnabled: z.boolean(),
        approvalLimit: z.number().int().nonnegative().optional(),
        approvalChain: z
          .array(
            z.object({
              level: z.number().int().min(1).max(10),
              userId: z.string().min(1),
            }),
          )
          .max(10)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { hospitalId, uid } = ensureCtx(ctx);
      const db = adminDb();
      await ensureOwner(db, hospitalId, uid);

      // 결재자 검증 — 모든 결재자가 isApprover=true 멤버인지 확인
      if (input.approvalChain && input.approvalChain.length > 0) {
        const seenLevels = new Set<number>();
        for (const node of input.approvalChain) {
          if (seenLevels.has(node.level)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "결재 단계가 중복되었습니다.",
            });
          }
          seenLevels.add(node.level);
        }
        const memberIds = input.approvalChain.map((c) => c.userId);
        const memberSnaps = await Promise.all(
          memberIds.map((id) =>
            db
              .collection(SUB_COLLECTIONS.hospitalMembers(hospitalId))
              .doc(id)
              .get(),
          ),
        );
        for (let i = 0; i < memberSnaps.length; i++) {
          const ms = memberSnaps[i];
          if (!ms.exists) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `결재자 ${memberIds[i]} 는 병원 멤버가 아닙니다.`,
            });
          }
          const md = ms.data() as { isApprover?: boolean };
          if (!md.isApprover) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "결재자 권한이 없는 멤버는 결재 체인에 포함할 수 없습니다. 먼저 멤버를 결재자로 지정하세요.",
            });
          }
        }
      }

      const patch: Record<string, unknown> = {
        approvalEnabled: input.approvalEnabled,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (typeof input.approvalLimit === "number") {
        patch.approvalLimit = input.approvalLimit;
      }
      if (input.approvalChain !== undefined) {
        patch.approvalChain = input.approvalChain.sort(
          (a, b) => a.level - b.level,
        );
      }

      await db.collection(COLLECTIONS.hospitals).doc(hospitalId).update(patch);

      try {
        await db.collection(COLLECTIONS.auditLogs).add({
          actorId: uid,
          actorRole: ctx.role ?? "BUYER_OWNER",
          action: "HOSPITAL_APPROVAL_SETTINGS_UPDATED",
          targetType: "Hospital",
          targetId: hospitalId,
          after: {
            approvalEnabled: input.approvalEnabled,
            approvalLimit: input.approvalLimit ?? null,
            approvalChain: input.approvalChain ?? [],
          },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // best-effort
      }
      return { ok: true };
    }),
});
