import {
  adjustInventory,
  getInventoryQuantity,
  setInventoryQuantity,
} from "./shopify-inventory";
import {
  getMappingsByChildVariantIds,
  markOrderProcessed,
  variantGidFromId,
  isOrderProcessed,
} from "./mappings";
import { SkuMapping } from "@prisma/client";

type OrderLineItem = {
  variant_id: number | null;
  quantity: number;
  sku: string | null;
};

type OrderPayload = {
  id: number;
  line_items: OrderLineItem[];
};

type RefundLineItem = {
  line_item: {
    variant_id: number | null;
    quantity: number;
  };
  quantity: number;
};

type RefundPayload = {
  id: number;
  order_id: number;
  refund_line_items: RefundLineItem[];
};

async function syncChildInventoryFromMaster(
  shop: string,
  mapping: SkuMapping,
): Promise<void> {
  const masterQty = await getInventoryQuantity(
    shop,
    mapping.masterInventoryItemId,
    mapping.locationId,
  );
  const childQty = Math.floor(masterQty / mapping.unitsPerChildUnit);
  await setInventoryQuantity(
    shop,
    mapping.childInventoryItemId,
    mapping.locationId,
    childQty,
  );
}

async function applyMasterDelta(
  shop: string,
  mapping: SkuMapping,
  soldChildUnits: number,
  direction: "deduct" | "restore",
): Promise<void> {
  const masterDelta =
    soldChildUnits * mapping.unitsPerChildUnit * (direction === "deduct" ? -1 : 1);

  await adjustInventory(
    shop,
    mapping.masterInventoryItemId,
    mapping.locationId,
    masterDelta,
    direction === "deduct" ? "correction" : "restock",
  );

  await syncChildInventoryFromMaster(shop, mapping);
}

export async function processOrderCreate(
  shop: string,
  body: string,
): Promise<void> {
  const order = JSON.parse(body) as OrderPayload;
  const orderGid = String(order.id);

  if (await isOrderProcessed(orderGid)) {
    return;
  }

  const variantIds = order.line_items
    .filter((item) => item.variant_id)
    .map((item) => variantGidFromId(item.variant_id!));

  const mappings = await getMappingsByChildVariantIds(shop, variantIds);
  if (mappings.length === 0) {
    await markOrderProcessed(orderGid, shop);
    return;
  }

  const mappingByChild = new Map(
    mappings.map((m) => [m.childVariantId, m]),
  );

  for (const item of order.line_items) {
    if (!item.variant_id || item.quantity <= 0) continue;
    const childGid = variantGidFromId(item.variant_id);
    const mapping = mappingByChild.get(childGid);
    if (!mapping) continue;

    await applyMasterDelta(shop, mapping, item.quantity, "deduct");
  }

  await markOrderProcessed(orderGid, shop);
}

export async function processRefundCreate(
  shop: string,
  body: string,
): Promise<void> {
  const refund = JSON.parse(body) as RefundPayload;

  const variantIds = refund.refund_line_items
    .filter((item) => item.line_item.variant_id)
    .map((item) => variantGidFromId(item.line_item.variant_id!));

  const mappings = await getMappingsByChildVariantIds(shop, variantIds);
  if (mappings.length === 0) return;

  const mappingByChild = new Map(
    mappings.map((m) => [m.childVariantId, m]),
  );

  for (const item of refund.refund_line_items) {
    if (!item.line_item.variant_id || item.quantity <= 0) continue;
    const childGid = variantGidFromId(item.line_item.variant_id);
    const mapping = mappingByChild.get(childGid);
    if (!mapping) continue;

    await applyMasterDelta(shop, mapping, item.quantity, "restore");
  }
}

export async function syncAllChildInventories(
  shop: string,
  mappings: SkuMapping[],
): Promise<void> {
  for (const mapping of mappings) {
    await syncChildInventoryFromMaster(shop, mapping);
  }
}

export async function getMasterInventorySummary(
  shop: string,
  mappings: SkuMapping[],
): Promise<
  Array<
    SkuMapping & {
      masterQuantity: number;
      childQuantity: number;
    }
  >
> {
  const results = [];
  for (const mapping of mappings) {
    const masterQuantity = await getInventoryQuantity(
      shop,
      mapping.masterInventoryItemId,
      mapping.locationId,
    );
    const childQuantity = Math.floor(
      masterQuantity / mapping.unitsPerChildUnit,
    );
    results.push({ ...mapping, masterQuantity, childQuantity });
  }
  return results;
}
