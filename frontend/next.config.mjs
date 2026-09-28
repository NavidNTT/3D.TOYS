/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Bind mounts inside a container: keep webpack's polling cache small and
  // readable from the host, and don't fail the build on lint nits.
  eslint: { ignoreDuringBuilds: false },

  images: {
    // 3D thumbnails are served straight out of MinIO over HTTP in dev.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
      { protocol: 'http', hostname: 'minio', port: '9000', pathname: '/**' },
      { protocol: 'https', hostname: '**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    // 3D viewers ship as sizeable client bundles; these keep dev reloads fast.
    optimizePackageImports: ['three', '@react-three/drei'],
  },
};

export default nextConfig;
