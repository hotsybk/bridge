// Wave V — Debug 도구 hub.
// SUPER_ADMIN only (proxy.ts 가드 + tRPC procedure 가드 이중 방어).

import Link from "next/link";
import {
  Activity,
  Database,
  KeyRound,
  RotateCcw,
  Terminal,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";

export const dynamic = "force-dynamic";

type Tool = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const TOOLS: Tool[] = [
  {
    href: "/admin/debug/explorer",
    label: "Firestore 쿼리 익스플로러",
    description:
      "허용 컬렉션에 where·orderBy·limit 쿼리 실행 — READ-ONLY. 모든 조회는 감사 로그 적재.",
    icon: Database,
  },
  {
    href: "/admin/debug/retry-queue",
    label: "재시도 큐 관리자",
    description:
      "_retryQueue 컬렉션 entry list. 재시도 / 취소 액션. 운영자 액션은 감사 로그 적재.",
    icon: RotateCcw,
  },
  {
    href: "/admin/debug/claims",
    label: "토큰 클레임 뷰어",
    description: "현재 로그인 사용자 Firebase Auth ID Token claims raw JSON 표시.",
    icon: KeyRound,
  },
  {
    href: "/admin/debug/callable",
    label: "Callable 시뮬레이터",
    description:
      "주요 Cloud Function (export · UDI · settings) 을 JSON input 으로 직접 호출.",
    icon: Zap,
  },
  {
    href: "/admin/debug/snapshot",
    label: "Snapshot Probe",
    description:
      "vendors 컬렉션 onSnapshot 실시간 구독 검증. Firestore Console 에서 doc 수정 시 자동 갱신.",
    icon: Activity,
  },
];

export default function AdminDebugPage() {
  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <div className="flex items-start gap-3">
        <Terminal className="mt-1 h-5 w-5 text-[var(--color-accent)]" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            시스템 · 디버그
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            디버그 도구
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            SUPER_ADMIN 전용. 모든 액션은 감사 로그에 기록됩니다.
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group relative flex gap-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] p-6 transition-colors hover:border-[var(--color-accent)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-light)]/40">
              <tool.icon className="h-4 w-4 text-[var(--color-accent)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)]">
                {tool.label}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
                {tool.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
