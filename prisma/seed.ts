import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcrypt";

const dbUrl = process.env.DATABASE_URL!.replace(/^mysql:\/\//, "mariadb://");
const adapter = new PrismaMariaDb(dbUrl);
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
    { name: "技术", slug: "technology", description: "技术动态与见解" },
    { name: "编程", slug: "programming", description: "编程教程与技巧" },
    { name: "生活", slug: "life", description: "生活与个人思考" },
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
    { name: "教程", slug: "tutorial" },
    { name: "技巧", slug: "tips" },
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
