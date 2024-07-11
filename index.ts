Deno.serve(() => {
  return new Response("hello", {
    headers: {
      "Content-Type": "text/html",
    },
  })
});
