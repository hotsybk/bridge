"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldX, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";

type Action = "approve" | "reject" | "suspend";

const ACTION_META: Record<
  Action,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    cta: string;
    requireReason: boolean;
    tone: "primary" | "destructive" | "warning";
  }
> = {
  approve: {
    label: "승인",
    icon: CheckCircle2,
    title: "입점 승인",
    description: "이 공급업체의 입점을 승인합니다. 셀러센터 접근이 즉시 허용되고 알림톡이 발송됩니다.",
    cta: "승인",
    requireReason: false,
    tone: "primary",
  },
  reject: {
    label: "반려",
    icon: XCircle,
    title: "입점 반려",
    description: "신청을 반려합니다. 입력한 사유는 사용자에게 그대로 전달됩니다.",
    cta: "반려",
    requireReason: true,
    tone: "destructive",
  },
  suspend: {
    label: "일시정지",
    icon: ShieldX,
    title: "이용 일시정지",
    description: "공급업체의 셀러센터 접근을 일시 정지합니다. 사유는 사용자에게 전달됩니다.",
    cta: "일시정지",
    requireReason: true,
    tone: "warning",
  },
};

export function VendorActions({
  vendorId,
  currentStatus,
}: {
  vendorId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const approve = trpc.admin.vendor.approve.useMutation();
  const reject = trpc.admin.vendor.reject.useMutation();
  const suspend = trpc.admin.vendor.suspend.useMutation();

  function close() {
    setActive(null);
    setReason("");
    setNote("");
    setError(null);
  }

  async function confirm() {
    if (!active) return;
    setError(null);
    try {
      if (active === "approve") {
        await approve.mutateAsync({ vendorId, note: note || undefined });
      } else if (active === "reject") {
        await reject.mutateAsync({ vendorId, reason });
      } else {
        await suspend.mutateAsync({ vendorId, reason });
      }
      close();
      router.refresh();
    } catch (err) {
      const e2 = err as { message?: string };
      setError(e2.message ?? "처리에 실패했습니다.");
    }
  }

  const pending =
    approve.isPending || reject.isPending || suspend.isPending;

  const canApprove = currentStatus !== "APPROVED";
  const canReject = currentStatus === "PENDING_REVIEW" || currentStatus === "PENDING_DOCS";
  const canSuspend = currentStatus === "APPROVED";

  const showHint =
    currentStatus === "REJECTED"
      ? "이 신청은 반려된 상태입니다. 재신청은 vendor 측에서 새 가입을 통해 진행됩니다."
      : currentStatus === "SUSPENDED"
        ? "정지 상태입니다. 승인 버튼으로 정지 해제가 가능합니다."
        : null;

  return (
    <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-6">
      <h2 className="text-lg font-semibold">심사 액션</h2>
      {showHint && (
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{showHint}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={() => setActive("approve")} disabled={!canApprove || pending}>
          <CheckCircle2 className="mr-1 h-4 w-4" />
          승인
        </Button>
        <Button
          variant="outline"
          onClick={() => setActive("reject")}
          disabled={!canReject || pending}
        >
          <XCircle className="mr-1 h-4 w-4" />
          반려
        </Button>
        <Button
          variant="outline"
          onClick={() => setActive("suspend")}
          disabled={!canSuspend || pending}
        >
          <ShieldX className="mr-1 h-4 w-4" />
          일시정지
        </Button>
      </div>

      <Dialog open={active !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{ACTION_META[active].title}</DialogTitle>
                <DialogDescription>{ACTION_META[active].description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {ACTION_META[active].requireReason ? (
                  <div className="space-y-2">
                    <Label htmlFor="reason">사유 (필수)</Label>
                    <Textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                      maxLength={500}
                      placeholder="사용자에게 그대로 전달됩니다."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="note">내부 메모 (선택)</Label>
                    <Textarea
                      id="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="운영자 간 공유용. 사용자에게 노출되지 않습니다."
                    />
                  </div>
                )}
                {error && (
                  <p className="text-sm text-[var(--color-error)]" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={close} disabled={pending}>
                  취소
                </Button>
                <Button
                  onClick={confirm}
                  disabled={
                    pending ||
                    (ACTION_META[active].requireReason && reason.trim().length === 0)
                  }
                >
                  {pending ? "처리 중..." : ACTION_META[active].cta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
