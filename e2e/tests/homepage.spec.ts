import { expect, test } from "@playwright/test";

test("unauthorized page shows up as login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
