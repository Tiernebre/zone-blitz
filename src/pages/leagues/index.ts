import { htmlResponse, notFound } from "../../http.ts";
import { httpRouter } from "../../router.ts";

const get = () =>
  htmlResponse(/*html*/ `
  Leagues
  `);
const post = () => notFound();

export default httpRouter({
  get,
  post,
});
