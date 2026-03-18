import { PageScrollLock } from "../../components/page-scroll-lock";
import { OperationsOverview } from "../../components/operations-overview";
import { getActiveBattles, getActiveRuns, getSupportedModelBenchmarks } from "../../lib/repo";
import { formatPercent } from "../../lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatMetric(value: number | null, digits = 1) {
  if (value === null) return "—";
  return value.toFixed(digits);
}

export default async function BenchmarksPage() {
  const [benchmarks, activeRuns, activeBattles] = await Promise.all([
    getSupportedModelBenchmarks(),
    getActiveRuns(4),
    getActiveBattles(6),
  ]);

  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-1 flex-col overflow-hidden md:h-[calc(100svh-var(--header-height)-1rem)]">
      <PageScrollLock />
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-b-[1.75rem] border-x border-b bg-card">
        <div className="border-b">
          <OperationsOverview initialRuns={activeRuns} initialBattles={activeBattles} />
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="text-2xl font-semibold">Benchmarks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Supported models only. Pokemon battle metrics only.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6">
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-muted/40 text-left">
                  <tr className="border-b">
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 text-right font-medium">Battles</th>
                    <th className="px-4 py-3 text-right font-medium">Wins</th>
                    <th className="px-4 py-3 text-right font-medium">Losses</th>
                    <th className="px-4 py-3 text-right font-medium">Win rate</th>
                    <th className="px-4 py-3 text-right font-medium">Avg turns</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map((benchmark) => (
                    <tr
                      key={`${benchmark.provider}:${benchmark.modelId}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{benchmark.modelName}</div>
                        <div className="text-xs text-muted-foreground">{benchmark.modelId}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{benchmark.providerLabel}</td>
                      <td className="px-4 py-3 text-right">{benchmark.battles}</td>
                      <td className="px-4 py-3 text-right">
                        {benchmark.battles === 0 ? "—" : benchmark.wins}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {benchmark.battles === 0 ? "—" : benchmark.losses}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {benchmark.winRate === null ? "—" : formatPercent(benchmark.winRate)}
                      </td>
                      <td className="px-4 py-3 text-right">{formatMetric(benchmark.averageTurns)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="pt-4 text-sm text-muted-foreground">
              Rows stay visible even before they have battle data so the supported model set stays explicit.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
