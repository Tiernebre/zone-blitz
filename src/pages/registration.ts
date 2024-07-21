import { STATUS_CODE } from "@std/http";
import { sql } from "../db/postgres.ts";
import { htmlResponse } from "../http.ts";
import { layout } from "../templates/layout.ts";
import argon2 from "argon2";
import { httpRouter } from "../router.ts";
import type { Registration, RegistrationForm } from "../domain/registration.ts";
import { createSession, respondWithSession } from "../domain/session.ts";

const get = () =>
  htmlResponse(
    layout(/*html*/ `
      <form method="post">
        <label for="username">Username</label>
        <input id="username" name="username" required>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required>
        <button>Register</button>
      </form>
    `),
  );

const post = (request: Request) =>
  request.formData().then(mapFromForm).then(insert).then(createSession).then(
    respondWithSession,
  )
    .catch(
      renderErrorPage,
    );

const mapFromForm = async (formData: FormData): Promise<RegistrationForm> => {
  const username = formData.get("username");
  const password = formData.get("password");
  if (!username || !password) {
    throw new Error("Username and password are required.");
  }
  if (typeof username !== "string" || typeof password !== "string") {
    throw new Error("Username and password must be strings.");
  }
  return { username, password: await argon2.hash(password) };
};

const insert = async (form: RegistrationForm) => {
  const [registration] = await sql<Registration[]>`
    INSERT INTO registration (username, password) VALUES (${form.username}, ${form.password}) RETURNING *
  `;
  if (!registration) {
    throw new Error(
      "Could not register an account from the given information.",
    );
  }
  return registration;
};

const renderErrorPage = (error: Error) =>
  htmlResponse(
    layout(/*html*/ `
      <p>Got error when registering: ${error.message}</p>
    `),
    {
      status: STATUS_CODE.BadRequest,
    },
  );

export default httpRouter({
  get,
  post,
});
