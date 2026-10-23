"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import type { AppLanguage } from "./i18n";

function LanguageIcon({ language }: { language: AppLanguage }) {
  if (language === "auto") return <Globe size={18} aria-hidden="true" />;
  return <svg className="language-flag" viewBox="0 0 30 20" width="24" height="16" aria-hidden="true">
    {language === "de" && <><path fill="#171717" d="M0 0h30v7H0z"/><path fill="#d52228" d="M0 7h30v6H0z"/><path fill="#ffce32" d="M0 13h30v7H0z"/></>}
    {language === "es" && <><path fill="#aa151b" d="M0 0h30v20H0z"/><path fill="#f1bf00" d="M0 5h30v10H0z"/><path fill="#aa151b" d="M8 8h3v5H8z"/></>}
    {language === "en" && <><path fill="#15366f" d="M0 0h30v20H0z"/><path stroke="#fff" strokeWidth="4" d="m0 0 30 20M30 0 0 20"/><path stroke="#c8102e" strokeWidth="1.5" d="m0 0 30 20M30 0 0 20"/><path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30"/><path stroke="#c8102e" strokeWidth="4" d="M15 0v20M0 10h30"/></>}
    {language === "bs" && <><path fill="#002395" d="M0 0h30v20H0z"/><path fill="#fecb00" d="M8 0h17v17z"/>{[0,1,2,3,4,5].map(i=><path key={i} fill="#fff" transform={`translate(${5+i*3},${1+i*3})`} d="m0-1.7.5 1.1 1.2.1-.9.8.3 1.2L0 .9l-1.1.6.3-1.2-.9-.8 1.2-.1z"/>)}</>}
  </svg>;
}

export default function LanguagePicker({ value, onChange, label, options }: { value: AppLanguage; onChange: (value: AppLanguage) => void; label: string; options: { value: AppLanguage; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="language-control" data-no-translate><span>{label}</span><div className="language-picker" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button className="language-trigger" ref={trigger} type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}><LanguageIcon language={value}/><span>{options.find(option=>option.value===value)?.label}</span><ChevronDown size={14} aria-hidden="true"/></button>
    {open && <div className="language-options" role="group" aria-label={label}>{options.map(option=><button type="button" key={option.value} data-language={option.value} aria-pressed={value===option.value} onClick={()=>{onChange(option.value);setOpen(false);trigger.current?.focus();}}><LanguageIcon language={option.value}/><span>{option.label}</span>{value===option.value && <Check size={14} aria-hidden="true"/>}</button>)}</div>}
  </div></div>;
}
