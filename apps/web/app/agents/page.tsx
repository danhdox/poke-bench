import { AgentForm } from "../../components/agent-form";
import { StatusPill } from "../../components/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgents } from "../../lib/repo";
import { formatDate } from "../../lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentForm />
          </CardContent>
        </Card>

        <section className="space-y-4">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="pb-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{agent.name}</h3>
                    <div className="text-sm text-muted-foreground">
                      {agent.provider} {agent.modelId ? `· ${agent.modelId}` : ""}
                    </div>
                  </div>
                  <StatusPill value={agent.provider} />
                </div>
                <div className="text-xs text-muted-foreground">Updated {formatDate(agent.updatedAt)}</div>
              </CardHeader>
              <CardContent>
                <AgentForm initial={agent} />
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
