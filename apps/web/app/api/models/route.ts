import { NextResponse } from "next/server";
import { getProviderModelCatalog } from "../../../lib/model-discovery";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const refresh = searchParams.get("refresh") === "1";

  if (
    provider !== "random" &&
    provider !== "heuristic" &&
    provider !== "openai" &&
    provider !== "anthropic"
  ) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const catalog = await getProviderModelCatalog(provider, refresh);
  return NextResponse.json(catalog);
}
