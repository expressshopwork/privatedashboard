/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/privatedashboard',
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
