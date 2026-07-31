-- CreateTable
CREATE TABLE "SkuMapping" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "masterVariantId" TEXT NOT NULL,
    "masterSku" TEXT,
    "masterProductTitle" TEXT,
    "masterInventoryItemId" TEXT NOT NULL,
    "childVariantId" TEXT NOT NULL,
    "childSku" TEXT,
    "childProductTitle" TEXT,
    "childInventoryItemId" TEXT NOT NULL,
    "unitsPerChildUnit" INTEGER NOT NULL DEFAULT 1,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkuMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedOrder" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkuMapping_shop_masterVariantId_idx" ON "SkuMapping"("shop", "masterVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "SkuMapping_shop_childVariantId_key" ON "SkuMapping"("shop", "childVariantId");

-- CreateIndex
CREATE INDEX "ProcessedOrder_shop_idx" ON "ProcessedOrder"("shop");
