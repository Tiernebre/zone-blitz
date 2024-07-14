import { start } from "../src/server.ts";
import { assert, assertEquals } from "@std/assert";
import { URL } from "./utils.ts";

await start();

Deno.test("renders index page", async () => {
  const response = await fetch(URL);
  assertEquals(response.status, 200);
  const body = await response.text();
  assert(body.includes("Home"));
});
