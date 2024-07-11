import { layout } from "./templates/layout.ts";

export const registrationPage = () =>
  layout(/*html*/ `
<form>
  <label for="username">Username</label>
  <input id="username" name="username" type="text">
  <label for="password">Password</label>
  <input id="password" name="password" type="password">
  <button type="submit">Register</button>
</form>
`);

export const register = (request: Request) => {
};
