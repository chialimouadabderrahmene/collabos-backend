/** Money amounts from the backend are integer minor-unit-free values in the
 * given currency (the API stores whole units, e.g. `totalValue: 14200`). */
export function formatMoney(
  amount: number,
  currency = "USD",
  options: { compact?: boolean } = {},
): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: options.compact ? "compact" : "standard",
  }).format(amount);
}

/** Amount without a currency symbol — for API payloads that omit the
 * currency (e.g. the cart), where guessing a symbol would be wrong. */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(amount);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: string | Date, withTime = false): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function formatRelative(value: string | Date, now = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

/** Two-letter monogram used by brand/user avatars ("Mara Collective" → "MC"). */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}
