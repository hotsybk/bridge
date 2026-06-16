// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/scheduled/groupbuy-closer must be used only on the server side.");
}

// Wave I — 매분 공동구매 마감 처리 cron.
//
// 동작:
// 1. status in [OPEN, TARGET_MET] AND endsAt <= now 인 groupBuys 조회
// 2. 각 캠페인 finalize:
//    - shard 합산 → 실 currentQty
//    - 목표 도달: 일괄 captureAuth → status FULFILLED + hospital 알림
//    - 미달:      일괄 cancelPayment → status FAILED + hospital 알림
// 3. 실패 시 _retryQueue 적재
//
// ARCHITECTURE.md §6.4 참조.

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import type {DocumentReference} from "firebase-admin/firestore";
// eslint-disable-next-line import/first
import {db, FieldValue, Timestamp, COLLECTIONS} from "../lib/firestore";
// eslint-disable-next-line import/first
import {sumCounter} from "../lib/distributed-counter";
// eslint-disable-next-line import/first
import {recordHeartbeat} from "../lib/heartbeat";
// eslint-disable-next-line import/first
import {captureAuth, cancelPayment} from "../lib/portone";

type ParticipationDoc = {
  hospitalId?: string | null;
  hospitalName?: string;
  qty?: number;
  preAuthPaymentId?: string;
  voidedAt?: unknown;
  capturedAt?: unknown;
};

type GroupBuyDoc = {
  vendorId?: string;
  productName?: string;
  targetQty?: number;
  status?: string;
};

export const groupbuyCloser = onSchedule(
  {
    schedule: "* * * * *", // 매분
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    const now = Timestamp.now();
    logger.info("[groupbuy-closer] tick", {now: now.toDate().toISOString()});

    let totalProcessed = 0;
    let totalFailed = 0;

    // OPEN + endsAt <= now
    const openSnap = await db
      .collection(COLLECTIONS.groupBuys)
      .where("status", "==", "OPEN")
      .where("endsAt", "<=", now)
      .limit(25)
      .get();
    // TARGET_MET + endsAt <= now
    const targetMetSnap = await db
      .collection(COLLECTIONS.groupBuys)
      .where("status", "==", "TARGET_MET")
      .where("endsAt", "<=", now)
      .limit(25)
      .get();

    const docs = [...openSnap.docs, ...targetMetSnap.docs];

    for (const doc of docs) {
      try {
        await finalizeGroupBuy(doc.ref);
        totalProcessed++;
      } catch (err) {
        totalFailed++;
        logger.error("[groupbuy-closer] finalize failed", {
          groupBuyId: doc.id,
          err: err instanceof Error ? err.message : String(err),
        });
        // _retryQueue 적재
        try {
          await db.collection(COLLECTIONS.retryQueue).add({
            type: "GROUPBUY_FINALIZE",
            payload: {groupBuyId: doc.id},
            reason: err instanceof Error ? err.message : String(err),
            attemptCount: 0,
            status: "PENDING",
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (qErr) {
          logger.error("[groupbuy-closer] retry queue write failed", {
            groupBuyId: doc.id,
            err: qErr instanceof Error ? qErr.message : String(qErr),
          });
        }
      }
    }

    logger.info("[groupbuy-closer] done", {
      scanned: docs.length,
      processed: totalProcessed,
      failed: totalFailed,
    });

    // Σ-3 — dead-man's-switch heartbeat
    await recordHeartbeat("groupbuyCloser", {
      lastScanned: docs.length,
      lastProcessed: totalProcessed,
    });
  },
);

async function finalizeGroupBuy(gbRef: DocumentReference): Promise<void> {
  const gbSnap = await gbRef.get();
  const gb = gbSnap.data() as GroupBuyDoc | undefined;
  if (!gb) return;
  if (gb.status === "FULFILLED" || gb.status === "FAILED") return;

  // 1) 정확한 currentQty (shard 합산)
  const currentQty = await sumCounter(gbRef);
  const targetQty = Number(gb.targetQty ?? 0);
  const reachedTarget = currentQty >= targetQty && targetQty > 0;

  // 2) 모든 active participation
  const allParticipations = await gbRef.collection("participations").get();
  const activeParticipations = allParticipations.docs.filter(
    (p) => !(p.data() as ParticipationDoc).voidedAt,
  );

  const productName = gb.productName ?? "공동구매 상품";

  if (reachedTarget) {
    // === 일괄 capture ===
    let captured = 0;
    let failed = 0;

    for (const p of activeParticipations) {
      const data = p.data() as ParticipationDoc;
      if (!data.preAuthPaymentId) continue;
      if (data.capturedAt) {
        captured++;
        continue;
      }
      try {
        const result = await captureAuth(data.preAuthPaymentId);
        if (result.status === "CAPTURED") {
          await p.ref.update({
            status: "CAPTURED",
            capturedAt: FieldValue.serverTimestamp(),
          });
          captured++;
          // hospital 알림
          if (data.hospitalId) {
            await db.collection(COLLECTIONS.notifications).add({
              targetType: "HOSPITAL",
              targetId: data.hospitalId,
              type: "GROUPBUY_FULFILLED",
              title: "공동구매 결제가 완료되었습니다",
              body: `${productName} 결제 완료. 곧 배송됩니다.`,
              channels: ["KAKAO", "IN_APP"],
              kakaoSent: false,
              emailSent: false,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        } else {
          failed++;
          await p.ref.update({
            status: "CAPTURE_FAILED",
            errorReason: "PortOne capture returned non-CAPTURED status",
            failedAt: FieldValue.serverTimestamp(),
          });
          logger.warn("[groupbuy-closer] capture FAILED", {
            participationId: p.id,
            paymentId: data.preAuthPaymentId,
          });
        }
      } catch (err) {
        failed++;
        const reason = err instanceof Error ? err.message : String(err);
        try {
          await p.ref.update({
            status: "CAPTURE_FAILED",
            errorReason: reason,
            failedAt: FieldValue.serverTimestamp(),
          });
        } catch {
          // best-effort
        }
        logger.error("[groupbuy-closer] capture exception", {
          participationId: p.id,
          err: reason,
        });
      }
    }

    // Phase β-2: 부분 capture 실패 시 PARTIAL_FULFILLED 분기.
    //   - failed == 0  → FULFILLED (전건 성공)
    //   - captured > 0 && failed > 0 → PARTIAL_FULFILLED (부분 성공)
    //   - captured == 0 → FAILED (전건 실패 — 캠페인 자체 실패로 격하)
    let finalStatus: "FULFILLED" | "PARTIAL_FULFILLED" | "FAILED";
    if (failed === 0) finalStatus = "FULFILLED";
    else if (captured > 0) finalStatus = "PARTIAL_FULFILLED";
    else finalStatus = "FAILED";

    await gbRef.update({
      status: finalStatus,
      currentQty,
      capturedCount: captured,
      failedCount: failed,
      ...(finalStatus === "FULFILLED" || finalStatus === "PARTIAL_FULFILLED"
        ? {fulfilledAt: FieldValue.serverTimestamp()}
        : {failedAt: FieldValue.serverTimestamp()}),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (gb.vendorId) {
      const title =
        finalStatus === "FULFILLED"
          ? "공동구매가 목표 달성으로 완료되었습니다"
          : finalStatus === "PARTIAL_FULFILLED"
            ? "공동구매 일부 결제 실패 — 운영자 확인 필요"
            : "공동구매 전체 결제 실패 — 운영자 확인 필요";
      const body =
        finalStatus === "FULFILLED"
          ? `${productName} ${currentQty}개 — 일괄 배송 준비 부탁드립니다.`
          : `${productName} 결제 성공 ${captured}건 / 실패 ${failed}건. 성공 건만 배송 부탁드립니다.`;
      await db.collection(COLLECTIONS.notifications).add({
        targetType: "VENDOR",
        targetId: gb.vendorId,
        type:
          finalStatus === "FULFILLED"
            ? "GROUPBUY_FULFILLED"
            : "GROUPBUY_PARTIAL_FULFILLED",
        title,
        body,
        channels: ["KAKAO", "IN_APP"],
        kakaoSent: false,
        emailSent: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await db.collection(COLLECTIONS.auditLogs).add({
      actorId: "system",
      actorRole: "SYSTEM",
      action: `GROUPBUY_${finalStatus}`,
      targetType: "GroupBuy",
      targetId: gbRef.id,
      after: {currentQty, target: targetQty, captured, failed, finalStatus},
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(`[groupbuy-closer] ${finalStatus}`, {
      groupBuyId: gbRef.id,
      currentQty,
      captured,
      failed,
    });
    return;
  }

  // === 일괄 void (미달) ===
  let voided = 0;
  for (const p of activeParticipations) {
    const data = p.data() as ParticipationDoc;
    if (!data.preAuthPaymentId) {
      await p.ref.update({voidedAt: FieldValue.serverTimestamp()});
      voided++;
      continue;
    }
    try {
      const result = await cancelPayment(
        data.preAuthPaymentId,
        "공동구매 미달로 자동 취소",
      );
      if (result.cancellation.status === "SUCCEEDED") {
        await p.ref.update({voidedAt: FieldValue.serverTimestamp()});
        voided++;
        if (data.hospitalId) {
          await db.collection(COLLECTIONS.notifications).add({
            targetType: "HOSPITAL",
            targetId: data.hospitalId,
            type: "GROUPBUY_FAILED",
            title: "공동구매가 미달로 종료되었습니다",
            body: `${productName} — 카드 보류는 자동 해제되었으며 추가 차감은 없습니다.`,
            channels: ["KAKAO", "IN_APP"],
            kakaoSent: false,
            emailSent: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      } else {
        logger.warn("[groupbuy-closer] void FAILED", {
          participationId: p.id,
          paymentId: data.preAuthPaymentId,
        });
      }
    } catch (err) {
      logger.error("[groupbuy-closer] void exception", {
        participationId: p.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await gbRef.update({
    status: "FAILED",
    currentQty,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (gb.vendorId) {
    await db.collection(COLLECTIONS.notifications).add({
      targetType: "VENDOR",
      targetId: gb.vendorId,
      type: "GROUPBUY_FAILED",
      title: "공동구매가 미달로 종료되었습니다",
      body: `${productName} — ${currentQty}/${targetQty}개 미달`,
      channels: ["KAKAO", "IN_APP"],
      kakaoSent: false,
      emailSent: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await db.collection(COLLECTIONS.auditLogs).add({
    actorId: "system",
    actorRole: "SYSTEM",
    action: "GROUPBUY_FAILED",
    targetType: "GroupBuy",
    targetId: gbRef.id,
    after: {currentQty, target: targetQty, voided},
    createdAt: FieldValue.serverTimestamp(),
  });

  logger.info("[groupbuy-closer] FAILED", {
    groupBuyId: gbRef.id,
    currentQty,
    target: targetQty,
    voided,
  });
}
