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
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };
    return config;
  },
};

module.exports = nextConfig;
