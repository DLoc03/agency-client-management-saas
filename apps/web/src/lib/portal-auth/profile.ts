/**
 * Client-side call to Next.js BFF: PATCH /api/portal/auth/profile
 * Updates the user's locale on the backend. Non-blocking: failures
 * are swallowed so the UI language change is never blocked.
 */
export async function updateProfileLocale(locale: string): Promise<void> {
  try {
    await fetch("/api/portal/auth/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ locale }),
    });
  } catch {
    // Non-blocking — the UI language already changed.
  }
}