import test from "node:test";
import assert from "node:assert/strict";
import { cacheReportPage, readReportPage } from "../lib/report-page-cache";
import type { ESOReport } from "../types";

test("report pages are isolated by snapshot and filter, expire and remain bounded", () => {
  const snapshot: ESOReport[] = [];
  const data = { reports: [], total: 12 };
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    cacheReportPage(snapshot, "mine=true&page=1", data);
    assert.equal(readReportPage(snapshot, "mine=true&page=1"), data);
    assert.equal(readReportPage([], "mine=true&page=1"), undefined);
    assert.equal(readReportPage(snapshot, "mine=false&page=1"), undefined);
    now += 30_000;
    assert.equal(readReportPage(snapshot, "mine=true&page=1"), undefined);
    for (let i = 0; i < 21; i++) cacheReportPage(snapshot, String(i), data);
    assert.equal(readReportPage(snapshot, "0"), undefined);
    assert.equal(readReportPage(snapshot, "20"), data);
  } finally { Date.now = originalNow; }
});
