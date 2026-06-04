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

  // Create a regular user for social features
  const user = await prisma.user.upsert({
    where: { email: "user@blog.com" },
    update: {},
    create: {
      email: "user@blog.com",
      passwordHash,
      name: "博主小明",
      username: "xiaoming",
      bio: "热爱技术，热爱生活。全栈开发者，开源爱好者。",
      points: 1200,
      level: 5,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "user2@blog.com" },
    update: {},
    create: {
      email: "user2@blog.com",
      passwordHash,
      name: "设计师小红",
      username: "xiaohong",
      bio: "UI/UX 设计师，关注前端技术与用户体验。",
      points: 800,
      level: 4,
    },
  });

  const categories = [
    { name: "技术", slug: "technology", description: "技术动态与见解" },
    { name: "编程", slug: "programming", description: "编程教程与技巧" },
    { name: "生活", slug: "life", description: "生活与个人思考" },
  ];

  const categoryRecords = [];
  for (const cat of categories) {
    const c = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    categoryRecords.push(c);
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

  const tagRecords = [];
  for (const tag of tags) {
    const t = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
    tagRecords.push(t);
  }

  // Create sample posts
  const samplePosts = [
    {
      title: "Next.js 15 新特性详解",
      slug: "nextjs-15-features",
      content: "<h2>Next.js 15 带来了许多令人兴奋的新特性</h2><p>包括 Turbopack 正式版、React Server Components 改进、新的缓存策略等。本文将详细介绍这些新特性及其使用方法。</p><h3>Turbopack</h3><p>Turbopack 是基于 Rust 的新一代打包工具，比 Webpack 快 10 倍以上。在 Next.js 15 中，Turbopack 已经成为默认的开发服务器。</p><h3>React Server Components</h3><p>Server Components 允许在服务器端渲染组件，减少客户端 JavaScript 体积，提升首屏加载速度。</p>",
      excerpt: "深入解析 Next.js 15 的新特性，包括 Turbopack、React Server Components 等。",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-05-20"),
      readingTime: 8,
      categoryId: categoryRecords[0]!.id,
    },
    {
      title: "TypeScript 高级类型技巧",
      slug: "typescript-advanced-types",
      content: "<h2>掌握 TypeScript 高级类型</h2><p>TypeScript 的类型系统非常强大，掌握高级类型技巧可以让你写出更安全、更优雅的代码。</p><h3>条件类型</h3><p>条件类型允许你根据条件选择类型，语法类似于三元运算符。</p><h3>映射类型</h3><p>映射类型可以基于已有类型创建新类型，非常适合用于工具类型。</p>",
      excerpt: "学习 TypeScript 的高级类型技巧，提升代码类型安全性。",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-05-18"),
      readingTime: 12,
      categoryId: categoryRecords[1]!.id,
    },
    {
      title: "React 性能优化实战",
      slug: "react-performance-optimization",
      content: "<h2>React 应用性能优化</h2><p>性能优化是前端开发的重要课题。本文将介绍 React 应用中常见的性能问题及解决方案。</p><h3>memo 和 useMemo</h3><p>使用 memo 包裹组件，useMemo 缓存计算结果，避免不必要的重新渲染。</p><h3>代码分割</h3><p>使用 React.lazy 和 Suspense 实现代码分割，减少初始加载体积。</p>",
      excerpt: "React 应用性能优化的实战技巧和最佳实践。",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-05-15"),
      readingTime: 10,
      categoryId: categoryRecords[0]!.id,
    },
    {
      title: "CSS Grid 布局完全指南",
      slug: "css-grid-complete-guide",
      content: "<h2>CSS Grid 布局</h2><p>CSS Grid 是最强大的 CSS 布局系统之一，可以轻松创建复杂的二维布局。</p><h3>基本概念</h3><p>Grid 布局由容器和项目组成，通过定义行和列来创建网格。</p><h3>实际案例</h3><p>本文将通过多个实际案例展示 Grid 布局的使用方法。</p>",
      excerpt: "CSS Grid 布局的完全指南，从基础到高级。",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-05-12"),
      readingTime: 15,
      categoryId: categoryRecords[0]!.id,
    },
    {
      title: "Node.js 微服务架构实践",
      slug: "nodejs-microservices",
      content: "<h2>Node.js 微服务架构</h2><p>微服务架构是现代应用开发的主流模式。本文将介绍如何使用 Node.js 构建微服务。</p><h3>服务拆分</h3><p>合理的服务拆分是微服务架构成功的关键。</p><h3>通信方式</h3><p>微服务之间的通信方式包括 REST、gRPC、消息队列等。</p>",
      excerpt: "使用 Node.js 构建微服务架构的实践经验。",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-05-10"),
      readingTime: 18,
      categoryId: categoryRecords[1]!.id,
    },
    {
      title: "程序员的周末时光",
      slug: "programmer-weekend",
      content: "<h2>程序员也需要休息</h2><p>工作之余，程序员也需要放松身心。分享我的周末生活方式。</p><h3>户外运动</h3><p>跑步、骑行、爬山，让身体动起来。</p><h3>阅读与学习</h3><p>除了技术书籍，也读一些文学、哲学类书籍。</p>",
      excerpt: "程序员如何利用周末时光放松身心。",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-05-08"),
      readingTime: 5,
      categoryId: categoryRecords[2]!.id,
    },
  ];

  const postRecords = [];
  for (const postData of samplePosts) {
    const existing = await prisma.post.findUnique({ where: { slug: postData.slug } });
    if (existing) {
      postRecords.push(existing);
    } else {
      const p = await prisma.post.create({
        data: {
          ...postData,
          authorId: admin.id,
          userId: user.id,
        },
      });
      postRecords.push(p);
    }
  }

  // Create Topics
  const topics = [
    { name: "前端开发", slug: "frontend", description: "HTML、CSS、JavaScript 及前端框架", postCount: 3, isHot: true },
    { name: "后端技术", slug: "backend", description: "Node.js、Python、数据库等后端技术", postCount: 2, isHot: true },
    { name: "React 生态", slug: "react-ecosystem", description: "React、Next.js 及相关生态", postCount: 2, isHot: true },
    { name: "TypeScript", slug: "typescript", description: "TypeScript 语言特性与最佳实践", postCount: 1, isHot: false },
    { name: "CSS 艺术", slug: "css-art", description: "CSS 布局、动画与视觉效果", postCount: 1, isHot: false },
    { name: "开发者生活", slug: "dev-life", description: "程序员的工作与生活", postCount: 1, isHot: false },
    { name: "开源项目", slug: "open-source", description: "优秀的开源项目推荐", postCount: 0, isHot: false },
    { name: "AI 与编程", slug: "ai-coding", description: "AI 辅助编程与智能工具", postCount: 0, isHot: true },
  ];

  const topicRecords = [];
  for (const topicData of topics) {
    const t = await prisma.topic.upsert({
      where: { slug: topicData.slug },
      update: { postCount: topicData.postCount, isHot: topicData.isHot },
      create: topicData,
    });
    topicRecords.push(t);
  }

  // Link posts to topics
  const topicPostLinks = [
    { topicIdx: 0, postIdx: 0 }, // 前端开发 → Next.js 15
    { topicIdx: 0, postIdx: 2 }, // 前端开发 → React 性能优化
    { topicIdx: 0, postIdx: 3 }, // 前端开发 → CSS Grid
    { topicIdx: 1, postIdx: 4 }, // 后端技术 → Node.js 微服务
    { topicIdx: 2, postIdx: 0 }, // React 生态 → Next.js 15
    { topicIdx: 2, postIdx: 2 }, // React 生态 → React 性能优化
    { topicIdx: 3, postIdx: 1 }, // TypeScript → TS 高级类型
    { topicIdx: 4, postIdx: 3 }, // CSS 艺术 → CSS Grid
    { topicIdx: 5, postIdx: 5 }, // 开发者生活 → 程序员周末
  ];
  for (const link of topicPostLinks) {
    const topic = topicRecords[link.topicIdx];
    const post = postRecords[link.postIdx];
    if (topic && post) {
      await prisma.topicPost.upsert({
        where: { topicId_postId: { topicId: topic.id, postId: post.id } },
        update: {},
        create: { topicId: topic.id, postId: post.id },
      });
    }
  }

  // Create Series
  const seriesData = [
    {
      name: "Next.js 全栈开发",
      slug: "nextjs-fullstack",
      description: "从零开始学习 Next.js 全栈开发，涵盖路由、数据获取、部署等核心概念。",
      userId: user.id,
      postIndices: [0, 2],
    },
    {
      name: "前端性能优化",
      slug: "frontend-performance",
      description: "系统学习前端性能优化技巧，让你的网站飞起来。",
      userId: user.id,
      postIndices: [2, 3],
    },
    {
      name: "TypeScript 进阶",
      slug: "typescript-advanced",
      description: "深入学习 TypeScript 高级特性，写出更安全的代码。",
      userId: user.id,
      postIndices: [1],
    },
  ];

  for (const seriesInfo of seriesData) {
    const existing = await prisma.postSeries.findUnique({ where: { slug: seriesInfo.slug } });
    if (!existing) {
      const series = await prisma.postSeries.create({
        data: {
          name: seriesInfo.name,
          slug: seriesInfo.slug,
          description: seriesInfo.description,
          userId: seriesInfo.userId,
        },
      });
      for (let i = 0; i < seriesInfo.postIndices.length; i++) {
        const postIndex = seriesInfo.postIndices[i];
        const post = postIndex !== undefined ? postRecords[postIndex] : undefined;
        if (post) {
          await prisma.seriesPost.create({
            data: { seriesId: series.id, postId: post.id, order: i + 1 },
          });
        }
      }
    }
  }

  // Create Groups
  const groupsData = [
    {
      name: "前端工程师",
      slug: "frontend-engineers",
      description: "前端开发技术交流，分享 React、Vue、Angular 等框架的使用经验。",
      ownerId: user.id,
      memberCount: 2,
    },
    {
      name: "全栈开发者",
      slug: "fullstack-developers",
      description: "全栈开发技术讨论，前后端通吃。",
      ownerId: user.id,
      memberCount: 2,
    },
    {
      name: "开源贡献者",
      slug: "open-source-contributors",
      description: "开源项目交流与合作，一起为开源社区做贡献。",
      ownerId: user2.id,
      memberCount: 1,
    },
    {
      name: "设计师与开发者",
      slug: "designers-developers",
      description: "设计师与开发者协作交流，探讨设计与技术的融合。",
      ownerId: user2.id,
      memberCount: 2,
    },
  ];

  const groupRecords = [];
  for (const groupData of groupsData) {
    const existing = await prisma.group.findUnique({ where: { slug: groupData.slug } });
    if (existing) {
      groupRecords.push(existing);
    } else {
      const g = await prisma.group.create({
        data: {
          name: groupData.name,
          slug: groupData.slug,
          description: groupData.description,
          ownerId: groupData.ownerId,
        },
      });
      // Add owner as admin member
      await prisma.groupMember.create({
        data: { groupId: g.id, userId: groupData.ownerId, role: "ADMIN" },
      });
      // Add other members
      if (groupData.memberCount > 1) {
        const otherUser = groupData.ownerId === user.id ? user2 : user;
        await prisma.groupMember.create({
          data: { groupId: g.id, userId: otherUser.id, role: "MEMBER" },
        });
      }
      groupRecords.push(g);
    }
  }

  // Link posts to groups
  const groupPostLinks = [
    { groupIdx: 0, postIdx: 0 }, // 前端工程师 → Next.js 15
    { groupIdx: 0, postIdx: 2 }, // 前端工程师 → React 性能优化
    { groupIdx: 0, postIdx: 3 }, // 前端工程师 → CSS Grid
    { groupIdx: 1, postIdx: 0 }, // 全栈开发者 → Next.js 15
    { groupIdx: 1, postIdx: 4 }, // 全栈开发者 → Node.js 微服务
    { groupIdx: 3, postIdx: 3 }, // 设计师与开发者 → CSS Grid
  ];
  for (const link of groupPostLinks) {
    const group = groupRecords[link.groupIdx];
    const post = postRecords[link.postIdx];
    if (group && post) {
      await prisma.groupPost.upsert({
        where: { groupId_postId: { groupId: group.id, postId: post.id } },
        update: {},
        create: { groupId: group.id, postId: post.id },
      });
    }
  }

  // Create Activities
  const p0 = postRecords[0]!, p1 = postRecords[1]!, p2 = postRecords[2]!, p3 = postRecords[3]!, p4 = postRecords[4]!, p5 = postRecords[5]!;
  const activitiesData = [
    { userId: user.id, type: "POST_PUBLISHED" as const, targetId: p0.id, metadata: JSON.stringify({ title: p0.title }) },
    { userId: user.id, type: "POST_PUBLISHED" as const, targetId: p1.id, metadata: JSON.stringify({ title: p1.title }) },
    { userId: user.id, type: "POST_PUBLISHED" as const, targetId: p2.id, metadata: JSON.stringify({ title: p2.title }) },
    { userId: user2.id, type: "LIKE_ADDED" as const, targetId: p0.id, metadata: JSON.stringify({ title: p0.title }) },
    { userId: user2.id, type: "BOOKMARK_ADDED" as const, targetId: p1.id, metadata: JSON.stringify({ title: p1.title }) },
    { userId: user.id, type: "POST_PUBLISHED" as const, targetId: p3.id, metadata: JSON.stringify({ title: p3.title }) },
    { userId: user2.id, type: "FOLLOW_USER" as const, targetId: user.id, metadata: JSON.stringify({ name: user.name }) },
    { userId: user.id, type: "POST_PUBLISHED" as const, targetId: p4.id, metadata: JSON.stringify({ title: p4.title }) },
    { userId: user.id, type: "POST_PUBLISHED" as const, targetId: p5.id, metadata: JSON.stringify({ title: p5.title }) },
    { userId: user2.id, type: "COMMENT_ADDED" as const, targetId: p0.id, metadata: JSON.stringify({ title: p0.title }) },
  ];

  // Only create activities if none exist
  const activityCount = await prisma.activity.count();
  if (activityCount === 0) {
    for (const activityData of activitiesData) {
      await prisma.activity.create({ data: activityData });
    }
  }

  console.log("Seed completed:", {
    admin: admin.email,
    user: user.email,
    user2: user2.email,
    categories: categoryRecords.length,
    tags: tagRecords.length,
    posts: postRecords.length,
    topics: topicRecords.length,
    series: seriesData.length,
    groups: groupRecords.length,
    activities: activitiesData.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
