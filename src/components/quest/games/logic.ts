// Pure mini-game rules (no React). Tested in logic.test.ts.

// ---------- progress ----------
export const CAMPUS_IDS = ["office", "magic", "qa", "reindeer", "elfops"] as const;
export type CampusId = (typeof CAMPUS_IDS)[number];
const KEY = "santa-village-progress";
export function loadProgress(): CampusId[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is CampusId => (CAMPUS_IDS as readonly string[]).includes(x)) : [];
  } catch { return []; }
}
export function markComplete(prev: CampusId[], id: CampusId): CampusId[] {
  if (prev.includes(id)) return prev;
  const next = [...prev, id];
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}

// ---------- 1. Santa's office: debugging ----------
export type Bug = { code: string[]; bugLine: number; options: string[]; correct: number; fixed: string; explain: string };
export const BUGS: Bug[] = [
  {
    code: ["function pickGift(child) {", "  if (child.hasBadGrades)", "    return 'Brand New iPhone 17';", "  return 'Носки';", "}"],
    bugLine: 2,
    options: ["return 'Ещё два iPhone';", "return 'Учебник и тёплые носки';", "delete child;"],
    correct: 1,
    fixed: "    return 'Учебник и тёплые носки';",
    explain: "Двоечникам — учебник, а не флагман!",
  },
  {
    code: ["const nice = children.filter(c =>", "  c.goodDeeds < 0", ");", "deliver(nice);"],
    bugLine: 1,
    options: ["c.goodDeeds > 0", "c.goodDeeds === 'много'", "true || c.isGrinch"],
    correct: 0,
    fixed: "  c.goodDeeds > 0",
    explain: "Хорошие дети — те, у кого добрых дел больше нуля.",
  },
  {
    code: ["for (let i = 0; i <= gifts.length; i++) {", "  sleigh.load(gifts[i]);", "}"],
    bugLine: 0,
    options: ["i <= gifts.length + 1", "i < gifts.length", "i = gifts.length"],
    correct: 1,
    fixed: "for (let i = 0; i < gifts.length; i++) {",
    explain: "Off-by-one: в сани грузился несуществующий подарок.",
  },
];

// ---------- 2. Department of Magic: festive choir memory ----------
export const RUNES = ["⛄", "🦌", "🎅", "🍪", "🔔", "🧦"] as const;
export const SINGERS = [
  { e: "⛄", name: "Снеговик", sound: "Бррр-ля-ля!" },
  { e: "🦌", name: "Олень", sound: "Ту-ту-тууу!" },
  { e: "🎅", name: "Санта", sound: "Хо-хо-хо!" },
  { e: "🍪", name: "Пряник", sound: "Хрум-хрум!" },
  { e: "🔔", name: "Колокольчик", sound: "Дзинь-дзинь!" },
  { e: "🧦", name: "Носок", sound: "Шурх-шурх!" },
] as const;
export function makeSequence(len: number, n: number, rnd: () => number = Math.random): number[] {
  const out: number[] = [];
  while (out.length < len) {
    const k = Math.floor(rnd() * n);
    if (out[out.length - 1] !== k) out.push(k);
  }
  return out;
}
/** "ok" = correct so far, "win" = sequence finished, "fail" = wrong rune. */
export function checkRune(seq: number[], input: number[]): "ok" | "win" | "fail" {
  for (let i = 0; i < input.length; i++) if (input[i] !== seq[i]) return "fail";
  return input.length === seq.length ? "win" : "ok";
}

// ---------- 3. QA Gift: conveyor ----------
export const GOOD_TOYS = ["🧸", "🚂", "🪀", "🎁", "🪆", "🎄", "⛸️", "🥁"];
export const BAD_TOYS = [
  { e: "🧸", tag: "с крыльями дракона", fx: "wings" },
  { e: "🔮", tag: "глючащий неон", fx: "glitch" },
  { e: "🚂", tag: "колёса квадратные", fx: "flip" },
  { e: "🪀", tag: "раздвоился", fx: "glitch" },
  { e: "🎁", tag: "внутри Гринч", fx: "wings" },
] as const;
export const QA_TARGET = 3;

// ---------- 4. Reindeer Engineering: star navigator ----------
export const NAV_ROWS = 5;
export const NAV_COLS = 7;
export const NAV_START: [number, number] = [2, 0];
export const NAV_FINISH: [number, number] = [2, 6];
/** Storm cells, "r,c". */
export const NAV_STORMS = new Set(["1,1", "2,1", "3,1", "2,2", "0,3", "1,3", "2,3", "3,5", "2,5", "1,5", "4,3"]);
export const isStorm = (r: number, c: number) => NAV_STORMS.has(`${r},${c}`);
export const adjacent = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
/** Validates a step; returns the new path, or null if the step is illegal (storm / not adjacent). */
export function stepPath(path: [number, number][], cell: [number, number]): [number, number][] | null {
  if (isStorm(cell[0], cell[1])) return null;
  const last = path[path.length - 1]!;
  const idx = path.findIndex((p) => p[0] === cell[0] && p[1] === cell[1]);
  if (idx >= 0) return path.slice(0, idx + 1); // backtrack
  if (!adjacent(last, cell)) return null;
  return [...path, cell];
}
export const reachedFinish = (path: [number, number][]) => {
  const l = path[path.length - 1]!;
  return l[0] === NAV_FINISH[0] && l[1] === NAV_FINISH[1];
};
/** BFS: is the finish reachable at all (guards the level design). */
export function navSolvable() {
  const seen = new Set<string>([NAV_START.join(",")]);
  const q: [number, number][] = [NAV_START];
  while (q.length) {
    const [r, c] = q.shift()!;
    if (r === NAV_FINISH[0] && c === NAV_FINISH[1]) return true;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr!, nc = c + dc!, k = `${nr},${nc}`;
      if (nr < 0 || nc < 0 || nr >= NAV_ROWS || nc >= NAV_COLS || seen.has(k) || isStorm(nr, nc)) continue;
      seen.add(k); q.push([nr, nc]);
    }
  }
  return false;
}

// ---------- 5. ElfOps: cable rotation ----------
// Directions: 0=N 1=E 2=S 3=W. Tiles are "I" (straight) or "L" (corner); rotation = clockwise quarter turns.
export type Tile = { kind: "I" | "L"; rot: number };
export const PIPE_ROWS = 4;
export const PIPE_COLS = 5;
export function openings(t: Tile): number[] {
  const base = t.kind === "I" ? [1, 3] : [0, 1];
  return base.map((d) => (d + t.rot) % 4);
}
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
/** Source enters (srcRow, 0) from the West; target leaves (dstRow, last col) to the East. */
export const PIPE_SRC = 1;
export const PIPE_DST = 2;
export function powered(grid: Tile[][]): { lit: Set<string>; done: boolean } {
  const lit = new Set<string>();
  let r = PIPE_SRC, c = 0, from = 3;
  for (let guard = 0; guard < PIPE_ROWS * PIPE_COLS + 1; guard++) {
    const t = grid[r]?.[c];
    if (!t) return { lit, done: false };
    const o = openings(t);
    if (!o.includes(from)) return { lit, done: false };
    lit.add(`${r},${c}`);
    const out = o.find((d) => d !== from)!;
    if (r === PIPE_DST && c === PIPE_COLS - 1 && out === 1) return { lit, done: true };
    r += DR[out]!; c += DC[out]!; from = (out + 2) % 4;
    if (lit.has(`${r},${c}`)) return { lit, done: false };
  }
  return { lit, done: false };
}
/** Solution path cells; tiles on it are derived, others are filler. Then rotations are scrambled. */
export const PIPE_PATH: [number, number][] = [[1, 0], [1, 1], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 4]];
export function solvedGrid(): Tile[][] {
  const g: Tile[][] = Array.from({ length: PIPE_ROWS }, (_, r) => Array.from({ length: PIPE_COLS }, (_, c) => ({ kind: (r + c) % 2 ? "L" : "I", rot: (r * 3 + c) % 4 }) as Tile));
  PIPE_PATH.forEach(([r, c], i) => {
    const prev = i === 0 ? [r, c - 1] : PIPE_PATH[i - 1]!;
    const next = i === PIPE_PATH.length - 1 ? [r, c + 1] : PIPE_PATH[i + 1]!;
    const dirTo = (a: number[], b: number[]) => DR.findIndex((dr, k) => a[0]! + dr === b[0] && a[1]! + DC[k]! === b[1]);
    const din = dirTo([r, c], prev), dout = dirTo([r, c], next);
    const kind = (din + 2) % 4 === dout ? "I" : "L";
    let rot = 0;
    for (; rot < 4; rot++) { const o = openings({ kind, rot }); if (o.includes(din) && o.includes(dout)) break; }
    g[r]![c] = { kind, rot };
  });
  return g;
}
export function scrambledGrid(rnd: () => number = Math.random): Tile[][] {
  const g = solvedGrid().map((row) => row.map((t) => ({ ...t, rot: (t.rot + 1 + Math.floor(rnd() * 3)) % 4 })));
  return powered(g).done ? scrambledGrid(rnd) : g;
}
export const rotate = (g: Tile[][], r: number, c: number): Tile[][] =>
  g.map((row, i) => row.map((t, j) => (i === r && j === c ? { ...t, rot: (t.rot + 1) % 4 } : t)));

/** Грандиозный сундук открывается только после всех 5 кампусов. */
export function allComplete(p: readonly string[]): boolean {
  return CAMPUS_IDS.every((id) => p.includes(id));
}

// ---------- накопительный лутбокс: каждый кампус открывает элемент открытки ----------
export const CARD_PARTS: Record<CampusId, { label: string; icon: string }> = {
  office: { label: "Премиальный фон", icon: "🌌" },
  magic: { label: "3D-ёлка", icon: "🎄" },
  qa: { label: "Подпись 2ГИС", icon: "✍️" },
  reindeer: { label: "Олени и снегопад", icon: "🦌" },
  elfops: { label: "Золотая рамка", icon: "✨" },
};

export const VACANCIES_URL = "https://job.2gis.ru/vacancies?direction=development&direction=testing&direction=product_management&direction=analytics&direction=design&direction=information_security&direction=infrastructure_administration&direction=team_management&direction=data_science_ai&direction=project_management";
export const TELEGRAM_URL = "https://t.me/rnd2GIS";

/** Тост после победы: QA Gift и ElfOps ведут в Telegram, остальные — на вакансии. */
export function winMessage(id: CampusId): { text: string; url: string; cta: string } {
  if (id === "qa" || id === "elfops")
    return { text: "Системы защищены! Наши ИТ-эльфы ежедневно делятся инсайдами разработки, мемами и лайфхаками в Telegram-канале Dev2ГИС.", url: TELEGRAM_URL, cta: "Заглядывай в Telegram" };
  return { text: "Квест пройден! Кстати, мы в 2ГИС всегда ищем крутых инженеров, аналитиков и дизайнеров.", url: VACANCIES_URL, cta: "Посмотреть вакансии" };
}
