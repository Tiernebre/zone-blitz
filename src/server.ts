import { registrationPage } from "./registration.ts";

export const start = () =>
  Deno.serve((request) => {
    if (request.method === "POST") {
      return new Response(registrationPage(), {
        headers: {
          "Content-Type": "text/html",
        },
      });
    } else {
      return new Response(registrationPage(), {
        headers: {
          "Content-Type": "text/html",
        },
      });
    }
  });
