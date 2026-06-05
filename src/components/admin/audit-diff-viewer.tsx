"use client";

type Props = {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

type Row = {
  key: string;
  before: unknown;
  after: unknown;
  kind: "added" | "removed" | "changed" | "same";
};

/**
 * before / after key-by-key diff viewer (drawer 내부 사용).
 *
 * - before == null → 신규 (모든 after 키가 added·green)
 * - after == null → 삭제 (모든 before 키가 removed·red)
 * - 둘 다 있을 때 → 키별 비교 (변경된 키만 highlight)
 *   - added (after 에만 존재) → green
 *   - removed (before 에만 존재) → red
 *   - changed (양쪽 존재 + 다름) → warning, 2-col before/after
 */
export function AuditDiffViewer({ before, after }: Props) {
  const allKeys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  const rows: Row[] = [...allKeys].map((key) => {
    const b = (before as Record<string, unknown> | null | undefined)?.[key];
    const a = (after as Record<string, unknown> | null | undefined)?.[key];
    let kind: Row["kind"] = "same";
    if (b === undefined) kind = "added";
    else if (a === undefined) kind = "removed";
    else if (JSON.stringify(b) !== JSON.stringify(a)) kind = "changed";
    return { key, before: b, after: a, kind };
  });

  const changedRows = rows.filter((r) => r.kind !== "same");

  if (changedRows.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)]">
        변경 사항 없음
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {changedRows.map((r) => {
        const borderColor =
          r.kind === "added"
            ? "var(--color-success)"
            : r.kind === "removed"
              ? "var(--color-error)"
              : "var(--color-warning)";
        return (
          <div
            key={r.key}
            className="border-l-2 pl-3"
            style={{ borderColor }}
          >
            <p className="font-mono text-xs font-semibold text-[var(--color-text-primary)]">
              {r.key}
            </p>
            {r.kind === "changed" && (
              <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                    before
                  </p>
                  <pre className="mt-1 overflow-x-auto rounded bg-[var(--color-error)]/5 p-2 font-mono text-[11px] text-[var(--color-error)]">
                    {formatValue(r.before)}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                    after
                  </p>
                  <pre className="mt-1 overflow-x-auto rounded bg-[var(--color-success)]/5 p-2 font-mono text-[11px] text-[var(--color-success)]">
                    {formatValue(r.after)}
                  </pre>
                </div>
              </div>
            )}
            {r.kind === "added" && (
              <pre className="mt-1.5 overflow-x-auto rounded bg-[var(--color-success)]/5 p-2 font-mono text-[11px] text-[var(--color-success)]">
                + {formatValue(r.after)}
              </pre>
            )}
            {r.kind === "removed" && (
              <pre className="mt-1.5 overflow-x-auto rounded bg-[var(--color-error)]/5 p-2 font-mono text-[11px] text-[var(--color-error)]">
                − {formatValue(r.before)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
