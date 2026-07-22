import { sleep } from './retry';

/**
 * Enforces a fixed delay between outbound requests so the scraper is
 * respectful of Transfermarkt and avoids unnecessary load / bans.
 */
export class RateLimiter {
  constructor(private readonly delayMs: number) {}

  async wait(): Promise<void> {
    if (this.delayMs > 0) {
      await sleep(this.delayMs);
    }
  }
}
