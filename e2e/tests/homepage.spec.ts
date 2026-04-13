import { clearScreenDown } from "node:readline";
import { expect, test } from "../fixtures/auth.ts";

test("unauthorized user gets navigated to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: /Sign In with Google/i }))
    .toBeVisible();
});

test("authorized user gets navigated to leagues", async ({ authenticatedPage }) => {
  await authenticatedPage.goto("/");
  await expect(authenticatedPage).not.toHaveURL(/\/login/);
  await expect(authenticatedPage.getByText(/No leagues yet/i)).toBeVisible();
});
