/** @type {import('next').NextConfig} */
const backendPort = process.env.BACKEND_PORT || "8080";
const backendUrl = process.env.BACKEND_URL || `http://127.0.0.1:${backendPort}`;

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Sembunyikan header X-Powered-By demi keamanan production
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
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
