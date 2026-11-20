import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

// English is the primary/default locale; Vietnamese is fully supported (DEC-006).
export const routing = defineRouting({
  locales: ["en", "vi"],
  defaultLocale: "en",
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
