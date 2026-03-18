export type Provider = "openai" | "anthropic" | "random" | "heuristic";
export type RunMode = "roundRobin";
export type DexEntityKind = "pokemon" | "move" | "item" | "ability";

export type AgentConfig = {
  id: string;
  name: string;
  provider: Provider;
  modelId?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
};

export type CreateAgentInput = Omit<AgentConfig, "id">;
export type UpdateAgentInput = Partial<CreateAgentInput>;

export type TeamData = {
  id: string;
  name: string;
  formatId: string;
  importable: string;
  validationStatus: "valid" | "invalid" | "pending";
  validationErrors?: string[];
};

export type CreateTeamInput = Omit<TeamData, "id" | "validationStatus" | "validationErrors">;
export type ValidateTeamInput = Pick<TeamData, "formatId" | "importable">;

export type BattleStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type BattleModelProvider = "openai" | "anthropic";

export type BattleModelSelection = {
  provider: BattleModelProvider;
  modelId: string;
};

export type BattleConfig = {
  formatId: string;
  model1: BattleModelSelection;
  model2: BattleModelSelection;
  team1Id: string;
  team2Id: string;
  maxTurns?: number;
  seed?: number;
};

export type CreateBattleInput = BattleConfig;

export type LegalAction = {
  id: string;
  label: string;
  kind: "move" | "switch" | "teamPreview";
  targets?: string[];
  tags?: string[];
};

export type RequestType = "teamPreview" | "move" | "switch";

export type TokenUsage = {
  provider?: Provider;
  modelId?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  parseMode?: "json_schema" | "json_prompt";
  stopReason?: string | null;
  attempts?: number;
  repairAttempts?: number;
};

export type AgentDecisionInput = {
  battleId: string;
  turn: number;
  side: "p1" | "p2";
  formatId: string;
  requestType: RequestType;
  legalActions: LegalAction[];
  observation: PublicBattleObservation;
  attempt?: number;
  validationError?: string;
};

export type AgentDecisionOutput = {
  action: string;
  publicReasoning?: string;
  confidence?: number;
  fallbackUsed?: boolean;
  tokenUsage?: TokenUsage;
  rawResponse?: unknown;
};

export type ActivePokemon = {
  species: string;
  hpPercent: number;
  status?: string;
  boosts: Record<string, number>;
  types: string[];
  volatiles: string[];
  isTerastallized?: boolean;
  teraType?: string;
  knownAbility?: string;
  knownItem?: string;
  knownMoves?: string[];
  speedRelation?: string;
};

export type BenchPokemon = {
  species: string;
  hpPercent: number;
  status?: string;
  fainted: boolean;
  knownAbility?: string;
  knownItem?: string;
};

export type PublicBattleObservation = {
  battleId: string;
  formatId: string;
  turn: number;
  requestType: RequestType;
  side: "p1" | "p2";
  weather?: string;
  terrain?: string;
  roomEffects: string[];
  ownSideConditions: string[];
  opponentSideConditions: string[];
  ownActive: ActivePokemon[];
  opponentActive: ActivePokemon[];
  ownBench: BenchPokemon[];
  opponentRevealed: BenchPokemon[];
  faintedOwn: string[];
  faintedOpponent: string[];
  lastTurnSummary?: {
    turn: number;
    moves: { pokemon: string; move: string; target?: string }[];
    fainted: string[];
    weather?: string;
  };
  legalActions: LegalAction[];
};

export type TurnRecord = {
  battleId: string;
  turnNumber: number;
  actingSide: "p1" | "p2";
  requestType: RequestType;
  observationJson?: string;
  legalActionsJson?: string;
  chosenAction: string;
  publicReasoning?: string;
  confidence?: number;
  latencyMs: number;
  fallbackUsed: boolean;
  rawModelResponseJson?: string;
  logChunk?: string;
};

export type BattleSummary = {
  id: string;
  status: BattleStatus;
  formatId: string;
  agent1Id: string;
  agent2Id: string;
  team1Id: string;
  team2Id: string;
  winnerSide?: "p1" | "p2";
  winnerAgentId?: string;
  turnCount: number;
  startedAt: Date;
  completedAt?: Date;
};

export type BattleSummaryJson = {
  log: string[];
  parsedTurns: Array<{
    turn: number;
    lines: string[];
    moves: { pokemon: string; move: string; target?: string }[];
    fainted: string[];
    weather?: string;
  }>;
  error?: string;
};

export type CreateRunInput = {
  name: string;
  formatId: string;
  agentIds: string[];
  teamIds: string[];
  gamesPerPairing?: number;
  mirror?: boolean;
  maxTurns?: number;
};

export type CreateRunRequest = {
  name: string;
  formatId: string;
  models: BattleModelSelection[];
  teamIds: string[];
  gamesPerPairing?: number;
  mirror?: boolean;
  maxTurns?: number;
};

export type TournamentBattleConfig = {
  agent1Id: string;
  agent2Id: string;
  team1Id: string;
  team2Id: string;
};

export type AgentMetrics = {
  agentId: string;
  agentName: string;
  wins: number;
  losses: number;
  winRate: number;
  averageTurns: number;
  averageLatencyMs: number;
  fallbackRate: number;
  invalidActionRate: number;
  timeoutRate: number;
  estimatedCostUsd: number;
};

export type TournamentSummaryJson = {
  mode: RunMode;
  formatId: string;
  gamesPerPairing: number;
  mirror: boolean;
  totalBattles: number;
  completedBattles: number;
  standings: AgentMetrics[];
};

export type DexSearchResult = {
  id: string;
  name: string;
  kind: DexEntityKind;
  subtitle?: string;
};
