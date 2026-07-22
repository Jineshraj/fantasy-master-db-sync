import { SheetsClient } from './sheetsClient';
import { ClubRecord } from '../types/club';

export const CLUBS_SHEET_NAME = 'Clubs';

export const CLUBS_HEADER = ['Transfermarkt Club ID', 'Club Name', 'League', 'Club URL', 'Last Synced'];

export interface ExistingClubRow {
  record: ClubRecord;
  rowNumber: number;
}

export class ClubsSheetRepository {
  constructor(private readonly client: SheetsClient) {}

  async ensureExists(): Promise<void> {
    await this.client.ensureSheetExists(CLUBS_SHEET_NAME, CLUBS_HEADER);
  }

  async loadExisting(): Promise<Map<string, ExistingClubRow>> {
    const rows = await this.client.readAllRows(CLUBS_SHEET_NAME);
    const map = new Map<string, ExistingClubRow>();

    rows.forEach((row, index) => {
      const id = row[0];
      if (!id) return;

      map.set(id, {
        record: {
          transfermarktClubId: id,
          clubName: row[1] ?? '',
          league: row[2] ?? '',
          clubUrl: row[3] ?? '',
          lastSynced: row[4] ?? '',
        },
        rowNumber: index + 2,
      });
    });

    return map;
  }

  toRowArray(record: ClubRecord): (string | number)[] {
    return [record.transfermarktClubId, record.clubName, record.league, record.clubUrl, record.lastSynced];
  }

  async appendRecords(records: ClubRecord[]): Promise<void> {
    await this.client.appendRows(CLUBS_SHEET_NAME, records.map((r) => this.toRowArray(r)));
  }

  async updateRecord(rowNumber: number, record: ClubRecord): Promise<void> {
    await this.client.updateRow(CLUBS_SHEET_NAME, rowNumber, this.toRowArray(record));
  }
}
