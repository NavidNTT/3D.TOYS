/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    // 3D thumbnails are served straight out of MinIO over HTTP in dev.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
      { protocol: 'http', hostname: 'minio', port: '9000', pathname: '/**' },
      { protocol: 'https', hostname: '**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // 3D viewers ship as sizeable client bundles; this keeps dev reloads fast.
  // (Stays top-level in Next 16 — `experimental.optimizePackageImports` warns.)
  optimizePackageImports: ['three', '@react-three/drei'],
};

export default nextConfig;
