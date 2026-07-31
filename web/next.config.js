/** @type {import('next').NextConfig} */
const path = require("path");

const host = process.env.HOST?.replace(/\/$/, "");

const nextConfig = {
  env: {
    NEXT_PUBLIC_HOST: host,
    NEXT_PUBLIC_SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
  },
  ...(host ? { allowedDevOrigins: [host] } : {}),
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
