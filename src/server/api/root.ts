import { createTRPCRouter } from "./trpc";
import { hospitalRouter } from "./routers/hospital";
import { vendorRouter } from "./routers/vendor";
import { adminVendorRouter } from "./routers/admin/vendor";
import { productRouter } from "./routers/product";

const adminRouter = createTRPCRouter({
  vendor: adminVendorRouter,
});

export const appRouter = createTRPCRouter({
  hospital: hospitalRouter,
  vendor: vendorRouter,
  admin: adminRouter,
  product: productRouter,
});

export type AppRouter = typeof appRouter;
