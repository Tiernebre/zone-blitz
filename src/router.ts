import { notFound } from "./http.ts";
import path from "node:path";
import { promises as fsPromises } from "node:fs";
import { Session } from "./domain/session.ts";

export type Router = {
  urlPattern: URLPattern;
  handler: RouterHandler;
};

export type RouterHandlerOptions = {
  urlPatternResult: URLPatternResult;
  session?: Session;
};

export type RouterHandler = (
  request: Request,
  options: RouterHandlerOptions,
) => Promise<Response> | Response;

type HttpRouterOptions = {
  get?: RouterHandler;
  post?: RouterHandler;
};

const rootPagesFolderPath = path.resolve(`${import.meta.dirname}/pages`);

export const getRouters = async (path = "") => {
  let routers: Router[] = [];
  const base = `${rootPagesFolderPath}/${path}`;
  const files = await fsPromises.readdir(base);
  for (const file of files) {
    const absolutePath = `${base}${file}`;
    if ((await fsPromises.stat(absolutePath)).isDirectory()) {
      routers = routers.concat(await getRouters(`${file}/`));
    } else {
      const pathname = `/${path.endsWith("/") ? path.slice(0, -1) : path}${
        file.slice(0, -3).replace("index", "")
      }`;
      routers.push({
        urlPattern: new URLPattern({
          pathname,
        }),
        handler: (await import(absolutePath)).default,
      });
    }
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
