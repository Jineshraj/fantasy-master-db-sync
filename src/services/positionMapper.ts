import { FantasyPosition } from "../types/player";

/**
 * Single source of truth for Transfermarkt Position -> Fantasy Position.
 * Mirrors the "Position Mapping" sheet, which is auto-populated from this map.
 */
const POSITION_MAP: Record<string, FantasyPosition> = {
  GK: "GK",
  GOALKEEPER: "GK",
  "GOAL KEEPER": "GK",
  "GOAL-KEEPER": "GK",

  CB: "DEF",
  LCB: "DEF",
  RCB: "DEF",
  "CENTRE-BACK": "DEF",
  "CENTER-BACK": "DEF",
  "CENTRE BACK": "DEF",
  "CENTER BACK": "DEF",
  LB: "DEF",
  "LEFT-BACK": "DEF",
  "LEFT BACK": "DEF",
  RB: "DEF",
  "RIGHT-BACK": "DEF",
  "RIGHT BACK": "DEF",
  LWB: "DEF",
  "LEFT WING-BACK": "DEF",
  "LEFT WING BACK": "DEF",
  RWB: "DEF",
  "RIGHT WING-BACK": "DEF",
  "RIGHT WING BACK": "DEF",

  CDM: "MID",
  DM: "MID",
  "DEFENSIVE MIDFIELD": "MID",
  CM: "MID",
  "CENTRAL MIDFIELD": "MID",
  "CENTRE MIDFIELD": "MID",
  CAM: "MID",
  "ATTACKING MIDFIELD": "MID",
  "ATTACKING MIDFEILD": "MID",
  AM: "MID",
  LM: "MID",
  "LEFT MIDFIELD": "MID",
  RM: "MID",
  "RIGHT MIDFIELD": "MID",
  LW: "MID",
  "LEFT WINGER": "MID",
  "LEFT WING": "MID",
  RW: "MID",
  "RIGHT WINGER": "MID",
  "RIGHT WING": "MID",

  CF: "FOR",
  SS: "FOR",
  ST: "FOR",
  STRIKER: "FOR",
  "CENTRE FORWARD": "FOR",
  "CENTER FORWARD": "FOR",
  "CENTRE-FORWARD": "FOR",
  "CENTER-FORWARD": "FOR",
  "SECOND STRIKER": "FOR",
};

export class PositionMapper {
  /** Returns the fantasy position for a raw Transfermarkt position, or null if unrecognized. */
  static toFantasyPosition(primaryPosition: string): FantasyPosition | null {
    const normalized = primaryPosition.trim().toUpperCase();
    return POSITION_MAP[normalized] ?? null;
  }

  /** Returns the full mapping table, used to seed the "Position Mapping" sheet. */
  static getFullMapping(): Array<{
    transfermarktPosition: string;
    fantasyPosition: FantasyPosition;
  }> {
    return Object.entries(POSITION_MAP).map(
      ([transfermarktPosition, fantasyPosition]) => ({
        transfermarktPosition,
        fantasyPosition,
      }),
    );
  }
}
