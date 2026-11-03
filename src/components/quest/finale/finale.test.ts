import { describe, expect, it } from "vitest";
import { WISHES, nextWish } from "./wishes";
import { allComplete } from "../games/logic";

describe("finale", () => {
  it("has exactly 100 unique wishes", () => {
    expect(WISHES.length).toBe(100);
    expect(new Set(WISHES).size).toBe(100);
  });
  it("next wish always differs from current", () => {
    for (let c = 0; c < 100; c++) for (const r of [0, 0.5, 0.999]) expect(nextWish(c, () => r)).not.toBe(c);
  });
  it("chest unlocks only after all 5 campuses", () => {
    expect(allComplete(["office", "magic", "qa", "reindeer"])).toBe(false);
    expect(allComplete(["office", "magic", "qa", "reindeer", "elfops"])).toBe(true);
  });
});

import { winMessage, TELEGRAM_URL, VACANCIES_URL } from "../games/logic";
describe("PR toast after quests", () => {
  it("QA Gift and ElfOps link to Telegram", () => {
    expect(winMessage("qa").url).toBe(TELEGRAM_URL);
    expect(winMessage("elfops").url).toBe("https://t.me/rnd2GIS");
  });
  it("other quests link to vacancies", () => {
    for (const id of ["office", "magic", "reindeer"] as const) expect(winMessage(id).url).toBe(VACANCIES_URL);
    expect(VACANCIES_URL).toContain("direction=data_science_ai");
  });
});
