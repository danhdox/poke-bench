import { listFormats } from "@poke-bench/dex";
import { BattleForms } from "../../../components/battle-forms";
import { getBattleModelSetup } from "../../../lib/battle-setup";
import { getTeams } from "../../../lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewBattlePage() {
  const [{ models, catalogStates }, teams, formats] = await Promise.all([
    getBattleModelSetup(),
    getTeams({ ensureDefaults: true }),
    listFormats(),
  ]);

  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-1 flex-col overflow-hidden md:h-[calc(100svh-var(--header-height)-1rem)]">
      <BattleForms
        models={models}
        catalogStates={catalogStates}
        teams={teams}
        formats={formats}
      />
    </div>
  );
}
