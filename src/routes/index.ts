import { htmlResponse } from "../http.ts";
import { httpHandler } from "../router.ts";
import { layout } from "../templates/layout.ts";

const get = () =>
  htmlResponse(
    layout(/*html*/ `
    <div>Home</div>
  `),
  );

export default httpHandler({
  get,
});
