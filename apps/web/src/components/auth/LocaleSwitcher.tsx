/**
 * LocaleSwitcher — FE-002
 * Renders EN ↔ VI toggle. No hardcoded labels.
 */

"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const c = useTranslations("Common");
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (next: "en" | "vi") => {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div
      className="flex items-center gap-2 text-xs text-neutral-500"
      aria-label={c("language")}
    >
      <span>{c("language")}:</span>
      {(["en", "vi"] as const).map((lng) => (
        <button
          key={lng}
          onClick={() => handleSwitch(lng)}
          disabled={isPending || locale === lng}
          className={[
            "rounded px-2 py-0.5 font-medium transition",
            locale === lng
              ? "bg-indigo-100 text-indigo-700"
              : "hover:bg-neutral-100 text-neutral-500",
          ].join(" ")}
          aria-current={locale === lng ? "true" : undefined}
        >
          {lng === "en" ? "English" : "Tiếng Việt"}
        </button>
      ))}
    </div>
  );
}
