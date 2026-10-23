"use client";

import { useEffect, useRef, useState } from "react";
import { Home, ClipboardList, Plus, MessageSquare, Settings, FileText, Download, Trophy, Database, Users, MapPin, Wrench, ChevronRight, LockKeyhole, X, type LucideIcon } from "lucide-react";
import type { User } from "@/types";
import type { View } from "./eso-app";
import { canAdmin, canMaintain, canViewAll } from "./eso-shared";

type Group = "eso" | "voice" | "admin";
type Entry = { view: View; label: string; icon: LucideIcon; allowed: boolean };

function QuickNavLabel({children}:{children:string}) {
  const label=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    const el=label.current;
    if(!el)return;
    const fit=()=>{
      const labels=Array.from(el.closest('.quick-tabs')?.querySelectorAll<HTMLElement>('.quick-tab>span') || []);
      if(window.innerWidth>800){labels.forEach(item=>item.style.removeProperty('font-size'));return;}
      labels.forEach(item=>item.style.fontSize='10px');
      const size=Math.min(10,...labels.map(item=>item.clientWidth>0&&item.scrollWidth>item.clientWidth ? 10*item.clientWidth/item.scrollWidth : 10));
      labels.forEach(item=>item.style.fontSize=`${size}px`);    };
    const resize=new ResizeObserver(fit);
    resize.observe(el);
    const text=new MutationObserver(fit);
    text.observe(el,{childList:true,characterData:true,subtree:true});
    window.addEventListener('resize',fit);fit();
    return()=>{resize.disconnect();text.disconnect();window.removeEventListener('resize',fit);};
  },[]);
  return <span ref={label}>{children}</span>;
}
export default function MobileQuickNav({ user, view, go }: { user: User; view: View; go: (view: View) => void }) {
  const [open, setOpen] = useState<Group | null>(null);
  const nav = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<Group, HTMLButtonElement | null>>>({});
  const groups: Record<Group, { label: string; icon: LucideIcon; entries: Entry[] }> = {
    eso: { label: "My ESO", icon: ClipboardList, entries: [
      { view: "report", label: "Report ESO", icon: Plus, allowed: true },
      { view: "my-history", label: "My ESO History", icon: ClipboardList, allowed: true },
      { view: "all-reports", label: "All ESO Reports", icon: FileText, allowed: canViewAll(user.role) },
      { view: "exports", label: "Export data and reports", icon: Download, allowed: canViewAll(user.role) },
      { view: "hunt", label: "ESO Hunt", icon: Trophy, allowed: true },
    ] },
    voice: { label: "Voice of Employee", icon: MessageSquare, entries: [
      { view: "voe-submit", label: "Submit Voice", icon: Plus, allowed: true },
      { view: "voe-history", label: "My Voice History", icon: ClipboardList, allowed: true },
      { view: "voe-all", label: "Voice of Employee", icon: MessageSquare, allowed: canViewAll(user.role) },
    ] },
    admin: { label: "Administration", icon: Settings, entries: [
      { view: "plants", label: "Plants", icon: Database, allowed: user.role === "Super Admin" },
      { view: "employees", label: "Employee Tracker", icon: Users, allowed: canAdmin(user.role) },
      { view: "departments", label: "Departments", icon: Database, allowed: canAdmin(user.role) },
      { view: "locations", label: "Locations", icon: MapPin, allowed: canAdmin(user.role) },
      { view: "maintenance", label: "Corrective Action Tasks", icon: Wrench, allowed: canMaintain(user.role) },
    ] },
  };

  useEffect(() => { setOpen(null); }, [view, user.role]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!nav.current?.contains(event.target as Node)) setOpen(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(null); triggers.current[open]?.focus(); } };
    const desktop = window.matchMedia("(min-width:1301px)");
    const resize = () => { if (desktop.matches) setOpen(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    desktop.addEventListener("change", resize);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); desktop.removeEventListener("change", resize); };
  }, [open]);

  const navigate = (entry: Entry) => { if (!entry.allowed) return; setOpen(null); go(entry.view); };
  const groupTab = (id: Group) => {
    const group = groups[id], Icon = group.icon;
    const active = view !== "report" && group.entries.some(entry => entry.view === view);
    return <button type="button" ref={element => { triggers.current[id] = element; }} className={`quick-tab ${active ? "active" : ""} ${open === id ? "is-open" : ""}`} aria-expanded={open === id} aria-controls={`quick-panel-${id}`} onClick={() => setOpen(open === id ? null : id)}>
      <Icon size={20} /><QuickNavLabel>{group.label}</QuickNavLabel>
    </button>;
  };

  return <nav ref={nav} className="mobile-quick-nav" aria-label="Quick navigation">
    <div className="quick-tabs">
      <button type="button" className={`quick-tab ${view === "dashboard" ? "active" : ""}`} aria-current={view === "dashboard" ? "page" : undefined} onClick={() => { setOpen(null); go("dashboard"); }}><Home size={20} /><QuickNavLabel>Home</QuickNavLabel></button>
      {groupTab("eso")}
      <button type="button" className={`quick-tab quick-report ${view === "report" ? "active" : ""}`} aria-current={view === "report" ? "page" : undefined} onClick={() => { setOpen(null); go("report"); }}><Plus size={24} /><QuickNavLabel>Report</QuickNavLabel></button>
      {groupTab("voice")}
      {groupTab("admin")}
    </div>
    {open && <section className={`quick-panel quick-panel-${open}`} id={`quick-panel-${open}`} aria-labelledby={`quick-heading-${open}`}>
      <div className="quick-panel-heading"><strong id={`quick-heading-${open}`}>{groups[open].label}</strong><button type="button" aria-label="Close navigation" onClick={() => { setOpen(null); triggers.current[open]?.focus(); }}><X size={18} /></button></div>
      <div className="quick-panel-items">{groups[open].entries.map(entry => { const Icon = entry.icon; return <button type="button" key={entry.view} disabled={!entry.allowed} aria-current={view === entry.view ? "page" : undefined} onClick={() => navigate(entry)}>
        <Icon size={19} /><span>{entry.label}</span>{entry.allowed ? <ChevronRight size={15} aria-hidden="true" /> : <LockKeyhole size={15} aria-label="Access restricted" />}
      </button>; })}</div>
    </section>}
  </nav>;
}




