import { start } from "../src/server.ts";
import { assert, assertEquals } from "@std/assert";
import { URL } from "./utils.ts";
import { STATUS_CODE } from "@std/http";
import { login } from "./api.ts";

await start();

Deno.test("renders index page", async () => {
  const response = await fetch(URL);
  assertEquals(response.status, STATUS_CODE.OK);
  assert((await response.text()).includes("Home"));
});

Deno.test("renders index page with login message", async () => {
  const sessionId = await login();
  const response = await fetch(URL, {
    headers: {
      "Cookie": `session=${sessionId}`,
    },
    credentials: "include",
  });
  assertEquals(response.status, STATUS_CODE.OK);
  assert((await response.text()).includes("You are logged in! Welcome"));
});
