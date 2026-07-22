import { google, sheets_v4 } from "googleapis";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { sleep, withRetry } from "../utils/retry";

/**
 * Thin wrapper around the Google Sheets API that always targets the ONE
 * spreadsheet configured via GOOGLE_SPREADSHEET_ID. It never creates a new
 * spreadsheet and never clears an existing sheet — it only ensures sheets
 * exist, reads rows, appends rows, and updates single rows in place.
 */
export class SheetsClient {
  private sheetsApi: sheets_v4.Sheets | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private lastWriteAt = 0;
  private readonly minWriteIntervalMs = Math.max(env.requestDelayMs, 1500);

  async init(): Promise<void> {
    const credentials = JSON.parse(env.googleServiceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const authClient = await auth.getClient();
    // googleapis' types for GoogleAuth clients don't line up perfectly with
    // the `auth` option's expected type across versions; this cast is safe.
    this.sheetsApi = google.sheets({
      version: "v4",
      auth: authClient as unknown as string,
    });
  }

  private get api(): sheets_v4.Sheets {
    if (!this.sheetsApi) {
      throw new Error(
        "SheetsClient not initialized. Call init() before using it.",
      );
    }
    return this.sheetsApi;
  }

  private async runSerializedWrite<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.writeQueue;
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.writeQueue = previous.then(() => current, () => current);

    await previous;

    try {
      const elapsed = Date.now() - this.lastWriteAt;
      if (elapsed < this.minWriteIntervalMs) {
        await sleep(this.minWriteIntervalMs - elapsed);
      }

      const result = await operation();
      this.lastWriteAt = Date.now();
      return result;
    } finally {
      release();
    }
  }

  async getSheetTitles(): Promise<string[]> {
    const res = await withRetry(
      () =>
        this.api.spreadsheets.get({
          spreadsheetId: env.googleSpreadsheetId,
        }),
      {
        retries: 3,
        onRetry: (attempt, error) =>
          logger.warn(
            `Retry ${attempt} getting sheet titles due to error: ${error}`,
          ),
      },
    );

    return (res.data.sheets ?? [])
      .map((s) => s.properties?.title ?? "")
      .filter(Boolean);
  }

  /** Creates the sheet with a header row if (and only if) it doesn't already exist. */
  async ensureSheetExists(title: string, headerRow: string[]): Promise<void> {
    const titles = await this.getSheetTitles();
    if (!titles.includes(title)) {
      logger.info(`Sheet "${title}" not found in spreadsheet — creating it.`);
      await withRetry(
        () =>
          this.runSerializedWrite(() =>
            this.api.spreadsheets.batchUpdate({
              spreadsheetId: env.googleSpreadsheetId,
              requestBody: {
                requests: [{ addSheet: { properties: { title } } }],
              },
            }),
          ),
        {
          retries: 3,
          baseDelayMs: 5000,
          onRetry: (attempt, error) =>
            logger.warn(
              `Retry ${attempt} creating sheet ${title} due to error: ${error}`,
            ),
        },
      );

      await withRetry(
        () =>
          this.runSerializedWrite(() =>
            this.api.spreadsheets.values.update({
              spreadsheetId: env.googleSpreadsheetId,
              range: `${title}!A1`,
              valueInputOption: "RAW",
              requestBody: { values: [headerRow] },
            }),
          ),
        {
          retries: 3,
          baseDelayMs: 5000,
          onRetry: (attempt, error) =>
            logger.warn(
              `Retry ${attempt} writing header for ${title} due to error: ${error}`,
            ),
        },
      );
      return;
    }

    const endColumn = this.columnLetter(headerRow.length);
    const res = await withRetry(
      () =>
        this.api.spreadsheets.values.get({
          spreadsheetId: env.googleSpreadsheetId,
          range: `${title}!A1:${endColumn}1`,
        }),
      {
        retries: 3,
        onRetry: (attempt, error) =>
          logger.warn(
            `Retry ${attempt} reading header for ${title} due to error: ${error}`,
          ),
      },
    );
    const existingHeader = res.data.values?.[0] ?? [];

    if (!this.headersMatch(existingHeader, headerRow)) {
      logger.info(
        `Sheet "${title}" header is out of date — updating header row.`,
      );
      await withRetry(
        () =>
          this.runSerializedWrite(() =>
            this.api.spreadsheets.values.update({
              spreadsheetId: env.googleSpreadsheetId,
              range: `${title}!A1`,
              valueInputOption: "RAW",
              requestBody: { values: [headerRow] },
            }),
          ),
        {
          retries: 3,
          baseDelayMs: 5000,
          onRetry: (attempt, error) =>
            logger.warn(
              `Retry ${attempt} updating header for ${title} due to error: ${error}`,
            ),
        },
      );
    }
  }

  private headersMatch(
    existingHeader: string[],
    desiredHeader: string[],
  ): boolean {
    if (existingHeader.length !== desiredHeader.length) return false;
    return desiredHeader.every(
      (value, index) => existingHeader[index] === value,
    );
  }

  private columnLetter(columnNumber: number): string {
    let letter = "";
    let current = columnNumber;

    while (current > 0) {
      const remainder = (current - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      current = Math.floor((current - 1) / 26);
    }

    return letter;
  }

  /** Reads every data row (excluding the header) from a sheet. */
  async readAllRows(sheetTitle: string): Promise<string[][]> {
    const res = await withRetry(
      () =>
        this.api.spreadsheets.values.get({
          spreadsheetId: env.googleSpreadsheetId,
          range: `${sheetTitle}!A2:Z`,
        }),
      {
        retries: 3,
        onRetry: (attempt, error) =>
          logger.warn(
            `Retry ${attempt} reading rows from ${sheetTitle} due to error: ${error}`,
          ),
      },
    );
    return res.data.values ?? [];
  }

  /** Appends new rows to the end of a sheet. Never touches existing rows. */
  async appendRows(
    sheetTitle: string,
    rows: (string | number)[][],
  ): Promise<void> {
    if (rows.length === 0) return;
    await withRetry(
      () =>
        this.runSerializedWrite(() =>
          this.api.spreadsheets.values.append({
            spreadsheetId: env.googleSpreadsheetId,
            range: `${sheetTitle}!A1`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: rows },
          }),
        ),
      {
        retries: 3,
        baseDelayMs: 5000,
        onRetry: (attempt, error) =>
          logger.warn(
            `Retry ${attempt} appending rows to ${sheetTitle} due to error: ${error}`,
          ),
      },
    );
  }

  async clearRange(sheetTitle: string, range: string): Promise<void> {
    await withRetry(
      () =>
        this.runSerializedWrite(() =>
          this.api.spreadsheets.values.clear({
            spreadsheetId: env.googleSpreadsheetId,
            range: `${sheetTitle}!${range}`,
          }),
        ),
      {
        retries: 3,
        baseDelayMs: 5000,
        onRetry: (attempt, error) =>
          logger.warn(
            `Retry ${attempt} clearing range ${range} in ${sheetTitle} due to error: ${error}`,
          ),
      },
    );
  }

  async overwriteRows(
    sheetTitle: string,
    startRange: string,
    rows: (string | number)[][],
  ): Promise<void> {
    if (rows.length === 0) return;
    await withRetry(
      () =>
        this.runSerializedWrite(() =>
          this.api.spreadsheets.values.update({
            spreadsheetId: env.googleSpreadsheetId,
            range: `${sheetTitle}!${startRange}`,
            valueInputOption: "RAW",
            requestBody: { values: rows },
          }),
        ),
      {
        retries: 3,
        baseDelayMs: 5000,
        onRetry: (attempt, error) =>
          logger.warn(
            `Retry ${attempt} overwriting rows in ${sheetTitle} due to error: ${error}`,
          ),
      },
    );
  }

  async batchUpdateRows(
    sheetTitle: string,
    rows: { rowNumber: number; values: (string | number)[] }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await withRetry(
      () =>
        this.runSerializedWrite(() =>
          this.api.spreadsheets.values.batchUpdate({
            spreadsheetId: env.googleSpreadsheetId,
            requestBody: {
              valueInputOption: "RAW",
              data: rows.map((row) => ({
                range: `${sheetTitle}!A${row.rowNumber}`,
                values: [row.values],
              })),
            },
          }),
        ),
      {
        retries: 3,
        baseDelayMs: 5000,
        onRetry: (attempt, error) =>
          logger.warn(
            `Retry ${attempt} batch updating rows in ${sheetTitle} due to error: ${error}`,
          ),
      },
    );
  }

  /**
   * Overwrites a single existing row in place. `rowNumber` is the absolute,
   * 1-indexed row number in the sheet (row 1 is the header).
   */
  async updateRow(
    sheetTitle: string,
    rowNumber: number,
    values: (string | number)[],
  ): Promise<void> {
    await this.batchUpdateRows(sheetTitle, [{ rowNumber, values }]);
  }
}
