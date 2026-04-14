import { expect, test } from "../fixtures/auth.ts";

test("user can create a league, pick a team, and land on the league dashboard", async ({ authenticatedPage: page }) => {
  await page.goto("/leagues/new");

  await expect(
    page.getByRole("heading", { name: "Create a new league" }),
  ).toBeVisible();

  await page.getByLabel("League name").fill("Test League");
  await page.getByRole("button", { name: "Create league" }).click();

  await expect(
    page.getByRole("heading", { name: "Choose Your Team" }),
  ).toBeVisible({ timeout: 30_000 });

  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  await expect(page).toHaveURL(new RegExp(`/leagues/${uuid}/team-select$`));

  await page.getByRole("button").first().click();

  await expect(page).toHaveURL(new RegExp(`/leagues/${uuid}$`));
});
