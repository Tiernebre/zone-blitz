import { STATUS_CODE } from "@std/http";
import { createSchema } from "./db/mod.ts";
import { promises } from "node:fs";
import path from "node:path";
import { Router } from "./router.ts";

export const start = async () => {
  await createSchema();

  const routesPath = path.resolve(`${import.meta.dirname}/routes`);
  const routers: Router[] = [];

  for (const routeFile of await promises.readdir(routesPath)) {
    routers.push({
      urlPattern: new URLPattern({
        pathname: `/${routeFile.slice(0, -3).replace("index", "")}`,
      }),
      handler: (await import(`${routesPath}/${routeFile}`)).default,
    });
  }

  return Deno.serve((request) => {
    for (const router of routers) {
      const matchedUrl = router.urlPattern.exec(new URL(request.url));
      if (matchedUrl) {
        return router.handler(request, matchedUrl);
      }
    }
    return new Response("Not Found", {
      status: STATUS_CODE.NotFound,
    });
  });
};
