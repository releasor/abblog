import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "登录 - billionaire",
  description: "登录你的 billionaire 账号",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
