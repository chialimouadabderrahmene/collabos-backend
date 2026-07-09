export interface DateRange {
  from: Date;
  to: Date;
}

const DEFAULT_WINDOW_DAYS = 90;

export function resolveDateRange(query: {
  from?: string;
  to?: string;
}): DateRange {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  return { from, to };
}
