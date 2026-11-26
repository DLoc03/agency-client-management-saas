/**
 * Portal Login Page — /[locale]/portal/login (FE-003; UI refresh FE-018, full-bleed fix FIX-016)
 * Layout per the PO-approved "P2 — Bento glass" sample (2026-11-25):
 * the emerald gradient fills the whole page area edge to edge
 * (FIX-016 — previously it wrapped only a floating panel), holding a
 * frosted-glass sign-in card, three glass tiles describing what
 * clients can do inside, and a cross-link back to the internal
 * sign-in. The portal header/footer chrome comes from the portal
 * layout and is unchanged.
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PortalLoginForm } from "@/components/portal/PortalLoginForm";
import { Logo } from "@/components/shell/Logo";

export default function PortalLoginPage() {
  const t = useTranslations("Portal.login");

  const tiles = [
    { title: t("tileProjectsTitle"), text: t("tileProjectsText") },
    { title: t("tileTasksTitle"), text: t("tileTasksText") },
    { title: t("tileInvoicesTitle"), text: t("tileInvoicesText") },
  ];

  return (
    <main className="h-full bg-[linear-gradient(135deg,#d9f5e8_0%,#eefaf4_45%,#e3f2ec_100%)] px-4 py-10 md:py-12">
      {/* Frosted-glass sign-in card */}
      <div className="mx-auto w-full max-w-[400px] rounded-[22px] border border-white/80 bg-white/80 p-8 shadow-[0_24px_60px_rgba(6,60,40,0.13)] backdrop-blur-md">
        <div className="mb-7 text-center">
          <Logo variant="emerald" className="mx-auto h-11 w-11" />
          <h1 className="mt-4 text-[21px] font-extrabold tracking-tight text-slate-900">
            {t("heading")}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {t("subtitle")}
          </p>
        </div>

        <PortalLoginForm />
      </div>

      {/* Bento tiles — what clients can do inside */}
      <div
        aria-hidden="true"
        className="mx-auto mt-4 grid w-full max-w-[400px] grid-cols-3 gap-3"
      >
        {tiles.map((tile) => (
          <div
            key={tile.title}
            className="rounded-2xl border border-white/70 bg-white/60 px-3.5 py-3.5 backdrop-blur"
          >
            <p className="text-[15px] font-extrabold text-emerald-950">{tile.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{tile.text}</p>
          </div>
        ))}
      </div>

      {/* Internal sign-in cross-link */}
      <p className="mt-5 text-center text-sm text-emerald-950/70">
        {t("staffPrompt")}{" "}
        <Link
          href="/login"
          className="border-b border-emerald-600/40 pb-0.5 font-semibold text-emerald-950 transition-colors hover:text-emerald-700"
        >
          {t("staffLink")} →
        </Link>
      </p>
    </main>
  );
}
