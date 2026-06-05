"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Send, X, AlertCircle, FileText, Download } from "lucide-react";
import { toast } from "sonner";

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
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc/client";
import type { Product } from "@/lib/types";

const CLASS_LABEL: Record<string, string> = {
  CLASS_1: "1등급",
  CLASS_2: "2등급",
  CLASS_3: "3등급",
  CLASS_4: "4등급",
  NON_DEVICE: "비의료기기",
};

const REVISION_FIELDS = [
  { value: "name", label: "상품명" },
  { value: "udi", label: "UDI" },
  { value: "mfdsLicenseNo", label: "식약처 번호" },
  { value: "categoryId", label: "카테고리" },
  { value: "description", label: "상품 설명" },
  { value: "images", label: "이미지" },
  { value: "certificateUrl", label: "인증서" },
  { value: "priceTiers", label: "가격 티어" },
];

type Action = "approve" | "reject" | "revision";

export function ProductReviewPanel({
  product,
  isPreview,
}: {
  product: Product;
  isPreview: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [revisionSet, setRevisionSet] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const approve = trpc.admin.product.approve.useMutation();
  const reject = trpc.admin.product.reject.useMutation();
  const requestRevision = trpc.admin.product.requestRevision.useMutation();

  const moderation = product.moderation ?? { status: product.status };

  function close() {
    setActive(null);
    setReason("");
    setNote("");
    setRevisionSet(new Set());
    setError(null);
  }

  function toggleRevisionField(v: string) {
    setRevisionSet((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  async function confirm() {
    if (!active) return;
    setError(null);
    try {
      if (active === "approve") {
        await approve.mutateAsync({
          productId: product.id,
          note: note || undefined,
        });
        toast.success("상품을 승인했습니다");
      } else if (active === "reject") {
        await reject.mutateAsync({ productId: product.id, reason });
        toast.success("상품을 반려했습니다");
      } else {
        await requestRevision.mutateAsync({
          productId: product.id,
          revisionFields: Array.from(revisionSet),
          reason,
        });
        toast.success("수정 요청을 전송했습니다");
      }
      close();
      router.refresh();
    } catch (err) {
      const e2 = err as { message?: string };
      const msg = e2.message ?? "처리에 실패했습니다.";
      setError(msg);
      toast.error(msg);
    }
  }

  const pending =
    approve.isPending || reject.isPending || requestRevision.isPending;

  const canApprove = moderation.status === "PENDING_REVIEW";
  const canRequestRevision = moderation.status === "PENDING_REVIEW";
  const canReject = moderation.status === "PENDING_REVIEW";

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          상품 상세
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          {product.name}
        </h2>
        <p className="mt-1 font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
          {product.id}
        </p>
      </div>

      {/* 이미지 placeholder grid */}
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="grid aspect-square place-items-center border border-[var(--color-border-light)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          </div>
        ))}
      </div>

      {/* 정보 dl */}
      <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        <Row
          label="카테고리"
          value={
            product.categoryPath?.length
              ? product.categoryPath.join(" › ")
              : product.categoryId
          }
        />
        <Row label="UDI" value={product.udiCode ?? "—"} mono />
        <Row label="식약처 번호" value={product.mfdsLicenseNo ?? "—"} mono />
        <Row label="등급" value={CLASS_LABEL[product.deviceClass] ?? "—"} />
        <Row label="공급업체" value={product.vendorName} />
        <Row
          label="신청일"
          value={formatDate(
            moderation.submittedAt ?? (product.createdAt as unknown),
          )}
          mono
        />
        {product.certificateUrl && (
          <Row
            label="인증서"
            value={
              <a
                href={product.certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
              >
                <FileText className="h-3 w-3" />
                인증서 PDF
                <Download className="h-3 w-3" />
              </a>
            }
          />
        )}
      </dl>

      {/* 자동 검증 결과 */}
      {product.verification && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            자동 검증
          </p>
          <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <Row
              label="UDI 형식"
              value={
                product.verification.udiValid === true
                  ? "유효"
                  : product.verification.udiValid === false
                    ? "형식 오류"
                    : "확인 안 됨"
              }
            />
            {product.verification.licenseOcr && (
              <Row
                label="인증서 OCR"
                value={`${product.verification.licenseOcr.number} (신뢰도 ${(product.verification.licenseOcr.confidence * 100).toFixed(0)}%)`}
                mono
              />
            )}
          </dl>
        </div>
      )}

      {/* 가격 티어 */}
      {product.priceTiers && product.priceTiers.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            가격 티어
          </p>
          <div className="mt-3 border-y border-[var(--color-border-light)]">
            <div className="grid grid-cols-[1fr_1fr] gap-4 border-b border-[var(--color-border-light)] px-2 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              <span>수량</span>
              <span className="text-right">단가</span>
            </div>
            <ul className="divide-y divide-[var(--color-border-light)]">
              {product.priceTiers.map((t, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[1fr_1fr] gap-4 px-2 py-3 text-sm"
                >
                  <span className="text-[var(--color-text-secondary)]">
                    {t.minQty}개 이상
                  </span>
                  <span className="text-right font-mono tabular-nums">
                    ₩{t.price.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 운영자 액션 */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          운영자 액션
        </p>
        {isPreview && (
          <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">
            PREVIEW · 로그인 후 액션이 활성화됩니다.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActive("approve")}
            disabled={isPreview || !canApprove || pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-text-primary)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
            승인
          </button>
          <button
            type="button"
            onClick={() => setActive("revision")}
            disabled={isPreview || !canRequestRevision || pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] px-4 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            수정 요청
          </button>
          <button
            type="button"
            onClick={() => setActive("reject")}
            disabled={isPreview || !canReject || pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/5 disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
            반려
          </button>
        </div>

        {moderation.statusReason && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning)]/5 p-3 text-xs text-[var(--color-warning)]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <div>
              <p className="font-medium">이전 사유</p>
              <p className="mt-0.5 text-[var(--color-text-secondary)]">
                {moderation.statusReason}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 메모 ledger */}
      <ProductMemoPanel productId={product.id} isPreview={isPreview} />

      {/* Dialog */}
      <Dialog open={active !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          {active === "approve" && (
            <>
              <DialogHeader>
                <DialogTitle>상품 승인</DialogTitle>
                <DialogDescription>
                  승인 즉시 카탈로그에 노출되고 vendor 에게 알림톡이 발송됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="approve-note">내부 메모 (선택)</Label>
                <Textarea
                  id="approve-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="운영자 간 공유용. vendor 에게 노출되지 않습니다."
                />
              </div>
            </>
          )}

          {active === "reject" && (
            <>
              <DialogHeader>
                <DialogTitle>상품 반려</DialogTitle>
                <DialogDescription>
                  반려 사유는 vendor 에게 그대로 전달됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="reject-reason">사유 (필수)</Label>
                <Textarea
                  id="reject-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="예) 식약처 허가번호 조회 결과 등록되지 않은 번호입니다."
                />
              </div>
            </>
          )}

          {active === "revision" && (
            <>
              <DialogHeader>
                <DialogTitle>수정 요청</DialogTitle>
                <DialogDescription>
                  어떤 필드를 수정해야 하는지 선택하고 사유를 입력합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>수정 필드 (1개 이상)</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {REVISION_FIELDS.map((f) => {
                      const checked = revisionSet.has(f.value);
                      return (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => toggleRevisionField(f.value)}
                          className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                            checked
                              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                              : "border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)]"
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revision-reason">사유 (필수)</Label>
                  <Textarea
                    id="revision-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="예) 인증서 PDF의 발행일이 누락되어 있습니다. 재업로드 부탁드립니다."
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <p
              className="error-slide-down border-l-2 border-[var(--color-error)] bg-[var(--color-error)]/5 px-3 py-2 text-sm text-[var(--color-error)]"
              role="alert"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={
                pending ||
                (active === "reject" && reason.trim().length === 0) ||
                (active === "revision" &&
                  (reason.trim().length === 0 || revisionSet.size === 0))
              }
              className={`inline-flex h-10 items-center justify-center rounded-full px-6 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-50 ${
                active === "reject"
                  ? "bg-[var(--color-error)] hover:opacity-90"
                  : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]"
              }`}
            >
              {pending
                ? "처리 중…"
                : active === "approve"
                  ? "승인"
                  : active === "reject"
                    ? "반려 확정"
                    : "요청 전송"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductMemoPanel({
  productId,
  isPreview,
}: {
  productId: string;
  isPreview: boolean;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listQuery = trpc.admin.product.listMemos.useQuery(
    { productId },
    { retry: false, enabled: !isPreview },
  );
  const addMutation = trpc.admin.product.addMemo.useMutation();

  async function submit() {
    setError(null);
    if (body.trim().length === 0) return;
    try {
      await addMutation.mutateAsync({ productId, body: body.trim() });
      toast.success("메모를 추가했습니다");
      setBody("");
      await listQuery.refetch();
    } catch (err) {
      const e2 = err as { message?: string };
      const msg = e2.message ?? "메모 저장에 실패했습니다.";
      setError(msg);
      toast.error(msg);
    }
  }

  const memos = listQuery.data ?? [];

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        운영자 메모
      </p>
      {isPreview ? (
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
          PREVIEW · 로그인 후 메모를 확인할 수 있습니다.
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {listQuery.isLoading && (
              <li className="py-3 text-center text-xs text-[var(--color-text-tertiary)]">
                불러오는 중…
              </li>
            )}
            {!listQuery.isLoading && memos.length === 0 && (
              <li className="py-3 text-center text-xs text-[var(--color-text-tertiary)]">
                등록된 메모가 없습니다
              </li>
            )}
            {memos.map((m) => (
              <li key={m.id} className="py-3">
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-text-primary)]">
                  {m.body}
                </p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  {formatMemoTime(m.createdAt)}
                  <span className="mx-1.5">·</span>
                  <span className="font-mono">{m.actorId.slice(0, 8)}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="메모 입력…"
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                {body.length} / 1000
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={addMutation.isPending || body.trim().length === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 text-xs font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-40"
              >
                <Send className="h-3 w-3" strokeWidth={2.4} />
                {addMutation.isPending ? "저장 중…" : "메모 추가"}
              </button>
            </div>
            {error && (
              <p
                className="error-slide-down border-l-2 border-[var(--color-error)] bg-[var(--color-error)]/5 px-3 py-2 text-xs text-[var(--color-error)]"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        </>
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
        className={`break-all text-sm text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

// formatDate 는 @/lib/format 에서 import 합니다 — Phase ν-4.

function formatMemoTime(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "";
  const w1 = ts as { toDate?: () => Date };
  if (typeof w1.toDate === "function") {
    try {
      return w1.toDate().toLocaleString("ko-KR");
    } catch {
      /* fallthrough */
    }
  }
  const w2 = ts as { seconds?: number; _seconds?: number };
  const sec = w2.seconds ?? w2._seconds;
  if (typeof sec === "number") {
    return new Date(sec * 1000).toLocaleString("ko-KR");
  }
  return "";
}
