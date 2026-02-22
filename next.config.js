/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: { unoptimized: true },
  // Renderer files live in renderer/
  // Next.js treats this as the app root
};

module.exports = nextConfig;
