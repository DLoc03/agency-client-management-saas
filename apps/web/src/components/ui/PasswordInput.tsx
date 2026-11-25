"use client";

import { Icon } from "@/components/shell/Icon";
import { useTranslations } from "next-intl";
import { forwardRef, useState, type InputHTMLAttributes } from "react";

/**
 * Password input with an Eye/EyeClosed visibility toggle (FE-012).
 * Drop-in replacement for <input type="password">: all standard input
 * props (including react-hook-form's register spread) are forwarded.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput({ className, ...props }, ref) {
  const t = useTranslations("Common");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={`${className ?? ""} w-full pr-10`}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icon name={visible ? "eye-off" : "eye"} className="h-4 w-4" />
      </button>
    </div>
  );
});
