import { hc } from "hono/client";
import type { AppType } from "@zone-blitz/server";

export const api = hc<AppType>("/");
