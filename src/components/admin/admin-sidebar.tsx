"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertCircle,
  Bell,
  Building,
  Building2,
  ClipboardList,
  Coins,
  FileBarChart,
  Flame,
  FolderTree,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Terminal,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * 운영자 콘솔 좌측 sidebar.
 *
 * 그룹별 nav.
 * 활성 항목은 좌측 3px accent 라인 + accent 컬러 텍스트.
 */

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  matchPrefix?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      {
        href: "/admin",
        label: "대시보드",
        icon: LayoutDashboard,
        matchPrefix: "/admin",
      },
    ],
  },
  {
    label: "운영",
    items: [
      { href: "/admin/vendors", label: "입점 심사", icon: Building2 },
      { href: "/admin/products", label: "상품 모더레이션", icon: Package },
      { href: "/admin/orders", label: "주문 감시", icon: ClipboardList },
      { href: "/admin/disputes", label: "분쟁 조정", icon: AlertCircle },
    ],
  },
  {
    label: "카탈로그",
    items: [
      { href: "/admin/categories", label: "카테고리", icon: FolderTree },
      { href: "/admin/coupons", label: "쿠폰", icon: Ticket },
      { href: "/admin/groupbuys", label: "공동구매", icon: Flame },
    ],
  },
  {
    label: "회원",
    items: [
      { href: "/admin/hospitals", label: "병원", icon: Users },
      { href: "/admin/vendors-list", label: "공급업체", icon: Building },
      { href: "/admin/staff", label: "운영자", icon: ShieldCheck },
    ],
  },
  {
    label: "정산·재무",
    items: [
      { href: "/admin/settlement", label: "정산 운영", icon: Wallet },
      { href: "/admin/payouts", label: "지급 이력", icon: Coins },
      { href: "/admin/udi-reports", label: "UDI 보고", icon: FileBarChart },
    ],
  },
  {
    label: "시스템",
    items: [
      { href: "/admin/monitoring", label: "모니터링", icon: Activity },
      { href: "/admin/notifications", label: "알림 발송", icon: Bell },
      { href: "/admin/audit-logs", label: "감사 로그", icon: ScrollText },
      { href: "/admin/settings", label: "설정", icon: Settings },
      { href: "/admin/debug", label: "디버그", icon: Terminal, matchPrefix: "/admin/debug" },
    ],
  },
];

export function AdminSidebar({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
} = {}) {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    if (item.matchPrefix === "/admin") return pathname === "/admin";
    return pathname.startsWith(item.matchPrefix ?? item.href);
  }

  return (
    <nav
      aria-label="운영자 메뉴"
      className={mobile ? "space-y-5" : "space-y-6"}
    >
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label || `g-${gi}`}>
          {group.label && (
            <p
              className={`pb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] ${mobile ? "px-4" : "px-3"}`}
            >
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.href} className="relative">
                  {active && (
                    <span
                      aria-hidden
                      className={`absolute left-0 rounded-r bg-[var(--color-accent)] ${mobile ? "top-2 bottom-2 w-[3px]" : "top-1.5 bottom-1.5 w-[3px]"}`}
                    />
                  )}
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => onNavigate?.()}
                    className={`flex items-center gap-2.5 rounded-md transition-colors ${
                      mobile ? "px-4 py-3 text-[15px]" : "px-3 py-1.5 text-sm"
                    } ${
                      active
                        ? "bg-[var(--color-accent-light)]/40 font-medium text-[var(--color-accent)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <item.icon
                      className={mobile ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5 shrink-0"}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
