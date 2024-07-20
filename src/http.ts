import { STATUS_CODE, StatusCode } from "@std/http";

type HtmlResponseParameters = {
  status?: StatusCode;
  headers?: HeadersInit;
};

export const htmlResponse = (
  html: string,
  { status = STATUS_CODE.OK, headers = {} }: HtmlResponseParameters = {},
) =>
  new Response(
    html,
    {
      status,
      headers: {
        "Content-Type": "text/html",
        ...headers,
      },
    },
  );

export const notFound = () =>
  new Response("Not Found", {
    status: STATUS_CODE.NotFound,
  });
