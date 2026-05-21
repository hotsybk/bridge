import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Clock,
  FileWarning,
  ShieldX,
  Stethoscope,
} from "lucide-react";

import { TimelineList, type TimelineItemStatus } from "@/components/shared/timeline-list";
import { trpcServer } from "@/lib/trpc/server";

// 인증 컨텍스트(cookies) 의존 — 정적 prerender 불가. 매 요청마다 SSR.
export const dynamic = "force-dynamic";

type StatusConfig = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  body: string;
  tone: "info" | "warning" | "error";
  timeline: ReadonlyArray<{ label: string; status: TimelineItemStatus }>;
  nextActions: ReadonlyArray<string>;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  PENDING_DOCS: {
    icon: FileWarning,
    title: "추가 서류가 필요합니다",
    description: "심사 진행을 위해 추가 서류 제출이 필요합니다",
    body: "운영자가 안내한 추가 서류를 등록 이메일로 회신해주세요. 접수 후 다시 심사 큐에 진입합니다.",
    tone: "warning",
    timeline: [
      { label: "서류 접수 완료", status: "done" },
      { label: "추가 서류 요청 (진행 중)", status: "current" },
      { label: "심사 재개", status: "pending" },
    ],
    nextActions: [
      "등록 이메일을 확인해 주세요",
      "요청된 서류를 회신하면 자동으로 심사 재개됩니다",
    ],
  },
  PENDING_REVIEW: {
    icon: Clock,
    title: "심사가 진행 중입니다",
    description: "영업일 기준 24~72시간 내 안내드립니다",
    body: "제출된 서류를 운영자가 검토하고 있습니다. 승인 시 등록 이메일과 알림톡으로 알려드립니다.",
    tone: "info",
    timeline: [
      { label: "서류 접수 완료", status: "done" },
      { label: "운영자 심사 진행 중", status: "current" },
      { label: "결과 통보 (이메일 + 알림톡)", status: "pending" },
    ],
    nextActions: [
      "별도 작업 없이 대기해주세요",
      "추가 서류 요청이 올 수 있습니다",
    ],
  },
  SUSPENDED: {
    icon: ShieldX,
    title: "이용이 일시 정지되었습니다",
    description: "셀러센터 접근이 제한된 상태입니다",
    body: "분쟁·정책 위반 등으로 일시 정지된 상태입니다. 자세한 사유와 해제 방법은 고객지원에 문의해주세요.",
    tone: "error",
    timeline: [
      { label: "이용 정상", status: "done" },
      { label: "일시 정지 상태", status: "current" },
      { label: "운영자 검토 후 해제", status: "pending" },
    ],
    nextActions: [
      "정지 사유를 아래에서 확인하세요",
      "이의 제기 또는 해제 요청은 고객지원으로",
    ],
  },
  REJECTED: {
    icon: AlertTriangle,
    title: "심사가 반려되었습니다",
    description: "제출하신 신청이 반려되었습니다",
    body: "반려 사유는 아래에 표시됩니다. 보완 후 재신청하시려면 고객지원에 문의해주세요.",
    tone: "error",
    timeline: [
      { label: "서류 접수 완료", status: "done" },
      { label: "심사 반려", status: "current" },
      { label: "재신청 검토 대기", status: "pending" },
    ],
    nextActions: [
      "반려 사유를 확인해주세요",
      "보완 후 재신청은 고객지원을 통해 진행됩니다",
    ],
  },
};

const VENDOR_TYPE_LABEL: Record<string, string> = {
  DISTRIBUTOR: "판매업자",
  MANUFACTURER: "제조업자",
  IMPORTER: "수입업자",
};

const TONE_STYLES: Record<
  StatusConfig["tone"],
  { iconBg: string; iconText: string; border: string }
> = {
  info: {
    iconBg: "bg-[var(--color-accent-light)]",
    iconText: "text-[var(--color-accent)]",
    border: "border-[var(--color-border-light)]",
  },
  warning: {
    iconBg: "bg-[var(--color-warning)]/12",
    iconText: "text-[var(--color-warning)]",
    border: "border-[var(--color-warning)]/30",
  },
  error: {
    iconBg: "bg-[var(--color-error)]/12",
    iconText: "text-[var(--color-error)]",
    border: "border-[var(--color-error)]/30",
  },
};

export default async function SellerPendingPage() {
  const trpc = await trpcServer();
  const vendor = await trpc.vendor.getCurrent();

  if (!vendor) redirect("/onboarding/vendor");
  if (vendor.status === "APPROVED") redirect("/seller/products");

  const status = String(vendor.status ?? "PENDING_REVIEW");
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.PENDING_REVIEW;
  const tone = TONE_STYLES[cfg.tone];
  const Icon = cfg.icon;
  const statusReason = (vendor as { statusReason?: string }).statusReason;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-12">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">MedPlace</span>
          </Link>
          <Link
            href="/api/logout"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-3 w-3" />
            로그아웃
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12 md:px-12 md:py-20">
        <div
          className={`overflow-hidden rounded-3xl border bg-[var(--color-bg-primary)] ${tone.border}`}
        >
          {/* Hero */}
          <div className={`flex flex-col items-center gap-5 px-8 pt-10 pb-8 text-center ${tone.iconBg}`}>
            <span className={`grid h-16 w-16 place-items-center rounded-full bg-[var(--color-bg-primary)] ${tone.iconText}`}>
              <Icon className="h-8 w-8" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {cfg.title}
              </h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)] md:text-base">
                {cfg.description}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-6 px-8 py-8">
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {cfg.body}
            </p>

            {/* 회사 정보 헤더 */}
            <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                현재 회사
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-bg-primary)] text-[var(--color-accent)]">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {(vendor as { companyName?: string }).companyName ?? "—"}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {VENDOR_TYPE_LABEL[
                      (vendor as { vendorType?: string }).vendorType ?? ""
                    ] ?? "—"}
                    {" · "}
                    상태 <span className="font-mono">{status}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 사유 박스 (REJECTED / SUSPENDED 만) */}
            {statusReason && (cfg.tone === "error" || cfg.tone === "warning") && (
              <div
                className={`rounded-2xl border-l-4 bg-[var(--color-bg-secondary)] p-4 text-sm ${
                  cfg.tone === "error"
                    ? "border-[var(--color-error)]"
                    : "border-[var(--color-warning)]"
                }`}
              >
                <p className="font-medium">사유</p>
                <p className="mt-1 text-[var(--color-text-secondary)]">{statusReason}</p>
              </div>
            )}

            {/* Timeline */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                진행 단계
              </p>
              <div className="mt-3">
                <TimelineList items={cfg.timeline} />
              </div>
            </div>

            {/* Next actions */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                다음 액션
              </p>
              <ul className="mt-3 space-y-2">
                {cfg.nextActions.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-sm">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
                    />
                    <span className="text-[var(--color-text-secondary)]">{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link
                href="/api/logout"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
                로그아웃
              </Link>
              <a
                href="mailto:support@medplace.example.com"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
              >
                고객지원 문의
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
