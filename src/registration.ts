import { layout } from "./templates/layout.ts";

export const registrationPage = () =>
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

const users: Record<string, string> = {};

export const register = async (request: Request) => {
  const data = await request.formData();
  const username = data.get("username") as string;
  console.log("got username and password", username);
  users.username = username;
  return new Response(
    "registered",
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  );
};
