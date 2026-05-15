import { PrismaClient } from "./generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

async function main() {
  const url = process.env.DATABASE_URL!;
  const adapter = new PrismaMariaDb(url);
  const prisma = new PrismaClient({ adapter });

  // Update existing post 1 with tags and category
  await prisma.post.update({
    where: { id: 1 },
    data: {
      categoryId: 2, // Programming
      tags: {
        create: [
          { tagId: 3 }, // React
          { tagId: 2 }, // TypeScript
        ]
      }
    }
  });
  console.log('Updated post 1 with React + TypeScript tags');

  // Create post 2 with React tag
  const p2 = await prisma.post.create({
    data: {
      title: 'Getting Started with React',
      slug: 'getting-started-with-react',
      content: '<p>Learn the basics of React framework.</p>',
      excerpt: 'Learn the basics of React framework',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-05-14'),
      authorId: 1,
      categoryId: 2,
      tags: { create: [{ tagId: 3 }] } // React
    }
  });
  console.log('Created post 2:', p2.title);

  // Create post 3 with TypeScript tag
  const p3 = await prisma.post.create({
    data: {
      title: 'TypeScript Best Practices',
      slug: 'typescript-best-practices',
      content: '<p>Best practices for TypeScript development.</p>',
      excerpt: 'Best practices for TypeScript development',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-05-13'),
      authorId: 1,
      categoryId: 2,
      tags: { create: [{ tagId: 2 }] } // TypeScript
    }
  });
  console.log('Created post 3:', p3.title);

  // Create post 4 with React + TypeScript tags
  const p4 = await prisma.post.create({
    data: {
      title: 'React with TypeScript',
      slug: 'react-with-typescript',
      content: '<p>How to use React with TypeScript effectively.</p>',
      excerpt: 'How to use React with TypeScript effectively',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-05-12'),
      authorId: 1,
      categoryId: 2,
      tags: { create: [{ tagId: 3 }, { tagId: 2 }] } // React + TypeScript
    }
  });
  console.log('Created post 4:', p4.title);

  // Create post 5 with different category, no shared tags
  const p5 = await prisma.post.create({
    data: {
      title: 'My Travel Blog',
      slug: 'my-travel-blog',
      content: '<p>Adventures around the world.</p>',
      excerpt: 'Adventures around the world',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-05-11'),
      authorId: 1,
      categoryId: 3, // Life
      tags: { create: [{ tagId: 8 }] } // Tips
    }
  });
  console.log('Created post 5:', p5.title);

  await prisma.$disconnect();
}

main().catch(console.error);
