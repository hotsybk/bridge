import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { z } from "zod";

import { buyerProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { SUB_COLLECTIONS } from "@/server/firebase/collections";

/**
 * 배송지 관리 — /account/addresses.
 * hospitals/{hid}/addresses/{addrId} 서브컬렉션에 영속.
 * 기본 배송지(isDefault)는 병원당 1개만 유지 (트랜잭션으로 보장).
 */

const MAX_ADDRESSES = 10;

const addressInput = z.object({
  label: z.string().min(1, "라벨을 입력해주세요").max(40),
  recipient: z.string().min(1, "수령인을 입력해주세요").max(40),
  phone: z.string().min(1, "연락처를 입력해주세요").max(30),
  zipcode: z.string().min(1, "우편번호를 입력해주세요").max(10),
  address: z.string().min(1, "주소를 입력해주세요").max(200),
  detail: z.string().max(100).optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

function requireHospital(hospitalId?: string): string {
  if (!hospitalId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "병원 계정이 필요합니다.",
    });
  }
  return hospitalId;
}

export const hospitalAddressesRouter = createTRPCRouter({
  list: buyerProcedure.query(async ({ ctx }) => {
    if (!ctx.hospitalId) return [];
    const snap = await adminDb()
      .collection(SUB_COLLECTIONS.hospitalAddresses(ctx.hospitalId))
      .orderBy("createdAt", "asc")
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        label: (data.label as string) ?? "",
        recipient: (data.recipient as string) ?? "",
        phone: (data.phone as string) ?? "",
        zipcode: (data.zipcode as string) ?? "",
        address: (data.address as string) ?? "",
        detail: (data.detail as string) ?? "",
        isDefault: Boolean(data.isDefault),
      };
    });
  }),

  create: buyerProcedure
    .input(addressInput)
    .mutation(async ({ ctx, input }) => {
      const hid = requireHospital(ctx.hospitalId);
      const db = adminDb();
      const col = db.collection(SUB_COLLECTIONS.hospitalAddresses(hid));

      const countSnap = await col.count().get();
      const count = countSnap.data().count;
      if (count >= MAX_ADDRESSES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `배송지는 최대 ${MAX_ADDRESSES}개까지 등록할 수 있습니다.`,
        });
      }

      const ref = col.doc(nanoid(12));
      const makeDefault = input.isDefault || count === 0; // 첫 주소는 자동 기본

      await db.runTransaction(async (tx) => {
        if (makeDefault) {
          const existing = await tx.get(col.where("isDefault", "==", true));
          existing.forEach((d) => tx.update(d.ref, { isDefault: false }));
        }
        tx.set(ref, {
          label: input.label,
          recipient: input.recipient,
          phone: input.phone,
          zipcode: input.zipcode,
          address: input.address,
          detail: input.detail ?? "",
          isDefault: makeDefault,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return { id: ref.id };
    }),

  update: buyerProcedure
    .input(addressInput.extend({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const hid = requireHospital(ctx.hospitalId);
      const db = adminDb();
      const col = db.collection(SUB_COLLECTIONS.hospitalAddresses(hid));
      const ref = col.doc(input.id);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
          throw new TRPCError({ code: "NOT_FOUND", message: "배송지를 찾을 수 없습니다." });
        }
        if (input.isDefault) {
          const existing = await tx.get(
            col.where("isDefault", "==", true),
          );
          existing.forEach((d) => {
            if (d.id !== input.id) tx.update(d.ref, { isDefault: false });
          });
        }
        tx.update(ref, {
          label: input.label,
          recipient: input.recipient,
          phone: input.phone,
          zipcode: input.zipcode,
          address: input.address,
          detail: input.detail ?? "",
          ...(input.isDefault ? { isDefault: true } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return { ok: true };
    }),

  setDefault: buyerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const hid = requireHospital(ctx.hospitalId);
      const db = adminDb();
      const col = db.collection(SUB_COLLECTIONS.hospitalAddresses(hid));
      const ref = col.doc(input.id);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
          throw new TRPCError({ code: "NOT_FOUND", message: "배송지를 찾을 수 없습니다." });
        }
        const existing = await tx.get(col.where("isDefault", "==", true));
        existing.forEach((d) => tx.update(d.ref, { isDefault: false }));
        tx.update(ref, { isDefault: true, updatedAt: FieldValue.serverTimestamp() });
      });

      return { ok: true };
    }),

  remove: buyerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const hid = requireHospital(ctx.hospitalId);
      const db = adminDb();
      const ref = db
        .collection(SUB_COLLECTIONS.hospitalAddresses(hid))
        .doc(input.id);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "배송지를 찾을 수 없습니다." });
      }
      if (Boolean(snap.data()?.isDefault)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "기본 배송지는 삭제할 수 없습니다. 다른 배송지를 기본으로 지정한 뒤 삭제해주세요.",
        });
      }
      await ref.delete();
      return { ok: true };
    }),
});
