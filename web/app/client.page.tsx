"use client";

import {
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  Layout,
  Modal,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";

type ProductVariant = {
  variantId: string;
  variantTitle: string;
  productId: string;
  productTitle: string;
  sku: string | null;
  inventoryItemId: string;
  inventoryQuantity: number;
};

type SkuMappingRow = {
  id: string;
  masterSku: string | null;
  masterProductTitle: string | null;
  childSku: string | null;
  childProductTitle: string | null;
  unitsPerChildUnit: number;
  masterQuantity: number;
  childQuantity: number;
};

function variantLabel(v: ProductVariant) {
  const sku = v.sku ? ` (${v.sku})` : "";
  return `${v.productTitle} — ${v.variantTitle}${sku} [${v.inventoryQuantity} in stock]`;
}

export default function Home() {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [mappings, setMappings] = useState<SkuMappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [masterVariantId, setMasterVariantId] = useState("");
  const [childVariantId, setChildVariantId] = useState("");
  const [unitsPerChildUnit, setUnitsPerChildUnit] = useState("1");

  const variantOptions = useMemo(
    () =>
      variants.map((v) => ({
        label: variantLabel(v),
        value: v.variantId,
      })),
    [variants],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, mappingsRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/mappings"),
      ]);
      const productsJson = await productsRes.json();
      const mappingsJson = await mappingsRes.json();

      if (productsJson.status === "success") {
        setVariants(productsJson.data);
      } else {
        throw new Error(productsJson.message ?? "Failed to load products");
      }

      if (mappingsJson.status === "success") {
        setMappings(mappingsJson.data);
      } else {
        throw new Error(mappingsJson.message ?? "Failed to load mappings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateMapping = async () => {
    const master = variants.find((v) => v.variantId === masterVariantId);
    const child = variants.find((v) => v.variantId === childVariantId);
    if (!master || !child) {
      setError("Please select both master and child SKUs");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterVariantId: master.variantId,
          masterSku: master.sku,
          masterProductTitle: master.productTitle,
          masterInventoryItemId: master.inventoryItemId,
          childVariantId: child.variantId,
          childSku: child.sku,
          childProductTitle: child.productTitle,
          childInventoryItemId: child.inventoryItemId,
          unitsPerChildUnit: Number(unitsPerChildUnit),
        }),
      });
      const json = await res.json();
      if (json.status !== "success") {
        throw new Error(json.message ?? "Failed to create mapping");
      }
      setModalOpen(false);
      setMasterVariantId("");
      setChildVariantId("");
      setUnitsPerChildUnit("1");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create mapping");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/mappings?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.status !== "success") {
        throw new Error(json.message ?? "Failed to delete mapping");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete mapping");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      if (json.status !== "success") {
        throw new Error(json.message ?? "Failed to sync inventory");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync inventory");
    } finally {
      setSyncing(false);
    }
  };

  const tableRows = mappings.map((m) => [
    m.masterSku ?? m.masterProductTitle ?? "—",
    m.childSku ?? m.childProductTitle ?? "—",
    String(m.unitsPerChildUnit),
    String(m.masterQuantity),
    String(m.childQuantity),
    <Button key={m.id} tone="critical" onClick={() => handleDelete(m.id)}>
      Remove
    </Button>,
  ]);

  return (
    <Page
      title="Inverty Track"
      subtitle="Map child SKUs to a master SKU and track shared inventory"
      primaryAction={{
        content: "Add mapping",
        onAction: () => setModalOpen(true),
      }}
      secondaryActions={[
        {
          content: "Sync inventory",
          onAction: handleSync,
          loading: syncing,
        },
        {
          content: "Refresh",
          onAction: loadData,
          loading: loading,
        },
      ]}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Banner tone="info">
            <p>
              Set a <strong>master SKU</strong> as your source of truth (e.g. a
              box of 200 screws). Map <strong>child SKUs</strong> to it (e.g.
              single screws or smaller packs). When a child SKU sells, the
              master inventory is reduced automatically.
            </p>
            <p style={{ marginTop: "0.5rem" }}>
              Example: Master has 200 units. Child sells 10 units (1 unit each)
              → master shows 190 units remaining.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {loading ? (
              <Text as="p" variant="bodyMd">
                Loading...
              </Text>
            ) : mappings.length === 0 ? (
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  No SKU mappings yet. Click &quot;Add mapping&quot; to link a
                  child SKU to a master SKU.
                </Text>
              </BlockStack>
            ) : (
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "numeric",
                  "numeric",
                  "numeric",
                  "text",
                ]}
                headings={[
                  "Master SKU",
                  "Child SKU",
                  "Units per child sale",
                  "Master units",
                  "Child units available",
                  "Actions",
                ]}
                rows={tableRows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Map child SKU to master"
        primaryAction={{
          content: "Save mapping",
          onAction: handleCreateMapping,
          loading: saving,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Select
              label="Master SKU (source of truth)"
              options={[{ label: "Select master SKU", value: "" }, ...variantOptions]}
              value={masterVariantId}
              onChange={setMasterVariantId}
              helpText="The SKU that holds the real inventory count (e.g. box of 200)"
            />
            <Select
              label="Child SKU"
              options={[{ label: "Select child SKU", value: "" }, ...variantOptions]}
              value={childVariantId}
              onChange={setChildVariantId}
              helpText="The SKU that deducts from the master when sold"
            />
            <TextField
              label="Units per child sale"
              type="number"
              value={unitsPerChildUnit}
              onChange={setUnitsPerChildUnit}
              autoComplete="off"
              helpText="How many master units each 1 child unit consumes. Use 1 for individual items, 10 for a 10-pack, etc."
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
