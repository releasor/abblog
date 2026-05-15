# Context Snapshot — F-003: Post Management CRUD

## Section 1 — Feature Brief

### Feature Description

Build the complete blog post management system accessible from the admin panel. Create the following admin pages: /admin/posts (list view with table showing title, status, category, published date, actions), /admin/posts/new (create form), /admin/posts/[id]/edit (edit form). The post list page should support filtering by status (All, Draft, Published) and sorting by date. The create/edit form should include: title input, slug auto-generated from title (editable), content area using a rich text editor (use @tiptap/react with basic formatting: bold, italic, headings, links, code blocks, images via URL), excerpt textarea, cover image URL input, category dropdown (populated from Category model), tags multi-select (populated from Tag model), status toggle (Draft/Published). Create API routes: GET/POST /api/posts (list with pagination, create), GET/PUT/DELETE /api/posts/[id] (read, update, delete). Implement slug generation from title using a slugify utility. When status changes to PUBLISHED, set publishedAt to current timestamp. When a post is deleted, cascade-delete related comments and PostTag entries. Add a public page at /posts/[slug] that renders a single published post with its content, category, tags, and published date.

### Acceptance Criteria

- [ ] AC1: Given an authenticated admin, When they visit /admin/posts, Then a table of all posts is displayed with title, status, category, and published date columns
- [ ] AC2: Given an authenticated admin, When they create a new post with title 'My First Post' and status Published, Then the post appears in the list with slug 'my-first-post' and publishedAt is set
- [ ] AC3: Given an authenticated admin, When they edit an existing post's title and save, Then the slug updates accordingly and the changes are reflected in the list
- [ ] AC4: Given an authenticated admin, When they delete a post, Then the post and its associated comments and tags are removed from the database
- [ ] AC5: Given a published post exists, When a visitor navigates to /posts/[slug], Then the post content is rendered with title, content, category, tags, and published date
- [ ] AC6: Given a draft post exists, When a visitor navigates to /posts/[slug], Then a 404 page is shown
- [ ] AC7: Given the post list has 25 posts, When the admin views the list, Then pagination controls are shown and 10 posts per page are displayed
- [ ] AC8: Given the post create form, When the admin types a title, Then the slug field auto-populates with a URL-friendly version

## Section 2 — Project Structure

```
prizm-docs/
prisma/
public/
src/
  app/
    admin/
      (admin)/
        dashboard/
        layout.tsx
      login/
    api/
      auth/
    layout.tsx
    page.tsx
    providers.tsx
  components/
  lib/
    auth.ts
    prisma.ts
  middleware.ts
```

## Section 3 — Prizm Context

### root.prizm
PRIZM_VERSION: 1.0
PROJECT: KitTest
LANG: TypeScript
PROJECT_TYPE: fullstack
TECH_STACK: TypeScript, Next.js 16, Tailwind CSS v4, ESLint (personal blog, user-provided)
MODULE_INDEX:
- app [routing, pages, layout]: src/app/ — Next.js App Router pages and layouts
- auth [nextauth, login, middleware, session]: src/lib/auth.ts, middleware.ts — NextAuth.js authentication, route protection
- admin [dashboard, layout, sidebar]: src/app/admin/ — admin panel pages and layout with sidebar nav
- components [ui, react]: src/components/ — reusable UI components (empty, ready for use)
- lib [utils, helpers, prisma]: src/lib/ — utility functions and Prisma client singleton
- prisma [database, schema, seed]: prisma/ — database schema, migrations, and seed script

### admin.prizm
MODULE: admin
FILES: src/app/admin/layout.tsx, src/app/admin/login/page.tsx, src/app/admin/(admin)/dashboard/page.tsx
RESPONSIBILITY: admin panel UI — login page, sidebar navigation layout, dashboard placeholder
DEPENDENCIES:
- uses: next-auth/react: useSession, signIn, signOut client hooks
- imports: next/navigation: useRouter, usePathname

### prisma.prizm
MODULE: prisma
FILES: schema.prisma, seed.ts, prisma.config.ts
RESPONSIBILITY: database schema definition, migrations, seed data, and Prisma 7 configuration
DEPENDENCIES:
- uses: @prisma/client: Prisma ORM client
- uses: @prisma/adapter-mariadb: MariaDB driver adapter for MySQL compatibility
- uses: bcrypt: password hashing for seed data
- imports: generated/prisma/client: generated Prisma client types

## Section 4 — Existing Source Files

### prisma/schema.prisma
```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "mysql"
}

model AdminUser {
  id           Int       @id @default(autoincrement())
  email        String    @unique
  passwordHash String    @map("password_hash")
  name         String
  createdAt    DateTime  @default(now()) @map("created_at")

  posts Post[]

  @@map("admin_users")
}

model Post {
  id           Int       @id @default(autoincrement())
  title        String
  slug         String    @unique
  content      String    @db.LongText
  excerpt      String?
  coverImageUrl String?  @map("cover_image_url")
  status       PostStatus @default(DRAFT)
  publishedAt  DateTime? @map("published_at")
  authorId     Int       @map("author_id")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  author   AdminUser @relation(fields: [authorId], references: [id])
  tags     PostTag[]
  comments Comment[]

  @@map("posts")
}

enum PostStatus {
  DRAFT
  PUBLISHED
}

model Category {
  id          Int     @id @default(autoincrement())
  name        String  @unique
  slug        String  @unique
  description String?

  @@map("categories")
}

model Tag {
  id   Int    @id @default(autoincrement())
  name String @unique
  slug String @unique

  posts PostTag[]

  @@map("tags")
}

model PostTag {
  postId Int  @map("post_id")
  tagId  Int  @map("tag_id")

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@map("post_tags")
}

model Comment {
  id          Int           @id @default(autoincrement())
  postId      Int           @map("post_id")
  authorName  String        @map("author_name")
  authorEmail String        @map("author_email")
  content     String        @db.LongText
  status      CommentStatus @default(PENDING)
  createdAt   DateTime      @default(now()) @map("created_at")

  post Post @relation(fields: [postId], references: [id])

  @@map("comments")
}

enum CommentStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### src/lib/prisma.ts
```ts
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL!;
  const adapter = new PrismaMariaDb(url);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### src/lib/auth.ts
```ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const user = await prisma.adminUser.findUnique({
          where: { email: credentials.email },
        });
        if (!user) {
          return null;
        }
        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!isValid) {
          return null;
        }
        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
};
```

### src/middleware.ts
```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
  });

  if (!token) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

### src/app/layout.tsx
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KitTest",
  description: "A personal blog for developers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### src/app/page.tsx
```tsx
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        KitTest
      </h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        A personal blog for developers
      </p>
    </main>
  );
}
```

### src/app/providers.tsx
```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

### src/app/admin/(admin)/layout.tsx
```tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/comments", label: "Comments" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
      <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Admin Panel
          </h2>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              {session?.user?.name || "Admin"}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

### src/app/admin/(admin)/dashboard/page.tsx
```tsx
export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Dashboard
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome to the admin dashboard.
      </p>
    </div>
  );
}
```

### src/app/admin/login/page.tsx
```tsx
"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid credentials");
    } else {
      router.push("/admin/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8 text-zinc-900 dark:text-zinc-100">
          Admin Login
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Email
            </label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Password
            </label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500" />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2 px-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### src/app/api/auth/[...nextauth]/route.ts
```ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

### prisma/seed.ts
```ts
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

  console.log("Seed completed:", { admin: admin.email, categories: categories.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  )
  .finally(() => prisma.$disconnect());
```

## Section 5 — Existing Tests

No test files exist yet.

## Implementation Log

(TO BE FILLED AFTER IMPLEMENTATION)
