import { createTRPCRouter } from "./trpc";
import { hospitalRouter } from "./routers/hospital";
import { vendorRouter } from "./routers/vendor";
import { adminVendorRouter } from "./routers/admin/vendor";
import { adminProductRouter } from "./routers/admin/product";
import { adminOrderRouter } from "./routers/admin/order";
import { adminDisputeRouter } from "./routers/admin/dispute";
import { adminAuditRouter } from "./routers/admin/audit";
import { adminMonitoringRouter } from "./routers/admin/monitoring";
import { adminNotificationRouter } from "./routers/admin/notification";
import { adminSettingsRouter } from "./routers/admin/settings";
import { adminCategoryRouter } from "./routers/admin/category";
import { adminCouponRouter } from "./routers/admin/coupon";
import { adminGroupbuyRouter } from "./routers/admin/groupbuy";
import { adminHospitalRouter } from "./routers/admin/hospital";
import { adminStaffRouter } from "./routers/admin/staff";
import { adminSettlementRouter } from "./routers/admin/settlement";
import { adminSubscriptionRouter } from "./routers/admin/subscription";
import { adminUdiRouter } from "./routers/admin/udi";
import { adminFeatureFlagRouter } from "./routers/admin/feature-flag";
import { adminDebugRouter } from "./routers/admin/debug";
import { adminSearchRouter } from "./routers/admin/search";
import { productRouter } from "./routers/product";
import { disputeRouter } from "./routers/dispute";
import { couponRouter } from "./routers/coupon";
import { groupbuyRouter } from "./routers/groupbuy";
import { cartRouter } from "./routers/cart";
import { orderRouter } from "./routers/order";
import { subscriptionRouter } from "./routers/subscription";
import { supportRouter } from "./routers/support";
import { notificationRouter } from "./routers/notification";
import { marketingSubscriptionRouter } from "./routers/marketing-subscription";

const adminRouter = createTRPCRouter({
  vendor: adminVendorRouter,
  product: adminProductRouter,
  order: adminOrderRouter,
  dispute: adminDisputeRouter,
  audit: adminAuditRouter,
  monitoring: adminMonitoringRouter,
  notifications: adminNotificationRouter,
  settings: adminSettingsRouter,
  category: adminCategoryRouter,
  coupon: adminCouponRouter,
  groupbuy: adminGroupbuyRouter,
  hospital: adminHospitalRouter,
  staff: adminStaffRouter,
  settlement: adminSettlementRouter,
  subscription: adminSubscriptionRouter,
  udi: adminUdiRouter,
  featureFlag: adminFeatureFlagRouter,
  debug: adminDebugRouter,
  search: adminSearchRouter,
});

export const appRouter = createTRPCRouter({
  hospital: hospitalRouter,
  vendor: vendorRouter,
  admin: adminRouter,
  product: productRouter,
  dispute: disputeRouter,
  coupon: couponRouter,
  groupbuy: groupbuyRouter,
  cart: cartRouter,
  order: orderRouter,
  subscription: subscriptionRouter,
  support: supportRouter,
  notification: notificationRouter,
  marketingSubscription: marketingSubscriptionRouter,
});

export type AppRouter = typeof appRouter;
