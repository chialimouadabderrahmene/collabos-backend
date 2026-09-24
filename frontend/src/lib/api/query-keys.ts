/** Central query-key factory so invalidation is consistent across features. */
export const queryKeys = {
  session: ["session"] as const,
  profile: ["users", "me"] as const,

  brands: {
    mine: ["brands", "mine"] as const,
    list: (query: object) => ["brands", "list", query] as const,
    detail: (id: string) => ["brands", "detail", id] as const,
    members: (id: string) => ["brands", id, "members"] as const,
    categories: ["categories"] as const,
  },

  briefs: {
    list: (query: object) => ["briefs", "list", query] as const,
    detail: (id: string) => ["briefs", id] as const,
    applications: (id: string) => ["briefs", id, "applications"] as const,
  },

  applications: {
    mine: (query: object) => ["applications", "mine", query] as const,
  },

  deals: {
    all: ["deals"] as const,
    list: (query: object) => ["deals", "list", query] as const,
    detail: (id: string) => ["deals", id] as const,
    proposals: (id: string) => ["deals", id, "proposals"] as const,
    responsibilities: (id: string) => ["deals", id, "responsibilities"] as const,
    milestones: (id: string) => ["deals", id, "milestones"] as const,
  },

  contracts: {
    all: ["contracts"] as const,
    list: (query: object) => ["contracts", "list", query] as const,
    detail: (id: string) => ["contracts", id] as const,
    versions: (id: string) => ["contracts", id, "versions"] as const,
    history: (id: string) => ["contracts", id, "history"] as const,
  },

  drops: {
    all: ["drops"] as const,
    list: (query: object) => ["drops", "list", query] as const,
    detail: (id: string) => ["drops", id] as const,
    page: (id: string) => ["drops", id, "page"] as const,
    seo: (id: string) => ["drops", id, "seo"] as const,
    media: (id: string) => ["drops", id, "media"] as const,
    products: (id: string) => ["drops", id, "products"] as const,
  },

  products: {
    all: ["products"] as const,
    list: (query: object) => ["products", "list", query] as const,
    detail: (id: string) => ["products", id] as const,
    variants: (id: string) => ["products", id, "variants"] as const,
    media: (id: string) => ["products", id, "media"] as const,
    stock: (id: string, variantId: string) => ["products", id, "variants", variantId, "stock"] as const,
  },

  cart: ["cart"] as const,

  orders: {
    all: ["orders"] as const,
    list: (query: object) => ["orders", "list", query] as const,
    detail: (id: string) => ["orders", id] as const,
    refunds: (id: string) => ["orders", id, "refunds"] as const,
    shipments: (id: string) => ["orders", id, "shipments"] as const,
  },

  payments: {
    mine: ["payments", "mine"] as const,
    connect: ["payments", "connect"] as const,
    invoices: ["payments", "invoices"] as const,
    transactions: (query: object) => ["payments", "transactions", query] as const,
  },

  payouts: {
    balance: ["payouts", "balance"] as const,
    list: (query: object) => ["payouts", "list", query] as const,
    transfers: (query: object) => ["payouts", "transfers", query] as const,
    report: (query: object) => ["payouts", "report", query] as const,
  },

  analytics: {
    report: (query: object) => ["analytics", "report", query] as const,
    revenue: (query: object) => ["analytics", "revenue", query] as const,
    traffic: (query: object) => ["analytics", "traffic", query] as const,
    prediction: (brandId: string) => ["analytics", "prediction", brandId] as const,
  },

  messages: {
    conversations: ["messages", "conversations"] as const,
    conversation: (id: string) => ["messages", "conversations", id] as const,
    thread: (id: string) => ["messages", "conversations", id, "messages"] as const,
  },

  opportunities: {
    all: ["opportunities"] as const,
    list: (query: object) => ["opportunities", "list", query] as const,
    detail: (id: string) => ["opportunities", id] as const,
    draft: (id: string) => ["opportunities", id, "draft"] as const,
    assets: (id: string) => ["opportunities", id, "assets"] as const,
    versions: (id: string) => ["opportunities", id, "versions"] as const,
    version: (id: string, n: number) => ["opportunities", id, "versions", n] as const,
    shareLinks: (id: string) => ["opportunities", id, "share-links"] as const,
    activity: (id: string) => ["opportunities", id, "activity"] as const,
    members: (id: string) => ["opportunities", id, "members"] as const,
    suggestions: (id: string) => ["opportunities", id, "ai-suggestions"] as const,
  },
} as const;
