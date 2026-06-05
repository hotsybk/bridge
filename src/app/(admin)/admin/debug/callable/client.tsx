"use client";

// Wave V — Cloud Function callable simulator.
// 배포된 callable function 화이트리스트 + JSON input → 직접 호출 → 결과 표시.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Loader2, Play, Zap } from "lucide-react";

import { app } from "@/lib/firebase/client";

type CallableSpec = {
  name: string;
  label: string;
  description: string;
  defaultInput: string;
};

const CALLABLES: CallableSpec[] = [
  {
    name: "exportOrdersCsv",
    label: "exportOrdersCsv",
    description: "주문 CSV/JSON export. 입력: { status?, format? }",
    defaultInput: JSON.stringify({ status: "PAID" }, null, 2),
  },
  {
    name: "exportAuditLogs",
    label: "exportAuditLogs",
    description: "감사 로그 CSV/JSON export. 입력: { actorRole?, action?, format? }",
    defaultInput: JSON.stringify({ format: "csv" }, null, 2),
  },
  {
    name: "exportSystemSettings",
    label: "exportSystemSettings",
    description: "시스템 설정 5 section + flags + categories JSON export. 입력 없음.",
    defaultInput: "{}",
  },
  {
    name: "importSystemSettings",
    label: "importSystemSettings (SUPER_ADMIN)",
    description:
      "시스템 설정 복원. 입력: { bundle: { systemSettings: {...} } }. 위험.",
    defaultInput: JSON.stringify(
      { bundle: { systemSettings: { general: { platformName: "메디플레이스" } } } },
      null,
      2,
    ),
  },
  {
    name: "triggerUdiReport",
    label: "triggerUdiReport",
    description: "UDI 월말 보고 수동 트리거. 입력: { period?: 'YYYY-MM' }",
    defaultInput: JSON.stringify({ period: "2026-05" }, null, 2),
  },
  {
    name: "reindexProducts",
    label: "reindexProducts",
    description:
      "Algolia 전체 재색인 (ACTIVE/APPROVED). env 미설정 시 mock count 반환. 입력 없음.",
    defaultInput: "{}",
  },
];

export function CallableClient() {
  const [selectedName, setSelectedName] = useState(CALLABLES[0].name);
  const selected = useMemo(
    () => CALLABLES.find((c) => c.name === selectedName) ?? CALLABLES[0],
    [selectedName],
  );

  const [input, setInput] = useState(selected.defaultInput);
  const [output, setOutput] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onSelect(name: string) {
    setSelectedName(name);
    const next = CALLABLES.find((c) => c.name === name);
    if (next) setInput(next.defaultInput);
    setOutput(null);
    setErrorMsg(null);
  }

  async function run() {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);
    setOutput(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch (e) {
      setErrorMsg(`JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
      return;
    }

    try {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const functions = getFunctions(app, "asia-northeast3");
      const fn = httpsCallable(functions, selected.name);
      const { data } = await fn(parsed);
      setOutput(JSON.stringify(data, null, 2));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <Link
        href="/admin/debug"
        className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        디버그 도구
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <Zap className="mt-1 h-5 w-5 text-[var(--color-accent)]" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            디버그 · Callable
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            Callable 시뮬레이터
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            화이트리스트된 Cloud Function 만 호출 가능. importSystemSettings 등
            위험 작업은 신중히.
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-[300px_1fr]">
        {/* 좌측 — function list */}
        <div className="space-y-1">
          {CALLABLES.map((c) => {
            const active = c.name === selectedName;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => onSelect(c.name)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                  active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/40"
                    : "border-[var(--color-border-light)] hover:border-[var(--color-border-default)]"
                }`}
              >
                <p
                  className={`font-medium ${
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-primary)]"
                  }`}
                >
                  {c.label}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--color-text-tertiary)]">
                  {c.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* 우측 — input · output */}
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              요청 JSON
            </p>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={12}
              className="mt-2 w-full rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-3 font-mono text-[11px] leading-relaxed focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={run}
              disabled={loading}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {loading ? "실행 중…" : "호출"}
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4 text-xs text-[var(--color-error)]">
              {errorMsg}
            </div>
          )}

          {output && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                응답
              </p>
              <pre className="mt-2 max-h-[400px] overflow-auto rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-3 font-mono text-[11px] leading-relaxed">
                {output}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
