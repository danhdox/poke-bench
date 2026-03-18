"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  getFallbackProviderCatalog,
  type ModelCatalogProvider,
  type ProviderCatalog,
} from "../lib/model-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AgentFormProps = {
  initial?: {
    id?: string;
    name?: string;
    provider?: string;
    modelId?: string | null;
    systemPrompt?: string | null;
    temperature?: number | null;
    maxTokens?: number | null;
  };
};

const providers = ["random", "heuristic", "openai", "anthropic"] as const;
const CUSTOM_MODEL_VALUE = "__custom__";

function getInitialModelState(
  provider: ModelCatalogProvider,
  catalog: Pick<ProviderCatalog, "models">,
  modelId?: string | null
) {
  const savedModel = modelId ?? "";
  if (catalog.models.length === 0) {
    return {
      modelChoice:
        provider === "openai" || provider === "anthropic" ? CUSTOM_MODEL_VALUE : "",
      customModelId: savedModel,
    };
  }

  if (savedModel && !catalog.models.some((model) => model.id === savedModel)) {
    return {
      modelChoice: CUSTOM_MODEL_VALUE,
      customModelId: savedModel,
    };
  }

  return {
    modelChoice: savedModel || catalog.models[0]?.id || "",
    customModelId: "",
  };
}

export function AgentForm({ initial }: AgentFormProps) {
  const router = useRouter();
  const initialProvider = (initial?.provider ?? "random") as ModelCatalogProvider;
  const initialCatalog = getFallbackProviderCatalog(initialProvider);
  const initialModelState = getInitialModelState(
    initialProvider,
    initialCatalog,
    initial?.modelId
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    provider: initialProvider,
    modelChoice: initialModelState.modelChoice,
    customModelId: initialModelState.customModelId,
    systemPrompt: initial?.systemPrompt ?? "",
    temperature: initial?.temperature?.toString() ?? "",
    maxTokens: initial?.maxTokens?.toString() ?? "",
  });
  const [providerCatalog, setProviderCatalog] = useState<ProviderCatalog>(initialCatalog);
  const requiresModel = form.provider === "openai" || form.provider === "anthropic";
  const resolvedModelId = requiresModel
    ? form.modelChoice === CUSTOM_MODEL_VALUE
      ? form.customModelId.trim()
      : form.modelChoice
    : undefined;

  useEffect(() => {
    const provider = form.provider as ModelCatalogProvider;
    let cancelled = false;

    const fallbackCatalog = getFallbackProviderCatalog(provider);
    setProviderCatalog(fallbackCatalog);

    async function loadCatalog() {
      const response = await fetch(`/api/models?provider=${provider}`, {
        cache: "no-store",
      }).catch(() => null);

      if (!response?.ok) return;
      const payload = (await response.json()) as ProviderCatalog;
      if (cancelled) return;

      setProviderCatalog(payload);
      setForm((current) => {
        if (current.provider !== provider) return current;
        if (payload.models.length === 0) {
          return {
            ...current,
            modelChoice:
              provider === "openai" || provider === "anthropic"
                ? CUSTOM_MODEL_VALUE
                : "",
          };
        }

        const currentModelId =
          current.modelChoice === CUSTOM_MODEL_VALUE
            ? current.customModelId.trim()
            : current.modelChoice;

        if (
          current.modelChoice === CUSTOM_MODEL_VALUE ||
          payload.models.some((model) => model.id === currentModelId)
        ) {
          return current;
        }

        return {
          ...current,
          modelChoice: payload.models[0]?.id ?? current.modelChoice,
          customModelId: "",
        };
      });
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [form.provider]);

  function handleProviderChange(nextProvider: ModelCatalogProvider) {
    const nextCatalog = getFallbackProviderCatalog(nextProvider);
    const nextModelState = getInitialModelState(nextProvider, nextCatalog, undefined);
    setForm((current) => ({
      ...current,
      provider: nextProvider,
      modelChoice: nextModelState.modelChoice,
      customModelId: nextModelState.customModelId,
    }));
  }

  function submit() {
    startTransition(async () => {
      setError(null);

      if (requiresModel && !resolvedModelId) {
        setError("Select a model preset or enter a custom model id.");
        return;
      }

      const response = await fetch(initial?.id ? `/api/agents/${initial.id}` : "/api/agents", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          provider: form.provider,
          modelId: resolvedModelId || undefined,
          systemPrompt: form.systemPrompt || undefined,
          temperature: form.temperature ? Number(form.temperature) : undefined,
          maxTokens: form.maxTokens ? Number(form.maxTokens) : undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Request failed" }));
        setError(payload.error ?? "Request failed");
        return;
      }

      if (!initial?.id) {
        const resetModelState = getInitialModelState(
          "random",
          getFallbackProviderCatalog("random"),
          undefined
        );
        setForm({
          name: "",
          provider: "random",
          modelChoice: resetModelState.modelChoice,
          customModelId: resetModelState.customModelId,
          systemPrompt: "",
          temperature: "",
          maxTokens: "",
        });
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select
            value={form.provider}
            onValueChange={(value) => handleProviderChange(value as ModelCatalogProvider)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>{providerCatalog.label}</CardTitle>
              <CardDescription>{providerCatalog.description}</CardDescription>
            </div>
            {requiresModel ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="default">
                  {providerCatalog.source === "live" ? "Live provider models" : "Fallback presets"}
                </Badge>
                {providerCatalog.status !== "ready" ? (
                  <Badge variant="outline">
                    {providerCatalog.status === "missing_key" ? "API key missing" : "Provider fetch failed"}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiresModel ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Model Preset</Label>
                <Select
                  value={form.modelChoice}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, modelChoice: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerCatalog.models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_MODEL_VALUE}>Custom model id</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.modelChoice === CUSTOM_MODEL_VALUE ? (
                <div className="space-y-2">
                  <Label>Custom Model Id</Label>
                  <Input
                    value={form.customModelId}
                    placeholder="provider-specific model id"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, customModelId: event.target.value }))
                    }
                  />
                </div>
              ) : (
                <div className="rounded-md border bg-muted/60 px-4 py-3 text-sm text-foreground/75">
                  Stored model id: <span className="mono text-foreground">{resolvedModelId}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/60 px-4 py-3 text-sm text-foreground/75">
              This provider does not need an external model id. Create the agent and it can battle
              immediately.
            </div>
          )}

          {providerCatalog.error ? (
            <div className="rounded-md border bg-muted/60 px-4 py-3 text-sm text-foreground/75">
              {providerCatalog.error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Temperature</Label>
          <Input
            type="number"
            step="0.1"
            value={form.temperature}
            onChange={(event) =>
              setForm((current) => ({ ...current, temperature: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Max Tokens</Label>
          <Input
            type="number"
            min="1"
            value={form.maxTokens}
            onChange={(event) =>
              setForm((current) => ({ ...current, maxTokens: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>System Prompt</Label>
        <Textarea
          className="min-h-28"
          value={form.systemPrompt}
          onChange={(event) =>
            setForm((current) => ({ ...current, systemPrompt: event.target.value }))
          }
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" onClick={submit} disabled={pending}>
        {pending ? "Saving..." : initial?.id ? "Update agent" : "Create agent"}
      </Button>
    </div>
  );
}
