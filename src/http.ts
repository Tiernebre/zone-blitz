import { STATUS_CODE, StatusCode } from "@std/http";

export const htmlResponse = (
  html: string,
  status: StatusCode = STATUS_CODE.OK,
) =>
  new Response(
    html,
    {
      status,
      headers: {
        "Content-Type": "text/html",
      },
    },
  );

export const notFound = () =>
  new Response("Not Found", {
    status: STATUS_CODE.NotFound,
  });
