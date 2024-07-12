export const htmlResponse = (html: string) =>
  new Response(
    html,
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  );
