import { SheetsClient } from "./sheetsClient";
import { PlayerRecord } from "../types/player";
import { PLAYERS_HEADER } from "./playersSheet";

export const DEBUG_SHEET_NAME = "Debug Squad";
export const DEBUG_SHEET_HEADER = PLAYERS_HEADER;

export class DebugSheetRepository {
  constructor(private readonly client: SheetsClient) {}

  async ensureExists(): Promise<void> {
    await this.client.ensureSheetExists(DEBUG_SHEET_NAME, DEBUG_SHEET_HEADER);
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
      DEBUG_SHEET_NAME,
      records.map((r) => this.toRowArray(r)),
    );
  }

  /** Append only records not already present, making retries idempotent. */
  async appendMissingRecords(records: PlayerRecord[]): Promise<{
    appended: number;
    skipped: number;
  }> {
    const existingRows = await this.client.readAllRows(DEBUG_SHEET_NAME);
    const existingIds = new Set(
      existingRows.map((row) => row[0]).filter((id): id is string => Boolean(id)),
    );
    const recordsToAppend = records.filter(
      (record) => !existingIds.has(record.transfermarktId),
    );

    await this.appendRecords(recordsToAppend);
    return {
      appended: recordsToAppend.length,
      skipped: records.length - recordsToAppend.length,
    };
  }
}
