// Pure world rules: no React, no three.js.

export type Weather = "clear" | "calm" | "snow" | "storm";
/** Barometer turns clockwise through these, then wraps around. */
export const WEATHER_CYCLE: Weather[] = ["clear", "calm", "snow", "storm"];
export const WEATHER_LABEL: Record<Weather, string> = { clear: "☀ Ясно и морозно", calm: "✦ Звёздный штиль", snow: "❄ Пушистый снегопад", storm: "🌨 Снежная буря" };
/** How much snow falls (0..1) for each weather. */
export const SNOW_AMOUNT: Record<Weather, number> = { clear: 0, calm: 0.35, snow: 0.85, storm: 1 };
export function nextWeather(w: Weather): Weather {
  return WEATHER_CYCLE[(WEATHER_CYCLE.indexOf(w) + 1) % WEATHER_CYCLE.length]!;
}

/** Aurora appears now and then: time is split into 45 s windows; ~half of them hold a soft
 *  rise-and-fade episode. Pure and deterministic for a given seed so it can be tested. */
export function auroraWave(t: number, seed = 1): number {
  const W = 45;
  const k = Math.floor(t / W);
  const h = Math.abs(Math.sin((k + 1) * 12.9898 * seed + 78.233) * 43758.5453) % 1;
  if (h < 0.45) return 0;
  const u = (t - k * W) / W;
  return Math.pow(Math.sin(Math.PI * u), 2);
}
export type TimeMode = "auto" | "morning" | "day" | "evening" | "night";
export type Phase = Exclude<TimeMode, "auto">;
/** Live values, eased toward the active preset each frame by the scene. glow scales windows/bulbs, aurora 0..1. */
export const world = { weather: "calm" as Weather, night: true, phase: "night" as Phase, glow: 1.4, aurora: 1 };

export const TIME_LABELS: Record<TimeMode, string> = {
  auto: "По умолчанию", morning: "Утро", day: "День", evening: "Вечер", night: "Ночь",
};

/** Real clock → phase: 6–10 morning, 10–17 day, 17–20 evening, else night. */
export function phaseForHour(h: number): Phase {
  if (h >= 6 && h < 10) return "morning";
  if (h >= 10 && h < 17) return "day";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}
export function resolvePhase(mode: TimeMode, hour: number): Phase {
  return mode === "auto" ? phaseForHour(hour) : mode;
}

export type Preset = {
  sky: string; fog: string; hemiSky: string; hemiGround: string; hemi: number; ambient: number;
  sun: string; sunI: number; sunPos: [number, number, number]; glow: number; aurora: number; stars: number;
};
export const PRESETS: Record<Phase, Preset> = {
  morning: { sky: "#d9a7b8", fog: "#e8bfcb", hemiSky: "#ffd6e2", hemiGround: "#8a7aa0", hemi: 1.3, ambient: 0.4, sun: "#ffc28a", sunI: 1.8, sunPos: [14, 4, 8], glow: 0.6, aurora: 0, stars: 0.2 },
  day: { sky: "#9cc7ef", fog: "#cfe2f5", hemiSky: "#eaf2ff", hemiGround: "#3a5aa0", hemi: 1.0, ambient: 0.3, sun: "#ffffff", sunI: 1.9, sunPos: [6, 16, 6], glow: 0.25, aurora: 0, stars: 0 },
  evening: { sky: "#5a3046", fog: "#b0684a", hemiSky: "#ffb27a", hemiGround: "#3a2440", hemi: 0.95, ambient: 0.3, sun: "#ff8a3a", sunI: 1.4, sunPos: [-16, 3, -6], glow: 1.1, aurora: 0.15, stars: 0.5 },
  night: { sky: "#0b1330", fog: "#16214a", hemiSky: "#5d78c9", hemiGround: "#1a1630", hemi: 0.75, ambient: 0.18, sun: "#9fb8ff", sunI: 1.2, sunPos: [-8, 14, -6], glow: 1.6, aurora: 1, stars: 1 },
};

/** Night = 18:00..06:59 local time. */
export function isNightHour(hour: number) {
  return phaseForHour(hour) === "night";
}

// ---------- character state machine ----------
export type CharState = "walk" | "idle" | "action";
export type Walker = {
  x: number; z: number; ry: number; speed: number;
  state: CharState; timer: number; tx: number; tz: number;
  seed: number;
};
export const FEEL = {
  elf: { max: 0.9, accel: 2.2, idle: [1.2, 3], action: [1.5, 3.5], walk: [2.5, 6] },
  reindeer: { max: 0.35, accel: 0.9, idle: [3, 6], action: [3, 6], walk: [2, 4] },
  gnome: { max: 0.5, accel: 1.2, idle: [1.5, 3.5], action: [2, 4.5], walk: [3, 7] },
  turnTime: 0.5,
} as const;

let s = 1;
export function rand(seed?: number) {
  if (seed !== undefined) s = seed;
  s = (s * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}
const between = (r: readonly [number, number]) => r[0] + rand() * (r[1] - r[0]);

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function stepWalker(w: Walker, dt: number, kind: "elf" | "gnome" | "reindeer", pickTarget: () => [number, number]) {
  const f = FEEL[kind];
  w.timer -= dt;
  if (w.timer <= 0) {
    const r = rand();
    if (w.state === "walk") { w.state = r < 0.6 ? "idle" : "action"; w.timer = between(w.state === "idle" ? f.idle : f.action); }
    else { w.state = "walk"; w.timer = between(f.walk); [w.tx, w.tz] = pickTarget(); }
  }
  const dx = w.tx - w.x, dz = w.tz - w.z, dist = Math.hypot(dx, dz);
  if (w.state === "walk" && dist < 0.15) { [w.tx, w.tz] = pickTarget(); }
  const want = w.state === "walk" ? Math.min(f.max, dist * 1.5) : 0;
  // smooth accelerate / decelerate
  w.speed += (want - w.speed) * (1 - Math.exp(-f.accel * dt));
  if (w.state === "walk" && dist > 0.01) {
    const target = Math.atan2(dx, dz);
    // reach heading in ~turnTime
    w.ry += angleDelta(w.ry, target) * (1 - Math.exp((-dt / FEEL.turnTime) * 4));
  }
  w.x += Math.sin(w.ry) * w.speed * dt;
  w.z += Math.cos(w.ry) * w.speed * dt;
}

// ---------- easter eggs ----------
export const SECRETS = [
  { id: "spirit", name: "Почтовый дух", hint: "Загляни в почтовый ящик" },
  { id: "sneeze", name: "Чих оленя", hint: "Олени не любят щекотку…" },
  { id: "ticket", name: "Золотой билет", hint: "Звезда на ёлке хранит тайну" },
  { id: "key", name: "Пряничный ключ", hint: "Постучи в пряничную пекарню" },
] as const;
export type SecretId = (typeof SECRETS)[number]["id"];
const KEY = "santa-village-secrets";

export function loadSecrets(): SecretId[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
const listeners = new Set<(s: SecretId[]) => void>();
export function onSecrets(fn: (s: SecretId[]) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function unlockSecret(id: SecretId) {
  const cur = loadSecrets();
  if (cur.includes(id)) return false;
  const next = [...cur, id];
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l(next));
  return true;
}

/** Counts clicks; returns true every `n`-th click. */
export function makeCounter(n: number) {
  let c = 0;
  return () => { c = (c + 1) % n; return c === 0; };
}
