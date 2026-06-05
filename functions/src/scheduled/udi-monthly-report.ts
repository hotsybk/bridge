// Wave N — 매월 말일 23:00 KST 식약처 e-MEDI UDI 일괄 보고.
//
// onSchedule cron 은 28-31일 매일 실행되지만, 내일이 다음 달이 아니면 skip.
// 즉 매월 1회만 실 작동 (28일 = 2월 말, 30일 = 4/6/9/11월 말, 31일 = 그 외).
//
// 처리 흐름:
// 1. _udiReportQueue 에서 해당 기간 unreported entry 조회 (limit 500)
// 2. udiReports/{period} master doc 생성/갱신 → status IN_PROGRESS
// 3. 각 entry 별로 reportToMfds 호출 → udiReports/{period}/items/{subOrderId} 저장
// 4. 실패는 _retryQueue 에 적재
// 5. master status COMPLETED / PARTIAL 갱신 + auditLog

// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/scheduled/udi-monthly-report must be used only on the server side.");
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
import {reportToMfds} from "../lib/mfds-udi";

type QueueEntry = {
  orderId?: string;
  subOrderId?: string;
  vendorId?: string;
  vendorName?: string;
  vendorBizRegNo?: string;
  hospitalId?: string;
  hospitalName?: string;
  hospitalBizRegNo?: string;
  productId?: string;
  productName?: string;
  udiCode?: string;
  udi?: string;
  lotNo?: string;
  expiry?: string;
  mfdsLicenseNo?: string;
  quantity?: number;
  unitPrice?: number;
  saleDate?: string;
  reportedAt?: FirebaseFirestore.Timestamp;
  result?: unknown;
  shippedAt?: FirebaseFirestore.Timestamp;
};

export const udiMonthlyReport = onSchedule(
  {
    schedule: "0 23 28-31 * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (today.getMonth() === tomorrow.getMonth()) {
      logger.info("[udi-monthly] 말일 아님 — skip", {
        today: today.toISOString(),
      });
      return;
    }
    await runUdiReport({});
  },
);

/**
 * UDI 보고 batch 실행. cron 또는 callable 에서 호출.
 */
export async function runUdiReport(args: {
  period?: string;
  triggeredById?: string;
}): Promise<{success: number; fail: number; total: number; period: string}> {
  const today = new Date();
  const period =
    args.period ??
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;

  const periodStart = new Date(year, month, 1, 0, 0, 0);
  const periodEnd = new Date(year, month + 1, 0, 23, 59, 59);

  logger.info("[udi-monthly] start", {period, periodStart, periodEnd});

  // ── 1) _udiReportQueue 에서 해당 기간 entry 조회 (limit 500)
  const queueSnap = await db
    .collection("_udiReportQueue")
    .where("shippedAt", ">=", Timestamp.fromDate(periodStart))
    .where("shippedAt", "<=", Timestamp.fromDate(periodEnd))
    .limit(500)
    .get();

  // 이미 reported 된 항목 제외
  const unreported = queueSnap.docs.filter((d) => {
    const data = d.data() as QueueEntry;
    return !data.reportedAt;
  });

  logger.info("[udi-monthly] queue scanned", {
    total: queueSnap.size,
    unreported: unreported.length,
  });

  // ── 2) master doc 생성/갱신
  const masterRef = db.collection(COLLECTIONS.udiReports).doc(period);
  await masterRef.set(
    {
      period,
      periodStart: Timestamp.fromDate(periodStart),
      periodEnd: Timestamp.fromDate(periodEnd),
      totalCount: unreported.length,
      successCount: 0,
      failCount: 0,
      status: "IN_PROGRESS",
      startedAt: FieldValue.serverTimestamp(),
      triggeredById: args.triggeredById ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  let success = 0;
  let fail = 0;

  // ── 3) 각 entry 별 보고
  for (const queueDoc of unreported) {
    const data = queueDoc.data() as QueueEntry;
    const subOrderId = data.subOrderId ?? queueDoc.id;
    try {
      const result = await reportToMfds({
        udiCode: data.udi ?? data.udiCode ?? "",
        lotNo: data.lotNo ?? "",
        expiry: data.expiry ?? "",
        vendorBizRegNo: data.vendorBizRegNo ?? "",
        hospitalBizRegNo: data.hospitalBizRegNo ?? "",
        hospitalName: data.hospitalName ?? "",
        quantity: data.quantity ?? 1,
        unitPrice: data.unitPrice ?? 0,
        saleDate:
          data.saleDate ?? new Date().toISOString().slice(0, 10),
        productName: data.productName ?? "",
        mfdsLicenseNo: data.mfdsLicenseNo,
      });

      // items 서브컬렉션 저장
      await masterRef.collection("items").doc(subOrderId).set({
        subOrderId,
        orderId: data.orderId ?? null,
        vendorId: data.vendorId ?? null,
        vendorName: data.vendorName ?? null,
        vendorBizRegNo: data.vendorBizRegNo ?? null,
        hospitalId: data.hospitalId ?? null,
        hospitalName: data.hospitalName ?? null,
        hospitalBizRegNo: data.hospitalBizRegNo ?? null,
        productId: data.productId ?? null,
        productName: data.productName ?? null,
        udiCode: data.udi ?? data.udiCode ?? "",
        lotNo: data.lotNo ?? "",
        expiry: data.expiry ?? "",
        mfdsLicenseNo: data.mfdsLicenseNo ?? null,
        quantity: data.quantity ?? 0,
        unitPrice: data.unitPrice ?? 0,
        saleDate: data.saleDate ?? "",
        result,
        retryCount: 0,
        reportedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });

      // queue entry 갱신
      await queueDoc.ref.update({
        reportedAt: FieldValue.serverTimestamp(),
        result,
      });

      if (result.success) {
        success++;
      } else {
        fail++;
        await db.collection(COLLECTIONS.retryQueue).add({
          type: "UDI",
          payload: {period, subOrderId},
          reason: result.resultMessage ?? "UDI 보고 실패",
          attemptCount: 0,
          status: "PENDING",
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // rate limit (식약처 API 호출 간격)
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      fail++;
      logger.error("[udi-monthly] item failed", {
        subOrderId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── 4) master 갱신
  await masterRef.update({
    successCount: success,
    failCount: fail,
    status:
      unreported.length === 0
        ? "COMPLETED"
        : fail === 0
          ? "COMPLETED"
          : "PARTIAL",
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // ── 5) auditLog
  try {
    await db.collection(COLLECTIONS.auditLogs).add({
      actorId: args.triggeredById ?? "system",
      actorRole: args.triggeredById ? "ADMIN" : "SYSTEM",
      action: "UDI_MONTHLY_REPORT",
      targetType: "UdiReport",
      targetId: period,
      after: {total: unreported.length, success, fail},
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.warn("[udi-monthly] audit failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info("[udi-monthly] complete", {period, success, fail});
  return {success, fail, total: unreported.length, period};
}
