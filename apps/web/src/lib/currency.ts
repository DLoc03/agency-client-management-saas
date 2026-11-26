/**
 * Money formatting shared across the finance screens. Follows the same
 * pattern as the Leads page: Intl.NumberFormat with the agency's base
 * currency (fallback USD) and the current locale.
 */
export function formatMoney(
  value: number | string | null | undefined,
  currency: string,
  locale: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return n.toLocaleString(locale);
  }
}
