import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/shell/Logo";

/**
 * Landing page (FE-016) — "Editorial" design approved by the PO
 * (sample 4, 2026-11-25): restrained B2B layout, brand violet used only
 * as an accent, a CSS mock of the real app as the product preview, and
 * clear routes into the internal login and the Client Portal.
 */
export default function HomePage() {
  const t = useTranslations("Home");
  const c = useTranslations("Common");
  const shell = useTranslations("Shell");
  const locale = useLocale();

  const previewProjects = [
    { name: t("p1Name"), meta: t("p1Meta"), pct: 25 },
    { name: t("p2Name"), meta: t("p2Meta"), pct: 0 },
    { name: t("p3Name"), meta: t("p3Meta"), pct: 25 },
  ];
  const previewNav = [
    shell("nav.dashboard"),
    shell("nav.leads"),
    shell("nav.clients"),
    shell("nav.projects"),
    shell("nav.team"),
    shell("nav.invoices"),
  ];
  const stats = [
    { value: t("stat1Value"), label: t("stat1Label") },
    { value: t("stat2Value"), label: t("stat2Label") },
    { value: t("stat3Value"), label: t("stat3Label") },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4 md:px-10">
        <div className="flex items-center gap-2.5">
          <Logo variant="violet" className="h-8 w-8 shrink-0" />
          <p className="text-base font-bold leading-tight">
            {shell("brand")}
            <span className="ml-2 hidden text-[13px] font-medium text-muted-foreground sm:inline">
              {t("footerNote")}
            </span>
          </p>
        </div>
        <nav className="flex items-center gap-5 text-sm">
          <span className="hidden items-center gap-2 text-muted-foreground sm:flex">
            <Link href="/" locale="en" className={locale === "en" ? "font-semibold text-foreground" : "hover:text-foreground"}>
              English
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/" locale="vi" className={locale === "vi" ? "font-semibold text-foreground" : "hover:text-foreground"}>
              Tiếng Việt
            </Link>
          </span>
          <Link
            href="/login"
            className="rounded-lg bg-foreground px-4 py-2 font-semibold text-background transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {t("signIn")}
          </Link>
        </nav>
      </header>

      {/* Hero + product preview */}
      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-14 px-6 py-14 md:px-10 lg:grid-cols-2 lg:py-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-text">
            {t("eyebrow")}
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.14] tracking-tight md:text-5xl">
            {t("headline1")}
            <br />
            {t("headline2")}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("lead")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/login"
              className="rounded-lg bg-primary px-7 py-3 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("signIn")}
            </Link>
            <Link
              href="/portal/login"
              className="border-b border-border pb-0.5 text-[15px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary-text"
            >
              {t("portal")} →
            </Link>
          </div>
          <dl className="mt-11 flex gap-9 border-t border-border pt-6">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-lg font-extrabold tracking-tight">{s.value}</dd>
                <dd className="mt-0.5 text-xs text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Product preview — decorative CSS mock of the real app */}
        <div
          aria-hidden="true"
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_rgba(23,18,46,0.10)]"
        >
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
          </div>
          <div className="grid min-h-[300px] grid-cols-[118px_1fr]">
            <div className="flex flex-col gap-1.5 bg-sidebar-background p-3">
              <div className="mb-2.5 flex items-center gap-2 px-1 text-xs font-bold text-sidebar-foreground">
                <Logo variant="light" className="h-5 w-5 shrink-0" />
                {shell("brand")}
              </div>
              {previewNav.map((item) => (
                <span
                  key={item}
                  className={`rounded-md px-2 py-1.5 text-[11px] ${
                    item === shell("nav.projects")
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                      : "text-sidebar-muted"
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="bg-background p-5">
              <p className="text-sm font-bold">{t("previewHeading")}</p>
              <div className="mt-3 space-y-3">
                {previewProjects.map((p) => (
                  <div key={p.name} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-[13px] font-semibold">{p.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{p.meta}</p>
                    <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-border px-6 py-4 text-xs text-muted-foreground md:px-10">
        <span>© 2026 {shell("brand")}</span>
        <span>
          {c("language")}: English · Tiếng Việt
        </span>
      </footer>
    </div>
  );
}
