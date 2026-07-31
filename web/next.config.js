/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  env: {
    NEXT_PUBLIC_HOST: process.env.HOST,
    NEXT_PUBLIC_SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
  },
  allowedDevOrigins: [process.env.HOST],
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
