export type RouterFunction = (
  request: Request,
  url: URL,
) => Promise<Response> | Response | null;
