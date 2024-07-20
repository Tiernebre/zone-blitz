import { notFound } from "./http.ts";
import path from "node:path";
import { promises as fsPromises } from "node:fs";

export type Router = {
  urlPattern: URLPattern;
  handler: RouterHandler;
};

export type RouterHandler = (
  request: Request,
  urlPatternResult: URLPatternResult,
) => Promise<Response> | Response;

type HttpRouterOptions = {
  get?: RouterHandler;
  post?: RouterHandler;
};

export const getRouters = async () => {
  const routesPath = path.resolve(`${import.meta.dirname}/pages`);
  const routers: Router[] = [];

  for (const routeFile of await fsPromises.readdir(routesPath)) {
    routers.push({
      urlPattern: new URLPattern({
        pathname: `/${routeFile.slice(0, -3).replace("index", "")}`,
      }),
      handler: (await import(`${routesPath}/${routeFile}`)).default,
    });
  }
  return routers;
};

export const httpRouter =
  (options: HttpRouterOptions): RouterHandler => (request, ...args) => {
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
