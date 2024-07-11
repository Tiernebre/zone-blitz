import { serveDir } from "@std/http";

export const server = () => Deno.serve((request) => {
  return serveDir(request, {
    fsRoot: "static",
    urlRoot: ""
  })
});