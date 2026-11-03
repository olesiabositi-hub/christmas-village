import { describe, expect, it } from "vitest";
import { angleDelta, isNightHour, PRESETS, resolvePhase, makeCounter, stepWalker, type Walker } from "./sim";

describe("world rules", () => {
  it("default mode follows the real clock", () => {
    expect(resolvePhase("auto", 7)).toBe("morning");
    expect(resolvePhase("auto", 13)).toBe("day");
    expect(resolvePhase("auto", 18)).toBe("evening");
    expect(resolvePhase("auto", 23)).toBe("night");
    expect(isNightHour(3)).toBe(true);
  });
  it("manual mode overrides the clock", () => {
    expect(resolvePhase("night", 13)).toBe("night");
    expect(resolvePhase("morning", 23)).toBe("morning");
  });
  it("aurora only fully on at night; windows brightest at night", () => {
    expect(PRESETS.night.aurora).toBe(1);
    expect(PRESETS.day.aurora).toBe(0);
    const g = Object.values(PRESETS).map((p) => p.glow);
    expect(Math.max(...g)).toBe(PRESETS.night.glow);
  });
  it("reindeer sneezes on every 3rd click", () => {
    const c = makeCounter(3);
    expect([c(), c(), c(), c(), c(), c()]).toEqual([false, false, true, false, false, true]);
  });
  it("turning takes about 0.5s, not a snap", () => {
    const w: Walker = { x: 0, z: 0, ry: 0, speed: 0, state: "walk", timer: 99, tx: 10, tz: 0, seed: 1 };
    stepWalker(w, 1 / 60, "elf", () => [10, 0]);
    expect(Math.abs(w.ry)).toBeLessThan(0.2);
    for (let i = 0; i < 30; i++) stepWalker(w, 1 / 60, "elf", () => [10, 0]);
    expect(Math.abs(angleDelta(w.ry, Math.PI / 2))).toBeLessThan(0.3);
  });
  it("walker accelerates smoothly", () => {
    const w: Walker = { x: 0, z: 0, ry: 0, speed: 0, state: "walk", timer: 99, tx: 0, tz: 10, seed: 1 };
    stepWalker(w, 1 / 60, "elf", () => [0, 10]);
    expect(w.speed).toBeGreaterThan(0);
    expect(w.speed).toBeLessThan(0.1);
  });
});

import { auroraWave, nextWeather, WEATHER_CYCLE } from "./sim";
describe("weather & aurora", () => {
  it("barometer cycles through 4 weathers and wraps", () => {
    expect(WEATHER_CYCLE).toHaveLength(4);
    let w = WEATHER_CYCLE[0]!;
    for (let i = 0; i < 4; i++) w = nextWeather(w);
    expect(w).toBe(WEATHER_CYCLE[0]);
    expect(nextWeather("snow")).toBe("storm");
  });
  it("aurora appears only sometimes, within 0..1", () => {
    let on = 0, off = 0;
    for (let t = 0; t < 45 * 40; t += 45) { const v = auroraWave(t + 22.5); if (v > 0.5) on++; else if (v === 0) off++; }
    expect(on).toBeGreaterThan(5);
    expect(off).toBeGreaterThan(5);
    expect(auroraWave(45 * 3)).toBeLessThanOrEqual(0.0001);
  });
});
