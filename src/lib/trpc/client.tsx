"use client";

import { useState, type ReactNode } from "react";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { toast } from "sonner";
import superjson from "superjson";

import type { AppRouter } from "@/server/api/root";
import { getBaseUrl } from "./shared";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Phase ν-1 — tRPC code → 한글 메시지 매핑.
 * UNAUTHORIZED·FORBIDDEN 은 query·mutation 양쪽에서 silent 처리하지 않고 toast.
 * page-level error.tsx 로 떨어지는 INTERNAL_SERVER_ERROR 는 query 측에서 silent
 * (error.tsx 가 fallback 렌더).
 */
const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "로그인이 필요합니다",
  FORBIDDEN: "권한이 없습니다",
  NOT_FOUND: "찾을 수 없습니다",
  BAD_REQUEST: "잘못된 요청입니다",
  TOO_MANY_REQUESTS: "잠시 후 다시 시도해 주세요",
  INTERNAL_SERVER_ERROR: "서버 오류가 발생했습니다",
  TIMEOUT: "요청 시간이 초과되었습니다",
  PARSE_ERROR: "요청 형식이 올바르지 않습니다",
  PRECONDITION_FAILED: "처리 조건이 충족되지 않았습니다",
  PAYLOAD_TOO_LARGE: "요청이 너무 큽니다",
};

function extractCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const data = (err as { data?: { code?: string } }).data;
  return data?.code;
}

function extractMessage(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  return (err as { message?: string }).message;
}

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30 * 1000, refetchOnWindowFocus: false },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            const code = extractCode(error);
            // UNAUTHORIZED / FORBIDDEN → toast 한 번
            if (code === "UNAUTHORIZED") {
              toast.error(MESSAGES.UNAUTHORIZED!);
              return;
            }
            if (code === "FORBIDDEN") {
              toast.error(MESSAGES.FORBIDDEN!);
              return;
            }
            // 그 외 query 에러는 silent — page-level error.tsx 가 fallback 렌더.
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            const code = extractCode(error);
            const fallback = MESSAGES[code ?? ""];
            const message =
              fallback ?? extractMessage(error) ?? "처리 중 오류가 발생했습니다";
            toast.error(message);
          },
        }),
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
