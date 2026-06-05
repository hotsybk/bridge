// Wave J — 병원 회원 상세. Firestore + tRPC 풀 연동 Server Component.
// PREVIEW (dev/unauth) 환경에서는 mock fallback.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { trpcServer } from "@/lib/trpc/server";
import {
  tsToMs,
  formatDate,
  formatDateTime,
} from "@/lib/utils/firestore-time";

import { HospitalActionsPanel, HospitalMemoList } from "./actions";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

type DeltaTone = "accent" | "warning" | "error" | "success";

type HospitalTypeValue =
  | "CLINIC"
  | "SMALL_HOSPITAL"
  | "GENERAL_HOSPITAL"
  | "TERTIARY"
  | "ORIENTAL"
  | "DENTAL";

const TYPE_LABEL: Record<HospitalTypeValue, string> = {
  CLINIC: "의원",
  SMALL_HOSPITAL: "중소병원",
  GENERAL_HOSPITAL: "종합병원",
  TERTIARY: "상급종합",
  ORIENTAL: "한방",
  DENTAL: "치과",
};


// PREVIEW fallback hospital
const MOCK_HOSPITAL = {
  id: "demo-h1",
  name: "서울메디컬의원",
  type: "CLINIC" as HospitalTypeValue,
  bizRegNo: "123-45-67890",
  ceoName: "박원장",
  phone: "02-1234-5678",
  email: "ops@seoulmed.kr",
  address: "서울 강남구 테헤란로 152, 5층 501호",
  ykiho: "11999900",
  status: "ACTIVE" as "ACTIVE" | "SUSPENDED",
  approvalEnabled: true,
  approvalLimit: 5000000,
  memberCount: 4,
  joinedAtMs: Date.parse("2025-08-12"),
  kpi: {
    orderCount: 142,
    orderAmount: 38420000,
    lastActiveMs: Date.parse("2026-06-01"),
  },
};

const MOCK_MEMBERS = [
  { id: "u1", name: "박원장", email: "owner@seoulmed.kr", role: "BUYER_OWNER", joinedAtMs: Date.parse("2025-08-12") },
  { id: "u2", name: "이실장", email: "manager@seoulmed.kr", role: "BUYER_STAFF", joinedAtMs: Date.parse("2025-08-14") },
  { id: "u3", name: "김간호사", email: "nurse@seoulmed.kr", role: "BUYER_STAFF", joinedAtMs: Date.parse("2025-09-01") },
  { id: "u4", name: "한경리", email: "acct@seoulmed.kr", role: "BUYER_VIEWER", joinedAtMs: Date.parse("2025-10-12") },
];

const MOCK_ORDERS = [
  { id: "MP-2026-06-01-0042", orderNo: "MP-2026-06-01-0042", createdAtMs: Date.parse("2026-06-01"), totalAmount: 469800, status: "PAID" },
  { id: "MP-2026-05-31-0234", orderNo: "MP-2026-05-31-0234", createdAtMs: Date.parse("2026-05-31"), totalAmount: 28900, status: "REFUND_REQUESTED" },
  { id: "MP-2026-05-29-0151", orderNo: "MP-2026-05-29-0151", createdAtMs: Date.parse("2026-05-29"), totalAmount: 145200, status: "COMPLETED" },
];

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "결제 대기",
  PENDING_APPROVAL: "승인 대기",
  PAID: "준비 중",
  PARTIALLY_SHIPPED: "부분 배송",
  SHIPPED: "배송 중",
  COMPLETED: "배송 완료",
  CANCELLED: "취소",
  REFUND_REQUESTED: "환불 요청",
  REFUNDED: "환불 완료",
};

export default async function AdminHospitalDetailPage({
  params,
}: {
  params: Promise<{ hospitalId: string }>;
}) {
  const { hospitalId } = await params;

  let hospital: typeof MOCK_HOSPITAL | null = null;
  let members: Array<{ id: string; name?: string; email?: string; role?: string; joinedAtMs: number }> = [];
  let orders: Array<{ id: string; orderNo?: string; createdAtMs: number; totalAmount?: number; status?: string }> = [];
  let subs: Array<{ id: string; name?: string; cadence?: string; nextRunAtMs: number }> = [];
  let memos: Array<{ id: string; body?: string; actorId?: string; createdAt?: unknown }> = [];
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [h, mlist, olist, slist, memlist] = await Promise.all([
      trpc.admin.hospital.getById({ hospitalId }),
      trpc.admin.hospital.listMembers({ hospitalId }),
      trpc.admin.hospital.listOrders({ hospitalId, pageSize: 10 }),
      trpc.admin.hospital.listSubscriptions({ hospitalId }),
      trpc.admin.hospital.listMemos({ hospitalId }),
    ]);

    if (!h) {
      if (PREVIEW_MODE) {
        isPreview = true;
        hospital = MOCK_HOSPITAL;
        members = MOCK_MEMBERS;
        orders = MOCK_ORDERS;
      } else {
        notFound();
      }
    } else {
      hospital = {
        id: h.id,
        name: h.name,
        type: (h.type ?? "CLINIC") as HospitalTypeValue,
        bizRegNo: h.bizRegNo,
        ceoName: h.ceoName,
        phone: h.phone,
        email: h.email,
        address: `${h.address}${h.addressDetail ? ` ${h.addressDetail}` : ""}`,
        ykiho: h.ykiho ?? "",
        status: (h.status ?? "ACTIVE") as "ACTIVE" | "SUSPENDED",
        approvalEnabled: h.approvalEnabled ?? false,
        approvalLimit: h.approvalLimit ?? 0,
        memberCount: h.memberCount ?? 0,
        joinedAtMs: tsToMs(h.createdAt),
        kpi: {
          orderCount: h.kpi?.orderCount ?? 0,
          orderAmount: h.kpi?.orderAmount ?? 0,
          lastActiveMs:
            tsToMs(h.kpi?.lastActiveAt) || tsToMs(h.createdAt),
        },
      };
      members = mlist.map((m) => {
        const data = m as Record<string, unknown>;
        return {
          id: m.id,
          name: data.name as string | undefined,
          email: data.email as string | undefined,
          role: data.role as string | undefined,
          joinedAtMs: tsToMs(data.joinedAt),
        };
      });
      orders = olist.map((o) => {
        const data = o as Record<string, unknown>;
        return {
          id: o.id,
          orderNo: (data.orderNo as string | undefined) ?? o.id,
          createdAtMs: tsToMs(data.createdAt),
          totalAmount: data.totalAmount as number | undefined,
          status: data.status as string | undefined,
        };
      });
      subs = slist.map((s) => {
        const data = s as Record<string, unknown>;
        return {
          id: s.id,
          name: data.name as string | undefined,
          cadence: data.cadence as string | undefined,
          nextRunAtMs: tsToMs(data.nextRunAt),
        };
      });
      memos = memlist.map((m) => {
        const data = m as Record<string, unknown>;
        return {
          id: m.id,
          body: data.body as string | undefined,
          actorId: data.actorId as string | undefined,
          createdAt: data.createdAt,
        };
      });
    }
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      hospital = MOCK_HOSPITAL;
      members = MOCK_MEMBERS;
      orders = MOCK_ORDERS;
    } else {
      notFound();
    }
  }

  if (!hospital) {
    notFound();
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
        <Link
          href="/admin/hospitals"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3 w-3" />
          병원 회원으로
        </Link>
      </div>

      {/* Header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Hospital
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            {hospital.name}
          </h1>
          {isPreview && (
            <p className="mt-1 text-[11px] text-[var(--color-warning)]">
              PREVIEW — 로그인 후 실 데이터 노출
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hospital.status === "SUSPENDED" && (
            <span className="inline-flex h-7 items-center rounded-full border border-[var(--color-error)] bg-[var(--color-error)]/5 px-3 text-xs font-medium text-[var(--color-error)]">
              일시 정지
            </span>
          )}
          <span className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-text-secondary)]">
            {TYPE_LABEL[hospital.type] ?? hospital.type}
          </span>
          <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
            가입 {formatDate(hospital.joinedAtMs)}
          </span>
        </div>
      </div>

      {/* KPI 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <KpiCell label="누적 주문 수" value={hospital.kpi.orderCount} unit="건" />
        <KpiCell
          label="누적 주문액"
          value={hospital.kpi.orderAmount}
          unit="원"
          mono
        />
        <KpiCell
          label="팀원"
          value={hospital.memberCount || members.length}
          unit="명"
        />
        <KpiCell
          label="마지막 활동"
          value={0}
          customText={formatDate(hospital.kpi.lastActiveMs)}
        />
      </dl>

      {/* 2-col */}
      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
        {/* 좌측 */}
        <div className="min-w-0 space-y-12">
          {/* 병원 정보 */}
          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              병원 정보
            </p>
            <dl className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              <Row label="사업자번호" value={hospital.bizRegNo} mono />
              <Row label="대표자" value={hospital.ceoName} />
              <Row label="전화" value={hospital.phone} mono />
              <Row label="이메일" value={hospital.email} mono />
              <Row label="주소" value={hospital.address} />
              <Row label="요양기관번호" value={hospital.ykiho || "—"} mono />
            </dl>
          </section>

          {/* 팀원 */}
          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              팀원
            </p>
            <div className="mt-4 border-y border-[var(--color-border-light)]">
              <div className="grid grid-cols-[1fr_1fr_120px_140px] gap-4 border-b border-[var(--color-border-light)] px-2 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                <span>이름</span>
                <span>이메일</span>
                <span>역할</span>
                <span>가입일</span>
              </div>
              {members.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--color-text-tertiary)]">
                  등록된 팀원이 없습니다
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-border-light)]">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="grid grid-cols-[1fr_1fr_120px_140px] items-center gap-4 px-2 py-3 text-sm"
                    >
                      <span className="font-medium">{m.name ?? "—"}</span>
                      <span className="truncate font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                        {m.email ?? "—"}
                      </span>
                      <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                        {m.role ?? "—"}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                        {formatDate(m.joinedAtMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* 결재 라인 */}
          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              결재 라인
            </p>
            <dl className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              <Row
                label="결재 활성화"
                value={hospital.approvalEnabled ? "ON" : "OFF"}
              />
              <Row
                label="결재 한도"
                value={
                  hospital.approvalLimit > 0
                    ? `₩${hospital.approvalLimit.toLocaleString()}`
                    : "—"
                }
                mono
              />
            </dl>
          </section>

          {/* 최근 주문 */}
          <section>
            <div className="flex items-baseline justify-between border-b border-[var(--color-border-light)] pb-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                최근 주문
              </p>
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
              >
                모두 보기
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {orders.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--color-text-tertiary)]">
                등록된 주문이 없습니다
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border-light)]">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="grid grid-cols-[1fr_120px_140px_100px] items-center gap-4 px-2 py-3 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]/40"
                    >
                      <span className="truncate font-mono text-xs tabular-nums text-[var(--color-accent)]">
                        {o.orderNo}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                        {formatDate(o.createdAtMs)}
                      </span>
                      <span className="font-mono tabular-nums">
                        ₩{(o.totalAmount ?? 0).toLocaleString()}
                      </span>
                      <span className="text-right text-xs text-[var(--color-text-secondary)]">
                        {ORDER_STATUS_LABEL[o.status ?? ""] ?? o.status ?? "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 정기 구독 */}
          {subs.length > 0 && (
            <section>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                정기 구독
              </p>
              <div className="mt-4 border-y border-[var(--color-border-light)]">
                <div className="grid grid-cols-[1fr_120px_140px] gap-4 border-b border-[var(--color-border-light)] px-2 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                  <span>이름</span>
                  <span>주기</span>
                  <span>다음 발주일</span>
                </div>
                <ul className="divide-y divide-[var(--color-border-light)]">
                  {subs.map((s) => (
                    <li
                      key={s.id}
                      className="grid grid-cols-[1fr_120px_140px] items-center gap-4 px-2 py-3 text-sm"
                    >
                      <span className="truncate">{s.name ?? s.id}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {s.cadence ?? "—"}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-[var(--color-accent)]">
                        {formatDateTime(s.nextRunAtMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>

        {/* 우측 sticky */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-8">
            <HospitalActionsPanel
              hospitalId={hospital.id}
              currentStatus={hospital.status}
              approvalEnabled={hospital.approvalEnabled}
              approvalLimit={hospital.approvalLimit}
            />
            <HospitalMemoList memos={memos} />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function KpiCell({
  label,
  value,
  unit,
  delta,
  deltaTone,
  mono,
  customText,
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: string;
  deltaTone?: DeltaTone;
  mono?: boolean;
  customText?: string;
}) {
  const deltaColor: Record<DeltaTone, string> = {
    accent: "text-[var(--color-accent)]",
    warning: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
    success: "text-[var(--color-success)]",
  };
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl ${
          mono ? "font-mono" : ""
        }`}
      >
        {customText ? (
          <span className="font-mono text-base">{customText}</span>
        ) : (
          <>
            <CountUp value={value} />
            {unit && (
              <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
                {unit}
              </span>
            )}
          </>
        )}
      </p>
      {delta && (
        <p
          className={`mt-2 text-xs ${
            deltaTone
              ? deltaColor[deltaTone]
              : "text-[var(--color-text-tertiary)]"
          }`}
        >
          {delta}
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-2 py-3">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd
        className={`text-sm text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
