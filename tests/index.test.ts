import { start } from "../src/server.ts";
import { assert, assertEquals } from "@std/assert";

start();

Deno.test("returns hello world html", async () => {
  const response = await fetch("http://0.0.0.0:8000");
  assertEquals(response.status, 200);
  const body = await response.text();
  assert(body.includes("hello"));
});
