/**
 * FIX-049: build next-intl navigation options for post-login redirects.
 * When the account's stored locale is known, carry it so the form's
 * replace doesn't lose to a locale-less replace / pre-login route locale.
 */
export function loginNavOptions(
  locale: "en" | "vi" | undefined
): { locale: "en" | "vi" } | undefined {
  return locale ? { locale } : undefined;
}