import { launch } from "@astral/astral";

export const browser = () =>
  launch({
    path: "/usr/local/bin/chrome",
    args: ["--no-sandbox"],
  });
