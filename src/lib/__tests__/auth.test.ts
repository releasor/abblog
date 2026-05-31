import { vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getAuthUserId, getAuthUserRole, getAuthUsername } from "../auth";

describe("getAuthUserId", () => {
  it("returns null for null session", () => {
    expect(getAuthUserId(null)).toBeNull();
  });

  it("returns null for session without user", () => {
    expect(getAuthUserId({})).toBeNull();
  });

  it("returns null when user has no id", () => {
    expect(getAuthUserId({ user: {} })).toBeNull();
  });

  it("parses numeric id string", () => {
    expect(getAuthUserId({ user: { id: "42" } })).toBe(42);
  });

  it("returns null for non-numeric id", () => {
    expect(getAuthUserId({ user: { id: "abc" } })).toBeNull();
  });

  it("handles string numbers", () => {
    expect(getAuthUserId({ user: { id: "123" } })).toBe(123);
  });
});

describe("getAuthUserRole", () => {
  it("returns null for null session", () => {
    expect(getAuthUserRole(null)).toBeNull();
  });

  it("returns null for session without user", () => {
    expect(getAuthUserRole({})).toBeNull();
  });

  it("returns role when present", () => {
    expect(getAuthUserRole({ user: { role: "admin" } })).toBe("admin");
  });

  it("returns null when role is missing", () => {
    expect(getAuthUserRole({ user: {} })).toBeNull();
  });
});

describe("getAuthUsername", () => {
  it("returns null for null session", () => {
    expect(getAuthUsername(null)).toBeNull();
  });

  it("returns null for session without user", () => {
    expect(getAuthUsername({})).toBeNull();
  });

  it("returns username when present", () => {
    expect(getAuthUsername({ user: { username: "testuser" } })).toBe("testuser");
  });

  it("returns null when username is missing", () => {
    expect(getAuthUsername({ user: {} })).toBeNull();
  });

  it("returns null when username is undefined", () => {
    expect(getAuthUsername({ user: { username: undefined } })).toBeNull();
  });
});
