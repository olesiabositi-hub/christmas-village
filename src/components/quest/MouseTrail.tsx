import { useEffect, useRef } from "react";

// Lightweight 2D-canvas wand trail: pooled particles, additive blending.
export default function MouseTrail() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio, 1.25);
    let alive = false;
    const resize = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
    resize();
    window.addEventListener("resize", resize);
    const N = 220;
    const ps = Array.from({ length: N }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, s: 1, gold: true }));
    let head = 0, lx = -1, ly = -1, raf = 0, last = performance.now();
    const onMove = (e: PointerEvent) => {
      const x = e.clientX * dpr, y = e.clientY * dpr;
      const dist = lx < 0 ? 0 : Math.hypot(x - lx, y - ly);
      const n = Math.min(6, 1 + Math.floor(dist / (10 * dpr)));
      for (let i = 0; i < n; i++) {
        const p = ps[head]!; head = (head + 1) % N;
        const k = i / n;
        p.x = lx < 0 ? x : lx + (x - lx) * k; p.y = ly < 0 ? y : ly + (y - ly) * k;
        p.vx = (Math.random() - 0.5) * 40 * dpr; p.vy = (Math.random() * 30 + 10) * dpr;
        p.max = p.life = 0.5 + Math.random() * 0.7; p.s = (1 + Math.random() * 2.2) * dpr; p.gold = Math.random() < 0.65;
      }
      lx = x; ly = y;
      alive = true;
    };
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (!alive) { raf = requestAnimationFrame(tick); return; }
      g.clearRect(0, 0, c.width, c.height);
      alive = false;
      g.globalCompositeOperation = "lighter";
      for (const p of ps) {
        if (p.life <= 0) continue;
        alive = true;
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96;
        const a = Math.max(0, p.life / p.max);
        const r = p.s * (0.4 + a);
        g.fillStyle = p.gold ? `rgba(255,205,110,${a * 0.25})` : `rgba(210,225,255,${a * 0.22})`;
        g.beginPath(); g.arc(p.x, p.y, r * 3.2, 0, 6.283); g.fill();
        g.fillStyle = p.gold ? `rgba(255,240,190,${a})` : `rgba(245,250,255,${a})`;
        g.beginPath(); g.arc(p.x, p.y, r, 0, 6.283); g.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", onMove); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-50 h-full w-full" aria-hidden />;
}
