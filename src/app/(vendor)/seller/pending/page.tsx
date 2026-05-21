import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Clock, FileWarning, ShieldX } from "lucide-react";

// 인증 컨텍스트(cookies) 의존 — 정적 prerender 불가. 매 요청마다 SSR.
export const dynamic = "force-dynamic";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpcServer } from "@/lib/trpc/server";

type StatusConfig = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  body: string;
  tone: "warning" | "info" | "error";
};

const STATUS_MAP: Record<string, StatusConfig> = {
  PENDING_DOCS: {
    icon: FileWarning,
    title: "추가 서류 필요",
    description: "심사를 진행하려면 추가 서류 제출이 필요합니다",
    body: "운영자가 안내한 추가 서류를 등록 이메일로 회신해주세요. 서류 접수 후 다시 심사 큐에 진입합니다.",
    tone: "warning",
  },
  PENDING_REVIEW: {
    icon: Clock,
    title: "심사 진행 중",
    description: "24~72시간 내 안내드립니다",
    body: "제출된 서류를 운영자가 검토하고 있습니다. 승인 시 등록 이메일과 알림톡으로 알려드립니다.",
    tone: "info",
  },
  SUSPENDED: {
    icon: ShieldX,
    title: "이용이 일시 정지되었습니다",
    description: "셀러센터 접근이 제한되었습니다",
    body: "분쟁·정책 위반 등으로 일시 정지된 상태입니다. 자세한 사유와 해제 방법은 고객지원에 문의해주세요.",
    tone: "error",
  },
  REJECTED: {
    icon: AlertTriangle,
    title: "심사 반려",
    description: "제출하신 신청이 반려되었습니다",
    body: "반려 사유는 아래에 표시됩니다. 보완 후 재신청하시려면 고객지원에 문의해주세요.",
    tone: "error",
  },
};

const TONE_CLASS: Record<StatusConfig["tone"], string> = {
  info: "text-[var(--color-info)]",
  warning: "text-[var(--color-warning)]",
  error: "text-[var(--color-error)]",
};

export default async function SellerPendingPage() {
  const trpc = await trpcServer();
  const vendor = await trpc.vendor.getCurrent();

  // 가입 자체가 안 됐으면 온보딩으로
  if (!vendor) {
    redirect("/onboarding/vendor");
  }

  // 이미 APPROVED 면 본 셀러센터로
  if (vendor.status === "APPROVED") {
    redirect("/seller/products");
  }

  const status = String(vendor.status ?? "PENDING_REVIEW");
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.PENDING_REVIEW;
  const Icon = cfg.icon;
  const statusReason = (vendor as { statusReason?: string }).statusReason;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center">
            <Icon className={`h-10 w-10 ${TONE_CLASS[cfg.tone]}`} />
          </div>
          <CardTitle className="text-2xl">{cfg.title}</CardTitle>
          <CardDescription>{cfg.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">{cfg.body}</p>

          <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4 text-xs">
            <p className="font-medium">현재 상태</p>
            <p className="mt-1 font-mono text-[var(--color-text-secondary)]">{status}</p>
            {statusReason && (
              <>
                <p className="mt-3 font-medium">반려·정지 사유</p>
                <p className="mt-1 text-[var(--color-text-secondary)]">{statusReason}</p>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" asChild className="flex-1">
              <Link href="/api/logout">로그아웃</Link>
            </Button>
            <Button asChild className="flex-1">
              <a href="mailto:support@medplace.example.com">고객지원 문의</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
