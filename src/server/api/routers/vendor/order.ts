// Wave P2 — vendor 본인 주문(SubOrder) 처리 tRPC router.
//
// admin/order.ts (운영자 주문 감시) 와 분리. vendor 가 본인이 받은 SubOrder 만
// 조회 + 상태 전이 (ACCEPTED → PACKING → SHIPPED → DELIVERED) 처리.
//
// Endpoints:
//   - list({status?, search?, pageSize, cursor}) — 본인 SubOrder 목록 (collectionGroup)
//   - counts()                                   — KPI 카운터 (ACCEPTED/PACKING/SHIPPED/DELIVERED + 오늘/총합)
//   - getById({orderId, subOrderId})             — 단건 + items + orderInfo
//   - acceptOrder({orderId, subOrderId})         — ACCEPTED → PACKING
//   - ship({...trackingNo,lotNo,expiry})         — PACKING → SHIPPED (운송장·LOT·유통기한)
//   - markDelivered({orderId, subOrderId})       — SHIPPED → DELIVERED
//   - cancel({orderId, subOrderId, reason})      — * → CANCELLED + hospital 알림
//
// 보안:
//   - vendorProcedure (role check + ctx.vendorId 필요)
//   - 모든 mutation 은 SubOrder.vendorId === ctx.vendorId 검증
//   - 발송 시 onSubOrderShipped trigger 가 hospital 알림 + _udiReportQueue 처리 (Wave D 기존)

import { TRPCError } from "@trpc/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { vendorProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";
import type { SubOrder, SubOrderItem } from "@/lib/types";

const SubOrderStatusEnum = z.enum([
  "ACCEPTED",
  "PACKING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
]);

// Phase γ-2 — LOT 입력 스키마. 의료기기 등급 2+ 상품 발송 시 필수.
const LotInputSchema = z.object({
  itemId: z.string().min(1),
  lotNo: z.string().min(1).max(60),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식"),
  manufactureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식")
    .optional(),
});

const MEDICAL_DEVICE_CLASSES = new Set(["CLASS_2", "CLASS_3", "CLASS_4"]);

/**
 * 의료기기 등급 2+ 상품을 포함한 SubOrder 의 LOT/유통기한 검증 헬퍼.
 *
 * - itemsSnap: subOrder.items 서브컬렉션
 * - lots: 사용자 입력 (또는 undefined)
 *
 * throws TRPCError(BAD_REQUEST) — 의료기기 포함인데 LOT 누락 / 유통기한 과거
 * returns: 없음 (검증만, 실 update 는 호출자가 수행)
 */
async function validateMedicalDeviceLots(
  db: FirebaseFirestore.Firestore,
  itemsSnap: FirebaseFirestore.QuerySnapshot,
  lots: z.infer<typeof LotInputSchema>[] | undefined,
): Promise<void> {
  // 1) 각 item 의 deviceClass 조회 (in-memory)
  const medicalItems: Array<{
    itemId: string;
    productName: string;
  }> = [];
  for (const itemDoc of itemsSnap.docs) {
    const item = itemDoc.data() as {
      productId?: string;
      productName?: string;
    };
    if (!item.productId) continue;
    const productSnap = await db
      .collection(COLLECTIONS.products)
      .doc(item.productId)
      .get();
    if (!productSnap.exists) continue;
    const product = productSnap.data() as { deviceClass?: string };
    if (product.deviceClass && MEDICAL_DEVICE_CLASSES.has(product.deviceClass)) {
      medicalItems.push({
        itemId: itemDoc.id,
        productName: item.productName ?? "상품",
      });
    }
  }

  if (medicalItems.length === 0) return; // 비의료기기 only — 검증 불요

  if (!lots || lots.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "의료기기 (등급 2 이상) 상품은 LOT 번호와 유통기한이 필수입니다.",
    });
  }

  const itemIdsWithLot = new Set(lots.map((l) => l.itemId));
  for (const m of medicalItems) {
    if (!itemIdsWithLot.has(m.itemId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${m.productName} 의 LOT 정보가 누락되었습니다.`,
      });
    }
  }

  // 유통기한 미래 검증
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const lot of lots) {
    const expiry = new Date(lot.expiryDate);
    if (Number.isNaN(expiry.getTime()) || expiry < today) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "유통기한이 지난 LOT 는 사용할 수 없습니다.",
      });
    }
  }
}

type SubOrderRow = SubOrder & {
  orderId: string;
};

function tsToMs(ts: unknown): number {
  if (!ts || typeof ts !== "object") return 0;
  const w1 = ts as { toMillis?: () => number; toDate?: () => Date };
  if (typeof w1.toMillis === "function") {
    try {
      return w1.toMillis();
    } catch {
      /* fallthrough */
    }
  }
  if (typeof w1.toDate === "function") {
    try {
      return w1.toDate().getTime();
    } catch {
      /* fallthrough */
    }
  }
  const w2 = ts as { seconds?: number; _seconds?: number };
  const sec = w2.seconds ?? w2._seconds;
  if (typeof sec === "number") return sec * 1000;
  return 0;
}

export const vendorOrderRouter = createTRPCRouter({
  /**
   * 본인 SubOrder list.
   *
   * collectionGroup("subOrders") + where(vendorId == userVendor) + orderBy(createdAt desc).
   * status 필터·search 는 in-memory.
   */
  list: vendorProcedure
    .input(
      z.object({
        status: SubOrderStatusEnum.optional(),
        search: z.string().optional(),
        pageSize: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(
      async ({
        ctx,
        input,
      }): Promise<{
        subOrders: SubOrderRow[];
        hasMore: boolean;
        nextCursor?: string;
      }> => {
        const db = adminDb();
        const vendorId = ctx.vendorId;
        if (!vendorId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "vendor 연결이 필요합니다.",
          });
        }

        let q: FirebaseFirestore.Query = db
          .collectionGroup("subOrders")
          .where("vendorId", "==", vendorId);
        if (input.status) q = q.where("status", "==", input.status);
        q = q.orderBy("createdAt", "desc").limit(input.pageSize + 1);

        try {
          const snap = await q.get();
          let items: SubOrderRow[] = snap.docs.map((d) => {
            const data = d.data() as Omit<SubOrder, "id">;
            return {
              ...data,
              id: d.id,
              // orderId 는 parent ref 우선 (denormalize 된 필드가 누락 가능)
              orderId: d.ref.parent.parent?.id ?? data.orderId ?? "",
            } as SubOrderRow;
          });

          if (input.search) {
            const k = input.search.toLowerCase();
            items = items.filter(
              (i) =>
                i.orderId.toLowerCase().includes(k) ||
                (i.orderNo ?? "").toLowerCase().includes(k) ||
                (i.subOrderNo ?? "").toLowerCase().includes(k) ||
                (i.hospitalName ?? "").toLowerCase().includes(k),
            );
          }

          const hasMore = items.length > input.pageSize;
          const trimmed = hasMore ? items.slice(0, -1) : items;
          const nextCursor = hasMore
            ? trimmed[trimmed.length - 1]?.id
            : undefined;
          return { subOrders: trimmed, hasMore, nextCursor };
        } catch {
          // composite index 부재 등 — UI 가 fallback 처리하도록 빈 결과 반환
          return { subOrders: [], hasMore: false };
        }
      },
    ),

  /** KPI counts — ACCEPTED·PACKING·SHIPPED·DELIVERED + 오늘 신규 + 총 매출. */
  counts: vendorProcedure.query(async ({ ctx }) => {
    const db = adminDb();
    const vendorId = ctx.vendorId;
    if (!vendorId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "vendor 연결이 필요합니다.",
      });
    }

    try {
      const snap = await db
        .collectionGroup("subOrders")
        .where("vendorId", "==", vendorId)
        .get();
      const items = snap.docs.map((d) => d.data() as SubOrder);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();

      return {
        accepted: items.filter((i) => i.status === "ACCEPTED").length,
        packing: items.filter((i) => i.status === "PACKING").length,
        shipped: items.filter((i) => i.status === "SHIPPED").length,
        delivered: items.filter((i) => i.status === "DELIVERED").length,
        cancelled: items.filter((i) => i.status === "CANCELLED").length,
        todayCount: items.filter((i) => tsToMs(i.createdAt) >= todayMs).length,
        totalAmount: items.reduce((s, i) => s + (i.total ?? 0), 0),
      };
    } catch {
      return {
        accepted: 0,
        packing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        todayCount: 0,
        totalAmount: 0,
      };
    }
  }),

  /** 단건 + items 서브컬렉션 + parent order info. */
  getById: vendorProcedure
    .input(z.object({ orderId: z.string(), subOrderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .collection("subOrders")
        .doc(input.subOrderId);
      const snap = await ref.get();
      if (!snap.exists) return null;
      const data = snap.data() as Omit<SubOrder, "id">;
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인 주문만 조회할 수 있습니다.",
        });
      }

      const orderSnap = await db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .get();
      const order = orderSnap.data() as
        | {
            orderNo?: string;
            createdAt?: unknown;
            hospitalName?: string;
            shippingAddress?: unknown;
            buyerNote?: string;
          }
        | undefined;

      const itemsSnap = await ref.collection("items").get();
      const items = itemsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SubOrderItem, "id">),
      })) as SubOrderItem[];

      return {
        ...data,
        id: snap.id,
        orderId: input.orderId,
        items,
        orderInfo: {
          orderNo: order?.orderNo ?? null,
          orderedAt: order?.createdAt ?? null,
          hospitalName: order?.hospitalName ?? data.hospitalName ?? null,
          shippingAddress: order?.shippingAddress ?? null,
          buyerNote: order?.buyerNote ?? null,
        },
      };
    }),

  /** 출고 준비 (ACCEPTED → PACKING). */
  acceptOrder: vendorProcedure
    .input(z.object({ orderId: z.string(), subOrderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .collection("subOrders")
        .doc(input.subOrderId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "주문을 찾을 수 없습니다." });
      }
      const data = snap.data() as SubOrder;
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (data.status !== "ACCEPTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "결제 완료 상태에서만 출고 준비로 전환할 수 있습니다.",
        });
      }

      const now = FieldValue.serverTimestamp();
      await ref.update({
        status: "PACKING",
        acceptedAt: now,
        updatedAt: now,
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "SUBORDER_ACCEPTED",
        targetType: "SubOrder",
        targetId: `${input.orderId}/${input.subOrderId}`,
        createdAt: now,
      });
      return { ok: true };
    }),

  /**
   * 배송 시작 (PACKING → SHIPPED).
   * 운송장·LOT·유통기한 입력. onSubOrderShipped trigger 가 후처리.
   *
   * Phase γ-2 — 의료기기 등급 2+ 상품 포함 시 lots[] 필수 (서버 검증).
   */
  ship: vendorProcedure
    .input(
      z.object({
        orderId: z.string(),
        subOrderId: z.string(),
        carrier: z.string().min(1).max(60),
        trackingNo: z.string().min(1).max(60),
        // 레거시 단일 LOT (비의료기기 또는 단일 상품 SubOrder 용)
        lotNo: z.string().max(60).optional(),
        expiry: z.string().optional(), // YYYY-MM-DD
        // 신규 — item 별 LOT 배열 (의료기기 등급 2+ 필수)
        lots: z.array(LotInputSchema).max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .collection("subOrders")
        .doc(input.subOrderId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "주문을 찾을 수 없습니다." });
      }
      const data = snap.data() as SubOrder;
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (data.status !== "ACCEPTED" && data.status !== "PACKING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "결제 완료 또는 출고 준비 상태에서만 발송 처리할 수 있습니다.",
        });
      }

      // Phase γ-2 — 의료기기 LOT 검증
      const itemsSnap = await ref.collection("items").get();
      await validateMedicalDeviceLots(db, itemsSnap, input.lots);

      const now = FieldValue.serverTimestamp();
      await ref.update({
        status: "SHIPPED",
        trackingCarrier: input.carrier,
        trackingNo: input.trackingNo,
        ...(input.lotNo ? { lotNo: input.lotNo } : {}),
        ...(input.expiry ? { expiry: input.expiry } : {}),
        ...(input.lots && input.lots.length > 0 ? { lots: input.lots } : {}),
        shippedAt: now,
        updatedAt: now,
      });

      // onSubOrderShipped trigger (Wave D) 가 hospital 알림 + _udiReportQueue 처리.

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "SUBORDER_SHIPPED",
        targetType: "SubOrder",
        targetId: `${input.orderId}/${input.subOrderId}`,
        after: {
          carrier: input.carrier,
          trackingNo: input.trackingNo,
          lotNo: input.lotNo ?? null,
          expiry: input.expiry ?? null,
          lotsCount: input.lots?.length ?? 0,
        },
        createdAt: now,
      });
      return { ok: true };
    }),

  /**
   * Phase γ-2 — vendor 일괄 발송 처리.
   *
   * 다수의 SubOrder 를 한 번에 SHIPPED 로 전환. 각 SubOrder 마다:
   *   - 본인 vendorId 검증
   *   - 상태 ACCEPTED/PACKING 검증
   *   - LOT/유통기한 검증 (의료기기 2+ 포함 시)
   *   - SHIPPED 로 업데이트
   *
   * 한 건 실패해도 나머지는 처리. results 에 success / failed 분리 반환.
   * audit: BULK_SHIP 1 회 + 각 SUBORDER_SHIPPED (배치 처리는 onSubOrderShipped trigger 가 추가 처리)
   */
  bulkShip: vendorProcedure
    .input(
      z.object({
        shipments: z
          .array(
            z.object({
              orderId: z.string(),
              subOrderId: z.string(),
              carrier: z.string().min(1).max(60),
              trackingNo: z.string().min(1).max(60),
              lots: z.array(LotInputSchema).max(50).optional(),
            }),
          )
          .min(1)
          .max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      if (!ctx.vendorId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "vendor 연결이 필요합니다.",
        });
      }

      const results = {
        success: [] as string[],
        failed: [] as Array<{ subOrderId: string; error: string }>,
      };

      const now = FieldValue.serverTimestamp();

      for (const ship of input.shipments) {
        try {
          const ref = db
            .collection(COLLECTIONS.orders)
            .doc(ship.orderId)
            .collection("subOrders")
            .doc(ship.subOrderId);
          const snap = await ref.get();
          if (!snap.exists) {
            throw new Error("주문을 찾을 수 없습니다.");
          }
          const data = snap.data() as SubOrder;
          if (data.vendorId !== ctx.vendorId) {
            throw new Error("본인 주문이 아닙니다.");
          }
          if (data.status !== "ACCEPTED" && data.status !== "PACKING") {
            throw new Error(
              "결제 완료 또는 출고 준비 상태에서만 발송 처리할 수 있습니다.",
            );
          }

          // LOT 검증
          const itemsSnap = await ref.collection("items").get();
          await validateMedicalDeviceLots(db, itemsSnap, ship.lots);

          await ref.update({
            status: "SHIPPED",
            trackingCarrier: ship.carrier,
            trackingNo: ship.trackingNo,
            ...(ship.lots && ship.lots.length > 0 ? { lots: ship.lots } : {}),
            shippedAt: now,
            updatedAt: now,
          });

          // 개별 audit (BULK_SHIP 으로 집계 + 개별 SUBORDER_SHIPPED 추적)
          await db.collection(COLLECTIONS.auditLogs).add({
            actorId: ctx.uid,
            actorRole: "VENDOR_OWNER",
            action: "SUBORDER_SHIPPED",
            targetType: "SubOrder",
            targetId: `${ship.orderId}/${ship.subOrderId}`,
            after: {
              carrier: ship.carrier,
              trackingNo: ship.trackingNo,
              lotsCount: ship.lots?.length ?? 0,
              bulk: true,
            },
            createdAt: now,
          });

          results.success.push(ship.subOrderId);
        } catch (err) {
          const message =
            err instanceof TRPCError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err);
          results.failed.push({ subOrderId: ship.subOrderId, error: message });
        }
      }

      // 집계 audit
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "BULK_SHIP",
        targetType: "SubOrder",
        targetId: "batch",
        after: {
          total: input.shipments.length,
          success: results.success.length,
          failed: results.failed.length,
        },
        createdAt: now,
      });

      return results;
    }),

  /** 배송 완료 마킹 (SHIPPED → DELIVERED). settlementDaily cron 이 어제 DELIVERED 처리한 SubOrder → settlement 생성. */
  markDelivered: vendorProcedure
    .input(z.object({ orderId: z.string(), subOrderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .collection("subOrders")
        .doc(input.subOrderId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "주문을 찾을 수 없습니다." });
      }
      const data = snap.data() as SubOrder;
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (data.status !== "SHIPPED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "배송 중 상태에서만 배송 완료 처리할 수 있습니다.",
        });
      }

      const now = FieldValue.serverTimestamp();
      await ref.update({
        status: "DELIVERED",
        deliveredAt: now,
        updatedAt: now,
      });

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "SUBORDER_DELIVERED",
        targetType: "SubOrder",
        targetId: `${input.orderId}/${input.subOrderId}`,
        createdAt: now,
      });
      return { ok: true };
    }),

  /** SubOrder 취소 (vendor 사유). hospital 알림 + audit. */
  cancel: vendorProcedure
    .input(
      z.object({
        orderId: z.string(),
        subOrderId: z.string(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = adminDb();
      const ref = db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .collection("subOrders")
        .doc(input.subOrderId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "주문을 찾을 수 없습니다." });
      }
      const data = snap.data() as SubOrder;
      if (data.vendorId !== ctx.vendorId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (data.status === "DELIVERED" || data.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 처리된 주문은 취소할 수 없습니다.",
        });
      }

      const now = FieldValue.serverTimestamp();
      await ref.update({
        status: "CANCELLED",
        cancelReason: input.reason,
        cancelledAt: now,
        updatedAt: now,
      });

      // hospital 알림
      const orderSnap = await db
        .collection(COLLECTIONS.orders)
        .doc(input.orderId)
        .get();
      const hospitalId =
        (orderSnap.data() as { hospitalId?: string } | undefined)?.hospitalId ??
        data.hospitalId;
      if (hospitalId) {
        await db.collection(COLLECTIONS.notifications).add({
          targetType: "HOSPITAL",
          targetId: hospitalId,
          type: "SUBORDER_CANCELLED",
          title: "주문이 취소되었습니다",
          body: input.reason,
          channels: ["KAKAO", "IN_APP"],
          kakaoSent: false,
          emailSent: false,
          createdAt: now,
        });
      }

      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: ctx.uid,
        actorRole: "VENDOR_OWNER",
        action: "SUBORDER_CANCELLED",
        targetType: "SubOrder",
        targetId: `${input.orderId}/${input.subOrderId}`,
        after: { reason: input.reason },
        createdAt: now,
      });
      return { ok: true };
    }),
});
