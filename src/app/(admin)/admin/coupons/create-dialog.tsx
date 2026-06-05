"use client";

// Wave H — 쿠폰 페이지 client island.
//
// 입력: trpcServer().admin.coupon.list/counts() 결과.
// 출력: KPI 4 + Segment Tabs + Filter + Table + 새 쿠폰 Dialog.
// mutation 후 router.refresh() 로 재패치.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { CountUp } from "@/components/shared/count-up";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import type { Coupon } from "@/lib/types";

type CouponCounts = {
  active: number;
  scheduled: number;
  expired: number;
  disabled: number;
  totalIssued: number;
  totalUsed: number;
};

type Tab = "ACTIVE" | "SCHEDULED" | "EXPIRED";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "ACTIVE", label: "활성" },
  { value: "SCHEDULED", label: "예정" },
  { value: "EXPIRED", label: "종료" },
];

const STATUS_LABEL: Record<Coupon["status"], string> = {
  ACTIVE: "활성",
  SCHEDULED: "예정",
  EXPIRED: "종료",
  DISABLED: "비활성",
};

const STATUS_TONE: Record<Coupon["status"], string> = {
  ACTIVE: "text-[var(--color-success)]",
  SCHEDULED: "text-[var(--color-accent)]",
  EXPIRED: "text-[var(--color-text-tertiary)]",
  DISABLED: "text-[var(--color-error)]",
};

function tsToDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && v !== null && "seconds" in v) {
    return new Date(((v as { seconds: number }).seconds ?? 0) * 1000);
  }
  if (typeof v === "object" && v !== null && "toDate" in v) {
    const fn = (v as { toDate: () => Date }).toDate;
    if (typeof fn === "function") return fn.call(v);
  }
  return null;
}

function fmtDate(v: unknown): string {
  const d = tsToDate(v);
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

type DeltaTone = "accent" | "warning" | "error" | "success";

export function CouponsClient({
  initialCoupons,
  initialCounts,
  readOnly = false,
}: {
  initialCoupons: Coupon[];
  initialCounts: CouponCounts;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ACTIVE");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // 새 쿠폰 form state
  const [draftCode, setDraftCode] = useState("");
  const [draftName, setDraftName] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">(
    "PERCENT",
  );
  const [discountValue, setDiscountValue] = useState<string>("");
  const [targetType, setTargetType] = useState<Coupon["targetType"]>("ALL");
  const [minOrderAmount, setMinOrderAmount] = useState<string>("");
  const [issueLimit, setIssueLimit] = useState<string>("");
  const [startsAt, setStartsAt] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [expiresAt, setExpiresAt] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const generateCodeMutation = trpc.admin.coupon.generateCode.useMutation();
  const createMutation = trpc.admin.coupon.create.useMutation();
  const disableMutation = trpc.admin.coupon.disable.useMutation();

  const filteredCoupons = useMemo(() => {
    let rows = initialCoupons.filter((c) => c.status === tab);
    if (search) {
      const k = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.code.toLowerCase().includes(k) ||
          c.name.toLowerCase().includes(k),
      );
    }
    return rows;
  }, [initialCoupons, tab, search]);

  async function handleGenerateCode() {
    try {
      const res = await generateCodeMutation.mutateAsync();
      setDraftCode(res.code);
    } catch {
      // fallback: 클라이언트 측 랜덤
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      setDraftCode(code);
    }
  }

  function resetForm() {
    setDraftCode("");
    setDraftName("");
    setDiscountType("PERCENT");
    setDiscountValue("");
    setTargetType("ALL");
    setMinOrderAmount("");
    setIssueLimit("");
    setSubmitError(null);
    const today = new Date();
    setStartsAt(today.toISOString().slice(0, 10));
    const next = new Date();
    next.setDate(next.getDate() + 30);
    setExpiresAt(next.toISOString().slice(0, 10));
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!draftCode.trim()) {
      setSubmitError("쿠폰 코드를 입력해주세요.");
      return;
    }
    if (!draftName.trim()) {
      setSubmitError("쿠폰 이름을 입력해주세요.");
      return;
    }
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      setSubmitError("할인 값을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await createMutation.mutateAsync({
        code: draftCode.trim().toUpperCase(),
        name: draftName.trim(),
        discountType,
        discountValue: value,
        minOrderAmount: minOrderAmount
          ? Number(minOrderAmount)
          : undefined,
        targetType,
        startsAt,
        expiresAt,
        issueLimit: issueLimit ? Number(issueLimit) : undefined,
        perUserLimit: 1,
      });
      toast.success("쿠폰을 생성했습니다");
      setCreateOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "쿠폰 생성에 실패했습니다.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable(couponId: string, code: string) {
    if (readOnly) return;
    if (!confirm(`${code} 쿠폰을 비활성화하시겠습니까?`)) return;
    try {
      await disableMutation.mutateAsync({
        couponId,
        reason: "운영자 수동 비활성화",
      });
      toast.success("쿠폰을 비활성화했습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "비활성화에 실패했습니다.");
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            카탈로그 · 쿠폰
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            쿠폰 관리
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            쿠폰을 발행·관리하고 사용 통계를 확인합니다.
          </p>
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />새 쿠폰
        </button>
      </div>

      {readOnly && (
        <div className="mt-6 border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
          미리보기 모드 — 실제 데이터가 없습니다. Firestore 시드 후 실 데이터로 전환됩니다.
        </div>
      )}

      {/* KPI 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <KpiCell
          label="활성 쿠폰"
          value={initialCounts.active}
          unit="건"
        />
        <KpiCell
          label="예정 쿠폰"
          value={initialCounts.scheduled}
          unit="건"
          deltaTone="accent"
        />
        <KpiCell
          label="총 사용"
          value={initialCounts.totalUsed}
          unit="건"
          deltaTone="success"
        />
        <KpiCell
          label="총 발행 한도"
          value={initialCounts.totalIssued}
          unit="건"
          mono
        />
      </dl>

      {/* Segment Tabs */}
      <nav
        className="mt-10 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="쿠폰 상태 필터"
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          const counts: Record<Tab, number> = {
            ACTIVE: initialCounts.active,
            SCHEDULED: initialCounts.scheduled,
            EXPIRED: initialCounts.expired,
          };
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={active}
              className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs tabular-nums text-[var(--color-text-tertiary)]">
                {counts[t.value]}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-0.5 bg-[var(--color-accent)]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Filter Chip Row */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {(["유형", "적용 대상", "기간"] as const).map((label) => (
          <button
            key={label}
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-3 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]"
          >
            {label}
            <ChevronDown className="h-3 w-3" />
          </button>
        ))}
        <div className="ml-auto inline-flex h-8 items-center gap-2 border-b border-[var(--color-border-light)] px-2 focus-within:border-[var(--color-accent)]">
          <Search className="h-3 w-3 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="쿠폰 코드"
            className="h-full w-48 bg-transparent text-xs placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-8 border-y border-[var(--color-border-light)]">
        <div className="grid grid-cols-[140px_70px_1fr_110px_120px_180px_80px_140px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>코드</span>
          <span>유형</span>
          <span>적용 대상</span>
          <span className="text-right">할인</span>
          <span className="text-right">사용량</span>
          <span>시작 ~ 종료</span>
          <span>상태</span>
          <span className="text-right">액션</span>
        </div>
        {filteredCoupons.length === 0 ? (
          <p className="px-2 py-12 text-center text-sm text-[var(--color-text-tertiary)]">
            해당 상태의 쿠폰이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)]">
            {filteredCoupons.map((c) => {
              const limit = c.issueLimit ?? 0;
              const pct =
                limit > 0
                  ? Math.round(((c.usedCount ?? 0) / limit) * 100)
                  : 0;
              const targetLabel =
                c.targetType === "ALL"
                  ? "전체"
                  : c.targetType === "FIRST_PURCHASE"
                    ? "첫 구매"
                    : c.targetType === "CATEGORY"
                      ? `카테고리 ${c.targetIds?.length ?? 0}개`
                      : `Vendor ${c.targetIds?.length ?? 0}개`;
              return (
                <li
                  key={c.id}
                  className="grid grid-cols-[140px_70px_1fr_110px_120px_180px_80px_140px] items-center gap-4 px-2 py-4 text-sm"
                >
                  <span className="font-mono text-xs font-medium tabular-nums text-[var(--color-text-primary)]">
                    {c.code}
                  </span>
                  <span
                    className={`inline-flex h-5 w-fit items-center rounded-full border px-2 text-[10px] font-medium ${
                      c.discountType === "PERCENT"
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-[var(--color-border-default)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {c.discountType === "PERCENT" ? "%" : "정액"}
                  </span>
                  <span className="truncate text-xs text-[var(--color-text-secondary)]">
                    {c.name}
                    <span className="ml-2 text-[var(--color-text-tertiary)]">
                      · {targetLabel}
                    </span>
                  </span>
                  <span className="text-right font-mono font-semibold tabular-nums">
                    {c.discountType === "PERCENT"
                      ? `${c.discountValue}%`
                      : `−₩${c.discountValue.toLocaleString()}`}
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-xs tabular-nums">
                      {(c.usedCount ?? 0).toLocaleString()}
                      {limit > 0 ? ` / ${limit.toLocaleString()}` : ""}
                    </span>
                    {limit > 0 && (
                      <span className="mt-1 block text-[10px] text-[var(--color-text-tertiary)]">
                        {pct}%
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                    {fmtDate(c.startsAt)} ~ {fmtDate(c.expiresAt)}
                  </span>
                  <span
                    className={`text-xs font-medium ${STATUS_TONE[c.status]}`}
                  >
                    {STATUS_LABEL[c.status]}
                  </span>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      disabled={readOnly || c.status === "DISABLED"}
                      onClick={() => handleDisable(c.id, c.code)}
                      className="text-xs text-[var(--color-error)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      비활성화
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== "undefined" && navigator.clipboard) {
                          navigator.clipboard.writeText(c.code);
                        }
                      }}
                      className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                    >
                      복사
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dialog — 새 쿠폰 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <button type="button" hidden aria-hidden />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 쿠폰 발행</DialogTitle>
            <DialogDescription>
              발행 즉시 적용 대상 사용자에게 사용 가능하게 표시됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            {/* 코드 */}
            <div>
              <label className="block text-xs text-[var(--color-text-tertiary)]">
                쿠폰 코드
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={draftCode}
                  onChange={(e) =>
                    setDraftCode(e.target.value.toUpperCase())
                  }
                  placeholder="예: WELCOME10"
                  className="h-9 flex-1 border-b border-[var(--color-border-light)] bg-transparent px-1 font-mono text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  disabled={generateCodeMutation.isPending}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-3 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3" />
                  {generateCodeMutation.isPending ? "생성 중" : "자동 생성"}
                </button>
              </div>
            </div>

            {/* 이름 */}
            <LineField label="쿠폰 이름">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="신규 가입 환영 10%"
                className="h-7 w-full bg-transparent text-right text-sm text-[var(--color-text-primary)] focus:outline-none"
              />
            </LineField>

            {/* 적용 대상 */}
            <LineField label="적용 대상">
              <select
                value={targetType}
                onChange={(e) =>
                  setTargetType(e.target.value as Coupon["targetType"])
                }
                className="h-7 w-full bg-transparent text-right text-sm text-[var(--color-text-primary)] focus:outline-none"
              >
                <option value="ALL">전체</option>
                <option value="CATEGORY">카테고리</option>
                <option value="VENDOR">Vendor</option>
                <option value="FIRST_PURCHASE">첫 구매</option>
              </select>
            </LineField>

            {/* 할인 유형 */}
            <div className="px-2 py-2.5">
              <label className="block text-xs text-[var(--color-text-tertiary)]">
                할인 유형
              </label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="dtype"
                    checked={discountType === "PERCENT"}
                    onChange={() => setDiscountType("PERCENT")}
                    className="accent-[var(--color-accent)]"
                  />
                  비율 (%)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="dtype"
                    checked={discountType === "FIXED"}
                    onChange={() => setDiscountType("FIXED")}
                    className="accent-[var(--color-accent)]"
                  />
                  정액 (₩)
                </label>
              </div>
            </div>

            {/* 할인 값 */}
            <LineField label="할인 값">
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "PERCENT" ? "10" : "50000"}
                className="h-7 w-full bg-transparent text-right font-mono text-sm tabular-nums focus:outline-none"
              />
            </LineField>

            {/* 최소 주문액 */}
            <LineField label="최소 주문액 (선택)">
              <input
                type="number"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="0"
                className="h-7 w-full bg-transparent text-right font-mono text-sm tabular-nums focus:outline-none"
              />
            </LineField>

            {/* 발행 수 한도 */}
            <LineField label="발행 수 한도 (선택)">
              <input
                type="number"
                value={issueLimit}
                onChange={(e) => setIssueLimit(e.target.value)}
                placeholder="무제한"
                className="h-7 w-full bg-transparent text-right font-mono text-sm tabular-nums focus:outline-none"
              />
            </LineField>

            {/* 기간 */}
            <div className="px-2 py-2.5">
              <label className="block text-xs text-[var(--color-text-tertiary)]">
                유효 기간
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="h-8 flex-1 border-b border-[var(--color-border-light)] bg-transparent px-1 font-mono text-xs tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
                />
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  ~
                </span>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="h-8 flex-1 border-b border-[var(--color-border-light)] bg-transparent px-1 font-mono text-xs tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>
            </div>

            {submitError && (
              <p className="px-2 text-xs text-[var(--color-error)]">
                {submitError}
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "발행 중" : "발행"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function LineField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] px-2 py-2.5">
      <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  unit,
  delta,
  deltaTone,
  decimal,
  mono,
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: string;
  deltaTone?: DeltaTone;
  decimal?: boolean;
  mono?: boolean;
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
        <CountUp value={value} integer={!decimal} />
        {unit && (
          <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
            {unit}
          </span>
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
