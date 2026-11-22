import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 拍照识词：图片 base64 后可达数 MB，需高于 Server Action 默认的 1MB
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
