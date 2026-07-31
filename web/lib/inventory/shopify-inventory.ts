import shopify from "@/lib/shopify/initialize-context";
import { findSessionsByShop } from "@/lib/db/session-storage";
import { Session } from "@shopify/shopify-api";

export async function getOfflineSession(shop: string): Promise<Session> {
  const sessions = await findSessionsByShop(shop);
  const offline = sessions.find((s) => !s.isOnline) ?? sessions[0];
  if (!offline) {
    throw new Error(`No session found for shop: ${shop}`);
  }
  return offline;
}

export function getGraphqlClient(session: Session) {
  return new shopify.clients.Graphql({ session });
}

export type ProductVariantOption = {
  variantId: string;
  variantTitle: string;
  productId: string;
  productTitle: string;
  sku: string | null;
  inventoryItemId: string;
  inventoryQuantity: number;
};

type ProductsResponse = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<{
      id: string;
      title: string;
      variants: {
        nodes: Array<{
          id: string;
          title: string;
          sku: string | null;
          inventoryQuantity: number;
          inventoryItem: { id: string };
        }>;
      };
    }>;
  };
};

type GraphqlResult<T> = {
  data?: T;
  errors?: { message: string };
};

const GET_PRODUCTS_WITH_VARIANTS = `#graphql
  query getProductsWithVariants($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        variants(first: 100) {
          nodes {
            id
            title
            sku
            inventoryQuantity
            inventoryItem {
              id
            }
          }
        }
      }
    }
  }
`;

export async function getProductVariants(
  shop: string,
  limit = 250,
): Promise<ProductVariantOption[]> {
  const session = await getOfflineSession(shop);
  const client = getGraphqlClient(session);
  const variants: ProductVariantOption[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage && variants.length < limit) {
    const { data, errors } = (await client.request<ProductsResponse>(
      GET_PRODUCTS_WITH_VARIANTS,
      {
        variables: { first: 50, after },
      },
    )) as GraphqlResult<ProductsResponse>;

    if (errors) {
      throw new Error(errors.message);
    }

    for (const product of data?.products.nodes ?? []) {
      for (const variant of product.variants.nodes) {
        variants.push({
          variantId: variant.id,
          variantTitle: variant.title,
          productId: product.id,
          productTitle: product.title,
          sku: variant.sku,
          inventoryItemId: variant.inventoryItem.id,
          inventoryQuantity: variant.inventoryQuantity,
        });
      }
    }

    hasNextPage = data?.products.pageInfo.hasNextPage ?? false;
    after = data?.products.pageInfo.endCursor ?? null;
  }

  return variants;
}

const GET_PRIMARY_LOCATION = `#graphql
  query getPrimaryLocation {
    locations(first: 1) {
      nodes {
        id
        name
      }
    }
  }
`;

export async function getPrimaryLocationId(shop: string): Promise<string> {
  const session = await getOfflineSession(shop);
  const client = getGraphqlClient(session);
  const { data, errors } = await client.request<{
    locations: { nodes: Array<{ id: string; name: string }> };
  }>(GET_PRIMARY_LOCATION);

  if (errors) {
    throw new Error(errors.message);
  }

  const locationId = data?.locations.nodes[0]?.id;
  if (!locationId) {
    throw new Error("No location found for shop");
  }
  return locationId;
}

const GET_INVENTORY_LEVEL = `#graphql
  query getInventoryLevel($inventoryItemId: ID!, $locationId: ID!) {
    inventoryItem(id: $inventoryItemId) {
      inventoryLevel(locationId: $locationId) {
        quantities(names: ["available"]) {
          name
          quantity
        }
      }
    }
  }
`;

export async function getInventoryQuantity(
  shop: string,
  inventoryItemId: string,
  locationId: string,
): Promise<number> {
  const session = await getOfflineSession(shop);
  const client = getGraphqlClient(session);
  const { data, errors } = await client.request<{
    inventoryItem: {
      inventoryLevel: {
        quantities: Array<{ name: string; quantity: number }>;
      } | null;
    } | null;
  }>(GET_INVENTORY_LEVEL, {
    variables: { inventoryItemId, locationId },
  });

  if (errors) {
    throw new Error(errors.message);
  }

  const available = data?.inventoryItem?.inventoryLevel?.quantities.find(
    (q) => q.name === "available",
  );
  return available?.quantity ?? 0;
}

const ADJUST_INVENTORY = `#graphql
  mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
    inventoryAdjustQuantities(input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

export async function adjustInventory(
  shop: string,
  inventoryItemId: string,
  locationId: string,
  delta: number,
  reason = "correction",
): Promise<void> {
  const session = await getOfflineSession(shop);
  const client = getGraphqlClient(session);
  const { data, errors } = await client.request<{
    inventoryAdjustQuantities: {
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(ADJUST_INVENTORY, {
    variables: {
      input: {
        reason,
        name: "available",
        changes: [
          {
            inventoryItemId,
            locationId,
            delta,
          },
        ],
      },
    },
  });

  if (errors) {
    throw new Error(errors.message);
  }

  const userErrors = data?.inventoryAdjustQuantities.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join(", "));
  }
}

const SET_INVENTORY = `#graphql
  mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

export async function setInventoryQuantity(
  shop: string,
  inventoryItemId: string,
  locationId: string,
  quantity: number,
): Promise<void> {
  const session = await getOfflineSession(shop);
  const client = getGraphqlClient(session);
  const { data, errors } = await client.request<{
    inventorySetQuantities: {
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(SET_INVENTORY, {
    variables: {
      input: {
        name: "available",
        reason: "correction",
        ignoreCompareQuantity: true,
        quantities: [
          {
            inventoryItemId,
            locationId,
            quantity,
          },
        ],
      },
    },
  });

  if (errors) {
    throw new Error(errors.message);
  }

  const userErrors = data?.inventorySetQuantities.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join(", "));
  }
}
