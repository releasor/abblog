import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site-url";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findFirst({
    where: { username },
    select: { name: true, bio: true, username: true, avatar: true },
  });

  if (!user) return { title: "用户不存在 - billionaire" };

  const description = user.bio || `${user.name} 的个人主页`;
  const url = absoluteUrl(`/u/${user.username}`);

  return {
    title: `${user.name} - billionaire`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${user.name} - billionaire`,
      description,
      url,
      type: "profile",
      siteName: "billionaire",
      images: user.avatar ? [{ url: user.avatar, alt: user.name }] : [],
    },
  };
}

export default function UserProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
