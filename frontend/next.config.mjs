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
  optimizePackageImports: ['three', '@react-three/drei', '@react-three/fiber'],

  // drei/fiber/three ship ESM that occasionally needs transpiling so webpack
  // resolves `three` imports to one shared copy (avoids duplicate instances
  // and "multiple copies of three.js" warnings in the 3D viewer).
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  // Serve .glb/.gltf/.bin + Draco decoders with correct MIME types so
  // useGLTF/useLoader fetch them as static assets without CORS errors.
  async headers() {
    return [
      {
        source: '/draco/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/models/:path*.glb',
        headers: [{ key: 'Content-Type', value: 'model/gltf-binary' }],
      },
    ];
  },
};

export default nextConfig;
