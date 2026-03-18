"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "./status-pill";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type OperationsRun = {
  id: string;
  name: string;
  status: string;
  participants: Array<{
    agent: {
      id: string;
      name: string;
    };
  }>;
  battles: Array<{
    battle: {
      status: string;
    };
  }>;
};

type OperationsBattle = {
  id: string;
  status: string;
  formatId: string;
  agent1: { name: string };
  agent2: { name: string };
  team1: { name: string };
  team2: { name: string };
};

function isStoppable(status: string) {
  return status === "pending" || status === "running";
}

export function OperationsOverview({
  initialRuns,
  initialBattles,
}: {
  initialRuns: OperationsRun[];
  initialBattles: OperationsBattle[];
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshPending, startRefreshTransition] = useTransition();

  function refreshData() {
    if (pendingKey) {
      return;
    }

    startRefreshTransition(() => {
      router.refresh();
    });
  }

  async function stopRun(runId: string) {
    if (pendingKey) {
      return;
    }

    setPendingKey(`run:${runId}`);
    setError(null);

    try {
      const response = await fetch(`/api/runs/${runId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "cancel" }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Stop request failed");
        return;
      }

      startRefreshTransition(() => {
        router.refresh();
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function stopBattle(battleId: string) {
    if (pendingKey) {
      return;
    }

    setPendingKey(`battle:${battleId}`);
    setError(null);

    try {
      const response = await fetch(`/api/battles/${battleId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "cancel" }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Stop request failed");
        return;
      }

      startRefreshTransition(() => {
        router.refresh();
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <Card className="flex min-h-0 flex-col border-0 bg-transparent shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-6 py-5">
        <div className="space-y-1">
          <CardTitle className="text-2xl">Operations</CardTitle>
          <CardDescription>
            Stop active runs and standalone battles from one place.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshData}
          disabled={Boolean(pendingKey) || refreshPending}
        >
          {refreshPending ? "Refreshing..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        {error ? <p className="pb-4 text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">Current Runs</div>
            {initialRuns.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                No active runs.
              </div>
            ) : (
              initialRuns.map((run) => {
                const completedBattles = run.battles.filter(
                  (entry) => entry.battle.status === "completed"
                ).length;

                return (
                  <Card key={run.id}>
                    <CardContent className="flex items-start justify-between gap-3 p-4">
                      <div>
                        <div className="font-medium">{run.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {run.participants.length} agents · {completedBattles}/{run.battles.length} battles completed
                        </div>
                        <Link
                          href={`/runs/${run.id}`}
                          className="mt-3 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                        >
                          Open run
                        </Link>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusPill value={run.status} />
                        {isStoppable(run.status) ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => stopRun(run.id)}
                            disabled={pendingKey === `run:${run.id}`}
                          >
                            {pendingKey === `run:${run.id}` ? "Stopping..." : "Stop Run"}
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">Standalone Battles</div>
            {initialBattles.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                No standalone battles.
              </div>
            ) : (
              initialBattles.map((battle) => (
                <Card key={battle.id}>
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <div className="font-medium">
                        {battle.agent1.name} vs {battle.agent2.name}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {battle.team1.name} vs {battle.team2.name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{battle.formatId}</div>
                      <Link
                        href={`/battles/${battle.id}`}
                        className="mt-3 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Open battle
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill value={battle.status} />
                      {isStoppable(battle.status) ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => stopBattle(battle.id)}
                          disabled={pendingKey === `battle:${battle.id}`}
                        >
                          {pendingKey === `battle:${battle.id}` ? "Stopping..." : "Stop Battle"}
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
