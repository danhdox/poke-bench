import { z } from "zod";

export const ProviderSchema = z.enum(["openai", "anthropic", "random", "heuristic"]);

export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: ProviderSchema,
  modelId: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export const TeamDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  formatId: z.string(),
  importable: z.string(),
  validationStatus: z.enum(["valid", "invalid", "pending"]),
  validationErrors: z.array(z.string()).optional(),
});

export const BattleConfigSchema = z.object({
  formatId: z.string(),
  agent1Id: z.string(),
  agent2Id: z.string(),
  team1Id: z.string(),
  team2Id: z.string(),
  maxTurns: z.number().int().positive().optional(),
  seed: z.number().int().optional(),
});

export const LegalActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["move", "switch", "teamPreview"]),
  targets: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});
