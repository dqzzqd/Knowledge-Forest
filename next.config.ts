import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 当前为标准构建（产出 .next/），适配 AiWorks 的「上传工程包 → 云端构建」方式。
   *
   * 首页 / 在构建时即已预渲染为静态内容（见构建输出的 ○ Static），
   * 因此运行期不依赖 Node 逻辑，速度快且稳定。
   *
   * 若以后要部署到纯静态托管（CloudBase 静态网站托管等），
   * 取消下面两行的注释即可产出 out/ 目录：
   *
   *   output: "export",
   *   images: { unoptimized: true },
   */
};

export default nextConfig;
