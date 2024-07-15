import { launch, Page } from "@astral/astral";

export const browserTest = async (
  url: string,
  cb: (page: Page) => void | Promise<void>,
) => {
  const browser = await launch({
    path: "/usr/local/bin/chrome",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage(url);
  await cb(page);
  await page.close();
  await browser.close();
};
