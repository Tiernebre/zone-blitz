import { start } from "../src/server.ts";
import { assert, assertNotEquals } from "@std/assert";
import { browser } from "./browser.ts";
import { REGISTRATION_URL as URL } from "./utils.ts";
import { Page } from "@astral/astral";

await start();

const getUsernameInput = (page: Page) => page.$('input[name="username"]');
const getPasswordInput = (page: Page) => page.$('input[name="password"]');
const getButton = (page: Page) => page.$("button");

Deno.test("renders a form", async () => {
  const suite = await browser();
  const page = await suite.newPage(URL);
  assertNotEquals(await getUsernameInput(page), null);
  await page.close();
  await suite.close();
});

Deno.test("registers a user", async () => {
  const suite = await browser();
  const page = await suite.newPage(URL);
  await (await getUsernameInput(page))!.type(crypto.randomUUID());
  await (await getPasswordInput(page))!.type(crypto.randomUUID());
  await (await getButton(page))!.click();
  await page.waitForNavigation();
  assert((await page.content()).includes("registered"));
  await page.close();
  await suite.close();
});
