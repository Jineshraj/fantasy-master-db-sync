import { PlayerRecord, ScrapedPlayer } from "../types/player";
import { PlayerDiffResult } from "../types/sync";
import { PositionMapper } from "./positionMapper";

export class DiffService {
  /** Builds a brand-new Players sheet row for a player not seen before. */
  buildNewRecord(scraped: ScrapedPlayer): PlayerRecord {
    const now = new Date().toISOString();
    return {
      transfermarktId: scraped.transfermarktPlayerId,
      playerName: scraped.playerName,
      primaryPosition: scraped.primaryPosition,
      fantasyPosition:
        PositionMapper.toFantasyPosition(scraped.primaryPosition) ?? "",
      club: scraped.club,
      league: scraped.league,
      nationality: scraped.nationality ?? "",
      profileUrl: scraped.profileUrl,
      imageUrl: scraped.imageUrl ?? "",
      status: "Pending",
      lastSynced: now,
      lastSeen: now,
    };
  }

  /**
   * Compares a freshly scraped player against its existing sheet row and
   * decides whether to insert, update, or skip it, following the rules:
   *  - Club / League / Primary Position changes -> update + "Needs Review"
   *  - Nationality / Image URL / Profile URL changes -> quiet update
   *  - Nothing changed -> skip (existing row, including any admin edits
   *    to fields not sourced from Transfermarkt, is left untouched)
   */
  diff(
    existing: PlayerRecord | undefined,
    scraped: ScrapedPlayer,
  ): { result: PlayerDiffResult; nextRecord: PlayerRecord } {
    const now = new Date().toISOString();

    if (!existing) {
      return {
        result: { action: "insert", reasonsChanged: [], needsReview: false },
        nextRecord: this.buildNewRecord(scraped),
      };
    }

    const nextRecord: PlayerRecord = { ...existing };
    const reasonsChanged: string[] = [];
    let needsReview = false;

    nextRecord.lastSeen = now;

    if (existing.club !== scraped.club) {
      reasonsChanged.push("Club");
      nextRecord.club = scraped.club;
      needsReview = true;
    }

    if (existing.league !== scraped.league) {
      reasonsChanged.push("League");
      nextRecord.league = scraped.league;
      needsReview = true;
    }

    if (existing.primaryPosition !== scraped.primaryPosition) {
      reasonsChanged.push("Primary Position");
      nextRecord.primaryPosition = scraped.primaryPosition;
      nextRecord.fantasyPosition =
        PositionMapper.toFantasyPosition(scraped.primaryPosition) ??
        existing.fantasyPosition;
      needsReview = true;
    }

    const mappedFantasyPosition =
      PositionMapper.toFantasyPosition(scraped.primaryPosition) ??
      existing.fantasyPosition;
    if (existing.fantasyPosition !== mappedFantasyPosition) {
      reasonsChanged.push("Fantasy Position");
      nextRecord.fantasyPosition = mappedFantasyPosition;
    }

    const scrapedNationality = scraped.nationality;
    if (scrapedNationality && existing.nationality !== scrapedNationality) {
      reasonsChanged.push("Nationality");
      nextRecord.nationality = scrapedNationality;
    }

    const scrapedImageUrl = scraped.imageUrl;
    if (scrapedImageUrl && existing.imageUrl !== scrapedImageUrl) {
      reasonsChanged.push("Image URL");
      nextRecord.imageUrl = scrapedImageUrl;
    }

    if (scraped.profileUrl && existing.profileUrl !== scraped.profileUrl) {
      reasonsChanged.push("Profile URL");
      nextRecord.profileUrl = scraped.profileUrl;
    }

    if (reasonsChanged.length === 0) {
      return {
        result: {
          action: "update",
          reasonsChanged: ["Last Seen"],
          needsReview: false,
        },
        nextRecord,
      };
    }

    if (needsReview) {
      nextRecord.status = "Needs Review";
    }
    nextRecord.lastSynced = now;

    return {
      result: { action: "update", reasonsChanged, needsReview },
      nextRecord,
    };
  }
}
