import { createTRPCRouter } from "./trpc";
import { hospitalRouter } from "./routers/hospital";
import { vendorRouter } from "./routers/vendor";
import { adminVendorRouter } from "./routers/admin/vendor";

const adminRouter = createTRPCRouter({
  vendor: adminVendorRouter,
});

export const appRouter = createTRPCRouter({
  hospital: hospitalRouter,
  vendor: vendorRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
