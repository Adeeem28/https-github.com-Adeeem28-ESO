"use client";
import { useEffect, useState } from "react";
import { getLocale, type AppLanguage } from "./i18n";

export default function LocalizedDate({
  value,
  format = "dateTime",
}: {
  value: string | number;
  format?: "date" | "time" | "dateTime";
}) {
  const [locale, setLocale] = useState("en-US");
  useEffect(() => {
    const update = () =>
      setLocale(
        getLocale(
          (localStorage.getItem("eso-language") || "auto") as AppLanguage,
        ),
      );
    update();
    window.addEventListener("eso-language-change", update);
    return () => window.removeEventListener("eso-language-change", update);
  }, []);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span data-no-translate>—</span>;
  const text =
    format === "date"
      ? date.toLocaleDateString(locale)
      : format === "time"
        ? date.toLocaleTimeString(locale)
        : date.toLocaleString(locale);
  return (
    <time data-no-translate dateTime={date.toISOString()}>
      {text}
    </time>
  );
}
