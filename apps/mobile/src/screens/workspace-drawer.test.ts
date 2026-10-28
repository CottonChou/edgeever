import { describe, expect, it } from "bun:test";
import { resolveDrawerDrag } from "./workspace-utils";

describe("WorkspaceDrawer resolution logic", () => {
  const drawerWidth = 320;

  it("opens when right swipe distance exceeds threshold (22%)", () => {
    // 22% of 320 = 70.4px
    const result = resolveDrawerDrag({
      translationX: 75,
      velocityX: 0,
      drawerWidth,
      isCurrentlyOpen: false,
    });
    expect(result).toBe(true);
  });

  it("does not open when right swipe distance is too small with low velocity", () => {
    const result = resolveDrawerDrag({
      translationX: 30,
      velocityX: 50,
      drawerWidth,
      isCurrentlyOpen: false,
    });
    expect(result).toBe(false);
  });

  it("opens on fast fling right even if distance is small", () => {
    const result = resolveDrawerDrag({
      translationX: 35,
      velocityX: 450,
      drawerWidth,
      isCurrentlyOpen: false,
    });
    expect(result).toBe(true);
  });

  it("closes when left swipe distance exceeds threshold (22%) while open", () => {
    // translationX is negative when dragging left
    const result = resolveDrawerDrag({
      translationX: -80,
      velocityX: 0,
      drawerWidth,
      isCurrentlyOpen: true,
    });
    // result = true means stay open, false means close
    expect(result).toBe(false);
  });

  it("stays open when left swipe distance is small with low velocity", () => {
    const result = resolveDrawerDrag({
      translationX: -20,
      velocityX: -50,
      drawerWidth,
      isCurrentlyOpen: true,
    });
    expect(result).toBe(true);
  });

  it("closes on fast flick left even if distance is small", () => {
    const result = resolveDrawerDrag({
      translationX: -25,
      velocityX: -400,
      drawerWidth,
      isCurrentlyOpen: true,
    });
    expect(result).toBe(false);
  });
});
