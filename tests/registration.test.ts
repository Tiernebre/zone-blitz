import { STATUS_CODE } from "@std/http";
import { start } from "../src/server.ts";
import { assert, assertEquals } from "@std/assert";

await start();

Deno.test("does not allow empty username", async () => {
  const response = await fetch("http://0.0.0.0:8000", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "",
  });
  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.text();
  assert(body.includes("Got error when registering"));
});
