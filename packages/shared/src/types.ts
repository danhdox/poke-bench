export type Provider = "openai" | "anthropic" | "random" | "heuristic";

export type AgentConfig = {
  id: string;
  name: string;
  provider: Provider;
  modelId?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
};

export type TeamData = {
  id: string;
  name: string;
  formatId: string;
  importable: string;
  validationStatus: "valid" | "invalid" | "pending";
  validationErrors?: string[];
};

export type BattleStatus = "pending" | "running" | "completed" | "failed";

export type BattleConfig = {
  formatId: string;
  agent1Id: string;
  agent2Id: string;
  team1Id: string;
  team2Id: string;
  maxTurns?: number;
  seed?: number;
};

export type LegalAction = {
  id: string;
  label: string;
  kind: "move" | "switch" | "teamPreview";
  targets?: string[];
  tags?: string[];
};

export type RequestType = "teamPreview" | "move" | "switch";

export type AgentDecisionInput = {
  battleId: string;
  turn: number;
  side: "p1" | "p2";
  formatId: string;
  requestType: RequestType;
  legalActions: LegalAction[];
  observation: PublicBattleObservation;
};

export type AgentDecisionOutput = {
  action: string;
  publicReasoning?: string;
  confidence?: number;
  fallbackUsed?: boolean;
};

export type ActivePokemon = {
  species: string;
  hpPercent: number;
  status?: string;
  boosts: Record<string, number>;
  types: string[];
  volatiles: string[];
  isTerastallized?: boolean;
};

export type PublicBattleObservation = {
  battleId: string;
  formatId: string;
  turn: number;
  requestType: RequestType;
  side: "p1" | "p2";
  weather?: string;
  terrain?: string;
  ownActive: ActivePokemon[];
  opponentActive: ActivePokemon[];
  ownBench: { species: string; hpPercent: number; status?: string; fainted: boolean }[];
  opponentRevealed: { species: string; hpPercent: number; status?: string; fainted: boolean }[];
  legalActions: LegalAction[];
};

export type TurnRecord = {
  battleId: string;
  turnNumber: number;
  actingSide: "p1" | "p2";
  requestType: RequestType;
  chosenAction: string;
  publicReasoning?: string;
  confidence?: number;
  latencyMs: number;
  fallbackUsed: boolean;
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
