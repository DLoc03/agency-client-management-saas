"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { FlagIcon } from "@/components/ui/FlagIcon";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Common");
  const [isPending, startTransition] = useTransition();

  const handleSwitch = () => {
    const next = locale === "vi" ? "en" : "vi";
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <button
      type="button"
      onClick={handleSwitch}
      disabled={isPending}
      aria-label={t("switchLanguage")}
      title={t("switchLanguage")}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent/50 disabled:opacity-60"
    >
      <span className="inline-flex h-[20px] w-[20px] overflow-hidden rounded-full">
        <FlagIcon locale={locale} className="h-full w-full" />
      </span>
    </button>
  );
}
