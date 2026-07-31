import "@shopify/shopify-api/adapters/web-api";
import { shopifyApi, ApiVersion, LogSeverity } from "@shopify/shopify-api";

function getHostName() {
  const host =
    process.env.HOST ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "localhost";
  return host.replace(/https?:\/\//, "").replace(/\/$/, "");
}

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  scopes: process.env.SCOPES?.split(",") || [
    "read_products",
    "write_products",
    "read_inventory",
    "write_inventory",
    "read_orders",
  ],
  hostName: getHostName(),
  hostScheme: "https",
  isEmbeddedApp: true,
  apiVersion: ApiVersion.October25,
  logger: {
    level:
      process.env.NODE_ENV === "development"
        ? LogSeverity.Debug
        : LogSeverity.Error,
  },
});

export default shopify;
