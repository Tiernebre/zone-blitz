import { start } from "../src/server.ts";
import { assertEquals } from "@std/assert";

start();

Deno.test("hello world", () => {
  assertEquals(1, 1);
});
