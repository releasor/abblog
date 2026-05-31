import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "通知 - billionaire",
  description: "查看你的通知和消息",
  robots: { index: false, follow: false },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
