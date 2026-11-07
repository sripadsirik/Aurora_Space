import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("complete investigation, replay, export, restore and failure exercise", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Mission lab/ }).click();
  await expect(page.getByText("COMPUTED LOCALLY")).toBeVisible();
  await expect(page.locator(".flight-wordmark")).toHaveText("AURORA");
  await expect(page.locator(".flight-brand-mark")).toHaveCount(0);
  await expect(page.getByText("85.0 m", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Encounter plane/ }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("encounter-desktop.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("region", { name: "Analysis recommendation" }),
  ).toContainText("MANEUVER RECOMMENDED FOR REVIEW");
  await page.getByRole("button", { name: "Review recommendation →" }).click();
  await expect(page.locator(".flight-trades tr.selected")).toContainText(
    "RECOMMENDED",
  );
  await expect(
    page.getByText("✓ Miss-distance check passed", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".flight-trades tbody tr")).toHaveCount(11);
  // Promote an early, small along-track burn from the map to a full RK4 run.
  const map = page.locator(".flight-heatmap-svg");
  const box = (await map.boundingBox())!;
  const cellW = (704 - 70) / 41,
    cellH = (318 - 18) / 24;
  await map.click({
    position: {
      x: ((70 + 22.5 * cellW) / 720) * box.width,
      y: ((18 + 5.5 * cellH) / 360) * box.height,
    },
  });
  await expect(page.locator(".flight-trades tbody tr")).toHaveCount(12);
  await expect(page.locator(".flight-trades tr.selected")).toContainText(
    "Design · T +0.100 m/s · T−95 min",
  );
  await expect(page.getByLabel("Scenario replay time")).toHaveAttribute(
    "min",
    "-5700",
  );
  await page.screenshot({
    path: testInfo.outputPath("trade-space-desktop.png"),
  });
  await page.getByRole("button", { name: /^Remove Design/ }).click();
  await expect(page.locator(".flight-trades tbody tr")).toHaveCount(11);
  await expect(page.getByLabel("Scenario replay time")).toHaveAttribute(
    "min",
    "-2700",
  );
  await page
    .getByRole("button", { name: "Prograde · 1.00 m/s", exact: true })
    .click();
  await expect(page.locator(".flight-trades tr.selected")).toContainText(
    "Prograde",
  );
  await page.getByRole("button", { name: "Play scenario replay" }).click();
  await expect(
    page.getByRole("button", { name: "Pause scenario replay" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause scenario replay" }).click();
  await page.getByLabel("Maximum Δv · m/s").fill("0.5");
  await page.getByRole("button", { name: "Recompute trade study" }).click();
  await expect(page.getByText("COMPUTED LOCALLY")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prograde · 0.50 m/s", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("maneuvers-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: /Evidence & replay/ }).click();
  await page
    .getByPlaceholder(
      "Record assumptions, candidate rationale and outstanding data requests.",
    )
    .fill("Reproducible browser-test rationale.");
  await page
    .getByRole("button", { name: "Start capture", exact: true })
    .click();
  await page.getByRole("button", { name: "Stop capture", exact: true }).click();
  await page
    .getByRole("button", { name: "Disconnect feed", exact: true })
    .click();
  await expect(
    page.getByText("FEED DISCONNECTED", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reconnect feed", exact: true })
    .click();
  await expect(
    page.getByText("LIVE CONNECTION PERMITTED", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export reproducible archive", exact: true })
    .click();
  const file = await download;
  const text = await readFile((await file.path())!, "utf8");
  const archive = JSON.parse(text);
  expect(archive.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(archive.capture).toHaveLength(3);
  await page
    .getByRole("button", { name: "Example mission", exact: true })
    .click();
  await page.getByLabel("Import mission archive or CDM").setInputFiles({
    name: "replay.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(page.getByText("COMPUTED LOCALLY")).toBeVisible();
  await expect(
    page.getByPlaceholder(
      "Record assumptions, candidate rationale and outstanding data requests.",
    ),
  ).toHaveValue("Reproducible browser-test rationale.");
  await expect(page.getByText(archive.sha256, { exact: true })).toBeVisible();
  const tampered = { ...archive, notes: "tampered" };
  await page.getByLabel("Import mission archive or CDM").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(tampered)),
  });
  await expect(page.getByRole("alert")).toContainText("checksum mismatch");
  await page.screenshot({
    path: testInfo.outputPath("evidence-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("mobile layout is usable without document overflow", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Mission lab/ }).click();
  await expect(page.getByText("COMPUTED LOCALLY")).toBeAttached();
  await expect(page.locator(".flight-metrics")).toBeVisible();
  expect(
    await page
      .locator(".flight-shell")
      .evaluate((el) => el.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("encounter-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: /Maneuver trade study/ }).click();
  await expect(page.locator(".flight-trades tbody tr")).toHaveCount(11);
  await page.getByRole("button", { name: /Evidence & replay/ }).click();
  await expect(
    page.getByRole("button", { name: "Export reproducible archive" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close mission lab" }).click();
  await expect(page.getByRole("button", { name: /Mission lab/ })).toBeVisible();
});

test("direct entry and browser frame evidence", async ({ page }, testInfo) => {
  await page.goto("/?mission=1");
  await expect(page.getByText("COMPUTED LOCALLY")).toBeVisible();
  const performanceReport = await page.evaluate(async () => {
    const samples: number[] = [];
    let previous = performance.now();
    await new Promise<void>((resolve) => {
      const frame = (now: number) => {
        samples.push(now - previous);
        previous = now;
        if (samples.length < 121) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    const sorted = samples.slice(1).sort((a, b) => a - b);
    return {
      scope:
        "120 requestAnimationFrame intervals in idle Mission Lab on the local development server; not a full-catalog rendering benchmark",
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      firstContentfulPaintMs:
        performance.getEntriesByName("first-contentful-paint")[0]?.startTime ??
        null,
      p50FrameMs: sorted[59],
      p95FrameMs: sorted[113],
      p99FrameMs: sorted[118],
      maxFrameMs: sorted.at(-1),
    };
  });
  await testInfo.attach("browser-performance", {
    body: JSON.stringify(performanceReport, null, 2),
    contentType: "application/json",
  });
  await page.getByRole("button", { name: /Evidence & replay/ }).click();
  await page
    .getByRole("textbox", { name: "Analyst notes" })
    .fill("Session survives closing the lab.");
  await page.getByRole("button", { name: "Close mission lab" }).click();
  await page.getByRole("button", { name: /Mission lab/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Analyst notes" }),
  ).toHaveValue("Session survives closing the lab.");
});

test("failed recomputation cannot display or export previous results, and retry recovers", async ({
  page,
}) => {
  let fail = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/src/mission/worker.ts*", async (route) => {
    if (!fail) {
      await route.continue();
      return;
    }
    await gate;
    await route.fulfill({
      contentType: "application/javascript",
      body: 'self.onmessage = () => self.postMessage({error: "Injected analysis failure"});',
    });
  });
  await page.goto("/?mission=1");
  await expect(page.getByText("COMPUTED LOCALLY")).toBeVisible();
  await page.getByRole("button", { name: /Maneuver trade study/ }).click();
  await page.getByLabel("Maximum Δv · m/s").fill("0.5");
  fail = true;
  await page.getByRole("button", { name: "Recompute trade study" }).click();
  await expect(page.getByText("Calculating…", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Analysis recommendation" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Evidence & replay/ }).click();
  await expect(
    page.getByRole("button", { name: /Engineering report/ }),
  ).toHaveCount(0);
  release();
  await expect(page.getByRole("alert")).toContainText(
    "Injected analysis failure",
  );
  await expect(page.getByText("COMPUTED LOCALLY")).toHaveCount(0);
  await expect(page.locator(".flight-metrics")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry analysis" }).click();
  await expect(page.getByText("COMPUTED LOCALLY")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Engineering report/ }).click();
  const report = await readFile((await (await downloaded).path())!, "utf8");
  expect(report).toContain("Prograde · 0.50 m/s");
  expect(report).not.toContain("Prograde · 1.00 m/s");
});

test("coast already meeting the goal shows zero cost and is selectable on the map", async ({
  page,
}) => {
  const fixture = JSON.parse(
    await readFile("src/mission/fixtures/pathfinder-v1.1.0.json", "utf8"),
  );
  const scenario = fixture.scenario;
  scenario.secondary.state.r[0] += 415;
  scenario.config.burnExecutionSigmaMs = 1;
  await page.goto("/?mission=1");
  await page.getByLabel("Import mission archive or CDM").setInputFiles({
    name: "coast.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(scenario)),
  });
  await expect(
    page.getByText("BELOW ACTION THRESHOLD", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Maneuver trade study/ }).click();
  await expect(page.getByText("COAST MEETS THE GOAL")).toBeVisible();
  await page
    .getByRole("button", { name: "Prograde · 1.00 m/s", exact: true })
    .click();
  const map = page.locator(".flight-heatmap-svg");
  const box = (await map.boundingBox())!;
  await map.click({
    position: { x: (387 / 720) * box.width, y: (30 / 360) * box.height },
  });
  await expect(page.locator(".flight-trades tr.selected")).toContainText(
    "Coast · no burn",
  );
  await expect(page.locator(".flight-trades tbody tr")).toHaveCount(11);
});
