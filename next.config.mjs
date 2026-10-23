/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  compress: true,
  // Static export: gambar tidak bisa pakai next/image optimization
  images: {
    unoptimized: true,
  },
  // Trailing slash agar Apache bisa serve /dashboard/ → /dashboard/index.html
  trailingSlash: true,
};

export default nextConfig;
