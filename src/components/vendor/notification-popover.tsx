"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Package,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { ComponentType } from "react";

import { trpc } from "@/lib/trpc/client";
import { formatDateTime, tsToMs } from "@/lib/utils/firestore-time";

/**
 * 셀러센터 글로벌 알림 popover — Phase δ-10 백엔드 연동.
 *
 * tRPC notification.listMine / markAllRead.
 * 비로그인·권한 부재 시 query 가 throw → catch 해서 빈 상태로 처리.
 */

type Icon = ComponentType<{ className?: string }>;

const TYPE_ICON: Record<string, { icon: Icon; color: string }> = {
  ORDER_NEW: {
    icon: Package,
    color: "text-[var(--color-status-paid)]",
  },
  ORDER_SHIPPED: {
    icon: Package,
    color: "text-[var(--color-status-shipped)]",
  },
  ORDER_REFUNDED: {
    icon: AlertTriangle,
    color: "text-[var(--color-warning)]",
  },
  DISPUTE_OPENED: {
    icon: AlertTriangle,
    color: "text-[var(--color-warning)]",
  },
  DISPUTE_RESOLVED: {
    icon: CheckCircle2,
    color: "text-[var(--color-success)]",
  },
  SETTLEMENT_APPROVED: {
    icon: Wallet,
    color: "text-[var(--color-success)]",
  },
  SETTLEMENT_PAID: {
    icon: Wallet,
    color: "text-[var(--color-success)]",
  },
  VENDOR_APPROVED: {
    icon: CheckCircle2,
    color: "text-[var(--color-accent)]",
  },
  PRODUCT_APPROVED: {
    icon: CheckCircle2,
    color: "text-[var(--color-accent)]",
  },
  PRODUCT_REJECTED: {
    icon: AlertTriangle,
    color: "text-[var(--color-error)]",
  },
  GROUPBUY_FULFILLED: {
    icon: CheckCircle2,
    color: "text-[var(--color-success)]",
  },
  GROUPBUY_FAILED: {
    icon: AlertTriangle,
    color: "text-[var(--color-warning)]",
  },
};

const DEFAULT_ICON = { icon: Clock, color: "text-[var(--color-text-tertiary)]" };

function relativeTime(ts: unknown): string {
  const ms = tsToMs(ts);
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}일 전`;
  return formatDateTime(ts);
}

export function NotificationPopover() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const notifsQuery = trpc.notification.listMine.useQuery(
    { pageSize: 20 },
    { retry: false, refetchOnWindowFocus: false },
  );
  const utils = trpc.useUtils();
  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("모두 읽음 처리됨");
      utils.notification.listMine.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "읽음 처리 중 오류가 발생했습니다.");
    },
  });

  const notifications = notifsQuery.data?.notifications ?? [];
  const unreadCount = useMemo(
    () => notifications.filter((n) => n.isUnread).length,
    [notifications],
  );

  // 외부 클릭·ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleMarkAllRead() {
    if (unreadCount === 0) return;
    markAllReadMutation.mutate();
  }

  // Phase ξ-1 — 알림 list 본문 (desktop popover / mobile sheet 공용).
  const listContent = (
    <>
      {notifsQuery.isLoading ? (
        <p className="px-4 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
          불러오는 중…
        </p>
      ) : notifsQuery.isError ? (
        <p className="px-4 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
          알림을 불러올 수 없습니다
        </p>
      ) : notifications.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
          새 알림이 없습니다
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-light)]">
          {notifications.map((n) => {
            const meta = TYPE_ICON[n.type ?? ""] ?? DEFAULT_ICON;
            const Icon = meta.icon;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-tertiary)]/60"
                >
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{n.title ?? "알림"}</span>
                      {n.isUnread && (
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                      )}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                      {relativeTime(n.createdAt)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="알림"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-11 w-11 place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] md:h-10 md:w-10"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[var(--color-error)]" />
        )}
      </button>

      {open && (
        <>
          {/* Mobile: fullscreen sheet */}
          <div
            role="dialog"
            aria-label="알림 센터"
            className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg-primary)] md:hidden"
            style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
          >
            <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border-light)] px-4">
              <p className="text-base font-semibold">
                알림
                {unreadCount > 0 && (
                  <span className="ml-2 text-xs font-medium text-[var(--color-accent)]">
                    {unreadCount}건 새 알림
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0 || markAllReadMutation.isPending}
                  className="rounded-full px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-accent)] disabled:opacity-40"
                >
                  모두 읽음
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-11 w-11 place-items-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                  aria-label="닫기"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto pb-20">{listContent}</div>
            <footer
              className="shrink-0 border-t border-[var(--color-border-light)] px-4 py-3 text-center"
              style={{
                paddingBottom: "max(12px, env(safe-area-inset-bottom))",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/seller/notifications");
                }}
                className="text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                모든 알림 보기 →
              </button>
            </footer>
          </div>

          {/* Desktop: anchored popover */}
          <div
            role="dialog"
            aria-label="알림 센터"
            className="popover-slide-down absolute right-0 top-12 z-40 hidden w-[360px] rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] shadow-lg md:block"
          >
            <header className="flex items-center justify-between border-b border-[var(--color-border-light)] px-4 py-3">
              <p className="text-sm font-semibold">
                알림
                {unreadCount > 0 && (
                  <span className="ml-2 text-xs font-medium text-[var(--color-accent)]">
                    {unreadCount}건 새 알림
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0 || markAllReadMutation.isPending}
                className="text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)] disabled:opacity-40"
              >
                모두 읽음
              </button>
            </header>
            <div className="max-h-[480px] overflow-y-auto">{listContent}</div>
            <footer className="border-t border-[var(--color-border-light)] px-4 py-2.5 text-center">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/seller/notifications");
                }}
                className="text-xs font-medium text-[var(--color-accent)] hover:underline"
              >
                모든 알림 보기 →
              </button>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}
