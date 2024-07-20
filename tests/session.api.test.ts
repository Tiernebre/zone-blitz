import { getSetCookies, STATUS_CODE } from "@std/http";
import { start } from "../src/server.ts";
import { assert, assertEquals } from "@std/assert";
import { SESSION_URL } from "./utils.ts";
import { post, register } from "./api.ts";
import { SessionForm } from "../src/domain/session.ts";

await start();

const account = await register();
const login = (sessionForm: Partial<SessionForm> = {}) =>
  post(SESSION_URL, sessionForm);

Deno.test("does not allow empty requests", async () => {
  const response = await login();
  assertEquals(response.status, STATUS_CODE.BadRequest);
  assert((await response.text()).includes("Could not login due to an error"));
});

Deno.test("does not allow empty username", async () => {
  const response = await login({
    password: "password",
  });
  assertEquals(response.status, STATUS_CODE.BadRequest);
  assert((await response.text()).includes("Could not login due to an error"));
});

Deno.test("does not allow empty password", async () => {
  const response = await login({
    username: "username",
  });
  assertEquals(response.status, STATUS_CODE.BadRequest);
  assert((await response.text()).includes("Could not login due to an error"));
});

Deno.test("requires a valid username", async () => {
  const response = await login({
    username: crypto.randomUUID(),
    password: crypto.randomUUID(),
  });
  assertEquals(response.status, STATUS_CODE.BadRequest);
  assert(
    (await response.text()).includes(
      "Could not find an existing account with the given username or password.",
    ),
  );
});

Deno.test("requires a valid password", async () => {
  const response = await login({
    username: account.username,
    password: crypto.randomUUID(),
  });
  assertEquals(response.status, STATUS_CODE.BadRequest);
  assert(
    (await response.text()).includes(
      "Could not find an existing account with the given username or password.",
    ),
  );
});

Deno.test("successfully logs in", async () => {
  const response = await login({
    username: account.username,
    password: account.password,
  });
  assertEquals(response.status, STATUS_CODE.OK);
  assert((await response.text()).includes("Logged in"));
  const [sessionCookie] = getSetCookies(response.headers);
  assert(sessionCookie);
  assertEquals(sessionCookie.name, "session");
  assertEquals(sessionCookie.value, "1");
});
