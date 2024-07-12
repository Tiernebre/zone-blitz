import { sql } from "./db/postgres.ts";
import { layout } from "./templates/layout.ts";

type Registration = {
  username: string;
  password: string;
};

export const renderRegistrationPage = () =>
  new Response(
    layout(/*html*/ `
      <form method="post">
        <label for="username">Username</label>
        <input id="username" name="username" type="text">
        <label for="password">Password</label>
        <input id="password" name="password" type="password">
        <button type="submit">Register</button>
      </form>
    `),
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  );

export const register = (request: Request) =>
  request.formData().then(mapFromForm).then(insert).then(renderSuccessPage)
    .catch(
      renderErrorPage,
    );

const mapFromForm = (formData: FormData): Registration => {
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

const insert = (registration: Registration) =>
  sql`
  INSERT INTO registration (username, password) VALUES (${registration.username}, ${registration.password})
`;

const renderSuccessPage = () => (
  new Response(
    layout(/*html*/ `
      <p>registered</p>
    `),
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  )
);

const renderErrorPage = (error: Error) => (
  new Response(
    layout(/*html*/ `
      <p>Got error when registering: ${error.message}</p>
    `),
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  )
);
