import { htmlResponse } from "../http.ts";
import { httpRouter, RouterHandlerOptions } from "../router.ts";
import { layout } from "../templates/layout.ts";

const get = (_request: Request, { session }: RouterHandlerOptions) =>
  htmlResponse(
    layout(/*html*/ `
    <div>
      Home
      ${session ? `You are logged in! Welcome ${session.registrationId}` : ""}
    </div>
  `),
  );

export default httpRouter({
  get,
});
