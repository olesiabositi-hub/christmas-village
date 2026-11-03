import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "../audio";
import {
  BAD_TOYS, BUGS, checkRune, GOOD_TOYS, isStorm, makeSequence, NAV_COLS, NAV_FINISH, NAV_ROWS, NAV_START,
  PIPE_COLS, PIPE_DST, PIPE_ROWS, PIPE_SRC, powered, QA_TARGET, reachedFinish, rotate, RUNES, SINGERS, scrambledGrid, stepPath,
} from "./logic";

type GameProps = { onWin: () => void };

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-display text-[11px] uppercase tracking-[0.25em] text-parchment/60">{label}</span>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-2.5 w-6 rounded-full transition-all duration-500 ${i < done ? "bg-gold shadow-[0_0_10px_var(--gold)]" : "bg-parchment/15"}`} />
        ))}
      </div>
    </div>
  );
}

// ---------- 1. «Калибровка Списков» ----------
export function DebugGame({ onWin }: GameProps) {
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [fixed, setFixed] = useState(false);
  const bug = BUGS[i]!;
  const pick = (k: number) => {
    if (fixed) return;
    if (k !== bug.correct) { setWrong(k); sfx("crunch"); window.setTimeout(() => setWrong(null), 600); return; }
    setFixed(true); sfx("chime");
    window.setTimeout(() => {
      if (i + 1 >= BUGS.length) { onWin(); return; }
      setI(i + 1); setFixed(false);
    }, 1300);
  };
  return (
    <div className="space-y-5">
      <Progress done={i + (fixed ? 1 : 0)} total={BUGS.length} label="Исправлено багов" />
      <pre key={i} className="animate-card-in overflow-x-auto rounded-xl border border-[color:var(--flame)]/40 bg-night/80 p-5 font-mono text-[13px] leading-7 text-parchment/90 shadow-[0_0_40px_-10px_var(--flame)] md:text-sm">
        {bug.code.map((l, k) => (
          <div key={k} className={`rounded px-2 ${k === bug.bugLine ? (fixed ? "bg-[color:var(--flame)]/20 text-[color:var(--flame)]" : "animate-pulse bg-destructive/25 text-parchment") : ""}`}>
            <span className="mr-4 select-none text-parchment/30">{k + 1}</span>
            {k === bug.bugLine && fixed ? bug.fixed : l}
          </div>
        ))}
      </pre>
      <p className="font-body text-sm text-parchment/70">{fixed ? `✦ ${bug.explain}` : "Выбери магический патч, который исправит подсвеченную строку:"}</p>
      <div className="grid gap-3 md:grid-cols-3">
        {bug.options.map((o, k) => (
          <button
            key={o}
            onClick={() => pick(k)}
            className={`glass-card rounded-xl p-4 text-left font-mono text-xs text-parchment transition-all hover:-translate-y-1 hover:border-gold/60 ${wrong === k ? "animate-shake border-destructive" : ""} ${fixed && k === bug.correct ? "border-gold bg-gold/15" : ""}`}
          >
            <span className="mb-2 block font-display text-[10px] uppercase tracking-[0.25em] text-gold/80">Заклинание {k + 1}</span>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- 2. «Праздничный Хор» ----------
export function RuneGame({ onWin }: GameProps) {
  const [seq, setSeq] = useState(() => makeSequence(4, RUNES.length));
  const [flash, setFlash] = useState<number | null>(null);
  const [showing, setShowing] = useState(true);
  const [input, setInput] = useState<number[]>([]);
  const [msg, setMsg] = useState("Слушай, кто поёт по очереди…");
  const [beam, setBeam] = useState(false);
  const pos = useMemo(() => RUNES.map((_, k) => {
    const a = (k / RUNES.length) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(a) * 36, y: 50 + Math.sin(a) * 36 };
  }), []);
  useEffect(() => {
    setShowing(true); setInput([]); setMsg("Слушай, кто поёт по очереди…");
    const ids: number[] = [];
    seq.forEach((r, k) => {
      ids.push(window.setTimeout(() => { setFlash(r); sfx("chime"); }, 900 + k * 900));
      ids.push(window.setTimeout(() => setFlash(null), 900 + k * 900 + 550));
    });
    ids.push(window.setTimeout(() => { setShowing(false); setMsg("Твоя очередь! Повтори порядок певцов"); }, 900 + seq.length * 900));
    return () => ids.forEach(clearTimeout);
  }, [seq]);
  const click = (k: number) => {
    if (showing || beam) return;
    const next = [...input, k];
    const res = checkRune(seq, next);
    setFlash(k); window.setTimeout(() => setFlash(null), 250);
    if (res === "fail") { sfx("crunch"); setMsg("Хор сбился и хихикает! Слушай ещё раз…"); window.setTimeout(() => setSeq(makeSequence(4, RUNES.length)), 900); return; }
    sfx("chime");
    setInput(next);
    if (res === "win") { setBeam(true); setMsg("Браво! Праздничная песня спета!"); window.setTimeout(onWin, 1800); }
  };
  return (
    <div className="space-y-4">
      <Progress done={input.length} total={seq.length} label="Ноты" />
      <p className="font-body text-sm text-parchment/75">{msg}</p>
      <div className="relative mx-auto w-full max-w-[460px]">
        {beam && <div className="pointer-events-none absolute inset-0 animate-pulse rounded-3xl bg-gold/20 shadow-[0_0_80px_20px_var(--gold)]" />}
        <div className="relative grid grid-cols-3 gap-3">
          {SINGERS.map((r, k) => (
            <button
              key={r.e}
              onClick={() => click(k)}
              aria-label={r.name}
              className={`flex flex-col items-center rounded-2xl border px-2 py-3 transition-all duration-200 ${flash === k ? "-translate-y-2 scale-110 border-gold bg-gold/25 shadow-[0_0_40px_6px_var(--gold)]" : "border-parchment/15 bg-night/50 hover:bg-night/70"}`}
            >
              <span className={`text-4xl transition-transform ${flash === k ? "animate-bounce" : ""}`}>{r.e}</span>
              <span className="mt-1 font-display text-xs font-semibold text-parchment">{r.name}</span>
              <span className={`font-body text-[11px] ${flash === k ? "text-gold" : "text-parchment/40"}`}>{flash === k ? r.sound : "…"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- 3. «Конвейерный Хаос» ----------
type Toy = { id: number; e: string; bad: null | (typeof BAD_TOYS)[number]; state: "go" | "caught" | "oops" };
export function ConveyorGame({ onWin }: GameProps) {
  const [toys, setToys] = useState<Toy[]>([]);
  const [caught, setCaught] = useState(0);
  const [note, setNote] = useState("Лови бракованные игрушки! Нормальные — пропускай.");
  const nid = useRef(0);
  const won = useRef(false);
  useEffect(() => {
    let k = 0;
    const id = window.setInterval(() => {
      k++;
      const bad = k % 3 === 0 || Math.random() < 0.15 ? BAD_TOYS[Math.floor(Math.random() * BAD_TOYS.length)]! : null;
      const toy: Toy = { id: nid.current++, e: bad ? bad.e : GOOD_TOYS[Math.floor(Math.random() * GOOD_TOYS.length)]!, bad, state: "go" };
      setToys((t) => [...t.filter((x) => x.id > toy.id - 9), toy]);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const click = (t: Toy) => {
    if (t.state !== "go" || won.current) return;
    if (t.bad) {
      sfx("chime");
      setToys((all) => all.map((x) => (x.id === t.id ? { ...x, state: "caught" } : x)));
      setNote(`Брак пойман: ${t.bad.tag}!`);
      setCaught((c) => {
        const n = c + 1;
        if (n >= QA_TARGET) { won.current = true; window.setTimeout(onWin, 900); }
        return n;
      });
    } else {
      sfx("crunch");
      setToys((all) => all.map((x) => (x.id === t.id ? { ...x, state: "oops" } : x)));
      setNote("Эта игрушка в порядке — не трогай!");
    }
  };
  return (
    <div className="space-y-5">
      <Progress done={caught} total={QA_TARGET} label="Поймано брака" />
      <p className="font-body text-sm text-parchment/75">{note}</p>
      <div className="relative h-44 overflow-hidden rounded-2xl border border-gold/20 bg-night/60">
        <div className="animate-belt absolute inset-x-0 bottom-8 h-6 bg-[repeating-linear-gradient(90deg,var(--wood)_0_18px,var(--wood-dark)_18px_36px)]" />
        <div className="absolute inset-x-0 bottom-6 h-2 bg-night" />
        {toys.map((t) => (
          <button
            key={t.id}
            onClick={() => click(t)}
            aria-label={t.bad ? "Подозрительная игрушка" : "Игрушка"}
            className={`animate-conveyor absolute bottom-12 grid h-20 w-20 place-items-center text-5xl ${t.state === "caught" ? "pointer-events-none" : ""}`}
          >
            <span className={`relative transition-all duration-500 ${t.state === "caught" ? "-translate-y-24 scale-50 opacity-0" : ""} ${t.state === "oops" ? "animate-shake" : ""} ${t.bad?.fx === "glitch" ? "animate-glitch" : ""} ${t.bad?.fx === "flip" ? "inline-block -scale-y-100" : ""}`}>
              {t.bad?.fx === "wings" && <span className="absolute -left-5 -top-2 text-3xl">🪽</span>}
              {t.e}
              {t.bad?.fx === "wings" && <span className="absolute -right-5 -top-2 -scale-x-100 text-3xl">🪽</span>}
            </span>
          </button>
        ))}
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-night to-transparent" />
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-night to-transparent" />
      </div>
    </div>
  );
}

// ---------- 4. «Звездный Навигатор» ----------
export function NavigatorGame({ onWin }: GameProps) {
  const [path, setPath] = useState<[number, number][]>([NAV_START]);
  const [hit, setHit] = useState<string | null>(null);
  const done = reachedFinish(path);
  const click = (r: number, c: number) => {
    if (done) return;
    const next = stepPath(path, [r, c]);
    if (!next) {
      if (isStorm(r, c)) { setHit(`${r},${c}`); sfx("crunch"); setPath([NAV_START]); window.setTimeout(() => setHit(null), 700); }
      return;
    }
    sfx("chime");
    setPath(next);
    if (reachedFinish(next)) window.setTimeout(onWin, 1200);
  };
  const inPath = (r: number, c: number) => path.some((p) => p[0] === r && p[1] === c);
  const last = path[path.length - 1]!;
  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-parchment/75">
        Проложи маршрут саней по безопасным звёздам от <b className="text-gold">Старта</b> до <b className="text-gold">Финиша</b>. Красные зоны — метели: попадёшь — маршрут сбросится.
      </p>
      <div className="relative mx-auto grid w-full max-w-[560px] gap-2" style={{ gridTemplateColumns: `repeat(${NAV_COLS}, minmax(0, 1fr))` }}>
        {Array.from({ length: NAV_ROWS }, (_, r) =>
          Array.from({ length: NAV_COLS }, (_, c) => {
            const storm = isStorm(r, c), on = inPath(r, c);
            const start = r === NAV_START[0] && c === NAV_START[1], fin = r === NAV_FINISH[0] && c === NAV_FINISH[1];
            const isLast = last[0] === r && last[1] === c;
            return (
              <button
                key={`${r},${c}`}
                onClick={() => click(r, c)}
                aria-label={storm ? "Метель" : start ? "Старт" : fin ? "Финиш" : "Звезда"}
                className={`relative grid aspect-square place-items-center rounded-xl text-xl transition-all ${storm ? `bg-destructive/25 ${hit === `${r},${c}` ? "animate-shake bg-destructive/60" : ""}` : on ? "bg-gold/25 shadow-[0_0_18px_var(--gold)]" : "bg-night/50 hover:bg-parchment/10"}`}
              >
                {storm ? <span className="animate-spin-slow text-2xl opacity-80">🌀</span> : <span className={on ? "text-gold" : "text-parchment/50"}>{fin ? "🏁" : start ? "🛷" : "✦"}</span>}
                {isLast && !done && <span className="absolute inset-0 animate-ping rounded-xl border border-gold/60" />}
              </button>
            );
          }),
        )}
      </div>
      <p className="font-display text-xs uppercase tracking-[0.2em] text-gold/80">{done ? "Маршрут проложен! Сани взлетают ✦" : `Шагов: ${path.length - 1}`}</p>
    </div>
  );
}

// ---------- 5. «Отражение Атаки Гринча» ----------
function Cable({ kind, rot, lit }: { kind: "I" | "L"; rot: number; lit: boolean }) {
  const col = lit ? "var(--lime)" : "var(--cable)";
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full transition-transform duration-200" style={{ transform: `rotate(${rot * 90}deg)` }}>
      {kind === "I" ? <line x1="0" y1="50" x2="100" y2="50" stroke={col} strokeWidth="16" strokeLinecap="round" /> : <path d="M50 0 V50 H100" fill="none" stroke={col} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />}
      <circle cx="50" cy="50" r="10" fill={col} />
      {lit && <circle cx="50" cy="50" r="22" fill={col} opacity="0.25" />}
    </svg>
  );
}
export function CableGame({ onWin }: GameProps) {
  const [grid, setGrid] = useState(() => scrambledGrid());
  const { lit, done } = powered(grid);
  const fired = useRef(false);
  useEffect(() => { if (done && !fired.current) { fired.current = true; sfx("chime"); window.setTimeout(onWin, 1300); } }, [done, onWin]);
  const [attack, setAttack] = useState(0);
  useEffect(() => { const id = window.setInterval(() => setAttack((a) => (a + 7) % 100), 400); return () => clearInterval(id); }, []);
  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-parchment/75">Нажимай на кабели, чтобы поворачивать их на 90°. Собери непрерывную зелёную линию от Главного сервера до Радара!</p>
      <div className="flex items-center justify-center gap-2">
        <div className="flex flex-col items-center gap-1" style={{ marginTop: `${(PIPE_SRC - (PIPE_ROWS - 1) / 2) * 2 * 2.6}rem` }}>
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-[color:var(--lime)]/20 text-2xl shadow-[0_0_20px_var(--lime)]">🖥️</span>
          <span className="font-display text-[10px] uppercase tracking-widest text-parchment/60">Сервер</span>
        </div>
        <div className="grid gap-1 rounded-2xl bg-night/60 p-2" style={{ gridTemplateColumns: `repeat(${PIPE_COLS}, minmax(0, 1fr))` }}>
          {grid.map((row, r) => row.map((t, c) => (
            <button
              key={`${r},${c}`}
              onClick={() => { if (!done) { sfx("crunch"); setGrid((g) => rotate(g, r, c)); } }}
              aria-label="Повернуть кабель"
              className="h-14 w-14 rounded-lg bg-parchment/5 p-1 hover:bg-parchment/10 md:h-16 md:w-16"
            >
              <Cable kind={t.kind} rot={t.rot} lit={lit.has(`${r},${c}`)} />
            </button>
          )))}
        </div>
        <div className="flex flex-col items-center gap-1" style={{ marginTop: `${(PIPE_DST - (PIPE_ROWS - 1) / 2) * 2 * 2.6}rem` }}>
          <span className={`grid h-14 w-14 place-items-center rounded-xl text-2xl ${done ? "bg-[color:var(--lime)]/30 shadow-[0_0_30px_var(--lime)]" : "animate-pulse bg-destructive/25"}`}>📡</span>
          <span className="font-display text-[10px] uppercase tracking-widest text-parchment/60">Радар</span>
        </div>
      </div>
      <div className="mx-auto max-w-md">
        <div className="mb-1 flex justify-between font-display text-[10px] uppercase tracking-widest text-parchment/60">
          <span>DDoS Гринча</span><span>{done ? "Отражено ✦" : `${attack}%`}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-parchment/10">
          <div className={`h-full transition-all duration-300 ${done ? "bg-[color:var(--lime)]" : "bg-destructive"}`} style={{ width: done ? "100%" : `${attack}%` }} />
        </div>
      </div>
    </div>
  );
}
