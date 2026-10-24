"use client";
import type { Role } from "@/types";
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function json(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new RequestError(d.error || "Request failed", r.status);
  return d;
}

export function Title({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

export function Badge({ text }: { text: string }) {
  return (
    <span className={`badge ${text.toLowerCase().replaceAll(" ", "-")}`}>
      {text}
    </span>
  );
}

export function Detail({ l, v }: { l: string; v: React.ReactNode }) {
  return (
    <div className="detail">
      <span>{l}</span>
      <strong data-no-translate={["Reporter", "Department", "Plant", "Location"].includes(l) || undefined}>{v}</strong>
    </div>
  );
}

export function Block({ l, v, className = "" }: { l: string; v: string; className?: string }) {
  return (
    <div className={`detail-block ${className}`}>
      <span>{l}</span>
      <p data-no-translate>{v}</p>
    </div>
  );
}

export const canAdmin = (r?: Role) => r === "Admin" || r === "Super Admin";

export const canMaintain = (r?: Role) =>
  r === "Maintenance" ||
  r === "Supervisor" ||
  r === "Management" ||
  canAdmin(r);

export const canViewAll = (r?: Role) => r === "Management" || canAdmin(r);
