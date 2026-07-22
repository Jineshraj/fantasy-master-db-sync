import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * `GOOGLE_SERVICE_ACCOUNT_JSON` may contain either the full JSON (single line)
 * or a local file path to a JSON key file. Support both for convenience.
 */
function loadServiceAccountJson(): string {
  const raw = required("GOOGLE_SERVICE_ACCOUNT_JSON").trim();

  // Heuristic: if it starts with `{` assume it's the inline JSON string.
  if (raw.startsWith("{")) return raw;

  // Otherwise treat it as a path (relative to project root or absolute).
  const possiblePath = raw;
  const resolved = path.isAbsolute(possiblePath)
    ? possiblePath
    : path.resolve(process.cwd(), possiblePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_JSON does not look like JSON and the path does not exist: ${possiblePath}`,
    );
  }

  return fs.readFileSync(resolved, { encoding: "utf8" });
}

export const env = {
  transfermarktBaseUrl: (
    process.env.TRANSFERMARKT_BASE_URL || "https://www.transfermarkt.com"
  ).replace(/\/$/, ""),
  googleSpreadsheetId: required("GOOGLE_SPREADSHEET_ID"),
  googleServiceAccountJson: loadServiceAccountJson(),
  requestDelayMs: optionalNumber("REQUEST_DELAY_MS", 1500),
  navigationTimeoutMs: optionalNumber("NAVIGATION_TIMEOUT_MS", 30000),
  maxRetries: optionalNumber("MAX_RETRIES", 3),
};
