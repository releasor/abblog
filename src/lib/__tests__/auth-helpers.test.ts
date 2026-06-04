import { describe, it, expect } from "vitest";
import { getAuthUserId, getAuthUserRole, isAdmin, getAuthUsername } from "../auth-helpers";

// Use the same SessionLike type that auth-helpers accepts
type SessionLike = Parameters<typeof getAuthUserId>[0];

describe("getAuthUserId", () => {
  it("returns parsed user id", () => {
    expect(getAuthUserId({ user: { id: "42" } } as SessionLike)).toBe(42);
  });

  it("returns null when session is null", () => {
    expect(getAuthUserId(null)).toBeNull();
  });

  it("returns null when user is undefined", () => {
    expect(getAuthUserId({ user: undefined } as SessionLike)).toBeNull();
  });

  it("returns null when id is not a number", () => {
    expect(getAuthUserId({ user: { id: "abc" } } as SessionLike)).toBeNull();
  });

  it("returns null when id is missing", () => {
    expect(getAuthUserId({ user: {} } as SessionLike)).toBeNull();
  });
});

describe("getAuthUserRole", () => {
  it("returns role string", () => {
    expect(getAuthUserRole({ user: { role: "admin" } } as SessionLike)).toBe("admin");
  });

  it("returns null when session is null", () => {
    expect(getAuthUserRole(null)).toBeNull();
  });

  it("returns null when user has no role", () => {
    expect(getAuthUserRole({ user: {} } as SessionLike)).toBeNull();
  });
});

describe("isAdmin", () => {
  it("returns true for admin role", () => {
    expect(isAdmin({ user: { role: "admin" } } as SessionLike)).toBe(true);
  });

  it("returns false for non-admin role", () => {
    expect(isAdmin({ user: { role: "user" } } as SessionLike)).toBe(false);
  });

  it("returns false for null session", () => {
    expect(isAdmin(null)).toBe(false);
  });
});

describe("getAuthUsername", () => {
  it("returns username", () => {
    expect(getAuthUsername({ user: { username: "testuser" } } as SessionLike)).toBe("testuser");
  });

  it("returns null when session is null", () => {
    expect(getAuthUsername(null)).toBeNull();
  });

  it("returns null when username is missing", () => {
    expect(getAuthUsername({ user: {} } as SessionLike)).toBeNull();
  });
});
