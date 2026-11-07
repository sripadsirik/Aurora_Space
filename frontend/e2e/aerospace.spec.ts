import { test, expect } from "@playwright/test";
test("launch countdown, aircraft details, layers and mobile layout", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/aerospace/**", async (route) => {
    const data = route.request().url().endsWith("/launches")
      ? {
          results: [
            {
              id: "launch-test",
              name: "Test Rocket | Research mission",
              net: new Date(Date.now() + 86400000).toISOString(),
              net_precision: { name: "Minute" },
              status: { name: "Go for Launch" },
              rocket: { configuration: { name: "Test Rocket" } },
              pad: {
                latitude: 28.6,
                longitude: -80.6,
                location: { name: "Cape Canaveral" },
              },
              vid_urls: [{ url: "https://example.com/webcast" }],
            },
          ],
        }
      : {
          now: Date.now(),
          ac: [
            {
              hex: "abc123",
              flight: "TEST123",
              t: "B738",
              lat: 28.8,
              lon: -80.5,
              alt_geom: 12000,
              seen_pos: 1,
              gs: 320,
              track: 90,
              dbFlags: 1,
            },
          ],
        };
    await route.fulfill({
      json: { data, fetchedAt: new Date().toISOString(), stale: false },
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Orbital operations" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  const layers = page.getByLabel("Visible layers");
  await layers.getByLabel("Satellites", { exact: true }).uncheck();
  await expect(layers.getByLabel("Aircraft", { exact: true })).toBeChecked();
  await expect(
    layers.getByLabel("Rockets & launch sites", { exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close layers" }).click();
  await page.getByRole("button", { name: "↑ Rockets", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Air and launch workspace" })
      .getByRole("checkbox", { name: "Aircraft", exact: true }),
  ).toHaveCount(0);

  await expect(page.getByRole("button", { name: /Test Rocket/ })).toBeVisible();
  await page.getByRole("button", { name: /Test Rocket/ }).click();
  await expect(page.locator(".liftoff-banner")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Follow launch", exact: true })
    .click();
  await expect(page.getByLabel("Following launch")).toContainText(
    "The countdown alone will not start an animation",
  );
  await expect(page.locator(".liftoff-banner")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Stop following launch", exact: true })
    .click();
  await expect(page.locator(".launch-countdown")).toContainText("T−");
  await expect(
    page.getByRole("link", { name: /Watch webcast/ }),
  ).toHaveAttribute("href", "https://example.com/webcast");
  await page.getByRole("button", { name: /Locate launch site/ }).click();
  await page.screenshot({
    path: testInfo.outputPath("launch-watch-desktop.png"),
  });
  await page.getByRole("button", { name: /Preview simulated liftoff/ }).click();
  await expect(page.locator(".liftoff-banner")).toContainText("NOT LIVE");
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Simulation time").inputValue()),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause ascent", exact: true }).click();
  const paused = await page.getByLabel("Simulation time").inputValue();
  await page.waitForTimeout(500);
  expect(await page.getByLabel("Simulation time").inputValue()).toBe(paused);
  await page.getByLabel("Simulation time").press("End");
  await expect(page.locator(".liftoff-banner")).toContainText("129.6 km");
  await page.getByRole("button", { name: "Restart ascent" }).click();
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Simulation time").inputValue()),
    )
    .toBeLessThan(10);
  await page.getByRole("button", { name: "Exit preview" }).click();
  await expect(page.locator(".liftoff-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "✈ Aircraft", exact: true }).click();
  await page.getByLabel("Coverage region").selectOption("florida");
  await expect(
    page.getByRole("region", { name: "Orbital operations" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /TEST123/ }).click();
  await expect(page.locator(".aerospace-detail").first()).toContainText(
    "3,658",
  );
  await page.getByRole("button", { name: "Locate on globe ↗" }).click();
  await page.getByLabel("Military-tagged only").check();
  await expect(page.getByRole("button", { name: /TEST123/ })).toBeVisible();
  await page.getByLabel("Find aircraft").fill("absent");
  await expect(
    page.getByText("No matching observations in this feed."),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("aircraft-mobile.png") });
  const box = await page
    .getByRole("region", { name: "Air and launch workspace" })
    .boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Close aerospace workspace" }).click();
  await page.getByRole("button", { name: "Open data sources" }).hover();
  await expect(
    page.getByRole("region", { name: "Connected feeds and counts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Connected feeds and counts" }),
  ).toContainText("Satellites");
  await page.getByRole("button", { name: "Open data sources" }).click();
  await expect(page.getByLabel("Data layers status")).toContainText(
    "CelesTrak",
  );
  await expect(page.getByLabel("Data layers status")).toContainText("adsb.lol");
  expect(errors).toEqual([]);
});

test("worldwide aircraft and street-named Illinois camera shortcuts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/aerospace/**", async route => {
    const time = Math.floor(Date.now() / 1000);
    const data = route.request().url().endsWith("/worldwide")
      ? { time, states: [["abc123", "WORLD123", "United States", time, time, -87.9, 42.16, 9000, false, 200, 90, 0, null, 9200]] }
      : { results: [] };
    await route.fulfill({ json: { data, fetchedAt: new Date().toISOString(), stale: false }, headers: { "Access-Control-Allow-Origin": "*" } });
  });
  await page.route("**/api/earth/cameras/**", async route => {
    const feed = route.request().url().split("/").at(-1)!;
    const data = feed === "illinois-3" ? { features: ["N", "S"].map((direction, i) => ({
      attributes: { OBJECTID: 3339 + i, CameraLocation: "IL 21 at Inverrary", CameraDirection: direction,
        SnapShot: `https://www.lakecountypassage.com/snapshots/Inverrary_${direction}.jpg`, AgeInMinutes: "3", TooOld: "false" },
      geometry: { x: -87.91899109, y: 42.16080856 },
    })) } : feed === "london" || feed === "illinois-passage" ? [] : feed === "singapore" ? { items: [] } : feed.startsWith("california") ? { data: [] } : { features: [] };
    await route.fulfill({ json: { data, fetchedAt: new Date().toISOString(), stale: false }, headers: { "Access-Control-Allow-Origin": "*" } });
  });
  await page.route("https://www.lakecountypassage.com/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="gray"/></svg>' }));
  await page.goto("/?cameras=illinois&area=inverrary");
  const earth = page.getByRole("region", { name: "Earth and public cameras" });
  await expect(earth.getByRole("heading", { name: "Milwaukee Ave (IL 21) & Inverrary Ln · North view" })).toBeVisible();
  await expect(earth).toContainText("2 matching cameras");
  await earth.getByRole("button", { name: "Milwaukee Ave (IL 21) & Inverrary Ln · South view", exact: true }).click();
  await expect(earth.getByRole("heading", { name: /South view/ })).toBeVisible();
  await earth.getByRole("button", { name: "Deerfield", exact: true }).click();
  await expect(earth).toContainText("2 matching cameras");
  await earth.getByRole("button", { name: "UIUC · nearby roads", exact: true }).click();
  await expect(earth).toContainText("No published camera images found in this area");
  await expect(earth.getByRole("link", { name: "Official campus-camera status ↗" })).toHaveAttribute("href", "https://illinois.edu/community/campus-cams/");
  await page.route("https://api.wetmet.net/**", route => route.fulfill({ contentType: "text/html", body: "<video controls></video>" }));
  await earth.getByRole("button", { name: "Willis Tower", exact: true }).click();
  await expect(earth.getByRole("heading", { name: "Willis Tower · live skyline video" })).toBeVisible();
  await expect(earth.locator("iframe")).toHaveAttribute("src", /uid=bb1f0d7f31da085370753153f57204a5/);
  await earth.getByLabel("Live video only", { exact: true }).check();
  await earth.getByRole("button", { name: "Deerfield", exact: true }).click();
  await expect(earth).toContainText("No published live video found for these filters");
  await expect(earth.locator("iframe")).toHaveCount(0);
  await earth.getByLabel("Live video only", { exact: true }).uncheck();
  await expect(earth).toContainText("2 matching cameras");
  await earth.getByRole("button", { name: "New York Street", exact: true }).click();
  await expect(earth).toContainText("No New York Street feed was found");
  await expect(earth.locator(".earth-camera")).toHaveCount(0);
  await page.getByRole("button", { name: "Close Earth workspace" }).click();
  await page.getByRole("button", { name: "✈ Aircraft", exact: true }).click();
  await expect(page.getByLabel("Coverage region")).toHaveValue("worldwide");
  await expect(page.getByRole("button", { name: /WORLD123/ })).toBeVisible();
  await expect(page.getByLabel("Military-tagged only")).toBeDisabled();
  expect(errors).toEqual([]);
});

test("camera pagination, street filters and video failure fallback", async ({ page }) => {
  await page.route("**/api/aerospace/**", route => route.fulfill({ json: { data: { results: [] }, fetchedAt: new Date().toISOString() }, headers: { "Access-Control-Allow-Origin": "*" } }));
  await page.route("**/api/earth/cameras/**", async route => {
    const feed = route.request().url().split("/").at(-1)!;
    const data = feed === "illinois-0" ? { features: Array.from({ length: 160 }, (_, i) => ({
      attributes: { OBJECTID: i, CameraLocation: i === 159 ? "Eola / Liberty" : `Aurora road ${i}`, CameraDirection: "N", SnapShot: `https://cctv.travelmidwest.com/snapshots/test-${i}.jpg` },
      geometry: { x: -88.245, y: 41.769 },
    })) } : feed === "california-4" ? { data: [{ cctv: { index: "1", inService: "true",
      location: { latitude: "37.8", longitude: "-122.2", locationName: "I-580 video test" },
      imageData: { streamingVideoURL: "https://wzmedia.dot.ca.gov/test/playlist.m3u8", static: { currentImageURL: "https://cwwp2.dot.ca.gov/test.jpg" } },
    } }] } : feed === "london" || feed === "illinois-passage" ? [] : feed === "singapore" ? { items: [] } : feed.startsWith("california") ? { data: [] } : { features: [] };
    await route.fulfill({ json: { data, fetchedAt: new Date().toISOString(), stale: false }, headers: { "Access-Control-Allow-Origin": "*" } });
  });
  for (const host of ["cctv.travelmidwest.com", "cwwp2.dot.ca.gov"]) await page.route(`https://${host}/**`, route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"/>' }));
  await page.route("https://wzmedia.dot.ca.gov/**", route => route.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "unavailable" }));
  await page.goto("/?cameras=illinois&area=aurora");
  const earth = page.getByRole("region", { name: "Earth and public cameras" });
  await expect(earth).toContainText("160 matching cameras");
  await expect(earth.locator(".earth-camera-list button")).toHaveCount(150);
  await earth.getByRole("button", { name: "Show more cameras (10 remaining)" }).click();
  await expect(earth.locator(".earth-camera-list button")).toHaveCount(160);
  await earth.getByRole("button", { name: "Eola Road", exact: true }).click();
  await expect(earth).toContainText("1 matching cameras");
  await expect(earth.getByRole("heading", { name: "Eola / Liberty · North view" })).toBeVisible();
  await earth.getByLabel("Camera network", { exact: true }).selectOption("california");
  await expect(earth.locator("video")).toBeVisible();
  await expect(earth).toContainText("Video could not be loaded", { timeout: 30000 });
  await expect(earth.getByAltText("I-580 video test public road image")).toBeVisible();
  await expect(earth.locator("video")).toHaveCount(0);
});
