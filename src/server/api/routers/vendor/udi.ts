// Phase Φ-C 작업3 — vendor UDI 보고 현황 조회 tRPC router (read-only).
//
// vendor 가 본인 상품의 UDI(식약처 e-MEDI) 보고 상태를 확인한다.
// 데이터 소스: _udiReportQueue (onSubOrderShipped trigger 가 의료기기 발송 시 적재).
//   - status: PENDING (미보고) → reportedAt + result 채워지면 보고 완료
//   - 월말 자동 보고 (udiMonthlyReport cron) 가 식약처 e-MEDI 로 일괄 전송.
//
// _udiReportQueue 는 Firestore Rules 상 admin-only 이지만 tRPC vendorProcedure 는
// Admin SDK 로 읽으므로 vendorId match read 가능 (서버 가드).
//
// Endpoint:
//   list — 본인 vendorId 의 UDI 보고 대상 list + 이번 달 KPI.

import { vendorProcedure, createTRPCRouter } from "@/server/api/trpc";
import { adminDb } from "@/server/firebase/admin";

type QueueDoc = {
  subOrderId?: string;
  orderId?: string;
  productName?: string;
  udiCode?: string;
  udi?: string;
  lotNo?: string;
  expiry?: string;
  hospitalName?: string;
  quantity?: number;
  shippedAt?: unknown;
  reportedAt?: unknown;
  result?: { success?: boolean; resultMessage?: string } | null;
  status?: string;
};

function tsToMs(ts: unknown): number {
  if (!ts || typeof ts !== "object") return 0;
  const w = ts as {
    toMillis?: () => number;
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
  };
  if (typeof w.toMillis === "function") {
    try {
      return w.toMillis();
    } catch {
      /* fallthrough */
    }
  }
  if (typeof w.toDate === "function") {
    try {
      return w.toDate().getTime();
    } catch {
      /* fallthrough */
    }
  }
  const sec = w.seconds ?? w._seconds;
  if (typeof sec === "number") return sec * 1000;
  return 0;
}

function periodOf(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type ReportStatus = "PENDING" | "REPORTED" | "FAILED";

function serializeTs(ts: unknown): { _seconds: number; _nanoseconds: number } | null {
  if (!ts || typeof ts !== "object") return null;
  const w = ts as { seconds?: number; nanoseconds?: number; _seconds?: number; _nanoseconds?: number };
  const sec = w.seconds ?? w._seconds;
  const nano = w.nanoseconds ?? w._nanoseconds ?? 0;
  if (typeof sec === "number") return { _seconds: sec, _nanoseconds: nano };
  return null;
}

export type VendorUdiRow = {
  id: string;
  subOrderNo: string;
  productName: string;
  lotNo: string;
  udiCode: string;
  hospitalName: string;
  quantity: number;
  period: string;
  reportStatus: ReportStatus;
  reportedAt: { _seconds: number; _nanoseconds: number } | null;
  shippedAt: { _seconds: number; _nanoseconds: number } | null;
};

export type VendorUdiResult = {
  rows: VendorUdiRow[];
  thisMonth: {
    period: string;
    target: number; // 이번 달 보고 대상
    reported: number; // 보고 완료
    pending: number; // 미보고
  };
};

export const vendorUdiRouter = createTRPCRouter({
  list: vendorProcedure.query(async ({ ctx }): Promise<VendorUdiResult> => {
    const now = new Date();
    const thisMonthPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const emptyKpi = {
      period: thisMonthPeriod,
      target: 0,
      reported: 0,
      pending: 0,
    };

    if (!ctx.vendorId) {
      return { rows: [], thisMonth: emptyKpi };
    }

    const db = adminDb();
    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      // orderBy 없이 vendorId 단일 필터 (composite index 불필요) → in-memory 정렬.
      snap = await db
        .collection("_udiReportQueue")
        .where("vendorId", "==", ctx.vendorId)
        .limit(500)
        .get();
    } catch {
      return { rows: [], thisMonth: emptyKpi };
    }

    const rows: VendorUdiRow[] = snap.docs.map((d) => {
      const data = d.data() as QueueDoc;
      const shippedMs = tsToMs(data.shippedAt);
      const reportedMs = tsToMs(data.reportedAt);
      let reportStatus: ReportStatus;
      if (reportedMs) {
        reportStatus = data.result?.success === false ? "FAILED" : "REPORTED";
      } else {
        reportStatus = "PENDING";
      }
      return {
        id: d.id,
        subOrderNo: data.subOrderId ?? d.id,
        productName: data.productName ?? "의료기기",
        lotNo: data.lotNo ?? "—",
        udiCode: data.udiCode ?? data.udi ?? "—",
        hospitalName: data.hospitalName ?? "—",
        quantity: data.quantity ?? 0,
        period: periodOf(shippedMs),
        reportStatus,
        reportedAt: serializeTs(data.reportedAt),
        shippedAt: serializeTs(data.shippedAt),
      };
    });

    // 최신 발송 순 정렬.
    rows.sort((a, b) => {
      const am = a.shippedAt?._seconds ?? 0;
      const bm = b.shippedAt?._seconds ?? 0;
      return bm - am;
    });

    // 이번 달 KPI.
    const thisMonthRows = rows.filter((r) => r.period === thisMonthPeriod);
    const reported = thisMonthRows.filter(
      (r) => r.reportStatus === "REPORTED",
    ).length;
    const pending = thisMonthRows.filter(
      (r) => r.reportStatus !== "REPORTED",
    ).length;

    return {
      rows,
      thisMonth: {
        period: thisMonthPeriod,
        target: thisMonthRows.length,
        reported,
        pending,
      },
    };
  }),
});
