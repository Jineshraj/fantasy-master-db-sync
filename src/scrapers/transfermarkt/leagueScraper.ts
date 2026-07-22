import { Page } from 'playwright';
import { League, ScrapedClub } from '../../types/player';
import { SELECTORS } from './constants';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Handles the first hop of the navigation flow: Top League -> Clubs.
 */
export class LeagueScraper {
  buildLeagueUrl(league: League): string {
    return `${env.transfermarktBaseUrl}/${league.transfermarktSlug}/startseite/wettbewerb/${league.transfermarktId}`;
  }

  async scrapeClubs(page: Page, league: League): Promise<ScrapedClub[]> {
    const url = this.buildLeagueUrl(league);
    logger.info(`Navigating to league page: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const rows = await page.locator(SELECTORS.competitionClubTable).all();
    const clubs: ScrapedClub[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const link = row.locator(SELECTORS.competitionClubLink).first();
      const href = await link.getAttribute('href').catch(() => null);
      const clubName = (await link.textContent().catch(() => null))?.trim();

      if (!href || !clubName) continue;

      const clubIdMatch = href.match(/verein\/(\d+)/);
      if (!clubIdMatch) continue;

      const transfermarktClubId = clubIdMatch[1];
      if (seen.has(transfermarktClubId)) continue;
      seen.add(transfermarktClubId);

      clubs.push({
        transfermarktClubId,
        clubName,
        league: league.name,
        clubUrl: new URL(href, env.transfermarktBaseUrl).toString(),
      });
    }

    logger.info(`Found ${clubs.length} clubs for ${league.name}`);
    return clubs;
  }
}
