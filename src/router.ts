import { STATUS_CODE } from "@std/http";

export type Router = {
  urlPattern: URLPattern;
  handler: RouterHandler;
};

export type RouterHandler = (
  request: Request,
  urlPatternResult: URLPatternResult,
) => Promise<Response> | Response;

type HttpHandlerOptions = {
  get?: RouterHandler;
  post?: RouterHandler;
};

export const httpHandler =
  (options: HttpHandlerOptions): RouterHandler => (request, ...args) => {
    let handler;
    switch (request.method) {
      case "GET":
        handler = options.get;
        break;
      case "POST":
        handler = options.post;
        break;
      default:
        return notFound();
    }
    return handler ? handler(request, ...args) : notFound();
  };

export const notFound = () =>
  new Response("Not Found", {
    status: STATUS_CODE.NotFound,
  });
