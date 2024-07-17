import { STATUS_CODE } from "@std/http";
import { createSchema } from "./db/mod.ts";
import fs from "node:fs";
import path from "node:path";

export const start = async () => {
  await createSchema();

  const routesPath = path.resolve(`${import.meta.dirname}/routes`);
  const routes = await fs.promises.readdir(routesPath);
  for (const route of routes) {
    const router = await import(`${routesPath}/${route}`);
    console.log({ router });
  }

  return Deno.serve({
    onListen: () => "",
  }, () => {
    return new Response("Not Found", {
      status: STATUS_CODE.NotFound,
    });
  });
};
