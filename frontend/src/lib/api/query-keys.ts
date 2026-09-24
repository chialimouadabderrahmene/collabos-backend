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
