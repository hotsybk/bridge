"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/firebase/auth-context";
import { MobileSidebarDrawer } from "./mobile-sidebar-drawer";
import { NotificationPopover } from "./notification-popover";

/**
 * 운영자 콘솔 상단 바.
 *
 * 로고 + Cmd+K 검색 trigger + 알림 popover + 운영자 dropdown.
 * Phase ν-1 — dropdown(권한 표시·설정·로그아웃) + Bell→Popover 연결.
 */
export function AdminTopBar() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/85 backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-2 pl-3 pr-3 md:gap-4 md:pl-6 md:pr-6">
        <div className="flex items-center gap-1 md:gap-3">
          <MobileSidebarDrawer />
          <Link href="/admin" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-text-primary)] text-white">
              <Stethoscope className="h-3.5 w-3.5" />
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight">
                MedPlace
              </span>
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-accent)] sm:inline">
                Admin
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop: full search trigger */}
        <button
          type="button"
          onClick={() =>
            document.dispatchEvent(new CustomEvent("admin:command-palette:open"))
          }
          className="hidden h-9 max-w-md flex-1 items-center gap-2 rounded-full border border-[var(--color-border-light)] px-4 text-left text-xs text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-border-default)] md:inline-flex"
          aria-label="빠른 검색"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">주문번호·vendor·hospital 검색…</span>
          <kbd className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center gap-1 md:gap-2">
          {/* Mobile: icon-only search */}
          <button
            type="button"
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("admin:command-palette:open"),
              )
            }
            className="grid h-11 w-11 place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] md:hidden"
            aria-label="빠른 검색"
          >
            <Search className="h-5 w-5" />
          </button>
          <NotificationPopover />
          <AdminUserMenu />
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// AdminUserMenu — dropdown
// ─────────────────────────────────────────────────────────────

function AdminUserMenu() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRole(null);
      return;
    }
    user
      .getIdTokenResult()
      .then((res) => {
        if (cancelled) return;
        const claim = res.claims?.role;
        setRole(typeof claim === "string" ? claim : null);
      })
      .catch(() => setRole(null));
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await fetch("/api/logout", { method: "POST" });
      if (!res.ok && res.status !== 204) {
        throw new Error(`logout failed: ${res.status}`);
      }
      toast.success("로그아웃되었습니다");
      router.push("/login");
    } catch (err) {
      console.error(err);
      toast.error("로그아웃 중 오류가 발생했습니다");
      setLoggingOut(false);
    }
  }

  const roleLabel =
    role === "SUPER_ADMIN"
      ? "최고 운영자"
      : role === "ADMIN"
        ? "운영자"
        : role
          ? role
          : "운영자";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-bg-secondary)] text-xs font-semibold">
          운
        </span>
        <span className="hidden md:inline">운영자</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div
          role="menu"
          className="popover-slide-down absolute right-0 top-12 z-40 w-56 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] py-1.5 shadow-lg"
        >
          <div className="border-b border-[var(--color-border-light)] px-4 pb-2.5 pt-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              현재 권한
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              {roleLabel}
            </p>
          </div>
          <MenuItem
            onClick={() => {
              setOpen(false);
              router.push("/admin/settings");
            }}
            icon={Settings}
            label="설정"
          />
          <div className="my-1 h-px bg-[var(--color-border-light)]" />
          <MenuItem
            onClick={handleLogout}
            icon={LogOut}
            label={loggingOut ? "로그아웃 중…" : "로그아웃"}
            danger
            disabled={loggingOut}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  icon: Icon,
  label,
  danger,
  disabled,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors disabled:opacity-40 ${
        danger
          ? "text-[var(--color-error)] hover:bg-[var(--color-error)]/5"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
