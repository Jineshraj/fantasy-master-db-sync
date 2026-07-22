/** A row in the "Clubs" Google Sheet. */
export interface ClubRecord {
  transfermarktClubId: string;
  clubName: string;
  league: string;
  clubUrl: string;
  lastSynced: string;
}
