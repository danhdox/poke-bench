import { notFound } from "next/navigation";
import { LiveBattle } from "../../../components/live-battle";
import { getBattleDetail } from "../../../lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BattleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const battle = await getBattleDetail(id);

  if (!battle) {
    notFound();
  }

  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-1 flex-col overflow-hidden md:h-[calc(100svh-var(--header-height)-1rem)]">
      <LiveBattle initialBattle={battle} />
    </div>
  );
}
