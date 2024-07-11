import { layout } from "./templates/layout.ts";

export const start = () =>
  Deno.serve(() => {
    return new Response(layout("hello"), {
      headers: {
        "Content-Type": "text/html",
      },
    });
  });
