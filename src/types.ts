export type Router = {
  urlPattern: URLPattern;
  handler: RouterHandler;
};

export type RouterHandler = (
  request: Request,
  urlPatternResult: URLPatternResult,
) => Promise<Response> | Response;
