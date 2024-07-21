import { STATUS_CODE } from "@std/http";
import { start } from "../src/server.ts";
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { REGISTRATION_URL as URL } from "./utils.ts";
import { Registration, RegistrationForm } from "../src/domain/registration.ts";
import { post } from "./api.ts";
import { sql } from "../src/db/mod.ts";
import { assertOnLoggedIn } from "./assertions.ts";

await start();

const register = (registration: Partial<RegistrationForm>) =>
  post(URL, registration);

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
  const username = crypto.randomUUID();
  const password = crypto.randomUUID();
  const response = await register({
    username,
    password,
  });
  const [persistedRegistration] = await sql<
    Partial<Registration>[]
  >`SELECT password FROM registration WHERE username = ${username}`;
  assertNotEquals(persistedRegistration.password, password);
  await assertOnLoggedIn(response);
});
