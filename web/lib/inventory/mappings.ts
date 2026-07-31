import prisma from "@/lib/db/prisma-connect";
import { SkuMapping } from "@prisma/client";

export type CreateMappingInput = {
  shop: string;
  masterVariantId: string;
  masterSku?: string | null;
  masterProductTitle?: string | null;
  masterInventoryItemId: string;
  childVariantId: string;
  childSku?: string | null;
  childProductTitle?: string | null;
  childInventoryItemId: string;
  unitsPerChildUnit: number;
  locationId: string;
};

export async function getMappings(shop: string): Promise<SkuMapping[]> {
  return prisma.skuMapping.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMappingByChildVariant(
  shop: string,
  childVariantId: string,
): Promise<SkuMapping | null> {
  return prisma.skuMapping.findUnique({
    where: {
      shop_childVariantId: { shop, childVariantId },
    },
  });
}

export async function getMappingsByChildVariantIds(
  shop: string,
  childVariantIds: string[],
): Promise<SkuMapping[]> {
  if (childVariantIds.length === 0) return [];
  return prisma.skuMapping.findMany({
    where: {
      shop,
      childVariantId: { in: childVariantIds },
    },
  });
}

export async function createMapping(
  input: CreateMappingInput,
): Promise<SkuMapping> {
  if (input.masterVariantId === input.childVariantId) {
    throw new Error("Master and child SKU must be different variants");
  }
  if (input.unitsPerChildUnit < 1) {
    throw new Error("Units per child sale must be at least 1");
  }

  const existingChild = await getMappingByChildVariant(
    input.shop,
    input.childVariantId,
  );
  if (existingChild) {
    throw new Error("This child SKU is already mapped to a master");
  }

  return prisma.skuMapping.create({ data: input });
}

export async function deleteMapping(
  shop: string,
  id: string,
): Promise<void> {
  await prisma.skuMapping.deleteMany({
    where: { id, shop },
  });
}

export async function isOrderProcessed(orderId: string): Promise<boolean> {
  const record = await prisma.processedOrder.findUnique({
    where: { id: orderId },
  });
  return !!record;
}

export async function markOrderProcessed(
  orderId: string,
  shop: string,
): Promise<void> {
  await prisma.processedOrder.upsert({
    where: { id: orderId },
    update: { processedAt: new Date() },
    create: { id: orderId, shop },
  });
}

export function variantGidFromId(variantId: number | string): string {
  const id = String(variantId);
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/ProductVariant/${id}`;
}
