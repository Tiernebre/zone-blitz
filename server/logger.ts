import pino from "pino";

const isProduction = Deno.env.get("DENO_ENV") === "production";

export const logger = pino({
  level: isProduction ? "info" : "debug",
  ...(!isProduction && {
    transport: {
      target: "pino-pretty",
    },
  }),
});
