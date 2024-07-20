import { STATUS_CODE } from "@std/http";
import { sql } from "../db/postgres.ts";
import { htmlResponse } from "../http.ts";
import { layout } from "../templates/layout.ts";
import argon2 from "argon2";

export type Registration = {
  username: string;
  password: string;
};

export default (request: Request, _urlPatternResult: URLPatternResult) => {
  return request.method === "GET" ? get() : post(request);
};

export const get = () =>
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

export const post = (request: Request) =>
  request.formData().then(mapFromForm).then(insert).then(renderSuccessPage)
    .catch(
      renderErrorPage,
    );

const mapFromForm = async (formData: FormData): Promise<Registration> => {
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

const insert = (registration: Registration) =>
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
    STATUS_CODE.BadRequest,
  );
