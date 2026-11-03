import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import office1 from "@/assets/quests/office-1.webp";
import magic1 from "@/assets/quests/magic-1.webp";
import magic2 from "@/assets/quests/magic-2.webp";
import qa1 from "@/assets/quests/qa-1.webp";
import qa2 from "@/assets/quests/qa-2.webp";
import rd1 from "@/assets/quests/reindeer-1.webp";
import rd2 from "@/assets/quests/reindeer-2.webp";
import ops1 from "@/assets/quests/elfops-1.webp";
import ops2 from "@/assets/quests/elfops-2.webp";
import type { QuestLocation } from "./locations";
import type { CampusId } from "./games/logic";
import { CableGame, ConveyorGame, DebugGame, NavigatorGame, RuneGame } from "./games/Games";
import { sfx } from "./audio";

type FxKind = "embers-green" | "dust-gold" | "bubbles" | "sparks" | "screens";
const CAMPUS: Record<CampusId, { title: string; bg: string[]; fx: FxKind[]; tint: string; rules: string; Game: (p: { onWin: () => void }) => ReactNode }> = {
  office: { title: "Калибровка Списков", bg: [office1], fx: ["embers-green", "dust-gold"], tint: "from-night/40 via-night/30 to-night/85", rules: "В базу Санты пробрались баги. Исправь 3 ошибки магическими патчами.", Game: DebugGame },
  magic: { title: "Праздничный Хор", bg: [magic1, magic2], fx: ["dust-gold", "bubbles"], tint: "from-night/40 via-night/30 to-night/85", rules: "Снеговик, олень, Санта и компания репетируют рождественскую песню. Запомни, кто поёт по очереди, и повтори — иначе хор собьётся!", Game: RuneGame },
  qa: { title: "Конвейерный Хаос", bg: [qa1, qa2], fx: ["dust-gold"], tint: "from-night/30 via-night/25 to-night/85", rules: "Игрушки едут по конвейеру. Кликни 3 бракованные — нормальные пропускай.", Game: ConveyorGame },
  reindeer: { title: "Звездный Навигатор", bg: [rd1, rd2], fx: ["sparks", "screens"], tint: "from-night/40 via-night/30 to-night/85", rules: "Проведи сани от старта до финиша по безопасным звёздам, обходя метели.", Game: NavigatorGame },
  elfops: { title: "Отражение Атаки Гринча", bg: [ops1, ops2], fx: ["screens", "sparks"], tint: "from-night/40 via-night/30 to-night/85", rules: "Гринч устроил DDoS! Поверни кабели и соедини Главный сервер с радаром.", Game: CableGame },
};

function Particles({ kind }: { kind: FxKind }) {
  const items = useMemo(() => Array.from({ length: kind === "screens" ? 0 : 26 }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 91.7 + n * 13.1) + 1) / 2);
    return { left: r(1) * 100, bottom: r(2) * (kind === "dust-gold" ? 90 : 25), size: 2 + r(3) * (kind === "bubbles" ? 14 : 5), dur: 4 + r(4) * 7, delay: -r(5) * 10, dx: (r(6) - 0.5) * 120 };
  }), [kind]);
  if (kind === "screens") return <div className="fx-scan absolute inset-0 opacity-60 mix-blend-screen" />;
  const color: Record<string, string> = { "embers-green": "var(--flame)", "dust-gold": "var(--star)", bubbles: "var(--rune)", sparks: "var(--lime)" };
  return (
    <>
      {items.map((p, i) => (
        <span
          key={i}
          className="fx-particle"
          style={{
            left: `${p.left}%`, bottom: `${p.bottom}%`, width: p.size, height: p.size,
            background: kind === "bubbles" ? "transparent" : color[kind],
            border: kind === "bubbles" ? `1px solid ${color[kind]}` : undefined,
            boxShadow: `0 0 ${p.size * 3}px ${color[kind]}`,
            "--dur": `${p.dur}s`, "--delay": `${p.delay}s`, "--dx": `${p.dx}px`, "--dy": kind === "dust-gold" ? "-120px" : "-320px", "--o": kind === "dust-gold" ? 0.5 : 0.85,
          } as CSSProperties}
        />
      ))}
    </>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 90 }, (_, i) => {
    const r = (n: number) => (Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1;
    const a = Math.abs(r(1)), b = Math.abs(r(2)), c = Math.abs(r(3));
    return { left: a * 100, size: 12 + b * 22, delay: c * 0.8, dur: 2 + b * 1.6, dx: (a - 0.5) * 200, rot: 360 + c * 720, ch: i % 3 ? "★" : "✦" };
  }), []);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {bits.map((p, i) => (
        <span key={i} className="confetti-piece" style={{ left: `${p.left}%`, fontSize: p.size, "--delay": `${p.delay}s`, "--dur": `${p.dur}s`, "--dx": `${p.dx}px`, "--rot": `${p.rot}deg` } as CSSProperties}>{p.ch}</span>
      ))}
    </div>
  );
}

export default function QuestOverlay({ loc, done, onWin, onClose }: { loc: QuestLocation; done: boolean; onWin: () => void; onClose: () => void }) {
  const c = CAMPUS[loc.id as CampusId];
  const [won, setWon] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const win = useCallback(() => {
    setWon(true);
    sfx("spirit");
    onWin();
    window.setTimeout(onClose, 3400);
  }, [onWin, onClose]);
  if (!c) return null;
  const { Game } = c;
  return (
    <div className="animate-card-in fixed inset-0 z-40 overflow-hidden bg-night" role="dialog" aria-modal="true" aria-label={c.title}>
      {/* living backdrop: slow camera drift, crossfading references, particles, flickering light */}
      <div className="absolute inset-0">
        {c.bg.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={`animate-kenburns absolute inset-0 h-full w-full object-cover ${i > 0 ? "animate-fade-swap" : ""}`}
            style={i > 0 ? { animationName: "kenburns, fade-swap", animationDuration: "28s, 16s", animationIterationCount: "infinite, infinite", animationDirection: "alternate-reverse, normal" } : undefined}
          />
        ))}
        <div className="fx-flicker absolute inset-0 bg-[radial-gradient(ellipse_at_25%_70%,color-mix(in_oklab,var(--star)_22%,transparent),transparent_55%)] mix-blend-screen" />
        {c.fx.map((f) => <Particles key={f} kind={f} />)}
        <div className={`absolute inset-0 bg-gradient-to-b ${c.tint}`} />
      </div>

      <div className="relative z-10 flex h-full flex-col overflow-y-auto p-4 md:p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.4em] text-gold/80">{loc.name} · Квест</p>
            <h2 className="mt-1 font-display text-3xl font-extrabold text-parchment text-glow md:text-5xl">{c.title}</h2>
            <p className="mt-2 max-w-xl font-body text-sm text-parchment/80 md:text-base">{c.rules}</p>
          </div>
          <button onClick={onClose} className="glass-card shrink-0 rounded-full px-5 py-2.5 font-display text-xs uppercase tracking-[0.2em] text-parchment">
            ✕ На карту
          </button>
        </header>

        <div className="mt-auto flex justify-center pb-4 pt-8">
          <div className="glass-card w-full max-w-3xl rounded-3xl p-5 md:p-8">
            {done && !won && (
              <p className="mb-4 rounded-full border border-gold/40 px-4 py-1.5 text-center font-display text-xs uppercase tracking-[0.2em] text-gold">✦ Кампус уже защищён — можно сыграть ещё раз</p>
            )}
            <Game key={run} onWin={win} />
            {!won && (
              <button onClick={() => setRun((r) => r + 1)} className="mt-5 font-display text-[11px] uppercase tracking-[0.2em] text-parchment/50 hover:text-parchment">
                ↻ Начать заново
              </button>
            )}
          </div>
        </div>
      </div>

      {won && (
        <>
          <Confetti />
          <div className="absolute inset-0 z-40 grid place-items-center p-4">
            <div className="glass-card animate-card-in rounded-3xl border-gold/60 px-10 py-8 text-center shadow-[0_0_80px_-10px_var(--star)]">
              <p className="text-5xl">🏆</p>
              <p className="mt-3 font-display text-3xl font-extrabold text-gold text-glow">Кампус успешно настроен!</p>
              <p className="mt-2 font-body text-parchment/80">Награда: <span className="text-gold">{loc.quest.reward}</span></p>
              <p className="mt-1 font-body text-sm text-parchment/50">Возвращаемся в деревню…</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
