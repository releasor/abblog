import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findFirst({
    where: { username },
    select: { name: true, bio: true },
  });

  if (!user) return { title: "用户不存在 - billionaire" };

  return {
    title: `${user.name} - billionaire`,
    description: user.bio || `${user.name} 的个人主页`,
  };
}

export default function UserProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
