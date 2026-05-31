import { vi } from "vitest";

// Mock the MariaDB adapter to prevent database connection at import time
vi.mock("@prisma/adapter-mariadb", () => ({
  PrismaMariaDb: class MockAdapter { constructor() {} },
}));

// Mock Prisma to prevent initialization errors when no database is available.
// Individual test files can override this with their own vi.mock("@/lib/prisma") calls.
vi.mock("@/lib/prisma", () => {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === "then") return undefined;
      return new Proxy({}, handler);
    },
  };
  return { prisma: new Proxy({}, handler) };
});

// Mock activity module to avoid prisma dependency
vi.mock("@/lib/activity", () => ({
  createActivity: vi.fn(),
}));
