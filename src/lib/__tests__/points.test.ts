import { vi } from "vitest";
// Mock prisma before importing points
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getLevelForPoints, getLevelName, getProgressToNextLevel, POINTS, LEVELS } from "../points";

describe("getLevelForPoints", () => {
  it("returns level 1 for 0 points", () => {
    expect(getLevelForPoints(0)).toBe(1);
  });

  it("returns level 1 for points below first threshold", () => {
    expect(getLevelForPoints(49)).toBe(1);
  });

  it("returns level 2 at exactly 50 points", () => {
    expect(getLevelForPoints(50)).toBe(2);
  });

  it("returns level 3 at 150 points", () => {
    expect(getLevelForPoints(150)).toBe(3);
  });

  it("returns max level for very high points", () => {
    expect(getLevelForPoints(99999)).toBe(LEVELS[LEVELS.length - 1].level);
  });

  it("returns correct level for intermediate values", () => {
    expect(getLevelForPoints(100)).toBe(2);
    expect(getLevelForPoints(400)).toBe(4);
    expect(getLevelForPoints(800)).toBe(5);
  });
});

describe("getLevelName", () => {
  it("returns '新手' for level 1", () => {
    expect(getLevelName(1)).toBe("新手");
  });

  it("returns '专家' for level 5", () => {
    expect(getLevelName(5)).toBe("专家");
  });

  it("returns '新手' for unknown level", () => {
    expect(getLevelName(99)).toBe("新手");
  });

  it("returns correct name for each level", () => {
    expect(getLevelName(2)).toBe("见习");
    expect(getLevelName(3)).toBe("进阶");
    expect(getLevelName(4)).toBe("资深");
    expect(getLevelName(6)).toBe("大师");
    expect(getLevelName(7)).toBe("宗师");
    expect(getLevelName(8)).toBe("传说");
  });
});

describe("getProgressToNextLevel", () => {
  it("returns 0% progress at level start", () => {
    const result = getProgressToNextLevel(50);
    expect(result.current).toBe(50);
    expect(result.next).toBe(150);
    expect(result.progress).toBe(0);
  });

  it("returns 100% at max level", () => {
    const maxLevel = LEVELS[LEVELS.length - 1];
    const result = getProgressToNextLevel(maxLevel.minPoints + 1000);
    expect(result.progress).toBe(100);
  });

  it("calculates correct progress percentage", () => {
    const result = getProgressToNextLevel(100); // 50 of 100 range between level 2 (50) and level 3 (150)
    expect(result.progress).toBe(50);
  });

  it("clamps progress at 100", () => {
    const maxLevel = LEVELS[LEVELS.length - 1];
    const result = getProgressToNextLevel(maxLevel.minPoints);
    expect(result.progress).toBeLessThanOrEqual(100);
  });
});

describe("POINTS constants", () => {
  it("has all expected point values", () => {
    expect(POINTS.POST_PUBLISHED).toBe(10);
    expect(POINTS.COMMENT).toBe(2);
    expect(POINTS.LIKE_RECEIVED).toBe(1);
    expect(POINTS.BOOKMARK_RECEIVED).toBe(1);
    expect(POINTS.FOLLOWER_GAINED).toBe(3);
    expect(POINTS.DONATION_RECEIVED).toBe(5);
  });
});
