import { start } from "../src/server.ts";
import { assertNotEquals } from "@std/assert";
import { browser } from "./browser.ts";
import { REGISTRATION_URL as URL } from "./utils.ts";

await start();

Deno.test("renders a form", async () => {
  const suite = await browser();
  const page = await suite.newPage(URL);
  assertNotEquals(await page.$('input[name="username"]'), null);
  await page.close();
  await suite.close();
});
