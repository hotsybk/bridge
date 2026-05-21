export const COLLECTIONS = {
  users: "users",
  hospitals: "hospitals",
  vendors: "vendors",
  products: "products",
  orders: "orders",
  subscriptions: "subscriptions",
  groupBuys: "groupBuys",
  rfqs: "rfqs",
  settlements: "settlements",
  notifications: "notifications",
  auditLogs: "auditLogs",
  categories: "categories",
  retryQueue: "_retryQueue",
} as const;

export const SUB_COLLECTIONS = {
  hospitalMembers: (hospitalId: string) => `hospitals/${hospitalId}/members`,
  vendorMembers: (vendorId: string) => `vendors/${vendorId}/members`,
  subOrders: (orderId: string) => `orders/${orderId}/subOrders`,
  subOrderItems: (orderId: string, subOrderId: string) =>
    `orders/${orderId}/subOrders/${subOrderId}/items`,
  subscriptionRuns: (subId: string) => `subscriptions/${subId}/runs`,
  groupBuyParticipations: (gbId: string) => `groupBuys/${gbId}/participations`,
  groupBuyShards: (gbId: string) => `groupBuys/${gbId}/counterShards`,
  rfqQuotes: (rfqId: string) => `rfqs/${rfqId}/quotes`,
} as const;
