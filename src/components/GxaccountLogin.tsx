"use client";

import { LogIn } from "lucide-react";

export const GxaccountLogin = () => {
  const handleLogin = () => {
    // 获取当前页面作为登录后跳转回的地址
    const currentPath = window.location.pathname;
    const back = encodeURIComponent(currentPath);

    // 跳转到广学账号登录页
    window.location.href = `/api/auth/login?back=${back}`;
  };

  return (
    <button
      onClick={handleLogin}
      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors mx-auto"
    >
      <LogIn className="w-5 h-5" />
      使用广学账号登录
    </button>
  );
};
