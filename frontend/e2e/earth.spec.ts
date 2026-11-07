import { test, expect } from "@playwright/test";
test("coordinate navigation and modern satellite inspector", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Earth", exact: true }).click();
  const panel = page.getByLabel("Earth and public cameras");
  await panel
    .getByLabel("Find a street, city or coordinates")
    .fill("51.5074, -0.1278");
  await panel.getByRole("button", { name: "Go", exact: true }).click();
  await expect(panel).toContainText("Singapore");
  await page.getByRole("button", { name: "▱ Satellites", exact: true }).click();
  await expect(panel).toHaveCount(0);
  const catalog = page.getByRole("region", { name: "Orbital operations" });
  await catalog.locator(".catalog-row button:nth-child(2)").first().click();
  await expect(
    page.getByRole("region", { name: "Satellite details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Satellite details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close satellite details" }),
  ).toBeVisible();
});
