"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusPill } from "./status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RunPayload = {
  id: string;
  name: string;
  status: string;
  summary: {
    totalBattles: number;
    completedBattles: number;
    standings: Array<{
      agentId: string;
      agentName: string;
      wins: number;
      losses: number;
      winRate: number;
      averageTurns: number;
      averageLatencyMs: number;
      fallbackRate: number;
    }>;
  } | null;
  battles: Array<{
    id: string;
    battle: {
      id: string;
      status: string;
      agent1: { name: string };
      agent2: { name: string };
      team1: { name: string };
      team2: { name: string };
      winnerSide: string | null;
    };
  }>;
};

function isRunTerminal(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function LiveRun({ initialRun }: { initialRun: RunPayload }) {
  const [run, setRun] = useState(initialRun);
  const [stopPending, setStopPending] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [stoppingBattleId, setStoppingBattleId] = useState<string | null>(null);

  useEffect(() => {
    if (isRunTerminal(run.status)) {
      return;
    }

    const interval = setInterval(async () => {
      const response = await fetch(`/api/runs/${run.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as RunPayload;
      setRun(payload);
      if (isRunTerminal(payload.status)) {
        clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [run.id, run.status]);

  const canStopRun = run.status === "pending" || run.status === "running";

  async function stopRun() {
    if (!canStopRun || stopPending) {
      return;
    }

    setStopPending(true);
    setStopError(null);

    try {
      const response = await fetch(`/api/runs/${run.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "cancel" }),
      });

      const payload = (await response.json().catch(() => null)) as
        | RunPayload
        | { error?: string }
        | null;

      if (!response.ok) {
        setStopError(
          payload && "error" in payload ? payload.error ?? "Stop request failed" : "Stop request failed"
        );
        return;
      }

      setRun(payload as RunPayload);
    } finally {
      setStopPending(false);
    }
  }

  async function stopBattle(battleId: string) {
    if (stoppingBattleId || stopPending) {
      return;
    }

    setStoppingBattleId(battleId);
    setStopError(null);

    try {
      const response = await fetch(`/api/battles/${battleId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "cancel" }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { id: string; status: string }
        | { error?: string }
        | null;

      if (!response.ok) {
        setStopError(
          payload && "error" in payload ? payload.error ?? "Stop request failed" : "Stop request failed"
        );
        return;
      }

      setRun((current) => ({
        ...current,
        battles: current.battles.map((entry) =>
          entry.battle.id === battleId
            ? {
                ...entry,
                battle: {
                  ...entry.battle,
                  status: "cancelled",
                },
              }
            : entry
        ),
      }));
    } finally {
      setStoppingBattleId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{run.name}</h2>
              {stopError ? (
                <p className="mt-2 text-sm text-destructive">{stopError}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <StatusPill value={run.status} />
              {canStopRun ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={stopRun}
                  disabled={stopPending}
                >
                  {stopPending ? "Stopping..." : "Stop Run"}
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Completed battles</div>
              <div className="mt-2 text-3xl font-semibold">
                {run.summary?.completedBattles ?? 0}/{run.summary?.totalBattles ?? run.battles.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Participants</div>
              <div className="mt-2 text-3xl font-semibold">{run.summary?.standings.length ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Scheduled battles</div>
              <div className="mt-2 text-3xl font-semibold">{run.battles.length}</div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Standings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>W-L</TableHead>
                  <TableHead>Win Rate</TableHead>
                  <TableHead>Avg Turns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(run.summary?.standings ?? []).map((entry) => (
                  <TableRow key={entry.agentId}>
                    <TableCell>{entry.agentName}</TableCell>
                    <TableCell>
                      {entry.wins}-{entry.losses}
                    </TableCell>
                    <TableCell>{(entry.winRate * 100).toFixed(1)}%</TableCell>
                    <TableCell>{entry.averageTurns.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Battles</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matchup</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.battles.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium">
                        {entry.battle.agent1.name} vs {entry.battle.agent2.name}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {entry.battle.team1.name} vs {entry.battle.team2.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill value={entry.battle.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/battles/${entry.battle.id}`}>Open</Link>
                        </Button>
                        {(entry.battle.status === "pending" || entry.battle.status === "running") ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => stopBattle(entry.battle.id)}
                            disabled={stoppingBattleId === entry.battle.id || stopPending}
                          >
                            {stoppingBattleId === entry.battle.id ? "Stopping..." : "Stop"}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
