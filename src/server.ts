import { register, registrationPage } from "./registration/registration.ts";

export const start = () =>
  Deno.serve((request) => {
    if (request.method === "POST") {
      console.log("form?");
      return register(request);
    } else {
      return registrationPage();
    }
  });
