import { STATUS_CODE } from "@std/http";
import { start } from "../src/server.ts";
import { assert, assertEquals } from "@std/assert";
import { Registration } from "../src/pages/registration.ts";
import { REGISTRATION_URL as URL } from "./utils.ts";

await start();

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
