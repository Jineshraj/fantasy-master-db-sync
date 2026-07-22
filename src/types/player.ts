export type FantasyPosition = "GK" | "DEF" | "MID" | "FOR";

export type PlayerStatus = "Pending" | "Approved" | "Needs Review" | "Archived";

export interface League {
  /** Human readable league name, e.g. "Premier League". */
  name: string;
  /** URL slug Transfermarkt uses for this competition. */
  transfermarktSlug: string;
  /** Transfermarkt's internal competition ID, e.g. "GB1". */
  transfermarktId: string;
}

/** Raw club data as scraped from a league/competition page. */
export interface ScrapedClub {
  transfermarktClubId: string;
  clubName: string;
  league: string;
  clubUrl: string;
}

/** Raw player data as scraped from a club squad page. */
export interface ScrapedPlayer {
  transfermarktPlayerId: string;
  playerName: string;
  primaryPosition: string;
  club: string;
  league: string;
  nationality?: string;
  profileUrl: string;
  imageUrl?: string;
}

/** A row in the "Players" Google Sheet. */
export interface PlayerRecord {
  transfermarktId: string;
  playerName: string;
  primaryPosition: string;
  fantasyPosition: FantasyPosition | "";
  club: string;
  league: string;
  nationality: string;
  profileUrl: string;
  imageUrl: string;
  status: PlayerStatus | "";
  lastSynced: string;
  lastSeen: string;
}
