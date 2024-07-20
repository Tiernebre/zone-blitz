import { htmlResponse } from "../http.ts";
import { layout } from "../templates/layout.ts";

export default () =>
  htmlResponse(
    layout(/*html*/ `
    <div>Home</div>
  `),
  );
