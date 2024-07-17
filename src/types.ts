export type RouterHandler = (
  request: Request,
) => Promise<Response> | Response | undefined;
