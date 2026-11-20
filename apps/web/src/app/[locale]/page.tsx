import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function HomePage() {
  const t = useTranslations("Home");
  const c = useTranslations("Common");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="text-lg text-neutral-600">{t("subtitle")}</p>
      <p className="text-sm text-neutral-500">{t("status")}</p>
      <nav className="mt-4 flex items-center gap-3 text-sm">
        <span className="text-neutral-500">{c("language")}:</span>
        <Link href="/" locale="en" className="underline">
          English
        </Link>
        <Link href="/" locale="vi" className="underline">
          Tiếng Việt
        </Link>
      </nav>
    </main>
  );
}
