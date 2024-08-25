/** @type {import('next').NextConfig} */
module.exports = {
  webpack(config) {
    config.resolve.alias.canvas = false
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    })

    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "**",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "**",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  transpilePackages: ["components"],
  experimental: {
    outputFileTracingExcludes: {
      // Avoids including canvas in the trace to avoid 50 Mb+ serverless functions
      "*": ["../../node_modules/canvas*", "node_modules/canvas*"],
    },
  },
}
