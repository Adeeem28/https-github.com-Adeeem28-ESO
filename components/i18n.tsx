"use client";
import { useEffect, useState } from "react";
import { dictionaries as dict, translateMessage } from "@/lib/ui-language";
import LanguagePicker from "./language-picker";

export type AppLanguage = "auto" | "en" | "bs" | "de" | "es";
type ConcreteLanguage = Exclude<AppLanguage, "auto">;
const STORAGE_KEY = "eso-language";
const LOCALE: Record<ConcreteLanguage, string> = {
  en: "en-US",
  bs: "bs-BA",
  de: "de-DE",
  es: "es-ES",
};

function detect(): ConcreteLanguage {
  if (typeof navigator === "undefined") return "en";
  const l = (
    navigator.languages?.[0] ||
    navigator.language ||
    "en"
  ).toLowerCase();
  if (l.startsWith("bs") || l.startsWith("hr") || l.startsWith("sr"))
    return "bs";
  if (l.startsWith("de")) return "de";
  if (l.startsWith("es")) return "es";
  return "en";
}
export function getResolvedLanguage(choice: AppLanguage): ConcreteLanguage {
  return choice === "auto"
    ? detect()
    : ["en", "bs", "de", "es"].includes(choice)
      ? choice
      : "en";
}
export function getLocale(choice: AppLanguage) {
  return LOCALE[getResolvedLanguage(choice)];
}
export function LanguageControl() {
  const [choice, setChoice] = useState<AppLanguage>("auto");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
    if (saved && ["auto", "en", "bs", "de", "es"].includes(saved))
      setChoice(saved);
    setReady(true);
  }, []);
  const resolved = getResolvedLanguage(choice);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, choice);
    document.documentElement.lang = resolved;
    window.dispatchEvent(
      new CustomEvent("eso-language-change", { detail: { choice, resolved } }),
    );
  }, [choice, resolved, ready]);
  return (
    <LanguagePicker
      value={choice}
      onChange={setChoice}
      label={dict[resolved]["Language"] || "Language"}
      options={[
        {
          value: "auto",
          label: {
            en: "Automatic",
            bs: "Automatski",
            de: "Automatisch",
            es: "Automático",
          }[resolved],
        },
        { value: "en", label: "English" },
        { value: "bs", label: "Bosanski" },
        { value: "de", label: "Deutsch" },
        { value: "es", label: "Español" },
      ]}
    />
  );
}
type TranslationState = { source: string; rendered: string };
const originals = new WeakMap<Node, TranslationState>();
const attrOriginals = new WeakMap<Element, Map<string, TranslationState>>();
function walk(root: Node, lang: ConcreteLanguage) {
  if (root.nodeType === Node.TEXT_NODE) {
    const p = root.parentElement;
    if (
      !p ||
      p.closest(
        '[data-no-translate], [translate="no"], script, style, textarea, input',
      )
    )
      return;
    const current = root.textContent || "";
    const old = originals.get(root);
    const source = old && current === old.rendered ? old.source : current;
    const key = p.closest("[data-i18n-key]")?.getAttribute("data-i18n-key");
    const rendered = translateMessage(key || source, lang);
    originals.set(root, { source, rendered });
    if (current !== rendered) root.textContent = rendered;
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  const protectedText = !!el.closest(
    '[data-no-translate], [translate="no"], script, style',
  );
  for (const attribute of [
    "placeholder",
    "title",
    "aria-label",
    "alt",
    "data-label",
  ]) {
    if (
      (protectedText && attribute !== "data-label") ||
      !el.hasAttribute(attribute)
    )
      continue;
    let map = attrOriginals.get(el);
    if (!map) {
      map = new Map();
      attrOriginals.set(el, map);
    }
    const current = el.getAttribute(attribute) || "";
    const old = map.get(attribute);
    const source = old && current === old.rendered ? old.source : current;
    const rendered = translateMessage(source, lang);
    map.set(attribute, { source, rendered });
    if (current !== rendered) el.setAttribute(attribute, rendered);
  }
  if (protectedText) return;
  Array.from(root.childNodes).forEach((node) => walk(node, lang));
}
export function AutoTranslator() {
  useEffect(() => {
    let lang = getResolvedLanguage(
      (localStorage.getItem(STORAGE_KEY) || "auto") as AppLanguage,
    );
    const config: MutationObserverInit = {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "placeholder",
        "title",
        "aria-label",
        "alt",
        "data-label",
      ],
    };
    const observer = new MutationObserver((records) => {
      observer.disconnect();
      for (const record of records) {
        if (record.type === "childList")
          record.addedNodes.forEach((node) => walk(node, lang));
        else walk(record.target, lang);
      }
      observer.observe(document.body, config);
    });
    const apply = () => {
      observer.disconnect();
      document.documentElement.lang = lang;
      walk(document.body, lang);
      observer.observe(document.body, config);
    };
    const onLanguage = (event: Event) => {
      lang = (event as CustomEvent).detail.resolved;
      apply();
    };
    apply();
    window.addEventListener("eso-language-change", onLanguage);
    return () => {
      observer.disconnect();
      window.removeEventListener("eso-language-change", onLanguage);
    };
  }, []);
  return null;
}

// Action labels are rendered by React, independently of status text translation.
export function OpenReportLabel() {
  const [language, setLanguage] = useState<ConcreteLanguage>("en");
  useEffect(() => {
    const update = () =>
      setLanguage(
        getResolvedLanguage(
          (localStorage.getItem(STORAGE_KEY) || "auto") as AppLanguage,
        ),
      );
    update();
    window.addEventListener("eso-language-change", update);
    return () => window.removeEventListener("eso-language-change", update);
  }, []);
  return (
    <span data-no-translate>
      {language === "bs"
        ? "OTVORI"
        : language === "de"
          ? "ÖFFNEN"
          : language === "es"
            ? "ABRIR"
            : "OPEN"}
    </span>
  );
}

// For system labels inside otherwise protected audit records.
export function LocalizedText({ children }: { children: string }) {
  const [language, setLanguage] = useState<ConcreteLanguage>("en");
  useEffect(() => {
    const update = () =>
      setLanguage(
        getResolvedLanguage(
          (localStorage.getItem(STORAGE_KEY) || "auto") as AppLanguage,
        ),
      );
    update();
    window.addEventListener("eso-language-change", update);
    return () => window.removeEventListener("eso-language-change", update);
  }, []);
  return <span data-no-translate>{translateMessage(children, language)}</span>;
}
