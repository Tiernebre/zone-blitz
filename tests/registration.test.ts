import { STATUS_CODE } from "@std/http";
import { start } from "../src/server.ts";
import { assert, assertEquals } from "@std/assert";
import { Registration } from "../src/registration.ts";
import { browser } from "./browser.ts";

await start();

await browser();

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
    username: crypto.randomUUID().toString(),
    password: "password",
  });
  assertEquals(response.status, STATUS_CODE.OK);
  const body = await response.text();
  assert(body.includes("registered"));
});
