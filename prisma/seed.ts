import { PrismaClient } from "../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcrypt";

const url = process.env.DATABASE_URL!;
const adapter = new PrismaMariaDb(url);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@blog.com" },
    update: {},
    create: {
      email: "admin@blog.com",
      passwordHash,
      name: "Admin",
    },
  });

  const categories = [
    { name: "Technology", slug: "technology", description: "Tech news and insights" },
    { name: "Programming", slug: "programming", description: "Coding tutorials and tips" },
    { name: "Life", slug: "life", description: "Life and personal thoughts" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  const tags = [
    { name: "JavaScript", slug: "javascript" },
    { name: "TypeScript", slug: "typescript" },
    { name: "React", slug: "react" },
    { name: "Next.js", slug: "nextjs" },
    { name: "CSS", slug: "css" },
    { name: "Node.js", slug: "nodejs" },
    { name: "Tutorial", slug: "tutorial" },
    { name: "Tips", slug: "tips" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }

  console.log("Seed completed:", { admin: admin.email, categories: categories.length, tags: tags.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
