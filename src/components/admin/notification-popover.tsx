"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Inbox,
  Package,
  Wallet,
  X,
} from "lucide-react";
import type { ComponentType } from "react";

import { trpc } from "@/lib/trpc/client";
import { formatDateTime, tsToMs } from "@/lib/utils/firestore-time";

/**
 * 운영자 콘솔 알림 popover — Phase ν-1.
 *
 * tRPC admin.notification.list 사용. 최근 운영자 발송·자동 발송 알림 노출.
 * "모든 알림 보기" → /admin/notifications.
 * 권한 부재·미로그인 시 빈 상태 fallback.
 */

type Icon = ComponentType<{ className?: string }>;

const TYPE_ICON: Record<string, { icon: Icon; color: string }> = {
  ORDER_NEW: { icon: Package, color: "text-[var(--color-accent)]" },
  ORDER_SHIPPED: { icon: Package, color: "text-[var(--color-success)]" },
  ORDER_REFUNDED: { icon: AlertTriangle, color: "text-[var(--color-warning)]" },
  DISPUTE_OPENED: { icon: AlertTriangle, color: "text-[var(--color-error)]" },
  DISPUTE_RESOLVED: { icon: CheckCircle2, color: "text-[var(--color-success)]" },
  SETTLEMENT_APPROVED: { icon: Wallet, color: "text-[var(--color-success)]" },
  SETTLEMENT_PAID: { icon: Wallet, color: "text-[var(--color-success)]" },
  VENDOR_APPROVED: { icon: CheckCircle2, color: "text-[var(--color-accent)]" },
  VENDOR_REJECTED: { icon: AlertTriangle, color: "text-[var(--color-error)]" },
  PRODUCT_APPROVED: { icon: CheckCircle2, color: "text-[var(--color-accent)]" },
  PRODUCT_REJECTED: { icon: AlertTriangle, color: "text-[var(--color-error)]" },
  GROUPBUY_FULFILLED: { icon: CheckCircle2, color: "text-[var(--color-success)]" },
  GROUPBUY_FAILED: { icon: AlertTriangle, color: "text-[var(--color-warning)]" },
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

  // Phase ξ-4 — bell dot 표시를 위해 항상 가벼운 prefetch (pageSize=5).
  const listQuery = trpc.admin.notifications.list.useQuery(
    { pageSize: 10 },
    { retry: false, refetchOnWindowFocus: false, enabled: open },
  );
  const badgeQuery = trpc.admin.notifications.list.useQuery(
    { pageSize: 5 },
    {
      retry: false,
      refetchOnWindowFocus: false,
      refetchInterval: 60_000,
    },
  );

  const notifications = listQuery.data?.notifications ?? [];
  // admin 측에는 read state 가 없으므로 "최근 N분 내" 를 새 알림으로 표기
  const newCount = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1h
    return notifications.filter(
      (n: { createdAt?: unknown }) => tsToMs(n.createdAt) > cutoff,
    ).length;
  }, [notifications]);
  const badgeNewCount = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    const arr = badgeQuery.data?.notifications ?? [];
    return arr.filter(
      (n: { createdAt?: unknown }) => tsToMs(n.createdAt) > cutoff,
    ).length;
  }, [badgeQuery.data]);
  const hasNew = badgeNewCount > 0 || newCount > 0;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Phase ξ-1 — 알림 list 본문 (desktop popover / mobile sheet 공용).
  const listContent = (
    <>
      {listQuery.isLoading ? (
        <p className="px-4 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
          불러오는 중…
        </p>
      ) : listQuery.isError ? (
        <p className="px-4 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
          알림을 불러올 수 없습니다
        </p>
      ) : notifications.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Inbox className="mx-auto h-5 w-5 text-[var(--color-text-tertiary)]" />
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            새 알림이 없습니다
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border-light)]">
          {notifications.map((n: {
            id: string;
            type?: string;
            title?: string;
            body?: string;
            targetType?: string;
            createdAt?: unknown;
          }) => {
            const meta = TYPE_ICON[n.type ?? ""] ?? DEFAULT_ICON;
            const Icon = meta.icon;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push("/admin/notifications");
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-tertiary)]/60"
                >
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {n.title ?? "알림"}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                      {relativeTime(n.createdAt)}
                      {n.targetType && (
                        <span className="ml-1.5 font-medium uppercase tracking-wider">
                          · {n.targetType}
                        </span>
                      )}
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
        className="relative grid h-11 w-11 place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] md:h-9 md:w-9"
      >
        <Bell className="h-4 w-4 md:h-3.5 md:w-3.5" />
        {hasNew && (
          <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[var(--color-error)] md:right-2 md:top-2" />
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
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border-light)] px-4">
              <p className="text-base font-semibold">
                알림
                {newCount > 0 && (
                  <span className="ml-2 text-xs font-medium text-[var(--color-accent)]">
                    최근 1시간 {newCount}건
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto pb-20">{listContent}</div>
            <footer
              className="shrink-0 border-t border-[var(--color-border-light)] px-4 py-3 text-center"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/admin/notifications");
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
                {newCount > 0 && (
                  <span className="ml-2 text-xs font-medium text-[var(--color-accent)]">
                    최근 1시간 {newCount}건
                  </span>
                )}
              </p>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                Admin Queue
              </span>
            </header>
            <div className="max-h-[480px] overflow-y-auto">{listContent}</div>
            <footer className="border-t border-[var(--color-border-light)] px-4 py-2.5 text-center">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/admin/notifications");
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
