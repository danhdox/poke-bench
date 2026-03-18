import { z } from "zod";

export const ProviderSchema = z.enum(["openai", "anthropic", "random", "heuristic"]);
export const BattleModelProviderSchema = z.enum(["openai", "anthropic"]);
export const RunModeSchema = z.enum(["roundRobin"]);
export const DexEntityKindSchema = z.enum(["pokemon", "move", "item", "ability"]);

export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: ProviderSchema,
  modelId: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export const CreateAgentInputSchema = AgentConfigSchema.omit({ id: true }).extend({
  name: z.string().min(1).max(80),
  systemPrompt: z.string().max(8000).optional(),
});

export const UpdateAgentInputSchema = CreateAgentInputSchema.partial();

export const TeamDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  formatId: z.string(),
  importable: z.string(),
  validationStatus: z.enum(["valid", "invalid", "pending"]),
  validationErrors: z.array(z.string()).optional(),
});

export const CreateTeamInputSchema = TeamDataSchema.omit({
  id: true,
  validationStatus: true,
  validationErrors: true,
}).extend({
  name: z.string().min(1).max(80),
  formatId: z.string().min(1),
  importable: z.string().min(1),
});

export const ValidateTeamInputSchema = z.object({
  formatId: z.string().min(1),
  importable: z.string().min(1),
});

export const BattleConfigSchema = z.object({
  formatId: z.string(),
  model1: z.object({
    provider: BattleModelProviderSchema,
    modelId: z.string().min(1),
  }),
  model2: z.object({
    provider: BattleModelProviderSchema,
    modelId: z.string().min(1),
  }),
  team1Id: z.string(),
  team2Id: z.string(),
  maxTurns: z.number().int().positive().optional(),
  seed: z.number().int().optional(),
});

export const CreateBattleInputSchema = BattleConfigSchema;

export const LegalActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["move", "switch", "teamPreview"]),
  targets: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const CreateRunInputSchema = z.object({
  name: z.string().min(1).max(120),
  formatId: z.string().min(1),
  agentIds: z.array(z.string().min(1)).min(2),
  teamIds: z.array(z.string().min(1)).min(2),
  gamesPerPairing: z.number().int().positive().max(9).optional(),
  mirror: z.boolean().optional(),
  maxTurns: z.number().int().positive().optional(),
});

export const CreateRunRequestSchema = z.object({
  name: z.string().min(1).max(120),
  formatId: z.string().min(1),
  models: z
    .array(
      z.object({
        provider: BattleModelProviderSchema,
        modelId: z.string().min(1),
      })
    )
    .min(2),
  teamIds: z.array(z.string().min(1)).min(2),
  gamesPerPairing: z.number().int().positive().max(9).optional(),
  mirror: z.boolean().optional(),
  maxTurns: z.number().int().positive().optional(),
});

export const DexSearchQuerySchema = z.object({
  q: z.string().optional().default(""),
  kind: DexEntityKindSchema.optional(),
});
