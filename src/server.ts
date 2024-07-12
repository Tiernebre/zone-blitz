import { createSchema } from "./db/mod.ts";
import { register, renderRegistrationPage } from "./registration.ts";

export const start = async () => {
  await createSchema();
  return Deno.serve((request) => {
    if (request.method === "POST") {
      return register(request);
    } else {
      return renderRegistrationPage();
    }
  });
};
