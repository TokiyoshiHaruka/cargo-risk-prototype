import { expect, test } from "@playwright/test";

test("player can complete a cargo run and inspect the receipt", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose a contract" })).toBeVisible();
  await page.locator('button[data-action="contract:med-supplies"]').click();
  await expect(page.getByRole("heading", { name: "Plot the run" })).toBeVisible();
  await page.locator('button[data-action="route:lantern"]').click();
  await expect(page.getByRole("heading", { name: "Route event" })).toBeVisible();
  await page.locator('button[data-action="event:hold"]').click();
  await page.locator('button[data-action="event:evade"]').click();
  await expect(page.getByRole("heading", { name: "Run complete" })).toBeVisible();
  await page.getByRole("button", { name: "Inspect run receipt" }).click();
  await expect(page.getByRole("heading", { name: "Run receipt" })).toBeVisible();
  await expect(page.getByText(/Seed 42/)).toBeVisible();
  await expect(page.locator(".receipt")).toContainText("choices hold, evade");
  await expect(page.locator(".receipt")).toContainText("profit");
  await page.screenshot({ path: "evidence/cargo-receipt.png", fullPage: true });
  await page.getByRole("button", { name: "Restart with new seed" }).click();
  await expect(page.getByRole("heading", { name: "Choose a contract" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run receipt" })).toHaveCount(0);
});

test("mobile layout keeps the route canvas behind a readable HUD", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose a contract" })).toBeVisible();
  await page.screenshot({ path: "evidence/cargo-mobile.png", fullPage: true });
});
