import { serveDir } from "@std/http";

export const start = () =>
  Deno.serve((request) => {
    return serveDir(request, {
      fsRoot: "static",
      urlRoot: "",
    });
  });
