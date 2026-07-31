import { verifyRequest } from "@/lib/shopify/verify";
import { getMappings } from "@/lib/inventory/mappings";
import { syncAllChildInventories } from "@/lib/inventory/process-order";
import { NextResponse } from "next/server";
import type { APIResponse } from "@/app/api/mappings/route";

export async function POST(req: Request) {
  try {
    const { shop } = await verifyRequest(req, false);
    const mappings = await getMappings(shop);
    await syncAllChildInventories(shop, mappings);
    return NextResponse.json<APIResponse<null>>({ status: "success" });
  } catch (error) {
    return NextResponse.json<APIResponse<null>>(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
