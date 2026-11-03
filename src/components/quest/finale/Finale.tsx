import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { toPng } from "html-to-image";
import { WISHES, nextWish } from "./wishes";
import { CardArt } from "./CardArt";
import { CAMPUS_IDS } from "../games/logic";

function faceTexture(back: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(256, 220, 40, 256, 256, 256);
  grd.addColorStop(0, back ? "#1d3b2a" : "#1a2458");
  grd.addColorStop(1, back ? "#0b1a12" : "#0a1030");
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#f5cf6a"; g.lineWidth = 10;
  g.beginPath(); g.arc(256, 256, 226, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(256, 256, 206, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#f5cf6a"; g.textAlign = "center";
  if (!back) {
    g.font = "bold 34px Onest, sans-serif"; g.fillText("ХРАНИТЕЛЬ", 256, 380);
    g.font = "600 26px Onest, sans-serif"; g.fillText("РОЖДЕСТВА", 256, 416);
    g.font = "600 20px Onest, sans-serif"; g.fillStyle = "#c8f03c"; g.fillText("2026 · 5/5 КАМПУСОВ", 256, 130);
  } else {
    g.fillStyle = "#c8f03c"; g.font = "bold 88px Onest, sans-serif"; g.fillText("2ГИС", 256, 250);
    g.fillStyle = "#f5cf6a"; g.font = "600 26px Onest, sans-serif"; g.fillText("Счастливого", 256, 310); g.fillText("Нового года!", 256, 344);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starShape(r1: number, r2: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  return s;
}

function Badge() {
  const g = useRef<THREE.Group>(null);
  const star = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => ({ front: faceTexture(false), back: faceTexture(true) }), []);
  const starGeo = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.62, 0.26), { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) g.current.position.y = Math.sin(t * 1.4) * 0.08;
    if (star.current) (star.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + Math.sin(t * 2.5) * 0.35;
  });
  return (
    <group ref={g}>
      {/* gold rim */}
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[1.5, 1.5, 0.22, 64]} />
        <meshStandardMaterial color="#d9a83a" metalness={1} roughness={0.25} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}><torusGeometry args={[1.5, 0.08, 16, 96]} /><meshStandardMaterial color="#ffe08a" metalness={1} roughness={0.15} /></mesh>
      {/* faces */}
      <mesh position-z={0.112}><circleGeometry args={[1.42, 64]} /><meshStandardMaterial map={tex.front} metalness={0.3} roughness={0.5} /></mesh>
      <mesh position-z={-0.112} rotation-y={Math.PI}><circleGeometry args={[1.42, 64]} /><meshStandardMaterial map={tex.back} metalness={0.3} roughness={0.5} /></mesh>
      {/* raised star */}
      <mesh ref={star} geometry={starGeo} position={[0, 0.12, 0.1]}>
        <meshStandardMaterial color="#ffd86b" emissive="#ffb320" emissiveIntensity={0.7} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* ribbon tails */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.45, -1.85, -0.05]} rotation-z={s * 0.18}>
          <boxGeometry args={[0.5, 1.1, 0.04]} />
          <meshStandardMaterial color={s < 0 ? "#c8102e" : "#2d8a4e"} roughness={0.6} />
        </mesh>
      ))}
      {/* 5 campus gems around rim */}
      {["#e63946", "#7b2cbf", "#4cc9f0", "#c8f03c", "#f5cf6a"].map((c, i) => {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
        return (
          <mesh key={c} position={[Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.14]}>
            <octahedronGeometry args={[0.13]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8} metalness={0.4} roughness={0.1} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function Finale({ onClose }: { onClose: () => void }) {
  const [wish, setWish] = useState(() => Math.floor(Math.random() * WISHES.length));
  const [layout, setLayout] = useState<"wide" | "story">("wide");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);

  const save = async () => {
    if (!card.current) return;
    setSaving(true); setErr(null);
    try {
      const url = await toPng(card.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.download = `2gis-otkrytka-${layout === "story" ? "storis" : "post"}.png`;
      a.href = url; a.click();
    } catch {
      setErr("Не удалось сохранить открытку. Попробуй ещё раз.");
    } finally { setSaving(false); }
  };

  return (
    <div className="finale-in fixed inset-0 z-50 overflow-y-auto bg-night">
      <button onClick={onClose} className="glass-card fixed right-4 top-4 z-10 rounded-full px-4 py-2 font-body text-sm text-parchment">← К деревне</button>
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-16 pt-10">
        <p className="font-display text-[11px] uppercase tracking-[0.35em] text-lime">Все 5 кампусов защищены</p>
        <h2 className="mt-2 text-center font-display text-3xl font-bold text-gold md:text-4xl">Бейдж Хранителя Рождества</h2>
        <div className="relative h-[360px] w-full max-w-[520px] cursor-grab active:cursor-grabbing">
          <Canvas camera={{ position: [0, 0, 5.2], fov: 40 }} dpr={[1, 2]}>
            <ambientLight intensity={0.4} />
            <pointLight position={[3, 3, 4]} intensity={30} color="#ffe2a8" />
            <pointLight position={[-4, -2, -3]} intensity={20} color="#7fb2ff" />
            <Environment resolution={64}>
              <Lightformer intensity={2} position={[0, 4, 3]} scale={[8, 3, 1]} />
              <Lightformer intensity={1.2} color="#c8f03c" position={[-4, 0, 2]} rotation-y={Math.PI / 2} scale={[6, 1, 1]} />
            </Environment>
            <Badge />
            <Sparkles count={60} scale={[5, 5, 3]} size={3} speed={0.4} color="#ffd86b" />
            <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.2} enableDamping />
          </Canvas>
          <p className="pointer-events-none absolute bottom-1 w-full text-center font-body text-xs text-parchment/50">Потяни, чтобы повернуть бейдж на 360°</p>
        </div>

        <section className="glass-card mt-6 w-full rounded-3xl p-5 md:p-7">
          <h3 className="text-center font-display text-xl font-bold text-parchment">Создай свою Рождественскую Открытку</h3>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(["wide", "story"] as const).map((l) => (
              <button key={l} onClick={() => setLayout(l)} className={`rounded-full px-4 py-1.5 font-body text-sm transition ${layout === l ? "bg-lime text-night" : "bg-parchment/10 text-parchment/80"}`}>
                {l === "wide" ? "Широкий экран / Пост" : "Сториз"}
              </button>
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <div ref={card} className={layout === "story" ? "aspect-[9/16] w-[270px]" : "aspect-[16/9] w-full max-w-[640px]"}>
              <CardArt parts={CAMPUS_IDS} story={layout === "story"} wish={WISHES[wish]!} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button onClick={() => setWish((w) => nextWish(w))} className="rounded-full bg-parchment/10 px-5 py-2.5 font-body text-sm text-parchment hover:bg-parchment/20">✨ Сгенерировать другое пожелание</button>
            <button onClick={save} disabled={saving} className="btn-gold rounded-full px-5 py-2.5 font-body text-sm font-semibold">{saving ? "Сохраняем…" : "📸 Сохранить открытку"}</button>
          </div>
          {err && <p className="mt-3 text-center font-body text-sm text-destructive">{err}</p>}
        </section>
      </div>
    </div>
  );
}
