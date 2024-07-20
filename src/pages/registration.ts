import { STATUS_CODE } from "@std/http";
import { sql } from "../db/postgres.ts";
import { htmlResponse } from "../http.ts";
import { layout } from "../templates/layout.ts";
import argon2 from "argon2";
import { httpRouter } from "../router.ts";
import type { RegistrationForm } from "../domain/registration.ts";

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
  request.formData().then(mapFromForm).then(insert).then(renderSuccessPage)
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

const insert = (registration: RegistrationForm) =>
  sql`
  INSERT INTO registration (username, password) VALUES (${registration.username}, ${registration.password})
`;

const renderSuccessPage = () => (
  htmlResponse(
    layout(/*html*/ `
      <p>registered</p>
    `),
  )
);

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
