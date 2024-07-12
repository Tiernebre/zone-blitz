import { createSchema } from "./db/mod.ts";
import { register, registrationPage } from "./registration.ts";

export const start = async () => await createSchema();
Deno.serve((request) => {
  if (request.method === "POST") {
    return register(request);
  } else {
    return registrationPage();
  }
});
