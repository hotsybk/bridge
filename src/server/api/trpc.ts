// tRPC v11 server-side 셋업.
// Phase 1.6-B 에서 도입. tRPC procedure 들의 context 와 role-based middleware 정의.

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { getServerTokens } from "@/server/firebase/auth";

const BUYER_ROLES = ["BUYER_OWNER", "BUYER_STAFF", "BUYER_VIEWER"];
const VENDOR_ROLES = ["VENDOR_OWNER", "VENDOR_STAFF"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

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

// Phase α-2 — PREVIEW bypass 격리.
// dev 환경에서 디자인 미리보기를 위해 role 가드를 우회하려면 ENABLE_PREVIEW_BYPASS=true
// 를 명시적으로 설정해야 한다. NODE_ENV !== "production" 만으로는 활성화되지 않음.
// 운영/스테이징에서는 절대 활성화 금지.
const PREVIEW_ROLE_BYPASS =
  process.env.ENABLE_PREVIEW_BYPASS === "true" &&
  process.env.NODE_ENV !== "production";

const enforceRole = (allowed: string[], label: string) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.uid) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (!allowed.includes(ctx.role ?? "")) {
      if (PREVIEW_ROLE_BYPASS) {
        // 그냥 통과 — 인증은 되어 있고 dev 미리보기 단계
      } else {
        throw new TRPCError({ code: "FORBIDDEN", message: `${label} 권한이 필요합니다.` });
      }
    }
    return next({ ctx: { ...ctx, uid: ctx.uid } });
  });

export const protectedProcedure = publicProcedure.use(enforceAuth);
export const buyerProcedure = publicProcedure.use(enforceRole(BUYER_ROLES, "구매자"));
export const vendorProcedure = publicProcedure.use(enforceRole(VENDOR_ROLES, "공급업체"));
export const adminProcedure = publicProcedure.use(enforceRole(ADMIN_ROLES, "관리자"));

// Wave L — SUPER_ADMIN 전용 middleware.
// staff(운영자 관리) 같은 보안 critical 액션은 단순 ADMIN 으로 접근 불가.
const enforceSuperAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (ctx.role !== SUPER_ADMIN_ROLE) {
    if (PREVIEW_ROLE_BYPASS) {
      // dev 미리보기 우회 — 운영에서는 정상 차단.
    } else {
      throw new TRPCError({ code: "FORBIDDEN", message: "SUPER_ADMIN 권한이 필요합니다." });
    }
  }
  return next({ ctx: { ...ctx, uid: ctx.uid } });
});

export const superAdminProcedure = publicProcedure.use(enforceAuth).use(enforceSuperAdmin);
