import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 纯静态导出：构建产物是 out/ 目录下的 HTML/JS/CSS/JSON，
   * 不需要 Node 服务端。部署到任意静态托管即可，演示时也无服务端可挂。
   *
   * 代价：不能使用 Route Handlers / Server Actions / 动态渲染。
   * 本项目的 AI 结果均为预生成数据，反馈信号计划存 localStorage，
   * 因此不需要服务端。
   */
  output: "export",

  /** 静态导出模式下 next/image 必须关闭优化（否则构建报错） */
  images: { unoptimized: true },
};

export default nextConfig;
