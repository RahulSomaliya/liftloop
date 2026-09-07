import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite loads its wasm with `new URL(..., import.meta.url)`; bundling it breaks that resolution
  // ("path argument must be of type string ... Received an instance of URL"). Keep both DB drivers
  // as Node externals so they run unbundled on the server.
  serverExternalPackages: ['@electric-sql/pglite', '@neondatabase/serverless'],
}

export default nextConfig
