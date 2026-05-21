// RSC (Server Component) 에서 tRPC procedure 를 직접 호출할 때 사용.
// HTTP round-trip 없이 in-process 호출.

import { appRouter } from "@/server/api/root";
import { createContext } from "@/server/api/trpc";

export async function trpcServer() {
  const ctx = await createContext();
  return appRouter.createCaller(ctx);
}
