import type { CampusId } from "../games/logic";

/** Новогодняя открытка, которая собирается по частям: каждый кампус добавляет свой элемент. */
export function CardArt({ parts, story = false, wish, mini = false }: { parts: readonly CampusId[]; story?: boolean; wish?: string; mini?: boolean }) {
  const has = (id: CampusId) => parts.includes(id);
  const s = mini ? 0.42 : 1;
  return (
    <div className={`relative h-full w-full overflow-hidden ${has("office") ? "postcard" : "postcard-empty"} ${has("elfops") ? "postcard-frame" : ""}`} style={{ borderRadius: 16 * s }}>
      {has("office") && <div className="postcard-stars absolute inset-0" />}
      {has("reindeer") && (
        <>
          <div className="postcard-snow absolute inset-0" />
          <span className="absolute" style={{ right: `${story ? 8 : 6}%`, top: story ? "5%" : "18%", fontSize: 30 * s }}>🦌</span>
          <span className="absolute opacity-80" style={{ right: `${story ? 26 : 16}%`, top: story ? "9%" : "24%", fontSize: 22 * s }}>🦌</span>
        </>
      )}
      {has("magic") && (
        <div className={`absolute ${story ? "left-1/2 top-[8%] -translate-x-1/2" : "bottom-[10%] right-[6%]"}`} style={{ width: (story ? 120 : 90) * s }}>
          <svg viewBox="0 0 100 120" className="w-full drop-shadow-[0_0_14px_var(--lime)]">
            <polygon points="50,10 80,50 66,50 90,82 62,82 96,112 4,112 38,82 10,82 34,50 20,50" fill="oklch(0.45 0.12 150)" />
            <rect x="43" y="112" width="14" height="8" fill="oklch(0.4 0.08 50)" />
            <polygon points="50,0 54,9 63,9 56,14 59,23 50,17 41,23 44,14 37,9 46,9" fill="var(--star)" />
            {[[40, 45], [62, 62], [30, 78], [70, 92], [48, 98], [22, 104], [78, 106]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill={["var(--lime)", "oklch(0.7 0.2 25)", "var(--star)"][i % 3]} />)}
          </svg>
        </div>
      )}
      <div className={`relative flex h-full flex-col justify-between ${story ? "items-center text-center" : ""}`} style={{ padding: 20 * s }}>
        <div className="flex items-center gap-2">
          <span className="dot" style={{ width: 8 * s, height: 8 * s }} />
          <span className="font-display uppercase tracking-[0.3em] text-lime" style={{ fontSize: 10 * s }}>Хранитель Рождества</span>
        </div>
        {wish ? (
          <p className={`font-display font-semibold leading-snug text-parchment ${story ? "mt-[55%]" : "max-w-[70%]"}`} style={{ fontSize: (story ? 17 : 19) * s }}>«{wish}»</p>
        ) : <span />}
        <div className={story ? "" : "max-w-[75%]"}>
          {has("qa") ? (
            <p className="font-display font-bold text-gold" style={{ fontSize: 22 * s }}>Счастливого Нового года от 2ГИС!</p>
          ) : (
            <p className="font-display text-parchment/25" style={{ fontSize: 14 * s }}>подпись ещё не найдена…</p>
          )}
          <p className="mt-1 font-body uppercase tracking-[0.25em] text-parchment/50" style={{ fontSize: 9 * s }}>✦ Волшебная деревня 2ГИС · 2026 ✦</p>
        </div>
      </div>
    </div>
  );
}
