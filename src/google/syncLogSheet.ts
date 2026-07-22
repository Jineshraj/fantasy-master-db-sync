import { SheetsClient } from './sheetsClient';
import { SyncLogEntry } from '../types/sync';

export const SYNC_LOG_SHEET_NAME = 'Sync Log';

export const SYNC_LOG_HEADER = [
  'Date',
  'Players Scanned',
  'Inserted',
  'Updated',
  'Skipped',
  'Errors',
  'Execution Time',
];

export class SyncLogSheetRepository {
  constructor(private readonly client: SheetsClient) {}

  async ensureExists(): Promise<void> {
    await this.client.ensureSheetExists(SYNC_LOG_SHEET_NAME, SYNC_LOG_HEADER);
  }

  async appendEntry(entry: SyncLogEntry): Promise<void> {
    await this.client.appendRows(SYNC_LOG_SHEET_NAME, [
      [
        entry.date,
        entry.playersScanned,
        entry.inserted,
        entry.updated,
        entry.skipped,
        entry.errors,
        `${(entry.executionTimeMs / 1000).toFixed(1)}s`,
      ],
    ]);
  }
}
