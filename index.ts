import { serveDir } from "@std/http";

Deno.serve((request) => {
  return serveDir(request, {
    fsRoot: "static",
    urlRoot: ""
  })
});
