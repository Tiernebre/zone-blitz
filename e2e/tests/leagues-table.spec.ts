import { expect, test } from "../fixtures/auth.ts";

test("created league appears in the home page leagues table", async ({ authenticatedPage: page }) => {
  const leagueName = `Table Test League ${Date.now()}`;

  await page.goto("/leagues/new");
  await page.getByLabel("League name").fill(leagueName);
  await page.getByRole("button", { name: "Create league" }).click();

  await expect(
    page.getByRole("heading", { name: "Choose Your Team" }),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Leagues" }),
  ).toBeVisible();

  const row = page.getByRole("row", { name: new RegExp(leagueName) });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell", { name: leagueName, exact: true }))
    .toBeVisible();
  await expect(row.getByRole("cell", { name: "32", exact: true }))
    .toBeVisible();
  await expect(row.getByRole("cell", { name: "17", exact: true }))
    .toBeVisible();
});
