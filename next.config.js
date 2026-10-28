/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Migrations are read from disk at runtime, make sure they end up in the standalone bundle
  outputFileTracingIncludes: {
    '/**': ['./src/db/migrations/*.sql'],
  },
  serverExternalPackages: ['pg'],
  experimental: {
    // forbidden() / unauthorized() for the 403 and 401 pages
    authInterrupts: true,
  },
}

module.exports = nextConfig
