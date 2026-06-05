"use client";

// Wave V — Firestore Query Explorer client island.
// READ-ONLY. 허용 컬렉션 dropdown + where 조건 (최대 5) + orderBy + limit.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Database, Play, Plus, X } from "lucide-react";

import { trpc } from "@/lib/trpc/client";

type Op =
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "array-contains"
  | "in";

const OPS: Op[] = ["==", "!=", ">", "<", ">=", "<=", "array-contains", "in"];

type WhereRow = {
  field: string;
  op: Op;
  raw: string;
};

// raw 문자열을 적절한 JSON value 로 파싱.
// "true"/"false"/숫자 → 자동 변환. 그 외는 string.
// "[1,2]" 또는 '["a","b"]' 같은 JSON 배열은 파싱.
function parseValue(raw: string): unknown {
  const t = raw.trim();
  if (t === "") return "";
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) {
    try {
      return JSON.parse(t);
    } catch {
      // fallthrough
    }
  }
  return t;
}

export function ExplorerClient() {
  const colQ = trpc.admin.debug.listCollections.useQuery(undefined, {
    retry: false,
  });
  const collections = useMemo(() => colQ.data ?? [], [colQ.data]);

  const [collection, setCollection] = useState("vendors");
  const [where, setWhere] = useState<WhereRow[]>([]);
  const [orderBy, setOrderBy] = useState("");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(20);
  const [result, setResult] = useState<{ rows: unknown[]; count: number } | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // queryFirestore 는 query → 직접 client 에서 fetch trigger 필요.
  // 대신 useQuery 를 enabled:false 로 두고 refetch 로 트리거.
  const queryQ = trpc.admin.debug.queryFirestore.useQuery(
    {
      collection,
      where: where.map((w) => ({ field: w.field, op: w.op, value: parseValue(w.raw) })),
      orderBy: orderBy || undefined,
      direction,
      limit,
    },
    { enabled: false, retry: false },
  );

  async function runQuery() {
    setErrorMsg(null);
    setResult(null);
    const r = await queryQ.refetch();
    if (r.error) {
      setErrorMsg(r.error.message);
      return;
    }
    if (r.data) {
      setResult(r.data as { rows: unknown[]; count: number });
    }
  }

  function updateWhere(idx: number, patch: Partial<WhereRow>) {
    setWhere((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)),
    );
  }

  function addWhere() {
    if (where.length >= 5) return;
    setWhere((prev) => [...prev, { field: "", op: "==", raw: "" }]);
  }

  function removeWhere(idx: number) {
    setWhere((prev) => prev.filter((_, i) => i !== idx));
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
        <Database className="mt-1 h-5 w-5 text-[var(--color-accent)]" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            디버그 · Firestore
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            쿼리 익스플로러
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            허용 컬렉션 화이트리스트만 READ-ONLY 쿼리. 모든 조회는 감사 로그 적재.
          </p>
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="mt-10 space-y-6 border-y border-[var(--color-border-light)] py-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
          <label className="text-xs text-[var(--color-text-tertiary)]">
            컬렉션
          </label>
          <select
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            className="h-8 w-full bg-transparent text-sm focus:outline-none"
          >
            {collections.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
          <label className="text-xs text-[var(--color-text-tertiary)]">
            where ({where.length}/5)
          </label>
          <div className="space-y-2">
            {where.map((w, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_120px_1fr_auto] items-center gap-2"
              >
                <input
                  type="text"
                  value={w.field}
                  onChange={(e) => updateWhere(idx, { field: e.target.value })}
                  placeholder="필드명"
                  className="h-8 border-b border-[var(--color-border-light)] bg-transparent font-mono text-xs placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
                />
                <select
                  value={w.op}
                  onChange={(e) =>
                    updateWhere(idx, { op: e.target.value as Op })
                  }
                  className="h-8 bg-transparent font-mono text-xs focus:outline-none"
                >
                  {OPS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={w.raw}
                  onChange={(e) => updateWhere(idx, { raw: e.target.value })}
                  placeholder='값 ("ACTIVE", true, 100, ["a","b"])'
                  className="h-8 border-b border-[var(--color-border-light)] bg-transparent font-mono text-xs placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeWhere(idx)}
                  className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addWhere}
              disabled={where.length >= 5}
              className="inline-flex h-7 items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              where 추가
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
          <label className="text-xs text-[var(--color-text-tertiary)]">
            orderBy
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
              placeholder="필드명 (선택)"
              className="h-8 flex-1 border-b border-[var(--color-border-light)] bg-transparent font-mono text-xs placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "asc" | "desc")}
              className="h-8 bg-transparent text-xs focus:outline-none"
            >
              <option value="desc">desc</option>
              <option value="asc">asc</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
          <label className="text-xs text-[var(--color-text-tertiary)]">
            limit (max 50)
          </label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
            min={1}
            max={50}
            className="h-8 w-24 border-b border-[var(--color-border-light)] bg-transparent font-mono text-xs tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={queryQ.isFetching}
            onClick={runQuery}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {queryQ.isFetching ? "실행 중…" : "쿼리 실행"}
          </button>
        </div>
      </div>

      {/* 결과 */}
      {errorMsg && (
        <div className="mt-6 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4 text-xs text-[var(--color-error)]">
          {errorMsg}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            결과 ({result.count}개)
          </p>
          <pre className="mt-3 max-h-[600px] overflow-auto rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-4 font-mono text-[11px] leading-relaxed">
            {JSON.stringify(result.rows, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
