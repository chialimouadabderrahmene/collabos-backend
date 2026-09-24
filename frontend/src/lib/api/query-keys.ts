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
