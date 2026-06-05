// Wave N — /admin/udi-reports/[period] Server Component.
// master + items + counts 를 fetch. PREVIEW fallback.

import {trpcServer} from "@/lib/trpc/server";
import {serializeFirestore} from "@/lib/utils/serialize-firestore";

import {
  UdiReportDetailClient,
  type AdminUdiItem,
  type AdminUdiMaster,
  type DetailCounts,
} from "./client";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

function buildMockMaster(period: string): AdminUdiMaster {
  return {
    id: period,
    period,
    status: "PARTIAL",
    totalCount: 24,
    successCount: 21,
    failCount: 3,
  };
}

function buildMockItems(period: string): AdminUdiItem[] {
  const base: Array<{
    subOrderId: string;
    vendor: string;
    product: string;
    udi: string;
    lot: string;
    expiry: string;
    success: boolean;
    code?: string;
    msg?: string;
  }> = [
    {
      subOrderId: `SUB-${period}-0142`,
      vendor: "메디서플라이",
      product: "수술용 라텍스 장갑 (M) 100매",
      udi: "(01)08800012345678(17)270630(10)LOT2026A042",
      lot: "LOT2026A042",
      expiry: "2027-06-30",
      success: true,
    },
    {
      subOrderId: `SUB-${period}-0143`,
      vendor: "한빛메디칼(주)",
      product: "디지털 청진기 BT-2",
      udi: "(01)08800022345671(11)260520(10)LOT2026B028",
      lot: "LOT2026B028",
      expiry: "—",
      success: true,
    },
    {
      subOrderId: `SUB-${period}-0144`,
      vendor: "케어스토어",
      product: "KF94 마스크 50매",
      udi: "(01)08800032345674(17)280930(10)LOT2026C112",
      lot: "LOT2026C112",
      expiry: "2028-09-30",
      success: false,
      code: "MFDS-E422",
      msg: "유통기한 형식 오류",
    },
    {
      subOrderId: `SUB-${period}-0148`,
      vendor: "라이프케어솔루션",
      product: "혈압계 디지털 BP-12",
      udi: "(01)08800072345676(11)260712(10)LOT2026G018",
      lot: "LOT2026G018",
      expiry: "—",
      success: false,
      code: "MFDS-E412",
      msg: "UDI 형식 오류 (GTIN 체크섬 불일치)",
    },
  ];
  return base.map((b) => ({
    id: b.subOrderId,
    subOrderId: b.subOrderId,
    vendorName: b.vendor,
    productName: b.product,
    udiCode: b.udi,
    lotNo: b.lot,
    expiry: b.expiry,
    quantity: 10,
    unitPrice: 0,
    saleDate: `${period}-31`,
    result: {
      success: b.success,
      resultCode: b.success ? "00" : b.code,
      resultMessage: b.success ? "정상 처리 (mock)" : b.msg,
      source: "mock" as const,
    },
    retryCount: 0,
  }));
}

export default async function AdminUdiReportDetailPage({
  params,
}: {
  params: Promise<{period: string}>;
}) {
  const {period} = await params;
  let master: AdminUdiMaster | null = null;
  let items: AdminUdiItem[] = [];
  let counts: DetailCounts = {
    totalCount: 0,
    successCount: 0,
    failCount: 0,
    retryAvailable: 0,
  };
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [reportRes, itemsRes, c] = await Promise.all([
      trpc.admin.udi.getReport({period}),
      trpc.admin.udi.listItems({period, status: "ALL", pageSize: 100}),
      trpc.admin.udi.counts({period}),
    ]);
    master = serializeFirestore(reportRes) as AdminUdiMaster | null;
    items = serializeFirestore(itemsRes.items) as AdminUdiItem[];
    counts = c;
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      master = buildMockMaster(period);
      items = buildMockItems(period);
      counts = {
        totalCount: master.totalCount ?? 0,
        successCount: master.successCount ?? 0,
        failCount: master.failCount ?? 0,
        retryAvailable: items.filter((i) => i.result?.success === false).length,
      };
    }
  }

  return (
    <UdiReportDetailClient
      period={period}
      master={master}
      items={items}
      counts={counts}
      isPreview={isPreview}
    />
  );
}
