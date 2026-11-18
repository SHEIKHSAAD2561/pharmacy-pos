import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Embedded Postgres (local development only) ships WASM files; load it from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
  // SQL migrations are applied automatically at runtime, so ship them with every API function.
  outputFileTracingIncludes: {
    "/api/**/*": ["./drizzle/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
