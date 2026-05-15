import { PrismaClient } from "./generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

async function main() {
  const url = process.env.DATABASE_URL!;
  const adapter = new PrismaMariaDb(url);
  const prisma = new PrismaClient({ adapter });

  // Check post 1 tags
  const post1 = await prisma.post.findUnique({
    where: { id: 1 },
    include: {
      tags: { include: { tag: true } },
      category: true,
    },
  });
  console.log('Post 1 tags:', post1?.tags.map(t => t.tag.name));
  console.log('Post 1 category:', post1?.category?.name);
  console.log('Post 1 categoryId:', post1?.categoryId);

  // Check all posts
  const allPosts = await prisma.post.findMany({
    include: { tags: { include: { tag: true } } },
  });
  console.log('\nAll posts:');
  for (const p of allPosts) {
    console.log(`  ${p.id}: ${p.title} [${p.status}] tags: ${p.tags.map(t => t.tag.name).join(', ')}`);
  }

  // Test getRelatedPosts logic
  const tagIds = post1?.tags.map(t => t.tagId) || [];
  console.log('\ntagIds for post 1:', tagIds);

  const tagScoredPosts = tagIds.length > 0
    ? await prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          id: { not: 1 },
          tags: { some: { tagId: { in: tagIds } } },
        },
        include: {
          tags: { include: { tag: { select: { name: true } } } },
          _count: {
            select: {
              tags: { where: { tagId: { in: tagIds } } },
            },
          },
        },
      })
    : [];
  console.log('\nTag-scored posts:', tagScoredPosts.map(p => ({
    id: p.id,
    title: p.title,
    score: p._count.tags,
  })));

  await prisma.$disconnect();
}

main().catch(console.error);
