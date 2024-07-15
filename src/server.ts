import { STATUS_CODE } from "@std/http";
import { createSchema } from "./db/mod.ts";
import { routeForRegistration } from "./registration.ts";
import { routeForHome } from "./home.ts";

export const start = async () => {
  await createSchema();

  return Deno.serve({
    onListen: () => "",
  }, async (request) => {
    const url = new URL(request.url);
    for (const router of [routeForHome, routeForRegistration]) {
      const response = await router(request, url);
      if (response) {
        return response;
      }
    }
    return new Response("Not Found", {
      status: STATUS_CODE.NotFound,
    });
  });
};
