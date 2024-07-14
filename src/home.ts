import { htmlResponse } from "./response.ts";
import { layout } from "./templates/layout.ts";
import { RouterFunction } from "./types.ts";

export const routeForHome: RouterFunction = (request, url) => {
  if (url.pathname === "/" && request.method === "GET") {
    return renderHomePage();
  } else {
    return null;
  }
};

const renderHomePage = () =>
  htmlResponse(
    layout(/*html*/ `
    <div>Home</div>
  `),
  );
