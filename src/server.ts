import { register, registrationPage } from "./registration.ts";

export const start = () =>
  Deno.serve((request) => {
    if (request.method === "POST") {
      return register(request);
    } else {
      return registrationPage();
    }
  });
