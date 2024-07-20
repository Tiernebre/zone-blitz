import { createSchema } from "./db/mod.ts";
import { notFound } from "./http.ts";
import { getRouters } from "./router.ts";

export const start = async () => {
  await createSchema();
  const routers = await getRouters();

  return Deno.serve((request) => {
    for (const router of routers) {
      const matchedUrl = router.urlPattern.exec(new URL(request.url));
      if (matchedUrl) {
        return router.handler(request, matchedUrl);
      }
    }
    return notFound();
  });
};
