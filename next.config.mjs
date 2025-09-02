/** @type {import('next').NextConfig} */
const nextConfig = {
  // 强制在构建时检查 ESLint 与 TypeScript 错误
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
