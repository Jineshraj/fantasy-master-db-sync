import { SheetsClient } from "./sheetsClient";
import { PlayerRecord } from "../types/player";

export const PLAYERS_SHEET_NAME = "Players";

export const PLAYERS_HEADER = [
  "Transfermarkt ID",
  "Player Name",
  "Primary Position",
  "Fantasy Position",
  "Club",
  "League",
  "Nationality",
  "Profile URL",
  "Image URL",
  "Status",
  "Last Synced",
  "Last Seen",
];

export interface ExistingPlayerRow {
  record: PlayerRecord;
  /** Absolute 1-indexed row number in the sheet, including the header. */
  rowNumber: number;
}

export interface PlayerSheetUpdate {
  rowNumber: number;
  record: PlayerRecord;
}

export class PlayersSheetRepository {
  constructor(private readonly client: SheetsClient) {}

  async ensureExists(): Promise<void> {
    await this.client.ensureSheetExists(PLAYERS_SHEET_NAME, PLAYERS_HEADER);
  }

  /** Loads every existing player, keyed by Transfermarkt ID, for fast lookup during diffing. */
  async loadExisting(): Promise<Map<string, ExistingPlayerRow>> {
    const rows = await this.client.readAllRows(PLAYERS_SHEET_NAME);
    const map = new Map<string, ExistingPlayerRow>();

    rows.forEach((row, index) => {
      const transfermarktId = row[0];
      if (!transfermarktId) return;

      const record: PlayerRecord = {
        transfermarktId,
        playerName: row[1] ?? "",
        primaryPosition: row[2] ?? "",
        fantasyPosition: (row[3] ?? "") as PlayerRecord["fantasyPosition"],
        club: row[4] ?? "",
        league: row[5] ?? "",
        nationality: row[6] ?? "",
        profileUrl: row[7] ?? "",
        imageUrl: row[8] ?? "",
        status: (row[9] ?? "") as PlayerRecord["status"],
        lastSynced: row[10] ?? "",
        lastSeen: row[11] ?? "",
      };

      // +2: readAllRows starts at A2, and sheet rows are 1-indexed.
      map.set(transfermarktId, { record, rowNumber: index + 2 });
    });

    return map;
  }

  toRowArray(record: PlayerRecord): (string | number)[] {
    return [
      record.transfermarktId,
      record.playerName,
      record.primaryPosition,
      record.fantasyPosition,
      record.club,
      record.league,
      record.nationality,
      record.profileUrl,
      record.imageUrl,
      record.status,
      record.lastSynced,
      record.lastSeen,
    ];
  }

  async appendRecords(records: PlayerRecord[]): Promise<void> {
    await this.client.appendRows(
      PLAYERS_SHEET_NAME,
      records.map((r) => this.toRowArray(r)),
    );
  }

  async updateRecord(rowNumber: number, record: PlayerRecord): Promise<void> {
    await this.updateRecords([{ rowNumber, record }]);
  }

  async updateRecords(updates: PlayerSheetUpdate[]): Promise<void> {
    await this.client.batchUpdateRows(
      PLAYERS_SHEET_NAME,
      updates.map((update) => ({
        rowNumber: update.rowNumber,
        values: this.toRowArray(update.record),
      })),
    );
  }
}
