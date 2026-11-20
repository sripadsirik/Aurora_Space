import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const schedule = JSON.parse(
  await readFile(
    new URL("../public/events/calendar-2026.json", import.meta.url),
    "utf8",
  ),
);
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T12:00:00Z"));
  await page.route("https://api.jolpi.ca/**", async (route) => {
    const year = route
      .request()
      .url()
      .match(/f1\/(\d+)/)?.[1];
    await route.fulfill({
      json:
        year === "2027" ? { MRData: { RaceTable: { Races: [] } } } : schedule,
    });
  });
  await page.route("https://api.openf1.org/**", (route) =>
    route.fulfill({ json: [] }),
  );
});
test("weekend calendar, complete season, next year, timezone and exit", async ({
  page,
}) => {
  await page.goto("/?events=1");
  await expect(
    page.getByRole("heading", { name: "The whole weekend." }),
  ).toBeVisible();
  await expect(page.locator(".events-race")).toHaveCount(3);
  await expect(page.locator(".events-weekend button")).toHaveCount(5);
  await expect(page.locator(".events-countdown")).toContainText(
    "Las Vegas Grand Prix",
  );
  await page.getByRole("button", { name: "Your local time" }).click();
  await expect(page.getByRole("button", { name: "UTC ⇄" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Full season", exact: true }).click();
  await expect(page.locator(".events-race")).toHaveCount(23);
  await page.getByRole("textbox", { name: "Search race events" }).fill("Miami");
  await expect(page.locator(".events-race")).toHaveCount(1);
  await page.locator(".events-race").click();
  await expect(page.locator(".events-weekend")).toContainText("Sprint");
  await expect(page.locator(".events-weekend")).toContainText(
    "Sprint Qualifying",
  );
  await page.getByRole("button", { name: "2027" }).click();
  await expect(page.locator(".events-season-empty")).toContainText(
    "No published events",
  );
  await page.getByRole("button", { name: "Close events" }).click();
  await expect(page.getByRole("main", { name: "Live events" })).toHaveCount(0);
  await page.getByRole("button", { name: "Events ↗" }).click();
  await expect(page.getByRole("main", { name: "Live events" })).toBeVisible();
});
test("mobile events remain within viewport and allow calendar browsing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?events=1");
  await expect(page.locator(".events-race")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: /Qatar Grand Prix/ }).click();
  await expect(page.locator(".events-hero")).toContainText("Lusail");
  await page.screenshot({ path: test.info().outputPath("events-mobile.png") });
});
test("saved calendar survives provider failure with explicit provenance", async ({
  page,
}) => {
  await page.route("https://api.jolpi.ca/**", (route) => route.abort());
  await page.goto("/?events=1");
  await expect(page.locator(".events-source")).toContainText("Saved calendar");
  await expect(page.locator(".events-race")).toHaveCount(3);
});

test("recorded session loads real channels, supports pause, selection and seeking", async ({
  page,
}) => {
  test.setTimeout(90000);
  const start = Date.parse("2026-11-20T00:30:00Z");
  const tracks = JSON.parse(
    await readFile(
      new URL("../public/events/circuits.json", import.meta.url),
      "utf8",
    ),
  );
  const coordinates: number[][] = tracks.vegas.coordinates;
  const lon =
    coordinates.reduce((s: number, p: number[]) => s + p[0], 0) /
    coordinates.length;
  const lat =
    coordinates.reduce((s: number, p: number[]) => s + p[1], 0) /
    coordinates.length;
  await page.route("https://api.openf1.org/**", async (route) => {
    const url = new URL(route.request().url()),
      kind = url.pathname.split("/").at(-1);
    let data: unknown[] = [];
    if (kind === "sessions")
      data = [
        {
          session_key: 1234,
          session_name: "Practice 1",
          session_type: "Practice",
          date_start: new Date(start).toISOString(),
          date_end: new Date(start + 3600000).toISOString(),
          location: "Las Vegas",
        },
      ];
    if (kind === "drivers")
      data = [
        {
          driver_number: 1,
          name_acronym: "VER",
          full_name: "Max Verstappen",
          team_name: "Red Bull Racing",
          team_colour: "3671C6",
        },
        {
          driver_number: 44,
          name_acronym: "HAM",
          full_name: "Lewis Hamilton",
          team_name: "Ferrari",
          team_colour: "E80020",
        },
      ];
    if (kind === "location")
      data = [1, 44].flatMap((driver_number) =>
        coordinates.map((p, i) => ({
          driver_number,
          date: new Date(
            start + (i * 120000) / coordinates.length,
          ).toISOString(),
          x: (p[0] - lon) * 111320 * Math.cos((lat * Math.PI) / 180) * 10,
          y: (p[1] - lat) * 111320 * 10,
        })),
      );
    if (kind === "car_data")
      data = Array.from({ length: 120 }, (_, i) => ({
        driver_number: Number(url.searchParams.get("driver_number")),
        date: new Date(start + i * 1000).toISOString(),
        speed: Number(url.searchParams.get("driver_number")) === 44 ? 244 : 217,
        n_gear: 5,
        throttle: 100,
        brake: 0,
        rpm: 11000,
      }));
    if (kind === "position")
      data = [
        { driver_number: 1, date: new Date(start).toISOString(), position: 1 },
        { driver_number: 44, date: new Date(start).toISOString(), position: 2 },
      ];
    if (kind === "session_result")
      data = [
        { driver_number: 1, position: 1, duration: 90.123, number_of_laps: 20 },
      ];
    await route.fulfill({ json: data });
  });
  await page.goto("/?events=1");
  await page.getByRole("button", { name: "Watch real replay ↗" }).click();
  await expect(page.locator(".events-track-badge-inline")).toContainText(
    "REPLAY",
    {
      timeout: 30000,
    },
  );
  await expect(page.locator(".race-map-note")).toContainText("fit error", {
    timeout: 30000,
  });
  await expect(page.locator(".events-speed")).toContainText("217", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Pause replay" }).click();
  await expect(page.getByRole("button", { name: "Play replay" })).toBeVisible();
  await page.getByRole("button", { name: /HAM #44/ }).click();
  await expect(page.locator(".events-speed")).toContainText("244", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Follow driver" }).click();
  await expect(page.getByRole("button", { name: "Following" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("combobox", { name: "Replay speed" }).selectOption("4");
  await expect(
    page.getByRole("combobox", { name: "Replay speed" }),
  ).toHaveValue("4");
  const originalCanvas = await page
    .locator(".cesium-widget canvas")
    .elementHandle();
  await page.getByRole("button", { name: "Track on Earth" }).click();
  await expect(
    page.getByRole("button", { name: "Release camera" }),
  ).toBeVisible();
  await expect(page.locator(".event-instruments")).toContainText("244");
  expect(await originalCanvas!.evaluate((el) => el.isConnected)).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = "/src/events/store.ts";
        const { viewer } = (await import(path)).useEvents.getState();
        return viewer.trackedEntity?.id;
      }),
    )
    .toBe("f1-44");
  await page.getByRole("button", { name: "overhead", exact: true }).click();
  await expect(page.getByRole("button", { name: "Follow car" })).toBeVisible();
  await page
    .getByRole("button", { name: "Weekend details, stats & replays" })
    .click();
  const seek = page.getByRole("slider", { name: "Session replay time" });
  await seek.fill(String(start + 60000));
  await seek.dispatchEvent("keyup", { key: "ArrowRight" });
  await expect(page.getByRole("button", { name: "Play replay" })).toBeVisible();
});
