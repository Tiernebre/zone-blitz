import { STATUS_CODE } from "@std/http";
import { createSchema } from "./db/mod.ts";
import fs from "node:fs";
import path from "node:path";
import { RouterHandler } from "./types.ts";

export const start = async () => {
  await createSchema();

  const notFoundResponse = new Response("Not Found", {
    status: STATUS_CODE.NotFound,
  });

  const routesPath = path.resolve(`${import.meta.dirname}/routes`);
  const routers: Record<string, RouterHandler> = {};

  for (const routeFile of await fs.promises.readdir(routesPath)) {
    Object.entries(await import(`${routesPath}/${routeFile}`)).forEach(
      ([method, handler]) => {
        routers[
          `${method}_${`/${routeFile.slice(0, -3).replace("index", "")}`}`
        ] = handler as RouterHandler;
      },
    );
  }

  return Deno.serve({
    onListen: () => "",
  }, async (request) => {
    const handler = routers[
      `${request.method.toLowerCase()}_${new URL(request.url).pathname}`
    ];
    return handler
      ? await handler(request) || notFoundResponse
      : notFoundResponse;
  });
};
