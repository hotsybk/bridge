// Cloud Functions exports — Wave A: notifications 발송 토대
//
// 각 함수는 named re-export 로 추가하면 Firebase CLI 가 자동 감지.
// e.g.:
//   export { subscriptionRunner } from "./scheduled/subscription-runner";
//   export { createOrder } from "./callable/create-order";

import {setGlobalOptions} from "firebase-functions/v2";

setGlobalOptions({
  region: "asia-northeast3",
  maxInstances: 10,
});

export {onNotificationCreated} from "./triggers/on-notification-created";
export {onVendorDocUploaded} from "./triggers/on-vendor-doc-uploaded";
export {onProductSubmitted} from "./triggers/on-product-submitted";
export {onProductApproved} from "./triggers/on-product-approved";
export {onProductApprovedAlgoliaIndex} from "./triggers/on-product-approved-algolia-index";
export {onProductDeletedAlgoliaRemove} from "./triggers/on-product-deleted-algolia-remove";
export {onOrderCreated} from "./triggers/on-order-created";
export {onSubOrderShipped} from "./triggers/on-suborder-shipped";
export {onPaymentFailed} from "./triggers/on-payment-failed";
export {onDisputeCreated} from "./triggers/on-dispute-created";
export {onDisputeMessageCreated} from "./triggers/on-dispute-message-created";
export {onDisputeResolved} from "./triggers/on-dispute-resolved";
export {onCategoryChanged} from "./triggers/on-category-changed";
export {onHospitalNameChanged} from "./triggers/on-hospital-name-changed";
export {onVendorNameChanged} from "./triggers/on-vendor-name-changed";
export {onCouponRedeemed} from "./triggers/on-coupon-redeemed";
export {onGroupbuyCreated} from "./triggers/on-groupbuy-created";
export {onSystemAlertCreated} from "./triggers/on-system-alert-created";
export {disputeSlaChecker} from "./scheduled/dispute-sla-checker";
export {couponExpirer} from "./scheduled/coupon-expirer";
export {groupbuyCloser} from "./scheduled/groupbuy-closer";
export {settlementDaily} from "./scheduled/settlement-daily";
export {udiMonthlyReport} from "./scheduled/udi-monthly-report";
export {scheduledNotificationSender} from "./scheduled/scheduled-notification-sender";
export {metricsHourly} from "./scheduled/metrics-hourly";
export {healthcheck} from "./scheduled/healthcheck";
export {auditAnomalyDetector} from "./scheduled/audit-anomaly-detector";
export {auditArchive} from "./scheduled/audit-archive";
export {subscriptionRunner} from "./scheduled/subscription-runner";
export {retryQueueProcessor} from "./scheduled/retry-queue-processor";
export {inviteExpirer} from "./scheduled/invite-expirer";
export {firestoreBackup} from "./scheduled/firestore-backup";
export {cronHeartbeatMonitor} from "./scheduled/cron-heartbeat-monitor";
export {exportOrdersCsv} from "./callable/export-orders-csv";
export {exportSettlements} from "./callable/export-settlements";
export {exportAuditLogs} from "./callable/export-audit-logs";
export {triggerUdiReport} from "./callable/trigger-udi-report";
export {exportSystemSettings} from "./callable/export-system-settings";
export {importSystemSettings} from "./callable/import-system-settings";
export {reindexProducts} from "./callable/reindex-products";
