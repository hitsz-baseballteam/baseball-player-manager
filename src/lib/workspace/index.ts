// ── Workspace barrel ──
// Re-exports everything from sub-modules for backward compatibility with "@/lib/workspace".

export type {
  PlayerStatus,
  Hand,
  PlayerProfileType,
  PositionCode,
  Player,
  PitcherRadar,
  FielderRadar,
  Game,
  InningRecord,
  Milestone,
  PlayerGameStatLine,
  PlayerProfile,
  ScenarioAssignments,
  Scenario,
  Workspace,
  WorkspaceExportPayload,
  ScenarioExportPayload,
  PendingImport,
} from "./types";

export {
  HISTORY_LIMIT,
  WORKSPACE_SCHEMA_VERSION,
  DEFAULT_WORKSPACE_SLUG,
  POSITIONS,
  POSITION_CODES,
  DEFENSE_PRIORITY,
  STATUS_LABELS,
  PROFILE_TYPE_LABELS,
  HAND_LABELS,
  PITCHER_RADAR_LABELS,
  FIELDER_RADAR_LABELS,
  GUIDE_STEPS,
  DEFAULT_PLAYERS,
  HALL_OF_FAME_MIN_DAYS,
  AWARD_MIN_PA_MULTIPLIER,
  SEASON_AWARD_LABELS,
} from "./types";

export {
  createId,
  inferPlayerProfileType,
  createEmptyPitcherRadar,
  createEmptyFielderRadar,
  createDefaultPlayerProfile,
  createEmptyAssignments,
  createScenario,
  createDefaultWorkspace,
  cloneWorkspace,
  createMilestone,
} from "./base";

export {
  isIsoDate,
  normalizeHand,
  sanitizeNullableNumber,
  sanitizePositions,
  sanitizePlayers,
  sanitizePlayerProfile,
  sanitizeScenario,
  sanitizeAssignments,
  sanitizeWorkspace,
  sanitizeGame,
  sanitizeGames,
  sanitizeMilestone,
  sanitizeMilestones,
} from "./sanitizers";


export {
  getActiveScenario,
  getPlayer,
  getPlayerAssignmentState,
  createUniqueScenarioName,
  removePlayersFromWorkspace,
  getPreferredBattingSlots,
  buildAutoScenario,
  analyzeScenarioWarnings,
  prepareImport,
  formatDateTime,
  timestampFilePart,
} from "./helpers";
