"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, RefreshCw, Send } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { formatTime } from "@/lib/format";

type Attachment = { name: string; size: number; url: string; mime: string };

export type ThreadMessage = {
  id: string;
  authorRole?: string;
  authorName?: string;
  body?: string;
  attachments?: Attachment[];
  systemEvent?: string;
  createdAt?: { seconds?: number; _seconds?: number };
};

type Props = {
  disputeId: string;
  initialMessages: ThreadMessage[];
  isPreview: boolean;
  /** 본인 role — 본인 메시지가 우측에 정렬되어 표시된다. */
  myRole: "BUYER" | "VENDOR";
  closed: boolean;
  hospitalName: string;
  vendorName: string;
};

const ROLE_LABEL: Record<string, string> = {
  BUYER: "병원",
  VENDOR: "공급업체",
  ADMIN: "운영자",
  SYSTEM: "시스템",
};

/**
 * 분쟁 메시지 thread — 카카오톡 / 슬랙 style 말풍선.
 *
 * - 본인(myRole) 메시지는 우측 정렬 + accent 배경
 * - 상대(BUYER/VENDOR) 메시지는 좌측 정렬 + 회색 배경
 * - 운영자(ADMIN) 메시지는 중앙 + warning 색
 * - 시스템(SYSTEM) 메시지는 중앙 small caption
 * - sticky bottom input + safe-area
 * - 새 메시지 도착 시 scroll 하단 정렬
 *
 * Buyer/Vendor 양쪽이 공유하는 컴포넌트. mutation 은 `dispute.sendMessage` 호출.
 */
export function DisputeThread({
  disputeId,
  initialMessages,
  isPreview,
  myRole,
  closed,
  hospitalName,
  vendorName,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<ThreadMessage[]>([]);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sendMutation = trpc.dispute.sendMessage.useMutation();

  const messages = [...initialMessages, ...optimistic];

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length]);

  // Phase ξ-3 — iOS 가상 키보드 활성화 시 sticky bottom input 이 가려지지 않도록
  // visualViewport API 로 키보드 높이를 측정해 padding-bottom 으로 보정.
  // interactiveWidget="resizes-content" 와 함께 동작.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    function handler() {
      // viewport.height 가 window.innerHeight 보다 작으면 키보드가 올라온 상태
      if (!vv) return;
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(Math.max(0, offset));
    }
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    handler();
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    };
  }, []);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setError("메시지를 입력해주세요.");
      return;
    }
    if (closed) {
      setError("이미 종결된 분쟁입니다.");
      return;
    }
    if (isPreview) {
      setOptimistic((arr) => [
        ...arr,
        {
          id: `local-${Date.now()}`,
          authorRole: myRole,
          authorName: myRole === "BUYER" ? hospitalName : vendorName,
          body: trimmed,
          attachments: [],
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        },
      ]);
      setBody("");
      return;
    }
    try {
      await sendMutation.mutateAsync({ disputeId, body: trimmed });
      setOptimistic((arr) => [
        ...arr,
        {
          id: `local-${Date.now()}`,
          authorRole: myRole,
          authorName: myRole === "BUYER" ? hospitalName : vendorName,
          body: trimmed,
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

  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          대화
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          새로고침
        </button>
      </div>

      {/* 메시지 컨테이너 */}
      <div
        role="log"
        aria-live="polite"
        aria-label="분쟁 대화 내용"
        className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/40 p-4 md:p-6"
      >
        {messages.length === 0 ? (
          <p className="py-12 text-center text-xs text-[var(--color-text-tertiary)]">
            아직 메시지가 없습니다.
          </p>
        ) : (
          messages.map((m) => {
            const role = m.authorRole ?? "SYSTEM";
            if (role === "SYSTEM" || m.systemEvent) {
              return <SystemBubble key={m.id} message={m} />;
            }
            if (role === "ADMIN") {
              return <AdminBubble key={m.id} message={m} />;
            }
            const isMine = role === myRole;
            return (
              <ChatBubble
                key={m.id}
                message={m}
                isMine={isMine}
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input — desktop inline + mobile sticky bottom (visualViewport 키보드 회피) */}
      <form
        onSubmit={send}
        className={`mt-4 lg:static lg:mt-4 ${
          closed
            ? ""
            : "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border-light)] bg-[var(--color-bg-primary)] p-3 lg:border-0 lg:bg-transparent lg:p-0"
        }`}
        style={{
          paddingBottom: closed
            ? undefined
            : keyboardOffset > 0
              ? `${keyboardOffset + 12}px`
              : "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        {closed ? (
          <p className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/40 p-4 text-center text-xs text-[var(--color-text-tertiary)]">
            종결된 분쟁입니다. 추가 메시지를 보낼 수 없습니다.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-2 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] p-2 focus-within:border-[var(--color-accent)]">
              <textarea
                rows={1}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="메시지를 입력하세요…"
                aria-label="메시지 입력"
                className="min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={sendMutation.isPending || !body.trim()}
                aria-label="메시지 전송"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-[var(--color-error)]">{error}</p>
            )}
            <p className="mt-1.5 hidden text-xs text-[var(--color-text-tertiary)] lg:block">
              Enter 전송 · Shift+Enter 줄바꿈. 운영자와 상대방이 함께 봅니다.
            </p>
          </>
        )}
      </form>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Bubble variants
// ─────────────────────────────────────────────────────────────

function ChatBubble({
  message,
  isMine,
}: {
  message: ThreadMessage;
  isMine: boolean;
}) {
  const role = message.authorRole ?? "SYSTEM";
  const time = formatTime(
    (message.createdAt?.seconds ?? message.createdAt?._seconds ?? 0) * 1000,
  );
  return (
    <div
      className={`flex max-w-full flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
    >
      {!isMine && (
        <p className="px-1 text-xs font-medium text-[var(--color-text-secondary)]">
          {ROLE_LABEL[role] ?? role} · {message.authorName ?? ""}
        </p>
      )}
      <div
        className={`flex items-end gap-1.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}
      >
        <div
          className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isMine
              ? "rounded-br-md bg-[var(--color-accent)] text-white"
              : "rounded-bl-md border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
          }`}
        >
          {message.body ?? ""}
          {message.attachments && message.attachments.length > 0 && (
            <ul className="mt-2 space-y-1">
              {message.attachments.map((a) => (
                <li key={a.name}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-xs ${
                      isMine ? "text-white/90 hover:text-white" : "text-[var(--color-accent)] hover:underline"
                    }`}
                  >
                    <Paperclip className="h-3 w-3" aria-hidden />
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <time className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
          {time}
        </time>
      </div>
    </div>
  );
}

function AdminBubble({ message }: { message: ThreadMessage }) {
  const time = formatTime(
    (message.createdAt?.seconds ?? message.createdAt?._seconds ?? 0) * 1000,
  );
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-warning)]">
        운영자 메시지
      </p>
      <div className="max-w-[88%] rounded-2xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5 px-4 py-2.5 text-center text-sm leading-relaxed text-[var(--color-text-primary)]">
        {message.body ?? ""}
      </div>
      <time className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
        {time}
      </time>
    </div>
  );
}

function SystemBubble({ message }: { message: ThreadMessage }) {
  const time = formatTime(
    (message.createdAt?.seconds ?? message.createdAt?._seconds ?? 0) * 1000,
  );
  return (
    <div className="my-1 flex items-center justify-center gap-2">
      <span className="text-xs text-[var(--color-text-tertiary)]">
        {message.body ?? message.systemEvent ?? "—"}
      </span>
      <time className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]/70">
        {time}
      </time>
    </div>
  );
}
