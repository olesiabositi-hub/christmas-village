import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import Scene from "@/components/quest/Scene";
import MouseTrail from "@/components/quest/MouseTrail";
import { LOCATIONS, type QuestLocation } from "@/components/quest/locations";
import { DISTRICTS } from "@/components/quest/districts";
import { setMuted, sfx, startAudio, stopAudio } from "@/components/quest/audio";
import { nextWeather, WEATHER_CYCLE, WEATHER_LABEL, type Weather, resolvePhase, TIME_LABELS, type TimeMode, loadSecrets, onSecrets, SECRETS, world, type SecretId } from "@/components/quest/sim";
import QuestOverlay from "@/components/quest/QuestOverlay";
import { allComplete, CAMPUS_IDS, CARD_PARTS, loadProgress, markComplete, TELEGRAM_URL, VACANCIES_URL, winMessage, type CampusId } from "@/components/quest/games/logic";
import { CardArt } from "@/components/quest/finale/CardArt";
import { lazy, Suspense } from "react";
const Finale = lazy(() => import("@/components/quest/finale/Finale"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Волшебная Деревня Санты — Christmas Magic Quest" },
      { name: "description", content: "Парящий ледяной остров с деревней Санты: эльфы, олени, пряничные человечки и пять зданий-квестов в 3D." },
      { property: "og:title", content: "Волшебная Деревня Санты" },
      { property: "og:description", content: "Кинематографичная 3D-сказка. Выбери здание и начни квест." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuestDashboard,
});

function QuestDashboard() {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focus, setFocus] = useState<QuestLocation | null>(null);
  const [started, setStarted] = useState(false);
  const [muted, setMute] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [welcome, setWelcome] = useState(true);
  const onIntroDone = useCallback(() => setIntroDone(true), []);
  const [names, setNames] = useState<Record<string, string>>({});
  const [hour, setHour] = useState(0);
  const [timeMode, setTimeMode] = useState<TimeMode>("auto");
  const phase = resolvePhase(timeMode, hour);
  const night = phase === "night";
  const [weather, setWeather] = useState<Weather>("calm");
  const storm = weather === "storm";
  const [panelOpen, setPanelOpen] = useState(true);
  const [secrets, setSecrets] = useState<SecretId[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [progress, setProgress] = useState<CampusId[]>([]);
  const [playing, setPlaying] = useState<QuestLocation | null>(null);
  useEffect(() => { setProgress(loadProgress()); }, []);
  const [finale, setFinale] = useState<"off" | "zoom" | "open">("off");
  const openChest = useCallback(() => { setFocus(null); setFinale("zoom"); window.setTimeout(() => setFinale("open"), 1600); }, []);
  const closeGame = useCallback(() => { setPlaying(null); setFocus(null); }, []);
  const [pr, setPr] = useState<ReturnType<typeof winMessage> | null>(null);
  const [fly, setFly] = useState(0);
  const [poi, setPoi] = useState<"hr" | "board" | null>(null);
  const winGame = useCallback(() => {
    if (!playing) return;
    const id = playing.id as CampusId;
    setProgress((p) => markComplete(p, id));
    window.setTimeout(() => { setPr(winMessage(id)); setFly((n) => n + 1); }, 3500);
  }, [playing]);
  useEffect(() => {
    if (!pr) return;
    const t = window.setTimeout(() => setPr(null), 12000);
    return () => clearTimeout(t);
  }, [pr]);

  useEffect(() => {
    const tick = () => setHour(new Date().getHours());
    tick();
    const id = window.setInterval(tick, 60000);
    setSecrets(loadSecrets());
    const off = onSecrets((s) => {
      setSecrets((prev) => {
        const fresh = s.find((x) => !prev.includes(x));
        if (fresh) setToast(SECRETS.find((x) => x.id === fresh)?.name ?? null);
        return s;
      });
    });
    // crisp chime / snow crunch on every button press
    const onClick = (e: MouseEvent) => { if ((e.target as HTMLElement).closest("button")) sfx(Math.random() > 0.5 ? "chime" : "crunch"); };
    window.addEventListener("click", onClick);
    return () => { clearInterval(id); off(); window.removeEventListener("click", onClick); };
  }, []);
  useEffect(() => { world.weather = weather; }, [weather]);
  useEffect(() => { world.night = night; world.phase = phase; }, [night, phase]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const begin = () => {
      startAudio();
      setStarted(true);
    };
    window.addEventListener("pointerdown", begin, { once: true });
    window.addEventListener("keydown", begin, { once: true });
    return () => {
      window.removeEventListener("pointerdown", begin);
      window.removeEventListener("keydown", begin);
      stopAudio();
    };
  }, []);

  // the greeting shows once at the start, then fades by itself
  useEffect(() => {
    if (!introDone || !welcome) return;
    const t = window.setTimeout(() => setWelcome(false), 12000);
    return () => clearTimeout(t);
  }, [introDone, welcome]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocus(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-night text-parchment">
      <Scene focus={focus} hoverId={hoverId} onHover={setHoverId} onSelect={setFocus} onIntroDone={onIntroDone} districtNames={names} phase={phase} storm={storm} completed={progress} chestOpen={allComplete(progress)} finale={finale !== "off"} onChest={openChest} onPoi={setPoi} paused={!!playing || finale === "open"} />
      <MouseTrail />
      {introDone && !focus && !welcome && !panelOpen && (
        <button onClick={() => setPanelOpen(true)} className="glass-card absolute bottom-24 left-4 z-10 flex items-center gap-2 rounded-full px-4 py-2 font-display text-xs font-semibold text-parchment md:bottom-28 md:left-10" aria-label="Развернуть контрольный список">
          🎁 Список <span className="text-gold">{progress.length}/5</span> <span className="text-parchment/50">▴</span>
        </button>
      )}
      {introDone && !focus && !welcome && panelOpen && (
        <div className="glass-card animate-card-in pointer-events-auto absolute bottom-24 left-4 z-10 max-h-[calc(100vh-14rem)] w-64 overflow-y-auto rounded-2xl p-4 md:bottom-28 md:left-10">
          <button onClick={() => setPanelOpen(false)} className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-parchment/10 text-xs text-parchment/70 hover:text-parchment" aria-label="Свернуть контрольный список">▾</button>
          <p className="font-display text-[10px] uppercase tracking-[0.3em] text-gold/80">Рождественский</p>
          <p className="font-display text-sm font-bold text-parchment">Контрольный Список</p>
          <div className="relative mt-3">
            <p className="mb-1.5 font-display text-[10px] uppercase tracking-[0.25em] text-lime">🎁 Накопительный Лутбокс · {progress.length}/5</p>
            <div className="aspect-[16/9] w-full"><CardArt parts={progress} mini /></div>
            <div className="mt-1.5 flex justify-between">
              {CAMPUS_IDS.map((id) => (
                <span key={id} title={CARD_PARTS[id].label} className={`grid h-7 w-7 place-items-center rounded-full text-sm ${progress.includes(id) ? "bg-gold/20 ring-1 ring-gold" : "bg-parchment/5 opacity-40 grayscale"}`}>{CARD_PARTS[id].icon}</span>
              ))}
            </div>
            {fly > 0 && <span key={fly} className="gift-fly pointer-events-none absolute left-1/2 top-1/3 h-8 w-8 rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--parchment),var(--star)_45%,oklch(0.55_0.2_25))] shadow-[0_0_30px_8px_var(--star)]" style={{ "--fx": "40vw", "--fy": "-40vh" } as React.CSSProperties} />}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-parchment/10">
            <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${(progress.length / LOCATIONS.length) * 100}%` }} />
          </div>
          <ul className="mt-3 space-y-1.5">
            {LOCATIONS.map((l) => {
              const ok = progress.includes(l.id as CampusId);
              return (
                <li key={l.id}>
                  <button onClick={() => { setWelcome(false); setFocus(l); }} className="flex w-full items-center justify-between gap-2 text-left font-body text-xs">
                    <span className={ok ? "text-parchment" : "text-parchment/60"}>{l.name}</span>
                    <span className={ok ? "text-gold" : "text-parchment/40"}>{ok ? "Защищен ✅" : "Ожидает"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {progress.length === LOCATIONS.length && <button onClick={openChest} className="mt-3 font-display text-xs text-gold underline-offset-4 hover:underline">✦ Рождество спасено! Открыть сундук у ёлки →</button>}
        </div>
      )}
      {pr && (
        <div className="glass-card animate-card-in fixed left-1/2 top-4 z-[60] w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl border-lime/40 p-4">
          <button onClick={() => setPr(null)} aria-label="Закрыть" className="absolute right-3 top-2 text-parchment/50 hover:text-parchment">✕</button>
          <p className="pr-5 font-body text-sm text-parchment">{pr.text}</p>
          <a href={pr.url} target="_blank" rel="noopener noreferrer" className="btn-gold mt-3 inline-block rounded-full px-4 py-2 font-display text-xs font-semibold">{pr.cta} →</a>
        </div>
      )}
      {poi && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/80 p-4" onClick={() => setPoi(null)}>
          <div className="animate-card-in relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPoi(null)} className="glass-card absolute -top-3 right-0 z-10 rounded-full px-3 py-1 font-body text-xs text-parchment">✕ Закрыть</button>
            {poi === "hr" ? (
              <div className="glass-card rounded-3xl border-gold/40 p-6 md:p-8">
                <p className="font-display text-[10px] uppercase tracking-[0.3em] text-lime">● HR-Служба · 2GIS Talent Acquisition Desk</p>
                <p className="mt-2 text-4xl">🧝‍♀️☕</p>
                <p className="mt-3 font-body text-base leading-relaxed text-parchment">Команда 2ГИС постоянно растет! Мы ищем опытных инженеров, продактов, архитекторов инфраструктуры и специалистов по Data Science. Присоединяйся к созданию иммерсивных карт!</p>
                <a href={VACANCIES_URL} target="_blank" rel="noopener noreferrer" className="btn-gold mt-5 inline-block rounded-full px-6 py-3 font-display text-sm font-bold">Смотреть вакансии →</a>
              </div>
            ) : (
              <div className="board-bg rounded-3xl p-5 md:p-7">
                <p className="mb-4 text-center font-display text-sm font-bold uppercase tracking-[0.25em] text-parchment">📌 Доска объявлений</p>
                <div className="grid grid-cols-2 gap-3">
                  {["Потерян красный нос. Нашедшему — морковка. Рудольф", "Эльф Гоша ищет пару для парного программирования. Желательно с печеньками", "Внимание! Олени не являются инфраструктурой. Не пингуйте их", "Продам санки б/у, пробег 1 млрд км. Санта"].map((t, i) => (
                    <p key={t} className={`paper-note font-body text-xs leading-snug ${i % 2 ? "rotate-2" : "-rotate-2"}`}>{t}</p>
                  ))}
                </div>
                <div className="paper-note mx-auto mt-4 max-w-sm rotate-[-1deg] text-center">
                  <p className="font-display text-sm font-bold">Главный вестник Деревни Санты!</p>
                  <p className="mt-1 font-body text-sm">Свежие сплетни про оленей, ИТ-юмор и новости RnD 2ГИС — в нашем Telegram-канале</p>
                  <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-display text-sm font-bold underline underline-offset-4">t.me/rnd2GIS →</a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {finale === "open" && <Suspense fallback={null}><Finale onClose={() => setFinale("off")} /></Suspense>}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 md:p-8">
        <div className={`transition-opacity duration-700 ${focus || !introDone ? "opacity-0" : "opacity-100"}`}>
          <p className="font-display text-[11px] uppercase tracking-[0.4em] text-gold/70">Северный полюс · 2ГИС</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold text-parchment md:text-5xl">Волшебная Деревня Санты</h1>
        </div>
        <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
        <div className="glass-card flex flex-col items-end gap-1.5 rounded-2xl p-1.5">
          <div className="flex gap-0.5" role="radiogroup" aria-label="Время суток">
            {(Object.keys(TIME_LABELS) as TimeMode[]).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={timeMode === m}
                onClick={() => setTimeMode(m)}
                title={TIME_LABELS[m]}
                className={`rounded-full px-2 py-0.5 font-display text-[10px] font-semibold transition-colors ${timeMode === m ? "btn-gold" : "text-parchment/70 hover:text-parchment"}`}
              >
                {m === "auto" ? "Авто" : TIME_LABELS[m]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setWeather(nextWeather(weather))}
            className="flex items-center gap-2 rounded-full px-1.5 py-0.5 text-left hover:bg-parchment/5"
            aria-label={`Погода: ${WEATHER_LABEL[weather]}. Нажми, чтобы сменить`}
            title="Волшебный барометр — нажми, чтобы сменить погоду"
          >
            <span className="relative grid h-6 w-6 place-items-center rounded-full border border-gold/50">
              <span className="absolute h-2.5 w-0.5 origin-bottom rounded bg-gold transition-transform duration-700" style={{ bottom: "50%", transform: `rotate(${WEATHER_CYCLE.indexOf(weather) * 90}deg)` }} />
              <span className="h-1 w-1 rounded-full bg-gold" />
            </span>
            <span className="font-display text-xs font-semibold text-parchment">{WEATHER_LABEL[weather]}</span>
            <span className="text-[10px] text-parchment/40">↻</span>
          </button>
        </div>
        {started && (
          <button
            onClick={() => { const m = !muted; setMute(m); setMuted(m); }}
            className="glass-card pointer-events-auto shrink-0 rounded-full px-4 py-2 font-display text-xs uppercase tracking-[0.25em] text-gold"
            aria-label={muted ? "Включить звук" : "Выключить звук"}
          >
            ♪ Звук {muted ? "выкл" : "вкл"}
          </button>
        )}
        </div>
      </header>

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
          <div className="glass-card animate-card-in rounded-full px-5 py-2 font-display text-sm text-gold">✦ Найден секрет: {toast}</div>
        </div>
      )}

      {welcome && introDone && !focus && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-night/55 p-4">
          <div className="glass-card animate-card-in max-w-lg rounded-2xl p-7 text-center">
            <p className="font-display text-[10px] uppercase tracking-[0.4em] text-gold/70">Christmas Magic Quest</p>
            <p className="mt-3 font-body text-xl leading-relaxed text-parchment/95">
              Добро пожаловать в Волшебную Деревню Санты! Крути карту мышкой, гуляй по мини-городу и нажимай на зелёные метки, чтобы запустить квест.
            </p>
            <button onClick={() => setWelcome(false)} className="btn-gold mt-6 rounded-full px-6 py-3 font-display text-xs uppercase tracking-[0.25em]">
              В путь!
            </button>
          </div>
        </div>
      )}

      <nav className={`absolute inset-x-0 bottom-6 flex flex-wrap justify-center gap-2 px-4 transition-all duration-700 md:bottom-10 ${focus || !introDone || welcome ? "pointer-events-none translate-y-8 opacity-0" : ""}`}>
        {LOCATIONS.map((l) => (
          <button
            key={l.id}
            onMouseEnter={() => setHoverId(l.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => { setWelcome(false); setFocus(l); }}
            className={`rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors ${hoverId === l.id ? "btn-gold" : "glass-card text-parchment"}`}
          >
            <span className="dot mr-2 align-middle" style={hoverId === l.id ? { background: "var(--night)" } : undefined} />{l.name}
          </button>
        ))}
      </nav>

      {focus && (
        <aside key={focus.id} className="absolute inset-y-0 right-0 z-30 flex w-full items-center p-4 md:w-[440px] md:p-8">
          <div className="glass-card animate-quest-in w-full rounded-2xl p-7">
            <p className="font-display text-[10px] uppercase tracking-[0.4em] text-gold/70">Квест открыт</p>
            <h2 className="font-display mt-2 text-3xl text-gold text-glow">{focus.quest.title}</h2>
            <p className="font-display mt-1 text-sm text-parchment/70">{focus.name}</p>
            <div className="divider-gold my-5" />
            <p className="font-body text-lg leading-relaxed text-parchment/90">{focus.description}</p>
            <ol className="mt-6 space-y-3">
              {focus.quest.steps.map((s, i) => (
                <li key={s} className="animate-step-in flex items-center gap-3 font-body text-lg" style={{ animationDelay: `${0.4 + i * 0.15}s` }}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold/50 font-display text-xs text-gold">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-6 font-body italic text-parchment/70">
              Награда: <span className="not-italic text-gold">{focus.quest.reward}</span>
            </p>
            <div className="mt-7 flex gap-3">
              <button onClick={() => setPlaying(focus)} className="btn-gold flex-1 rounded-full px-5 py-3 font-display text-xs uppercase tracking-[0.2em]">{progress.includes(focus.id as CampusId) ? "Сыграть снова" : "Начать квест"}</button>
              <button onClick={() => setFocus(null)} className="glass-card rounded-full px-5 py-3 font-display text-xs uppercase tracking-[0.2em] text-parchment/80">
                Назад
              </button>
            </div>
          </div>
        </aside>
      )}
      {playing && <QuestOverlay loc={playing} done={progress.includes(playing.id as CampusId)} onWin={winGame} onClose={closeGame} />}
    </main>
  );
}
