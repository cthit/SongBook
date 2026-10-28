/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Migrations are read from disk at runtime, make sure they end up in the standalone bundle
  outputFileTracingIncludes: {
    '/**': ['./src/db/migrations/*.sql'],
  },
  serverExternalPackages: ['pg'],
}

module.exports = nextConfig
