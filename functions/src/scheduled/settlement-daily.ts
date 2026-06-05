// Wave M — 매일 03:00 KST 정산 일괄 처리.
//
// 어제(KST 00:00 ~ 24:00) DELIVERED 된 SubOrder 들을 vendor 별로 묶어 settlement doc 자동 생성.
// 빠른정산 활성화된 vendor 는 status=REQUESTED + scheduledPayoutAt = +3일 으로 생성.
// 그 외는 status=PENDING + scheduledPayoutAt = +7일.

// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/scheduled/settlement-daily must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {Timestamp} from "firebase-admin/firestore";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {calculateSettlement, calculateFastFee} from "../lib/settlement-calc";

type SubOrderData = {
  vendorId?: string;
  totalAmount?: number;
  categoryId?: string;
  refundedAmount?: number;
  status?: string;
  deliveredAt?: {seconds?: number};
};

type VendorData = {
  companyName?: string;
  defaultCommissionRate?: number;
  fastSettlementEnabled?: boolean;
  grade?: string;
};

export const settlementDaily = onSchedule(
  {
    schedule: "0 3 * * *", // 매일 03:00 KST
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "512MiB",
  },
  async () => {
    logger.info("[settlement-daily] start");

    // 어제 00:00 ~ 오늘 00:00 (KST)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date(yesterday);
    today.setDate(yesterday.getDate() + 1);

    // collectionGroup 쿼리 — orders/{any}/subOrders. status=DELIVERED + 어제 deliveredAt.
    type EnrichedSubOrder = {
      _orderId: string;
      _subOrderId: string;
      vendorId: string;
      totalAmount: number;
      categoryId?: string;
      refundedAmount: number;
    };

    let subOrders: EnrichedSubOrder[] = [];
    try {
      const snap = await db
        .collectionGroup("subOrders")
        .where("status", "==", "DELIVERED")
        .where("deliveredAt", ">=", Timestamp.fromDate(yesterday))
        .where("deliveredAt", "<", Timestamp.fromDate(today))
        .limit(500)
        .get();
      subOrders = snap.docs
        .map((d): EnrichedSubOrder | null => {
          const data = d.data() as SubOrderData;
          const orderId = d.ref.parent.parent?.id;
          if (!orderId || !data.vendorId) return null;
          return {
            _orderId: orderId,
            _subOrderId: d.id,
            vendorId: data.vendorId,
            totalAmount: data.totalAmount ?? 0,
            categoryId: data.categoryId,
            refundedAmount: data.refundedAmount ?? 0,
          };
        })
        .filter((x): x is EnrichedSubOrder => x !== null);
    } catch (err) {
      logger.error("[settlement-daily] collectionGroup query failed", {
        err: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    logger.info(`[settlement-daily] scanned ${subOrders.length} delivered subOrders`);

    // vendor 별로 그룹
    const byVendor = new Map<string, EnrichedSubOrder[]>();
    for (const so of subOrders) {
      const list = byVendor.get(so.vendorId) ?? [];
      list.push(so);
      byVendor.set(so.vendorId, list);
    }

    let createdCount = 0;
    let skippedCount = 0;
    const categoryRateCache = new Map<string, number>();

    // 정산 period 키 (예: "2026-06-01") — settlement docId 와 subOrder dedup 양쪽에 사용.
    const periodKey = yesterday.toISOString().slice(0, 10);

    for (const [vendorId, list] of byVendor) {
      try {
        const vendorSnap = await db
          .collection(COLLECTIONS.vendors)
          .doc(vendorId)
          .get();
        if (!vendorSnap.exists) {
          logger.warn(`[settlement-daily] vendor ${vendorId} not found, skipping`);
          continue;
        }
        const vendor = vendorSnap.data() as VendorData;

        // 카테고리 rate 조회 (캐시)
        for (const so of list) {
          if (so.categoryId && !categoryRateCache.has(so.categoryId)) {
            const c = await db
              .collection(COLLECTIONS.categories)
              .doc(so.categoryId)
              .get();
            if (c.exists) {
              const rate = (c.data() as {commissionRate?: number}).commissionRate;
              if (typeof rate === "number") {
                categoryRateCache.set(so.categoryId, rate);
              }
            }
          }
        }

        const enriched = list.map((so) => ({
          id: so._subOrderId,
          orderId: so._orderId,
          vendorId: so.vendorId,
          totalAmount: so.totalAmount,
          categoryId: so.categoryId,
          categoryCommissionRate: so.categoryId
            ? categoryRateCache.get(so.categoryId)
            : undefined,
          refundedAmount: so.refundedAmount,
        }));

        const calc = calculateSettlement({
          subOrders: enriched,
          vendor: {
            id: vendorId,
            defaultCommissionRate: vendor.defaultCommissionRate ?? 0.05,
            fastSettlementEnabled: vendor.fastSettlementEnabled === true,
            grade: vendor.grade,
          },
          paymentChannel: "CARD",
        });

        const isFast = vendor.fastSettlementEnabled === true;
        const days = isFast ? 3 : 7;
        // 빠른정산 = D+3, 정기정산 = D+7. 단축 = 4일.
        const fastFee = isFast ? calculateFastFee(calc.netPayout, 4) : 0;

        // Phase β-2: idempotent — deterministic doc id (vendor_period) 로 중복 생성 차단.
        // 동일 (vendorId, periodKey) 조합으로 트랜잭션 내에서 dedup.
        const settlementDocId = `${vendorId}_${periodKey}`;
        const settlementRef = db
          .collection(COLLECTIONS.settlements)
          .doc(settlementDocId);

        // subOrder 들의 settlementId 박기 — 이미 정산된 doc 은 skip.
        // 단일 트랜잭션에 500 docs 한계 (CLAUDE.md §1.4). enriched 가 그보다 많으면 chunk.
        const CHUNK = 400; // settlement doc + subOrders → 500 미만 유지
        const subOrderRefs: typeof enriched = [];
        let txSkipped = false;
        for (let i = 0; i < enriched.length; i += CHUNK) {
          const chunk = enriched.slice(i, i + CHUNK);
          // eslint-disable-next-line no-await-in-loop
          await db.runTransaction(async (tx) => {
            // 첫 chunk 일 때 settlement doc 중복 검사
            if (i === 0) {
              const settlementSnap = await tx.get(settlementRef);
              if (settlementSnap.exists) {
                txSkipped = true;
                return;
              }
            }
            // 모든 subOrder 의 settlementId 검사 (idempotent)
            const subRefs = chunk.map((so) =>
              db
                .collection(COLLECTIONS.orders)
                .doc(so.orderId)
                .collection("subOrders")
                .doc(so.id),
            );
            const subSnaps = await Promise.all(subRefs.map((r) => tx.get(r)));
            for (let j = 0; j < subSnaps.length; j++) {
              const subData = subSnaps[j].data() as {
                settlementId?: string;
              } | undefined;
              if (subData?.settlementId) {
                // 이미 다른 settlement 에 묶인 subOrder — 스킵 (중복 정산 방지)
                continue;
              }
              tx.update(subRefs[j], {
                settlementId: settlementDocId,
                settledAt: FieldValue.serverTimestamp(),
              });
              subOrderRefs.push(chunk[j]);
            }

            // 첫 chunk 에서 settlement doc 생성
            if (i === 0) {
              tx.set(settlementRef, {
                id: settlementDocId,
                vendorId,
                vendorName: vendor.companyName ?? "",
                periodStart: Timestamp.fromDate(yesterday),
                periodEnd: Timestamp.fromDate(today),
                periodKey,
                ...calc,
                isFastSettlement: isFast,
                fastSettlementDays: days,
                fastSettlementFee: fastFee,
                finalPayout: calc.netPayout - fastFee,
                subOrderRefs: chunk.map((so) => ({
                  orderId: so.orderId,
                  subOrderId: so.id,
                  amount: so.totalAmount,
                })),
                status: isFast ? "REQUESTED" : "PENDING",
                scheduledPayoutAt: Timestamp.fromDate(
                  new Date(Date.now() + days * 86400 * 1000),
                ),
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });
            } else {
              // 후속 chunk: subOrderRefs 누적 append
              tx.update(settlementRef, {
                subOrderRefs: FieldValue.arrayUnion(
                  ...chunk.map((so) => ({
                    orderId: so.orderId,
                    subOrderId: so.id,
                    amount: so.totalAmount,
                  })),
                ),
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
          });
          if (txSkipped) break;
        }

        if (txSkipped) {
          logger.info(
            `[settlement-daily] vendor ${vendorId} period ${periodKey} already settled — skip`,
          );
          skippedCount++;
        } else {
          createdCount++;
        }
      } catch (err) {
        logger.error(`[settlement-daily] vendor ${vendorId} failed`, {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await db.collection(COLLECTIONS.auditLogs).add({
      actorId: "system",
      actorRole: "SYSTEM",
      action: "SETTLEMENT_DAILY_RUN",
      targetType: "Settlement",
      targetId: "batch",
      after: {
        scanned: subOrders.length,
        created: createdCount,
        skipped: skippedCount,
        period: periodKey,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(
      `[settlement-daily] done — created ${createdCount}, skipped ${skippedCount}`,
    );
  },
);
