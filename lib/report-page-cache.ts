import type { ESOReport } from "@/types";

type Page = { reports: ESOReport[]; total: number };
// A new dashboard snapshot (refresh, mutation or login) gets a separate cache.
// Weak keys release old sessions without persisting report data on the device.
const snapshots = new WeakMap<ESOReport[], Map<string, { data: Page; expires: number }>>();
export function readReportPage(snapshot: ESOReport[], key: string): Page | undefined {
  const cache = snapshots.get(snapshot);
  const entry = cache?.get(key);
  if (!entry) return;
  if (entry.expires <= Date.now()) { cache?.delete(key); return; }
  return entry.data;
}
export function cacheReportPage(snapshot: ESOReport[], key: string, data: Page) {
  let cache = snapshots.get(snapshot);
  if (!cache) { cache = new Map(); snapshots.set(snapshot, cache); }
  cache.delete(key);
  cache.set(key, { data, expires: Date.now() + 30_000 });
  if (cache.size > 20) cache.delete(cache.keys().next().value!);
}
