import { createSchema } from "./db/mod.ts";
import { getSession } from "./domain/session.ts";
import { notFound } from "./http.ts";
import { getRouters } from "./router.ts";

export const start = async () => {
  await createSchema();
  const routers = await getRouters();

  return Deno.serve(async (request) => {
    for (const router of routers) {
      const matchedUrl = router.urlPattern.exec(new URL(request.url));
      if (matchedUrl) {
        return router.handler(request, {
          urlPatternResult: matchedUrl,
          session: await getSession(request),
        });
      }
    }
    return notFound();
  });
};
