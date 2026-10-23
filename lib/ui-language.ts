import base from "./ui-base-translations.json";
import { translations } from "./ui-translations";
import { errorTranslations } from "./ui-error-translations";

export type Language = "en" | "bs" | "de" | "es";
export const dictionaries: Record<Language, Record<string, string>> = {
  en: {},
  bs: { ...base.bs, "Open report action": "OTVORI" },
  de: { ...base.de, "Open report action": "ÖFFNEN" },
  es: { ...base.es, "Open report action": "ABRIR" },
};
for (const [key, values] of Object.entries({
  ...translations,
  ...errorTranslations,
})) {
  dictionaries.bs[key] = values[0];
  dictionaries.de[key] = values[1];
  dictionaries.es[key] = values[2];
}

const templates: [RegExp, string, string][] = [
  [/^(FY\d{4}) performance overview$/, "{year} performance overview", "year"],
  [/^(\d+) unread$/, "{count} unread", "count"],
  [/^OVERDUE (\d+)d$/, "OVERDUE {count}d", "count"],
  [/^Assigned: (.+)$/, "Assigned: {name}", "name"],
  [
    /^(\d+) Voice of Employee submissions$/,
    "{count} Voice of Employee submissions",
    "count",
  ],
];

export function translateMessage(source: string, language: Language): string {
  if (language === "en")
    return source === "Open report action" ? "OPEN" : source;
  const text = source.trim(),
    dictionary = dictionaries[language];
  if (Object.hasOwn(dictionary, text))
    return source.replace(text, dictionary[text]);
  for (const [pattern, key, parameter] of templates) {
    const match = text.match(pattern);
    if (match)
      return source.replace(
        text,
        dictionary[key].replace(`{${parameter}}`, match[1]),
      );
  }
  // Counts and punctuation are separate from the translated label; never replace arbitrary substrings.
  const counted = text.match(/^(\d[\d.,]*\s+)(.+)$/);
  if (counted && Object.hasOwn(dictionary, counted[2]))
    return source.replace(text, counted[1] + dictionary[counted[2]]);
  return source;
}
