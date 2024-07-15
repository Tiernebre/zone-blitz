import { start } from "../src/server.ts";
import { assert, assertNotEquals } from "@std/assert";
import { browserTest } from "./browser.ts";
import { REGISTRATION_URL as URL } from "./utils.ts";
import { Page } from "@astral/astral";

const USERNAME = 'input[name="username"]';

await start();

const getUsernameInput = (page: Page) => page.$(USERNAME);
const getInvalidUsernameInput = (page: Page) => page.$(`${USERNAME}:invalid`);
const getPasswordInput = (page: Page) => page.$('input[name="password"]');
const getButton = (page: Page) => page.$("button");

Deno.test("renders a form", async () => {
  await browserTest(URL, async (page) => {
    assertNotEquals(await getUsernameInput(page), null);
  });
});

Deno.test("registers a user", async () => {
  await browserTest(URL, async (page) => {
    await (await getUsernameInput(page))!.type(crypto.randomUUID());
    await (await getPasswordInput(page))!.type(crypto.randomUUID());
    await (await getButton(page))!.click();
    await page.waitForNavigation();
    assert((await page.content()).includes("registered"));
  });
});

Deno.test("validates that username must be filled out", async () => {
  await browserTest(URL, async (page) => {
    await (await getPasswordInput(page))!.type(crypto.randomUUID());
    await (await getButton(page))!.click();
    assertNotEquals(await getInvalidUsernameInput(page), null);
  });
});
