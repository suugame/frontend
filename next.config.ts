import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const basePath = process.env.BASE_PATH || "";
const enableStaticExport = process.env.GITHUB_PAGES === "true" || process.env.STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  reactCompiler: true,
  ...(enableStaticExport
    ? {
        // GitHub Pages 仅支持静态站点，使用 Next.js 导出静态文件
        output: "export",
        // 避免需要服务器的图片优化
        images: { unoptimized: true },
        // 让导出的目录带有 index.html，兼容 Pages 的静态托管
        trailingSlash: true,
        // 项目页需要设置 basePath，如 /<repo>
        basePath: isProd && basePath ? basePath : undefined,
        assetPrefix: isProd && basePath ? basePath : undefined,
      }
    : {}),
};

export default nextConfig;
