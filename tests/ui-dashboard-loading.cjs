const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        serviceWorkers: "block",
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const user = {
      id: "u1",
      name: "Test Manager",
      employeeId: "100",
      department: "Operations",
      role: "Management",
      annualTarget: 200,
      active: true,
      plantId: "p1",
      plantName: "Plant A",
      companyId: "c1",
    };
    const all = Array.from({ length: 120 }, (_, i) => ({
      id: "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
      revision: 1,
      esoNo: "ESO-" + String(i).padStart(3, "0"),
      reporterId: "u1",
      createdAt: new Date(Date.now() - i * 60000).toISOString(),
      location: "Warehouse",
      plantId: "p1",
      plantName: "Plant A",
      category: "Safety",
      urgency: "Medium",
      description: "Synthetic report " + i,
      status: i < 90 ? "Open" : "Completed",
    }));
    let historyReads = 0,
      singleReads = 0,
      fail = false,
      bootstrapReads = 0;
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      let data = {},
        status = 200;
      if (url.pathname === "/api/data") {
        bootstrapReads++;
        data = {
          currentUser: user,
          users: [user],
          reports: all.slice(0, 10),
          locations: [],
          departments: [],
          plants: [],
          corporatePlants: [],
          dashboard: {
            ytd: 120,
            open: 90,
            inProgress: 0,
            completed: 30,
            critical: 0,
            overdue: 0,
            plantReported: 120,
            plantClosed: 30,
          },
          tracking: {
            year: 2027,
            currentMonth: 10,
            monthly: [],
            reporterLeaderboard: [
              {
                id: "u1",
                name: user.name,
                reportedYtd: 120,
                reportedThisMonth: 120,
              },
            ],
            resolverLeaderboard: [],
          },
        };
      } else if (url.pathname === "/api/reports/history") {
        if (url.searchParams.has("id")) {
          singleReads++;
          data = {
            reports: all.filter((r) => r.id === url.searchParams.get("id")),
          };
        } else {
          historyReads++;
          if (fail) {
            status = 503;
            data = { error: "History unavailable" };
          } else data = { reports: all };
        }
      } else if (url.pathname === "/api/notifications")
        data = {
          notifications: [
            {
              id: "n1",
              type: "assigned",
              title: "Older report notification",
              isRead: true,
              esoReportId: all[110].id,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      else if (url.pathname === "/api/reports/detail")
        data = {
          report: { id: all[110].id, revision: 1, status: "completed" },
          task: null,
          additionalLocations: [],
          photos: [],
          audit: [],
          legacyHistory: [],
          permissions: {},
        };
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    await page.goto(process.env.TEST_URL || "http://localhost:3250");
    await page.locator(".dashboard-summary-grid").waitFor();
    // The seamless carousel renders two visual copies; assertions target its original cycle.
    assert.equal(await page.locator('.stat-card.blue[data-cycle="1"]').count(), 1);
    assert.equal(await page.locator('.stat-card.blue[aria-hidden="true"]').count(), 2);
    assert.equal(historyReads, 0, "no full history request during startup");
    assert.equal(
      await page.locator('.stat-card.blue[data-cycle="1"] strong').innerText(),
      "120",
    );
    assert.equal(
      await page.locator('.stat-card.orange[data-cycle="1"] strong').innerText(),
      "90",
    );
    assert.equal(
      await page.locator('.stat-card.green[data-cycle="1"] strong').innerText(),
      "30",
    );
    assert.match(
      await page.locator(".department-compact-item").innerText(),
      /120/,
    );
    assert.match(await page.locator(".plant-closure-card").innerText(), /25%/);
    assert.equal(await page.locator(".reports-table tbody tr").count(), 10);
    // Notifications can open a report outside the ten-row bootstrap, without full history.
    await page
      .getByRole("button", { name: "Notifications", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Older report notification", exact: false })
      .click();
    await page.locator(".eso-workspace").waitFor();
    assert.equal(singleReads, 1);
    assert.equal(historyReads, 0);
    await page
      .locator(".modal-backdrop")
      .filter({ has: page.locator(".eso-workspace") })
      .locator(".modal-head > button")
      .first()
      .click();
    fail = true;
    await page.locator('.stat-card.orange[data-cycle="1"]').click();
    await page
      .locator(".form-error")
      .filter({ hasText: "History unavailable" })
      .waitFor();
    assert.equal(await page.locator(".kpi-modal").count(), 0);
    fail = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.locator(".kpi-modal").waitFor();
    assert.equal(await page.locator(".kpi-modal tbody tr").count(), 90);
    await page.locator(".kpi-modal .modal-head > button").click();
    const readCount = historyReads;
    await page.locator(".department-compact-item").click();
    await page.locator(".department-drilldown").waitFor();
    assert.equal(
      await page.locator(".department-drilldown tbody tr").count(),
      120,
    );
    assert.equal(
      historyReads,
      readCount,
      "history reused within current snapshot",
    );
    await page.locator(".department-drilldown .modal-head > button").click();
    await page.getByRole("button", { name: "REFRESH", exact: true }).click();
    await page.waitForFunction(
      () =>
        !document.querySelector(".dashboard-heading-actions button").disabled,
    );
    assert.equal(historyReads, readCount, "refresh does not prefetch history");
    await page.locator('.stat-card.green[data-cycle="1"]').click();
    await page.locator(".kpi-modal").waitFor();
    assert.equal(await page.locator(".kpi-modal tbody tr").count(), 30);
    assert.equal(
      historyReads,
      readCount + 1,
      "refresh invalidates old history",
    );
    await page.locator(".kpi-modal .modal-head > button").click();
    await page.getByRole("button", { name: "My Tasks", exact: true }).click();
    await page
      .getByRole("button", { name: "All active", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "All active", exact: true }).click();
    assert.equal(await page.locator(".task-card").count(), 90);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.equal(bootstrapReads, 2);
    const previousReads = historyReads;
    user.role = "Employee";
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
    await page.locator(".employee-hero").waitFor();
    assert.match(await page.locator(".employee-hero h2").innerText(), /120/);
    assert.equal(await page.locator(".reports-table tbody tr").count(), 5);
    assert.equal(historyReads, previousReads);
    await page.locator(".employee-hero").click();
    await page.locator(".kpi-modal").waitFor();
    assert.equal(await page.locator(".kpi-modal tbody tr").count(), 120);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: bounded startup, full counts, older notifications, lazy history/retry/cache invalidation, department drilldown, complete task list and mobile layout.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
