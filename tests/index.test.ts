import { start } from "../src/server.ts";
import { assert, assertEquals } from "@std/assert";
import { URL } from "./utils.ts";
import { STATUS_CODE } from "@std/http";

await start();

Deno.test("renders index page", async () => {
  const response = await fetch(URL);
  assertEquals(response.status, STATUS_CODE.OK);
  assert((await response.text()).includes("Home"));
});
