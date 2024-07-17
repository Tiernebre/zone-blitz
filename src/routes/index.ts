import { htmlResponse } from "../http.ts";
import { layout } from "../templates/layout.ts";

export const get = () =>
  htmlResponse(
    layout(/*html*/ `
    <div>Home</div>
  `),
  );
