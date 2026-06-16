import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  FileWarning,
  ShieldX,
  Stethoscope,
} from "lucide-react";

import { trpcServer } from "@/lib/trpc/server";

// 인증 컨텍스트(cookies) 의존 — 정적 prerender 불가. 매 요청마다 SSR.
export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

type TimelineItem = { label: string; status: "done" | "current" | "pending" };

type StatusConfig = {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  eyebrow: string;
  title: string;
  description: string;
  body: string;
  tone: "info" | "warning" | "error";
  timeline: ReadonlyArray<TimelineItem>;
  nextActions: ReadonlyArray<string>;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  PENDING_DOCS: {
    icon: FileWarning,
    eyebrow: "Action Required",
    title: "추가 서류가 필요합니다",
    description: "심사 진행을 위해 추가 서류 제출을 부탁드립니다",
    body: "운영자가 안내한 추가 서류를 등록 이메일로 회신해주세요. 접수되면 자동으로 심사 큐에 진입합니다.",
    tone: "warning",
    timeline: [
      { label: "서류 접수 완료", status: "done" },
      { label: "추가 서류 요청", status: "current" },
      { label: "심사 재개", status: "pending" },
    ],
    nextActions: [
      "등록 이메일을 확인해 주세요",
      "요청 서류 회신 시 자동 심사 재개",
    ],
  },
  PENDING_REVIEW: {
    icon: Clock,
    eyebrow: "In Review",
    title: "심사가 진행 중입니다",
    description: "영업일 24~72시간 안에 결과를 알려드립니다",
    body: "제출된 서류를 운영자가 검토하고 있습니다. 승인 시 등록 이메일과 알림톡으로 안내드립니다.",
    tone: "info",
    timeline: [
      { label: "서류 접수 완료", status: "done" },
      { label: "운영자 심사 진행 중", status: "current" },
      { label: "결과 통보 (이메일·알림톡)", status: "pending" },
    ],
    nextActions: [
      "별도 작업 없이 대기해주세요",
      "추가 서류 요청이 올 수 있습니다",
    ],
  },
  SUSPENDED: {
    icon: ShieldX,
    eyebrow: "Suspended",
    title: "이용이 일시 정지되었습니다",
    description: "셀러센터 접근이 제한된 상태입니다",
    body: "분쟁·정책 위반 등으로 일시 정지된 상태입니다. 자세한 사유와 해제 방법은 고객지원에 문의해주세요.",
    tone: "error",
    timeline: [
      { label: "이용 정상", status: "done" },
      { label: "일시 정지", status: "current" },
      { label: "운영자 검토 후 해제", status: "pending" },
    ],
    nextActions: [
      "정지 사유를 아래에서 확인하세요",
      "이의 제기·해제는 고객지원으로",
    ],
  },
  REJECTED: {
    icon: AlertTriangle,
    eyebrow: "Rejected",
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
      "보완 후 재신청은 고객지원을 통해 진행",
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
  { ringBg: string; ringText: string; eyebrowText: string }
> = {
  info: {
    ringBg: "bg-[var(--color-accent)]",
    ringText: "text-white",
    eyebrowText: "text-[var(--color-accent)]",
  },
  warning: {
    ringBg: "bg-[var(--color-warning)]",
    ringText: "text-white",
    eyebrowText: "text-[var(--color-warning)]",
  },
  error: {
    ringBg: "bg-[var(--color-error)]",
    ringText: "text-white",
    eyebrowText: "text-[var(--color-error)]",
  },
};

// 데모 데이터 — 비로그인 dev 환경에서만 사용
const DEMO_VENDOR = {
  companyName: "(주)메디서플라이",
  vendorType: "DISTRIBUTOR",
  status: "PENDING_REVIEW",
  statusReason: null as string | null,
};

export default async function SellerPendingPage() {
  let vendor:
    | {
        companyName?: string;
        vendorType?: string;
        status?: string;
        statusReason?: string | null;
      }
    | null = null;

  try {
    const trpc = await trpcServer();
    const result = await trpc.vendor.getCurrent();
    vendor = result as typeof vendor;
  } catch {
    // 비로그인·preview 등 — 아래에서 fallback
  }

  // 비로그인 + dev → 데모 데이터로 디자인 미리보기
  if (!vendor && PREVIEW_MODE) {
    vendor = DEMO_VENDOR;
  }

  if (!vendor) redirect("/onboarding/vendor");
  if (vendor.status === "APPROVED") redirect("/seller/products");

  const status = String(vendor.status ?? "PENDING_REVIEW");
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.PENDING_REVIEW;
  const tone = TONE_STYLES[cfg.tone];
  const Icon = cfg.icon;
  const statusReason = vendor.statusReason ?? null;
  const companyName = vendor.companyName ?? "—";
  const vendorTypeLabel = VENDOR_TYPE_LABEL[vendor.vendorType ?? ""] ?? "—";

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="border-b border-[var(--color-border-light)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-12">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              MedPlace
            </span>
          </Link>
          <Link
            href="/api/logout"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-3 w-3" />
            로그아웃
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-24">
        <div className="flex flex-col items-center text-center">
          {/* Hero icon — glow ring */}
          <div className="relative mt-4">
            <span
              aria-hidden
              className={`absolute inset-0 -z-10 rounded-full blur-3xl opacity-50 ${tone.ringBg}`}
            />
            <span
              className={`grid h-28 w-28 place-items-center rounded-full ${tone.ringBg} ${tone.ringText} shadow-[0_0_0_16px_var(--color-bg-secondary)]`}
            >
              <Icon className="h-12 w-12" strokeWidth={2.2} aria-hidden />
            </span>
          </div>

          <p
            className={`mt-10 text-xs font-medium uppercase tracking-[0.22em] ${tone.eyebrowText}`}
          >
            {cfg.eyebrow}
          </p>
          <h1 className="mt-3 max-w-2xl break-keep text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
            {cfg.title}
          </h1>
          <p className="mt-4 max-w-xl text-sm text-[var(--color-text-secondary)]">
            {cfg.description}
          </p>
        </div>

        {/* 회사 + 상태 — divider line only */}
        <dl className="mt-16 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <InfoRow label="회사명" value={companyName} />
          <InfoRow label="구분" value={vendorTypeLabel} />
          <InfoRow label="상태" value={status} mono />
        </dl>

        {/* Body */}
        <p className="mt-10 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {cfg.body}
        </p>

        {/* 사유 (REJECTED / SUSPENDED) */}
        {statusReason && (cfg.tone === "error" || cfg.tone === "warning") && (
          <div
            className={`mt-8 border-l-2 px-5 py-4 ${
              cfg.tone === "error"
                ? "border-[var(--color-error)] bg-[var(--color-error)]/5"
                : "border-[var(--color-warning)] bg-[var(--color-warning)]/5"
            }`}
          >
            <p
              className={`text-[11px] font-medium uppercase tracking-[0.18em] ${
                cfg.tone === "error"
                  ? "text-[var(--color-error)]"
                  : "text-[var(--color-warning)]"
              }`}
            >
              사유
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-primary)]">
              {statusReason}
            </p>
          </div>
        )}

        {/* Timeline */}
        <div className="mt-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            진행 단계
          </p>
          <div className="mt-6">
            <ProgressTimeline items={cfg.timeline} />
          </div>
        </div>

        {/* Next actions — divider only */}
        <div className="mt-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            다음 액션
          </p>
          <ul className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {cfg.nextActions.map((a, i) => (
              <li key={a} className="flex items-center gap-4 py-4">
                <span className="text-xs font-medium tabular-nums text-[var(--color-text-tertiary)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-sm text-[var(--color-text-primary)]">
                  {a}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-16 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/api/logout"
            className="inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
          >
            로그아웃
          </Link>
          <a
            href="mailto:support@medplace.example.com"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            고객지원 문의
          </a>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <dt className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd
        className={`text-sm font-medium text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ProgressTimeline({
  items,
}: {
  items: ReadonlyArray<TimelineItem>;
}) {
  return (
    <ol className="relative ml-3 border-l border-[var(--color-border-light)]">
      {items.map((it, i) => (
        <li key={i} className="relative py-3 pl-6">
          <span
            aria-hidden
            className={`absolute -left-[7px] top-4 grid h-3.5 w-3.5 place-items-center rounded-full transition-all ${
              it.status === "done"
                ? "bg-[var(--color-accent)]"
                : it.status === "current"
                  ? "status-pulse-dot bg-[var(--color-accent)] shadow-[0_0_0_4px_var(--color-accent-light)]"
                  : "border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]"
            }`}
          >
            {it.status === "done" && (
              <Check
                className="h-2.5 w-2.5 text-white"
                strokeWidth={4}
                aria-hidden
              />
            )}
          </span>
          <p
            className={`text-sm font-medium ${
              it.status === "pending"
                ? "text-[var(--color-text-tertiary)]"
                : "text-[var(--color-text-primary)]"
            }`}
          >
            {it.label}
          </p>
          {it.status === "current" && (
            <p className="mt-0.5 text-xs text-[var(--color-accent)]">
              진행 중…
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
