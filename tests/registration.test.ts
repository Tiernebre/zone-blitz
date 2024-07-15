import { STATUS_CODE } from "@std/http";
import { start } from "../src/server.ts";
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { Registration } from "../src/registration.ts";
import { browser } from "./browser.ts";
import { urlWithPath } from "./utils.ts";

const URL = urlWithPath("registration");

await start();

const register = (registration: Partial<Registration>) =>
  fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(registration),
  });

Deno.test("renders a form", async () => {
  const suite = await browser();
  const page = await suite.newPage(URL);
  assertNotEquals(await page.$('input[name="username"]'), null);
  await page.close();
  await suite.close();
});

Deno.test("does not allow empty requests", async () => {
  const response = await register({});
  assertEquals(response.status, STATUS_CODE.BadRequest);
  assert((await response.text()).includes("Got error when registering"));
});

Deno.test("does not allow empty username", async () => {
  const response = await register({
    password: "password",
  });
  assertEquals(response.status, STATUS_CODE.BadRequest);
  assert((await response.text()).includes("Got error when registering"));
});

Deno.test("does not allow empty password", async () => {
  const response = await register({
    password: "password",
  });
  assertEquals(response.status, STATUS_CODE.BadRequest);
  assert((await response.text()).includes("Got error when registering"));
});

Deno.test("successfully registers", async () => {
  const response = await register({
    username: crypto.randomUUID().toString(),
    password: "password",
  });
  assertEquals(response.status, STATUS_CODE.OK);
  assert((await response.text()).includes("registered"));
});
