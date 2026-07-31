import { verifyRequest } from "@/lib/shopify/verify";
import { getProductVariants } from "@/lib/inventory/shopify-inventory";
import { NextResponse } from "next/server";
import type { APIResponse } from "@/app/api/mappings/route";

export async function GET(req: Request) {
  try {
    const { shop } = await verifyRequest(req, false);
    const variants = await getProductVariants(shop);
    return NextResponse.json<APIResponse<typeof variants>>({
      status: "success",
      data: variants,
    });
  } catch (error) {
    return NextResponse.json<APIResponse<null>>(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 401 },
    );
  }
}
