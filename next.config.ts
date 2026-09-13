import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * AiWorks 的 Next.js 框架契约（next-standalone-v1）要求 standalone 输出：
   * 产物为 .next/standalone/server.js，由其 scf_bootstrap 启动为 HTTP 云函数。
   *
   * 注意：standalone 模式下本地预览请用
   *   node .next/standalone/server.js
   * 而不是 npm start。
   */
  output: "standalone",

  /** 静态导出模式下 next/image 必须关闭优化；standalone 下无副作用，提前置好避免切换时踩坑 */
  images: { unoptimized: true },
};

export default nextConfig;
