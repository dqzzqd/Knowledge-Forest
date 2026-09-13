import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * AiWorks 的 Next.js 框架契约（next-standalone-v1）要求 standalone 输出。
   * 产物入口：.next/standalone/server.js（通过 --backend-output-dir / --backend-entry
   * 显式声明给部署探测器，不使用框架默认推断）。
   *
   * 本地预览：node .next/standalone/server.js
   */
  output: "standalone",
  images: { unoptimized: true },
};

export default nextConfig;
