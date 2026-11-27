"use client";

import { useTranslations } from "next-intl";
import { Icon } from "./Icon";
import { NotificationBell } from "./NotificationBell";
import { LanguageToggle } from "./LanguageToggle";

type TopbarProps = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const t = useTranslations("Shell");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent md:hidden"
        onClick={onMenuClick}
        aria-label={t("openMenu")}
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-foreground">
          {t("topbarTitle")}
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          {t("topbarSubtitle")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <LanguageToggle />
        <NotificationBell />
        <span className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground sm:inline-flex">
          {t("environment")}
        </span>
      </div>
    </header>
  );
}