import { notFound } from "next/navigation";
import { LiveRun } from "../../../components/live-run";
import { getRunDetail } from "../../../lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getRunDetail(id);

  if (!run) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <LiveRun initialRun={run} />
    </div>
  );
}
