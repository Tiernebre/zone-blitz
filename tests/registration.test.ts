import { STATUS_CODE } from "@std/http";
import { start } from "../src/server.ts";
import { assert, assertEquals } from "@std/assert";
import { Registration } from "../src/registration.ts";
import { launch } from "jsr:@astral/astral";

await start();

const browser = await launch({
  wsEndpoint:
    "ws://127.0.0.1:1337/devtools/browser/c5b43dbd-e478-4840-abac-a84925a2d1d3",
  headless: true,
});

// Open a new page
const page = await browser.newPage("https://deno.land");

// Take a screenshot of the page and save that to disk
const screenshot = await page.screenshot();
Deno.writeFileSync("screenshot.png", screenshot);

// Close the browser
await browser.close();

const URL = "http://0.0.0.0:8000";

const register = (registration: Partial<Registration>) =>
  fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(registration),
  });

Deno.test("does not allow empty requests", async () => {
  const response = await register({});
  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.text();
  assert(body.includes("Got error when registering"));
});

Deno.test("does not allow empty username", async () => {
  const response = await register({
    password: "password",
  });
  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.text();
  assert(body.includes("Got error when registering"));
});

Deno.test("does not allow empty password", async () => {
  const response = await register({
    password: "password",
  });
  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.text();
  assert(body.includes("Got error when registering"));
});

Deno.test("successfully registers", async () => {
  const response = await register({
    username: "username",
    password: "password",
  });
  assertEquals(response.status, STATUS_CODE.OK);
  const body = await response.text();
  assert(body.includes("registered"));
});
