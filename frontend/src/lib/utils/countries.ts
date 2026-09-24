/** ISO 3166-1 alpha-2 region codes; display names come from Intl so they are
 * localised and never hand-maintained. */
const REGION_CODES = [
  "AE", "AR", "AT", "AU", "BE", "BR", "CA", "CH", "CL", "CN", "CO", "CZ", "DE", "DK",
  "DZ", "EG", "ES", "FI", "FR", "GB", "GH", "GR", "HK", "HU", "ID", "IE", "IL", "IN",
  "IT", "JP", "KE", "KR", "LB", "LU", "MA", "MX", "MY", "NG", "NL", "NO", "NZ", "PE",
  "PH", "PK", "PL", "PT", "QA", "RO", "RS", "SA", "SE", "SG", "SN", "TH", "TN", "TR",
  "TW", "UA", "US", "VN", "ZA",
] as const;

export function countryOptions(locale = "en"): Array<{ code: string; name: string }> {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return REGION_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
