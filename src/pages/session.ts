import { STATUS_CODE } from "@std/http";
import { sql } from "../db/mod.ts";
import { Registration } from "../domain/registration.ts";
import { Session, type SessionForm } from "../domain/session.ts";
import { htmlResponse } from "../http.ts";
import { httpRouter } from "../router.ts";
import argon2 from "argon2";

const mapFromForm = (formData: FormData): SessionForm => {
  const username = formData.get("username");
  const password = formData.get("password");
  if (!username || !password) {
    throw new Error("Username and password are required.");
  }
  if (typeof username !== "string" || typeof password !== "string") {
    throw new Error("Username and password must be strings.");
  }
  return { username, password };
};

const getRegistration = async ({ username, password }: SessionForm) => {
  const [registration] = await sql<
    Registration[]
  >`SELECT * FROM registration WHERE username = ${username}`;
  if (!registration) {
    throw new Error(
      "Could not find an existing account with the given username or password.",
    );
  }
  if (!await argon2.verify(registration.password, password)) {
    throw new Error(
      "Could not find an existing account with the given username or password.",
    );
  }
  return registration;
};

const createSession = async ({ id }: Registration) => {
  const [session] = await sql<
    Session[]
  >`INSERT INTO session (registration_id) VALUES (${id}) RETURNING *`;
  if (!session) {
    throw new Error("Could not create session for the provided account.");
  }
  return session;
};

const renderLoggedIn = (session: Session) =>
  htmlResponse(
    /*html*/ `
    <div>Logged in ${session.id}</div>
  `,
  );

const renderError = (error: Error) =>
  htmlResponse(
    /*html*/ `
    <div>Could not login due to an error: ${error}</div>
  `,
    STATUS_CODE.BadRequest,
  );

const get = () =>
  htmlResponse(/*html*/ `
  <form method="post">
    <label for="username">Username</label>
    <input id="username" name="username" required>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required>
    <button>Login</button>
  </form>
`);
const post = (request: Request) => {
  return request.formData().then(mapFromForm).then(getRegistration).then(
    createSession,
  ).then(renderLoggedIn).catch(renderError);
};

export default httpRouter({
  get,
  post,
});
