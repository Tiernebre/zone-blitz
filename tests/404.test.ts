import { start } from "../src/server.ts";
import { assert, assertEquals } from "@std/assert";
import { urlWithPath } from "./utils.ts";
import { STATUS_CODE } from "@std/http";

await start();

Deno.test("renders not found page", async () => {
  const response = await fetch(urlWithPath("not-a-legit-path"));
  assertEquals(response.status, STATUS_CODE.NotFound);
  assert((await response.text()).includes("Not Found"));
});
