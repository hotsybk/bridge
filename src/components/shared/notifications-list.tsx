"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  Repeat,
  Users,
  Wallet,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { trpc } from "@/lib/trpc/client";
import { formatDateTime, tsToMs } from "@/lib/utils/firestore-time";

/**
 * Phase ν-2 — 공용 알림 리스트 (buyer / vendor 공용).
 *
 * - KPI: 전체 N · 읽지 않음 M · 오늘 K
 * - 필터 탭: 전체 / 주문 / 분쟁 / 정산 / 정기구독 / 공동구매
 * - divide-y 라인 only — 박스 컨테이너 금지 (디자인 헌법)
 * - cursor pagination "더 보기"
 * - 마운트 시 markAllSeen 은 명시적 액션 (현재는 모두 읽음 버튼만)
 * - deep-link: orderId 있으면 /orders/[id] (buyer) 또는 /seller/orders (vendor)
 */

type Category = "ALL" | "ORDER" | "DISPUTE" | "SETTLEMENT" | "SUBSCRIPTION" | "GROUPBUY";

const CATEGORIES: ReadonlyArray<{ id: Category; label: string }> = [
  { id: "ALL", label: "전체" },
  { id: "ORDER", label: "주문" },
  { id: "DISPUTE", label: "분쟁" },
  { id: "SETTLEMENT", label: "정산" },
  { id: "SUBSCRIPTION", label: "정기구독" },
  { id: "GROUPBUY", label: "공동구매" },
];

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

const TYPE_ICON: Record<string, { icon: Icon; color: string }> = {
  ORDER_NEW: { icon: Package, color: "text-[var(--color-status-paid)]" },
  ORDER_SHIPPED: { icon: Package, color: "text-[var(--color-status-shipped)]" },
  ORDER_DELIVERED: { icon: Package, color: "text-[var(--color-status-delivered)]" },
  ORDER_REFUNDED: { icon: AlertTriangle, color: "text-[var(--color-warning)]" },
  ORDER_CANCELLED: { icon: AlertTriangle, color: "text-[var(--color-text-tertiary)]" },
  DISPUTE_OPENED: { icon: AlertTriangle, color: "text-[var(--color-warning)]" },
  DISPUTE_RESOLVED: { icon: CheckCircle2, color: "text-[var(--color-success)]" },
  SETTLEMENT_APPROVED: { icon: Wallet, color: "text-[var(--color-success)]" },
  SETTLEMENT_PAID: { icon: Wallet, color: "text-[var(--color-success)]" },
  PAYOUT_PAID: { icon: Wallet, color: "text-[var(--color-success)]" },
  VENDOR_APPROVED: { icon: CheckCircle2, color: "text-[var(--color-accent)]" },
  PRODUCT_APPROVED: { icon: CheckCircle2, color: "text-[var(--color-accent)]" },
  PRODUCT_REJECTED: { icon: AlertTriangle, color: "text-[var(--color-error)]" },
  SUBSCRIPTION_RUN_OK: { icon: Repeat, color: "text-[var(--color-success)]" },
  SUBSCRIPTION_RUN_FAILED: { icon: Repeat, color: "text-[var(--color-error)]" },
  GROUPBUY_FULFILLED: { icon: Users, color: "text-[var(--color-success)]" },
  GROUPBUY_FAILED: { icon: Users, color: "text-[var(--color-warning)]" },
  GROUPBUY_JOINED: { icon: Users, color: "text-[var(--color-accent)]" },
};

const DEFAULT_ICON = { icon: Clock, color: "text-[var(--color-text-tertiary)]" };

type NotificationItem = {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  createdAt?: unknown;
  readAt?: unknown | null;
  isUnread: boolean;
  orderId?: string;
  disputeId?: string;
  settlementId?: string;
};

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

export function NotificationsList({
  audience,
}: {
  /** "BUYER" — orderId 클릭 시 /orders/[id], "VENDOR" — /seller/orders. */
  audience: "BUYER" | "VENDOR";
}) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("ALL");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const countsQuery = trpc.notification.counts.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const listQuery = trpc.notification.listMine.useQuery(
    { pageSize: 20, category, cursorMs: null },
    { retry: false, refetchOnWindowFocus: false },
  );

  const utils = trpc.useUtils();

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: (_data, vars) => {
      setItems((prev) =>
        prev.map((n) =>
          n.id === vars.notificationId ? { ...n, isUnread: false, readAt: new Date() } : n,
        ),
      );
      void utils.notification.counts.invalidate();
    },
  });

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      setItems((prev) => prev.map((n) => ({ ...n, isUnread: false, readAt: new Date() })));
      void utils.notification.counts.invalidate();
    },
  });

  // 카테고리 변경 또는 첫 로드 — items 교체.
  useEffect(() => {
    if (listQuery.data) {
      setItems(listQuery.data.notifications);
      setCursor(listQuery.data.nextCursorMs);
      setHasMore(!!listQuery.data.nextCursorMs);
    }
  }, [listQuery.data]);

  // 카테고리 변경 시 cursor reset.
  useEffect(() => {
    setCursor(null);
    setHasMore(false);
    setItems([]);
  }, [category]);

  const [loadingMore, setLoadingMore] = useState(false);

  // "더 보기" — utils.fetch 직접 호출 (vanilla query).
  async function handleLoadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await utils.notification.listMine.fetch({
        pageSize: 20,
        category,
        cursorMs: cursor,
      });
      setItems((prev) => [...prev, ...res.notifications]);
      setCursor(res.nextCursorMs);
      setHasMore(!!res.nextCursorMs);
    } catch {
      // silent — TRPCProvider 의 onError 가 토스트
    } finally {
      setLoadingMore(false);
    }
  }

  const counts = countsQuery.data ?? { total: 0, unread: 0, today: 0 };
  const unreadVisible = useMemo(() => items.filter((n) => n.isUnread).length, [items]);

  function handleItemClick(n: NotificationItem) {
    // 읽음 처리
    if (n.isUnread) {
      markReadMutation.mutate({ notificationId: n.id });
    }
    // deep-link
    if (n.orderId) {
      router.push(audience === "BUYER" ? `/orders/${n.orderId}` : "/seller/orders");
    } else if (n.disputeId) {
      router.push(audience === "BUYER" ? "/orders" : "/seller/orders");
    } else if (n.settlementId) {
      router.push(audience === "BUYER" ? "/orders" : "/seller/settlement");
    }
  }

  return (
    <div className="space-y-12">
      {/* KPI */}
      <section className="grid grid-cols-3 gap-px border-y border-[var(--color-border-light)] bg-[var(--color-border-light)]">
        <KpiCell label="전체" value={counts.total} />
        <KpiCell label="읽지 않음" value={counts.unread} accent />
        <KpiCell label="오늘" value={counts.today} />
      </section>

      {/* 필터 + 모두 읽음 */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="-mx-1 flex flex-wrap gap-1 overflow-x-auto">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-text-primary)] text-[var(--color-bg-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                  }`}
                  aria-pressed={active}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            disabled={unreadVisible === 0 || markAllReadMutation.isPending}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)] disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            모두 읽음
          </button>
        </div>
      </section>

      {/* 리스트 */}
      <section>
        {listQuery.isLoading ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="새 알림이 없습니다"
            description="새 알림은 자동으로 이 화면에 추가됩니다."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {items.map((n) => {
              const meta = TYPE_ICON[n.type ?? ""] ?? DEFAULT_ICON;
              const Icon = meta.icon;
              const clickable =
                !!n.orderId || !!n.disputeId || !!n.settlementId;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    disabled={!clickable && !n.isUnread}
                    className={`flex w-full items-start gap-4 px-1 py-5 text-left transition-colors ${
                      clickable || n.isUnread
                        ? "hover:bg-[var(--color-bg-secondary)]/40"
                        : "cursor-default"
                    }`}
                  >
                    <Icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${meta.color}`}
                      strokeWidth={1.75}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium tracking-tight">
                        <span className="truncate">{n.title ?? "알림"}</span>
                        {n.isUnread && (
                          <span
                            aria-label="읽지 않음"
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
                          />
                        )}
                      </p>
                      {n.body && (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-[var(--color-text-tertiary)] tabular-nums">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
            >
              {loadingMore ? "불러오는 중..." : "더 보기"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 bg-[var(--color-bg-primary)] px-5 py-6 md:px-7 md:py-8">
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p
        className={`mt-3 truncate text-3xl font-semibold tabular-nums tracking-[-0.03em] md:text-4xl ${
          accent ? "text-[var(--color-accent)]" : ""
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-start gap-4 px-1 py-5">
          <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          </div>
        </li>
      ))}
    </ul>
  );
}
