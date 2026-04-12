# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: homepage.spec.ts >> homepage renders Zone Blitz heading
- Location: e2e/tests/homepage.spec.ts:3:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Zone Blitz' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Zone Blitz' })

```

# Page snapshot

```yaml
- generic [ref=e2]: 404 Not Found
```

# Test source

```ts
  1  | import { expect, test } from "../fixtures/auth.ts";
  2  | 
  3  | test("homepage renders Zone Blitz heading", async ({ authenticatedPage }) => {
  4  |   await authenticatedPage.goto("/");
  5  |   await expect(
  6  |     authenticatedPage.getByRole("heading", { name: "Zone Blitz" }),
> 7  |   ).toBeVisible();
     |     ^ Error: expect(locator).toBeVisible() failed
  8  | });
  9  | 
  10 | test("homepage shows leagues section", async ({ authenticatedPage }) => {
  11 |   await authenticatedPage.goto("/");
  12 |   await expect(
  13 |     authenticatedPage.getByRole("heading", { name: "Leagues" }),
  14 |   ).toBeVisible();
  15 | });
  16 | 
```