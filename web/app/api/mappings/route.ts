import { verifyRequest } from "../../../lib/shopify/verify";
import {
  createMapping,
  deleteMapping,
  getMappings,
} from "../../../lib/inventory/mappings";
import {
  getMasterInventorySummary,
  syncAllChildInventories,
} from "../../../lib/inventory/process-order";
import { getPrimaryLocationId } from "../../../lib/inventory/shopify-inventory";
import { NextResponse } from "next/server";

export type APIResponse<DataType> = {
  status: "success" | "error";
  data?: DataType;
  message?: string;
};

export async function GET(req: Request) {
  try {
    const { shop } = await verifyRequest(req, false);
    const mappings = await getMappings(shop);
    const withInventory = await getMasterInventorySummary(shop, mappings);
    return NextResponse.json<APIResponse<typeof withInventory>>({
      status: "success",
      data: withInventory,
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

export async function POST(req: Request) {
  try {
    const { shop } = await verifyRequest(req, false);
    const body = await req.json();
    const locationId =
      body.locationId ?? (await getPrimaryLocationId(shop));

    const mapping = await createMapping({
      shop,
      masterVariantId: body.masterVariantId,
      masterSku: body.masterSku,
      masterProductTitle: body.masterProductTitle,
      masterInventoryItemId: body.masterInventoryItemId,
      childVariantId: body.childVariantId,
      childSku: body.childSku,
      childProductTitle: body.childProductTitle,
      childInventoryItemId: body.childInventoryItemId,
      unitsPerChildUnit: Number(body.unitsPerChildUnit) || 1,
      locationId,
    });

    const mappings = await getMappings(shop);
    await syncAllChildInventories(shop, mappings);

    return NextResponse.json<APIResponse<typeof mapping>>({
      status: "success",
      data: mapping,
    });
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

export async function DELETE(req: Request) {
  try {
    const { shop } = await verifyRequest(req, false);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json<APIResponse<null>>(
        { status: "error", message: "Missing mapping id" },
        { status: 400 },
      );
    }

    await deleteMapping(shop, id);
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
