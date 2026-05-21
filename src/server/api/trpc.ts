// tRPC v11 server-side 셋업.
// Phase 1.6-B 에서 도입. tRPC procedure 들의 context 와 role-based middleware 정의.

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { getServerTokens } from "@/server/firebase/auth";

const BUYER_ROLES = ["BUYER_OWNER", "BUYER_STAFF", "BUYER_VIEWER"];
const VENDOR_ROLES = ["VENDOR_OWNER", "VENDOR_STAFF"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export type Ctx = {
  uid?: string;
  role?: string;
  hospitalId?: string;
  vendorId?: string;
};

/**
 * tRPC context — 모든 procedure 가 받는다.
 * next-firebase-auth-edge 의 getTokens 로 서명 쿠키를 검증하고
 * uid + Custom Claims(role/hospitalId/vendorId) 를 노출한다.
 */
export async function createContext(): Promise<Ctx> {
  try {
    const tokens = await getServerTokens();
    if (!tokens) return {};
    const dt = tokens.decodedToken as Record<string, unknown>;
    return {
      uid: tokens.decodedToken.uid,
      role: dt.role as string | undefined,
      hospitalId: dt.hospitalId as string | undefined,
      vendorId: dt.vendorId as string | undefined,
    };
  } catch {
    return {};
  }
}

const t = initTRPC.context<Ctx>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, uid: ctx.uid } });
});

const enforceRole = (allowed: string[], label: string) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.uid) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (!allowed.includes(ctx.role ?? "")) {
      throw new TRPCError({ code: "FORBIDDEN", message: `${label} 권한이 필요합니다.` });
    }
    return next({ ctx: { ...ctx, uid: ctx.uid } });
  });

export const protectedProcedure = publicProcedure.use(enforceAuth);
export const buyerProcedure = publicProcedure.use(enforceRole(BUYER_ROLES, "구매자"));
export const vendorProcedure = publicProcedure.use(enforceRole(VENDOR_ROLES, "공급업체"));
export const adminProcedure = publicProcedure.use(enforceRole(ADMIN_ROLES, "관리자"));
