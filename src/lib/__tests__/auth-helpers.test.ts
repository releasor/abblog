import { describe, it, expect } from "vitest";
import { getAuthUserId, getAuthUserRole, isAdmin, getAuthUsername } from "../auth-helpers";

describe("getAuthUserId", () => {
  it("returns parsed user id", () => {
    expect(getAuthUserId({ user: { id: "42" } } as any)).toBe(42);
  });

  it("returns null when session is null", () => {
    expect(getAuthUserId(null)).toBeNull();
  });

  it("returns null when user is undefined", () => {
    expect(getAuthUserId({ user: undefined } as any)).toBeNull();
  });

  it("returns null when id is not a number", () => {
    expect(getAuthUserId({ user: { id: "abc" } } as any)).toBeNull();
  });

  it("returns null when id is missing", () => {
    expect(getAuthUserId({ user: {} } as any)).toBeNull();
  });
});

describe("getAuthUserRole", () => {
  it("returns role string", () => {
    expect(getAuthUserRole({ user: { role: "admin" } } as any)).toBe("admin");
  });

  it("returns null when session is null", () => {
    expect(getAuthUserRole(null)).toBeNull();
  });

  it("returns null when user has no role", () => {
    expect(getAuthUserRole({ user: {} } as any)).toBeNull();
  });
});

describe("isAdmin", () => {
  it("returns true for admin role", () => {
    expect(isAdmin({ user: { role: "admin" } } as any)).toBe(true);
  });

  it("returns false for non-admin role", () => {
    expect(isAdmin({ user: { role: "user" } } as any)).toBe(false);
  });

  it("returns false for null session", () => {
    expect(isAdmin(null)).toBe(false);
  });
});

describe("getAuthUsername", () => {
  it("returns username", () => {
    expect(getAuthUsername({ user: { username: "testuser" } } as any)).toBe("testuser");
  });

  it("returns null when session is null", () => {
    expect(getAuthUsername(null)).toBeNull();
  });

  it("returns null when username is missing", () => {
    expect(getAuthUsername({ user: {} } as any)).toBeNull();
  });
});
