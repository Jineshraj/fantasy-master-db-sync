import { League } from '../../types/player';

/** Only these five leagues are imported, per the fantasy app's scope. */
export const SUPPORTED_LEAGUES: League[] = [
  { name: 'Premier League', transfermarktSlug: 'premier-league', transfermarktId: 'GB1' },
  { name: 'La Liga', transfermarktSlug: 'laliga', transfermarktId: 'ES1' },
  { name: 'Serie A', transfermarktSlug: 'serie-a', transfermarktId: 'IT1' },
  { name: 'Bundesliga', transfermarktSlug: 'bundesliga', transfermarktId: 'L1' },
  { name: 'Ligue 1', transfermarktSlug: 'ligue-1', transfermarktId: 'FR1' },
];

/**
 * Transfermarkt's HTML structure changes periodically. Every selector used
 * by the scrapers lives here so the site can be re-mapped in one place
 * without touching scraping logic. Verify these against the live site
 * before running in production, and update as needed.
 */
export const SELECTORS = {
  // Competition ("league") page: table listing every club in the league.
  competitionClubTable: 'table.items > tbody > tr',
  competitionClubLink: 'td.hauptlink a',

  // Club squad page: table listing every player in the squad.
  squadPlayerTable: 'table.items > tbody > tr',
  squadPlayerNameCell: 'td.posrela .hauptlink a',
  squadPlayerPositionCell: 'td.posrela table tr:nth-child(2) td',
  squadPlayerNationalityImg: 'td.zentriert img.flaggenrahmen',
  squadPlayerImage: 'td.zentriert img.bilderrahmen-fixed',
} as const;
