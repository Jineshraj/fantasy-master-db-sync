import { SheetsClient } from "./sheetsClient";
import { PositionMapper } from "../services/positionMapper";

export const POSITION_MAPPING_SHEET_NAME = "Position Mapping";

export const POSITION_MAPPING_HEADER = [
  "Transfermarkt Position",
  "Fantasy Position",
];

export class PositionMappingSheetRepository {
  constructor(private readonly client: SheetsClient) {}

  /**
   * Creates the sheet if missing, and seeds it with the full mapping table
   * only if it's currently empty. If an admin has already edited it, their
   * data is left untouched.
   */
  async ensurePopulated(): Promise<void> {
    await this.client.ensureSheetExists(
      POSITION_MAPPING_SHEET_NAME,
      POSITION_MAPPING_HEADER,
    );

    const existingRows = await this.client.readAllRows(
      POSITION_MAPPING_SHEET_NAME,
    );
    const mappingRows = PositionMapper.getFullMapping().map((m) => [
      m.transfermarktPosition,
      m.fantasyPosition,
    ]);

    if (existingRows.length === 0) {
      await this.client.appendRows(POSITION_MAPPING_SHEET_NAME, mappingRows);
      return;
    }

    const rowsMatch =
      existingRows.length === mappingRows.length &&
      mappingRows.every(
        (mappingRow, index) =>
          existingRows[index]?.[0] === mappingRow[0] &&
          existingRows[index]?.[1] === mappingRow[1],
      );

    if (!rowsMatch) {
      await this.client.clearRange(POSITION_MAPPING_SHEET_NAME, "A2:B");
      await this.client.overwriteRows(
        POSITION_MAPPING_SHEET_NAME,
        "A2",
        mappingRows,
      );
    }
  }
}
