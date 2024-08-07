import { start } from "../src/server.ts";
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { browserTest } from "./browser.ts";
import { SESSION_URL as URL } from "./utils.ts";
import { Page } from "@astral/astral";
import { register } from "./api.ts";

const USERNAME_SELECTOR = 'input[name="username"]';
const PASSWORD_SELECTOR = 'input[name="password"]';

await start();

const getUsernameInput = (page: Page) => page.$(USERNAME_SELECTOR);
const getPasswordInput = (page: Page) => page.$(PASSWORD_SELECTOR);
const getButton = (page: Page) => page.$("button");

Deno.test("renders a form", async () => {
  await browserTest(URL, async (page) => {
    assertNotEquals(await getUsernameInput(page), null);
  });
});

Deno.test("validates that username must be filled out", async () => {
  await browserTest(URL, async (page) => {
    await (await getPasswordInput(page))!.type(crypto.randomUUID());
    await (await getButton(page))!.click();
    assertNotEquals(await page.$(`${USERNAME_SELECTOR}:invalid`), null);
  });
});

Deno.test("validates that password must be filled out", async () => {
  await browserTest(URL, async (page) => {
    await (await getUsernameInput(page))!.type(crypto.randomUUID());
    await (await getButton(page))!.click();
    assertNotEquals(await page.$(`${PASSWORD_SELECTOR}:invalid`), null);
  });
});

Deno.test("logs in a user", async () => {
  const { account } = await register();
  await browserTest(URL, async (page) => {
    await (await getUsernameInput(page))!.type(account.username);
    await (await getPasswordInput(page))!.type(account.password);
    await (await getButton(page))!.click();
    await page.waitForNavigation();
    const message = await page.$("div");
    assert(message);
    assertEquals(
      await message.innerText(),
      "Home You are logged in! Welcome 1",
    );
  });
});
