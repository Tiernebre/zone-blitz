import { createHmac } from "node:crypto";
import { type Page, test as base } from "@playwright/test";
import { resetDatabase, seedTestUser } from "../helpers/db.ts";
import { SESSION_COOKIE_NAME } from "../helpers/seed-data.ts";

type AuthFixtures = {
  authenticatedPage: Page;
};

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ??
  "e2e-test-secret-not-real";

function signSessionCookie(token: string, secret: string): string {
  const signature = createHmac("sha256", secret)
    .update(token)
    .digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

function sessionCookie(signedValue: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: signedValue,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
    expires: Math.floor(new Date("2099-01-01").getTime() / 1000),
  };
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser, baseURL }, use) => {
    await resetDatabase();
    const { sessionToken } = await seedTestUser();
    const signedCookie = signSessionCookie(sessionToken, BETTER_AUTH_SECRET);

    const context = await browser.newContext({
      baseURL,
      storageState: {
        cookies: [sessionCookie(signedCookie)],
        origins: [],
      },
    });

    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
