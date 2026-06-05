"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, RefreshCw } from "lucide-react";

import { trpc } from "@/lib/trpc/client";

type Attachment = { name: string; size: number; url: string; mime: string };

type Message = {
  id: string;
  authorRole?: string;
  authorName?: string;
  body?: string;
  attachments?: Attachment[];
  systemEvent?: string;
  createdAt?: { seconds?: number };
};

type Props = {
  disputeId: string;
  initialMessages: Message[];
  isPreview: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  BUYER: "병원",
  VENDOR: "공급업체",
  ADMIN: "운영자",
  SYSTEM: "시스템",
};

const ROLE_BORDER: Record<string, string> = {
  BUYER: "border-[var(--color-accent)]",
  VENDOR: "border-[var(--color-border-default)]",
  ADMIN: "border-[var(--color-warning)]",
  SYSTEM: "border-[var(--color-text-tertiary)]",
};

const ROLE_TEXT: Record<string, string> = {
  BUYER: "text-[var(--color-accent)]",
  VENDOR: "text-[var(--color-text-secondary)]",
  ADMIN: "text-[var(--color-warning)]",
  SYSTEM: "text-[var(--color-text-tertiary)]",
};

function formatMs(seconds?: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 16);
}

/**
 * 운영자 — 분쟁 메시지 thread (client island).
 *
 * - 메시지 list 표시 + 새 메시지 append
 * - 운영자 입력 textarea + 전송 → adminMessage mutation
 * - 새로고침 버튼 (router.refresh)
 */
export function DisputeThread({ disputeId, initialMessages, isPreview }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Message[]>([]);

  const adminMessage = trpc.admin.dispute.adminMessage.useMutation();

  async function send() {
    setError(null);
    if (!body.trim()) {
      setError("메시지 내용을 입력해주세요.");
      return;
    }
    if (isPreview) {
      setError("PREVIEW 모드에서는 실제 전송되지 않습니다.");
      return;
    }
    try {
      await adminMessage.mutateAsync({ disputeId, body });
      setOptimistic((arr) => [
        ...arr,
        {
          id: `local-${Date.now()}`,
          authorRole: "ADMIN",
          authorName: "운영자",
          body,
          attachments: [],
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        },
      ]);
      setBody("");
      router.refresh();
    } catch (err) {
      const e2 = err as { message?: string };
      setError(e2.message ?? "메시지 전송에 실패했습니다.");
    }
  }

  const messages = [...initialMessages, ...optimistic];

  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          메시지
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          <RefreshCw className="h-3 w-3" />
          새로고침
        </button>
      </div>
      <ul className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        {messages.length === 0 ? (
          <li className="py-12 text-center text-xs text-[var(--color-text-tertiary)]">
            메시지가 없습니다.
          </li>
        ) : (
          messages.map((m) => {
            const role = m.authorRole ?? "SYSTEM";
            return (
              <li key={m.id} className="py-5">
                <div
                  className={`border-l-2 pl-4 ${ROLE_BORDER[role] ?? ROLE_BORDER.SYSTEM}`}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-xs font-medium ${
                        ROLE_TEXT[role] ?? ROLE_TEXT.SYSTEM
                      }`}
                    >
                      {ROLE_LABEL[role] ?? role}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {m.authorName ?? ""}
                    </span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                      {formatMs(m.createdAt?.seconds)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap text-[var(--color-text-secondary)]">
                    {m.body ?? ""}
                  </p>
                  {m.attachments && m.attachments.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {m.attachments.map((a) => (
                        <li key={a.name}>
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline"
                          >
                            <Paperclip className="h-3 w-3" />
                            {a.name}
                            <span className="font-mono tabular-nums text-[var(--color-text-tertiary)]">
                              · {(a.size / 1024).toFixed(0)} KB
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
      <div className="mt-6 space-y-2">
        <textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="운영자 발언을 입력하세요…"
          className="w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        {error && (
          <p className="text-xs text-[var(--color-error)]">{error}</p>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            발언은 양 당사자에게 공개됩니다.
          </p>
          <button
            type="button"
            onClick={send}
            disabled={adminMessage.isPending}
            className="inline-flex h-8 items-center rounded-full bg-[var(--color-text-primary)] px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {adminMessage.isPending ? "전송 중…" : "메시지 전송"}
          </button>
        </div>
      </div>
    </section>
  );
}
