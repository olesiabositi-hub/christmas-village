import { describe, expect, it } from "vitest";
import { BUGS, checkRune, loadProgress, markComplete, navSolvable, powered, rotate, scrambledGrid, solvedGrid, stepPath, NAV_START, reachedFinish } from "./logic";

describe("mini-game rules", () => {
  it("santa's office has 3 bugs to fix, each with 3 options", () => {
    expect(BUGS).toHaveLength(3);
    BUGS.forEach((b) => expect(b.options).toHaveLength(3));
  });
  it("rune sequence: wrong rune fails, full sequence wins", () => {
    expect(checkRune([1, 2, 3, 4], [1, 2])).toBe("ok");
    expect(checkRune([1, 2, 3, 4], [1, 3])).toBe("fail");
    expect(checkRune([1, 2, 3, 4], [1, 2, 3, 4])).toBe("win");
  });
  it("navigator: storms block, finish is reachable", () => {
    expect(navSolvable()).toBe(true);
    expect(stepPath([NAV_START], [2, 1])).toBeNull(); // storm
    expect(stepPath([NAV_START], [2, 3])).toBeNull(); // not adjacent
    let p = [NAV_START];
    for (const c of [[3, 0], [4, 0], [4, 1], [4, 2], [3, 2], [3, 3], [3, 4], [2, 4], [1, 4], [0, 4], [0, 5], [0, 6], [1, 6], [2, 6]] as [number, number][]) {
      p = stepPath(p, c)!;
      expect(p).not.toBeNull();
    }
    expect(reachedFinish(p)).toBe(true);
  });
  it("cables: solved grid is powered, scrambled is not, rotating 4x restores", () => {
    expect(powered(solvedGrid()).done).toBe(true);
    const s = scrambledGrid();
    expect(powered(s).done).toBe(false);
    let g = s;
    for (let i = 0; i < 4; i++) g = rotate(g, 0, 0);
    expect(g[0]![0]!.rot).toBe(s[0]![0]!.rot);
  });
  it("completed campuses persist and never duplicate", () => {
    localStorage.clear();
    let p = markComplete([], "qa");
    p = markComplete(p, "qa");
    expect(p).toEqual(["qa"]);
    expect(loadProgress()).toEqual(["qa"]);
  });
});
