import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createContext } from "@/server/api/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(),
    onError({ error, path }) {
      if (process.env.NODE_ENV === "development") {
        console.error(`tRPC error on ${path ?? "?"}: ${error.message}`);
      }
    },
  });

export { handler as GET, handler as POST };
