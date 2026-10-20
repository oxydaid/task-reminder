/** @type {import('next').NextConfig} */
const backendPort = process.env.BACKEND_PORT || "8080";
const backendUrl = process.env.BACKEND_URL || `http://127.0.0.1:${backendPort}`;

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
