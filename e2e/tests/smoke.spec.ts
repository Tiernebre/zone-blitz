import { expect, test } from "@playwright/test";

test("health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("ok");
});

test("homepage renders Zone Blitz heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Zone Blitz" }),
  ).toBeVisible();
});

test("homepage shows leagues section", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Leagues" }),
  ).toBeVisible();
});
