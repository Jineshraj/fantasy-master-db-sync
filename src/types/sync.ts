/** A row appended to the "Sync Log" sheet after every execution. */
export interface SyncLogEntry {
  date: string;
  playersScanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  executionTimeMs: number;
}

export interface SyncOptions {
  /** When true, no writes are made to Google Sheets — changes are only logged. */
  dryRun: boolean;
  /** When true, skip clubs that were already synced in a prior run. */
  resume?: boolean;
}

export type DiffAction = "insert" | "update" | "skip";

export interface PlayerDiffResult {
  action: DiffAction;
  /** Human-readable field names that changed, used for logging. */
  reasonsChanged: string[];
  /** True if a "sensitive" field changed (club, league, position) requiring admin review. */
  needsReview: boolean;
}
