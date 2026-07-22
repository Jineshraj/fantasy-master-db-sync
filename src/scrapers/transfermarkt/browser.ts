import { chromium, Browser, BrowserContext, Page } from "playwright";
import { env } from "../../config/env";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Wraps a single Playwright browser + context so callers don't have to
 * think about launch/teardown ordering.
 */
export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async launch(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({ userAgent: USER_AGENT });
    this.context.setDefaultNavigationTimeout(env.navigationTimeoutMs);
  }

  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error(
        "BrowserSession not launched. Call launch() before newPage().",
      );
    }

    const page = await this.context.newPage();
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType();
      if (["image", "stylesheet", "font"].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    return page;
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
  }
}
