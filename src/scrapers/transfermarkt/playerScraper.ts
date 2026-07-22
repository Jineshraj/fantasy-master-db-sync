import { Page } from 'playwright';
import { ScrapedClub, ScrapedPlayer } from '../../types/player';
import { SELECTORS } from './constants';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

type RawScrapedPlayer = {
  transfermarktPlayerId: string;
  playerName: string;
  primaryPosition: string;
  nationality?: string;
  profileUrl: string;
  imageUrl?: string;
};

/**
 * Handles the second and third hops of the navigation flow: Club -> Squad -> Players.
 */
export class PlayerScraper {
  buildSquadUrl(club: ScrapedClub): string {
    // Transfermarkt club "startseite" (home) pages and "kader" (squad) pages
    // share the same slug/id, differing only in the path segment.
    return club.clubUrl.includes('/startseite/')
      ? club.clubUrl.replace('/startseite/', '/kader/')
      : `${club.clubUrl.replace(/\/$/, '')}/kader`;
  }

  async scrapeSquad(page: Page, club: ScrapedClub): Promise<ScrapedPlayer[]> {
    const squadUrl = this.buildSquadUrl(club);
    logger.info(`Navigating to squad page: ${squadUrl}`);
    await page.goto(squadUrl, { waitUntil: 'domcontentloaded' });

    const players = await page
      .locator(SELECTORS.squadPlayerTable)
      .evaluateAll(
        (rows, baseUrl) =>
          rows
            .map((row) => {
              const nameLink = row.querySelector('td.posrela .hauptlink a') as any;
              const href = nameLink?.getAttribute?.('href')?.trim() ?? '';
              const playerName = nameLink?.textContent?.trim() ?? '';
              if (!href || !playerName) return null;

              const idMatch = href.match(/spieler\/(\d+)/);
              if (!idMatch) return null;

              const primaryPosition =
                (row.querySelector('td.posrela table tr:nth-child(2) td') as any)
                  ?.textContent?.trim() ?? '';
              const nationality =
                (row.querySelector('td.zentriert img.flaggenrahmen') as any)
                  ?.getAttribute?.('title')
                  ?.trim() ?? undefined;
              const imageUrl =
                (row.querySelector('td.zentriert img.bilderrahmen-fixed') as any)
                  ?.getAttribute?.('data-src')
                  ?.trim() ?? undefined;

              return {
                transfermarktPlayerId: idMatch[1],
                playerName,
                primaryPosition,
                nationality,
                profileUrl: new URL(href, baseUrl).toString(),
                imageUrl,
              } as RawScrapedPlayer;
            })
            .filter(
              (player): player is RawScrapedPlayer => Boolean(player),
            ),
        env.transfermarktBaseUrl,
      );

    logger.info(`Found ${players.length} players for ${club.clubName}`);
    return players.map((player) => ({
      ...player,
      club: club.clubName,
      league: club.league,
    }));
  }
}
