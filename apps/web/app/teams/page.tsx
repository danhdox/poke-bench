import { listFormats } from "@poke-bench/dex";
import { TeamForm } from "../../components/team-form";
import { StatusPill } from "../../components/status-pill";
import {
  filterSimpleTeamFormats,
  PREFERRED_BATTLE_FORMAT_ID,
} from "../../lib/team-formats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTeams } from "../../lib/repo";
import { formatDate } from "../../lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const [teams, allFormats] = await Promise.all([
    getTeams({ ensureDefaults: true }),
    listFormats(),
  ]);
  const formats = filterSimpleTeamFormats(allFormats);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamForm
              defaultFormatId={formats[0]?.id ?? PREFERRED_BATTLE_FORMAT_ID}
              formats={formats}
            />
          </CardContent>
        </Card>

        <section className="space-y-4">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{team.name}</h3>
                    <div className="text-sm text-muted-foreground">{team.formatId}</div>
                  </div>
                  <StatusPill value={team.validationStatus} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Updated {formatDate(team.updatedAt)}</div>
                {team.validationErrors ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-destructive">{team.validationErrors}</p>
                ) : null}
              </CardHeader>
              <CardContent>
                <pre className="mono max-h-80 overflow-auto rounded-md border bg-muted/30 p-4 text-xs text-foreground">
                  {team.importable}
                </pre>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
