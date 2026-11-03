import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls, PerformanceMonitor, Sparkles, Stars } from "@react-three/drei";
import { SantaSleigh } from "./Santa";
import { Bloom, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { LOCATIONS, type QuestLocation } from "./locations";
import { setZoneMix } from "./audio";
import Living, { SneezeOnClick } from "./Living";
import { auroraWave, FEEL, PRESETS, rand, SNOW_AMOUNT, stepWalker, world, type Phase, type Walker } from "./sim";
import { addFootprint, Aurora, Barn, Burst, Footprints, GoldHalo, StarSmoke } from "./Magic";
import { CabinGlow, faceTo, GingerHouse, LogCabin } from "./Cabins";

const GOLD = "#ffb347";
const LIME = "#c8f03c";
const PURPLE = "#b06bff";
const CYAN = "#6fe6ff";

// Building anchors (ground positions)
const P = {
  office: [0, 0, -6] as const,
  magic: [-6.5, 0, -2.5] as const,
  qa: [6.5, 0, -2.5] as const,
  reindeer: [-5.5, 0, 5] as const,
  elfops: [5.5, 0, 5] as const,
  cafe: [0, 0, 7] as const,
  mail: [3.8, 0, -4.2] as const,
};

// deterministic random
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ---------- flickering window materials ----------
const windowMats: THREE.MeshStandardMaterial[] = [];
function useWindowMat(color = GOLD) {
  return useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#3a2208", emissive: color, emissiveIntensity: 3, toneMapped: false });
    (m.userData as { seed: number }).seed = Math.random() * 100;
    windowMats.push(m);
    return m;
  }, [color]);
}
function Flicker() {
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const m of windowMats) {
      const s = (m.userData as { seed: number }).seed;
      m.emissiveIntensity = (0.4 + world.glow) * 1.5 +  Math.sin(t * 7 + s) * 0.35 + Math.sin(t * 13.3 + s * 2) * 0.25 + Math.sin(t * 2.1 + s) * 0.3;
    }
  });
  return null;
}
function Win({ p, s = [0.18, 0.32], r = 0, color }: { p: [number, number, number]; s?: [number, number]; r?: number; color?: string }) {
  const m = useWindowMat(color);
  return (
    <mesh position={p} rotation-y={r} material={m}>
      <planeGeometry args={s} />
    </mesh>
  );
}

// ---------- textures ----------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function useSnowTexture() {
  return useMemo(() => {
    const t = canvasTex(512, 512, (g) => {
      g.fillStyle = "#dfe8f7";
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) {
        const v = 200 + Math.random() * 55;
        g.fillStyle = `rgba(${v - 20},${v - 8},${v},${Math.random() * 0.5})`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 3, 2 + Math.random() * 3);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    return t;
  }, []);
}
function useStripeTex(a: string, b: string, n = 8) {
  return useMemo(() => {
    const t = canvasTex(64, 64, (g) => {
      for (let i = 0; i < n; i++) {
        g.fillStyle = i % 2 ? a : b;
        g.fillRect((i * 64) / n, 0, 64 / n, 64);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, [a, b, n]);
}
function useGlowTex(rgb = "255,255,255") {
  return useMemo(
    () =>
      canvasTex(64, 64, (g) => {
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, `rgba(${rgb},1)`);
        gr.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
      }),
    [rgb],
  );
}

// ---------- floating ice island ----------
function Island() {
  const snow = useSnowTexture();
  const top = useMemo(() => {
    const g = new THREE.CircleGeometry(19, 160);
    const p = g.attributes["position"]!;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const r = Math.hypot(x, y);
      let h = Math.sin(x * 0.5) * Math.cos(y * 0.4) * 0.18 + Math.sin(x * 1.3 + y) * 0.06;
      if (r > 17.5) h *= Math.max(0, 1 - (r - 17.5) / 1.5);
      p.setZ(i, h);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={top} rotation-x={-Math.PI / 2} receiveShadow>
        <meshStandardMaterial map={snow} roughness={0.85} color="#e8eefc" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <circleGeometry args={[140, 64]} />
        <meshStandardMaterial map={snow} roughness={0.9} color="#e3eaf8" />
      </mesh>
    </group>
  );
}

function Clouds() {
  const ref = useRef<THREE.Group>(null);
  const tex = useGlowTex("150,170,230");
  const puffs = useMemo(() => {
    const r = rng(3);
    return Array.from({ length: 34 }, () => {
      const a = r() * Math.PI * 2;
      const d = 13 + r() * 10;
      return { p: [Math.cos(a) * d, -3 + r() * 4, Math.sin(a) * d] as [number, number, number], s: 6 + r() * 8 };
    });
  }, []);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.012;
  });
  return (
    <group ref={ref}>
      {puffs.map((c, i) => (
        <sprite key={i} position={c.p} scale={[c.s, c.s * 0.45, 1]}>
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0.35} fog={false} />
        </sprite>
      ))}
    </group>
  );
}

// ---------- smoke / steam ----------
function Smoke({ p, n = 14, rise = 2.6, size = 0.45, speed = 0.18, color = "#9aa5c4", opacity = 0.22 }: { p: [number, number, number]; n?: number; rise?: number; size?: number; speed?: number; color?: string; opacity?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime * speed;
    for (let i = 0; i < n; i++) {
      const k = (t + i / n) % 1;
      d.position.set(p[0] + k * 0.6 + Math.sin(k * 6 + i) * 0.1, p[1] + k * rise, p[2] + Math.cos(k * 5 + i) * 0.08);
      d.scale.setScalar(0.1 + k * size);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </instancedMesh>
  );
}

// ---------- interactive wrapper ----------
type Interact = { onHover: (id: string | null) => void; onSelect: (l: QuestLocation) => void };
function Hit({ id, children, i }: { id: string; children: ReactNode; i: Interact }) {
  const loc = LOCATIONS.find((l) => l.id === id)!;
  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); i.onHover(id); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { i.onHover(null); document.body.style.cursor = ""; }}
      onClick={(e) => { e.stopPropagation(); i.onSelect(loc); }}
    >
      {children}
    </group>
  );
}

// ---------- the five campuses: Finnish log cabins ----------
const camRot = (id: string, x: number, z: number) => { const l = LOCATIONS.find((q) => q.id === id)!; return faceTo(x, z, l.camera[0], l.camera[2]); };
function Office() {
  const fire = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (fire.current) fire.current.intensity = 6 + Math.sin(clock.elapsedTime * 9) * 1.5 + Math.sin(clock.elapsedTime * 23) * 1;
  });
  return (
    <group position={[...P.office]}>
      <LogCabin w={4} d={2.6} h={2} pitch={0.6} rot={camRot("office", P.office[0], P.office[2])} seed={1}>
        <mesh position={[1.1, 3.1, -0.4]} castShadow><boxGeometry args={[0.5, 1.6, 0.5]} /><meshStandardMaterial color="#5b5f6b" roughness={1} /></mesh>
        <mesh position={[1.1, 3.95, -0.4]} scale={[1, 0.5, 1]}><sphereGeometry args={[0.36, 10, 8]} /><meshStandardMaterial color="#f4f8ff" roughness={1} /></mesh>
        <Smoke p={[1.1, 4.1, -0.4]} n={18} rise={3.2} size={0.6} />
        <StarSmoke p={[1.1, 4.2, -0.4]} />
        <pointLight ref={fire} position={[0, 0.6, 2]} color="#ff9a3a" intensity={6} distance={6} />
      </LogCabin>
    </group>
  );
}
function MagicTower() {
  const runes = useRef<THREE.Group>(null);
  useFrame((_, d) => { runes.current?.children.forEach((c, i) => { c.rotation.y += d * (i % 2 ? -0.8 : 0.6); }); });
  return (
    <group position={[...P.magic]}>
      <LogCabin w={2.4} d={2.2} h={2.6} pitch={0.95} rot={camRot("magic", P.magic[0], P.magic[2])} seed={2}>
        <group ref={runes} position={[0, 4.4, 0]}>
          {[0.6, 0.85].map((r, i) => (
            <mesh key={r} rotation-x={Math.PI / 2 + i * 0.3}>
              <torusGeometry args={[r, 0.025, 6, 48]} />
              <meshBasicMaterial color={i ? PURPLE : LIME} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </LogCabin>
    </group>
  );
}
function QAFactory() {
  return (
    <group position={[...P.qa]}>
      <LogCabin w={3} d={2.2} h={1.6} rot={camRot("qa", P.qa[0], P.qa[2])} seed={3}>
        {[[1.9, 0.2, 0.6, "#e63946"], [1.95, 0.2, 1.1, "#2a9d8f"], [1.9, 0.5, 0.85, "#e9c46a"]].map(([x, y, z, c], k) => (
          <mesh key={k} position={[x as number, (y as number) + 0.1, z as number]} castShadow>
            <boxGeometry args={[0.32, 0.3, 0.32]} />
            <meshStandardMaterial color={c as string} roughness={0.6} />
          </mesh>
        ))}
      </LogCabin>
    </group>
  );
}
function Hangar() {
  return (
    <group position={[...P.reindeer]}>
      <LogCabin w={3.2} d={2.4} h={1.4} pitch={0.5} rot={camRot("reindeer", P.reindeer[0], P.reindeer[2])} seed={4}>
        <group position={[1.9, 0, 1.2]} rotation-y={-0.4}>
          <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.5, 0.25, 0.9]} /><meshStandardMaterial color="#9a1b22" roughness={0.5} /></mesh>
          {[-0.22, 0.22].map((x) => (
            <mesh key={x} position={[x, 0.1, 0]}><boxGeometry args={[0.03, 0.03, 1.1]} /><meshStandardMaterial color="#c9a14a" metalness={0.8} roughness={0.3} /></mesh>
          ))}
        </group>
      </LogCabin>
    </group>
  );
}
function ElfOps() {
  const dish = useRef<THREE.Group>(null);
  useFrame((_, d) => { if (dish.current) dish.current.rotation.y += d * 0.6; });
  return (
    <group position={[...P.elfops]}>
      <LogCabin w={3} d={2.2} h={1.6} rot={camRot("elfops", P.elfops[0], P.elfops[2])} seed={5}>
        <group ref={dish} position={[-0.9, 2.9, -0.5]}>
          <mesh rotation-x={-0.6}><sphereGeometry args={[0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5]} /><meshStandardMaterial color="#d9dbe6" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 0.2, 0.15]}><sphereGeometry args={[0.04, 8, 8]} /><meshBasicMaterial color={LIME} toneMapped={false} /></mesh>
        </group>
      </LogCabin>
    </group>
  );
}

// ---------- giant Christmas tree ----------
function ChristmasTree() {
  const orn = useRef<THREE.Group>(null);
  const flare = useRef<THREE.Sprite>(null);
  const star = useRef<THREE.Mesh>(null);
  const flareTex = useGlowTex("255,220,150");
  const ornaments = useMemo(() => {
    const r = rng(9);
    const cols = ["#e63946", GOLD, "#4cc9f0", "#f72585", "#ffffff"];
    return Array.from({ length: 46 }, (_, i) => {
      const y = 0.6 + r() * 4.2;
      const rad = (1 - (y - 0.4) / 5.2) * 1.75 + 0.05;
      const a = r() * Math.PI * 2;
      return { p: [Math.cos(a) * rad, y, Math.sin(a) * rad] as [number, number, number], c: cols[i % cols.length]! };
    });
  }, []);
  useFrame(({ clock }, d) => {
    if (orn.current) orn.current.rotation.y += d * 0.25;
    const t = clock.elapsedTime;
    if (star.current) {
      star.current.rotation.y += d * 1.2;
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
      star.current.scale.setScalar(1 + pulse * 0.18);
      (star.current.material as THREE.MeshBasicMaterial).color.setRGB(1.6 + pulse * 2.2, 1.4 + pulse * 1.6, 0.7 + pulse * 0.6);
    }
    if (flare.current) {
      const burst = Math.pow(Math.max(0, Math.sin(t * 0.7)), 30);
      const s = 1.4 + Math.sin(t * 3) * 0.15 + burst * 5;
      flare.current.scale.set(s * 1.6, s * 0.35 + burst * 0.3, 1);
      flare.current.material.opacity = 0.6 + burst * 0.4;
      flare.current.material.rotation = t * 0.2;
    }
  });
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.2, 0.25, 0.6, 8]} />
        <meshStandardMaterial color="#4a2e1c" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <group key={i}>
          <mesh position={[0, 1.2 + i * 1.05, 0]} castShadow>
            <coneGeometry args={[1.9 - i * 0.4, 1.8, 12]} />
            <meshStandardMaterial color="#1d4a3a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.25 + i * 1.05, 0]} scale={[0.98, 0.35, 0.98]}>
            <coneGeometry args={[1.9 - i * 0.4, 1.8, 12, 1, true]} />
            <meshStandardMaterial color="#eef3ff" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <group ref={orn}>
        {ornaments.map((o, i) => (
          <mesh key={i} position={o.p}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial color={o.c} emissive={o.c} emissiveIntensity={1.6} metalness={0.6} roughness={0.2} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={star} position={[0, 5.45, 0]}>
        <octahedronGeometry args={[0.32]} />
        <meshBasicMaterial color="#fff2c0" toneMapped={false} />
      </mesh>
      <sprite ref={flare} position={[0, 5.45, 0]}>
        <spriteMaterial map={flareTex} color="#ffd890" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <pointLight position={[0, 5.4, 0]} color="#ffd890" intensity={10} distance={10} />
    </group>
  );
}

// ---------- glowing garlands between buildings ----------
function Garlands() {
  const pts = useMemo(() => {
    const anchors: [number, number, number][] = [
      [P.office[0] + 2, 2.6, P.office[2] + 1],
      [P.qa[0] - 1, 2.0, P.qa[2]],
      [P.elfops[0] - 1, 1.7, P.elfops[2] - 0.4],
      [P.cafe[0] + 0.9, 1.6, P.cafe[2]],
      [P.reindeer[0] + 0.6, 1.4, P.reindeer[2] - 0.6],
      [P.magic[0] + 0.8, 2.5, P.magic[2]],
      [P.office[0] - 2, 2.6, P.office[2] + 1],
    ];
    const tree: [number, number, number] = [0, 5, 0];
    const lines: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < anchors.length; i++) {
      lines.push([new THREE.Vector3(...anchors[i]!), new THREE.Vector3(...anchors[(i + 1) % anchors.length]!)]);
      if (i % 2 === 0) lines.push([new THREE.Vector3(...anchors[i]!), new THREE.Vector3(...tree)]);
    }
    const out: THREE.Vector3[] = [];
    for (const [a, b] of lines) {
      const len = a.distanceTo(b);
      const n = Math.floor(len * 4);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * len * 0.12; // sag
        out.push(p);
      }
    }
    return out;
  }, []);
  const groups = useMemo(() => [0, 1, 2].map((g) => pts.filter((_, i) => i % 3 === g)), [pts]);
  const base = ["#ff4d5e", "#ffcf5a", "#62ffb8"];
  const mats = useMemo(() => base.map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false })), []);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    const d = new THREE.Object3D();
    groups.forEach((g, gi) => {
      g.forEach((p, i) => {
        d.position.copy(p);
        d.updateMatrix();
        refs.current[gi]?.setMatrixAt(i, d.matrix);
      });
      if (refs.current[gi]) refs.current[gi]!.instanceMatrix.needsUpdate = true;
    });
  }, [groups]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    mats.forEach((m, i) => {
      m.color.set(base[i]!).multiplyScalar(1.6 + Math.sin(t * 1.8 + i * 2.1) * 1.2);
    });
  });
  return (
    <>
      {groups.map((g, gi) => (
        <instancedMesh key={gi} ref={(r) => { refs.current[gi] = r; }} args={[undefined, mats[gi], g.length]}>
          <sphereGeometry args={[0.045, 6, 6]} />
        </instancedMesh>
      ))}
    </>
  );
}

// ---------- Hot Chocolate Cafe (gingerbread) ----------
function Cafe() {
  return (
    <group>
      <GingerHouse p={[...P.cafe]} rot={0.25} seed={3} scale={1.4} sign="Горячий шоколад" />
      <Smoke p={[P.cafe[0] - 0.4, 2.4, P.cafe[2] + 0.3]} n={10} rise={1.6} size={0.3} speed={0.3} color="#ffffff" opacity={0.18} />
    </group>
  );
}

// ---------- Mail sorting deck with flying letters ----------
function MailDeck() {
  const N = 7;
  const ref = useRef<THREE.InstancedMesh>(null);
  const scrolls = useRef<THREE.InstancedMesh>(null);
  const arm = useRef<THREE.Mesh>(null);
  const d = useMemo(() => new THREE.Object3D(), []);
  const desk = new THREE.Vector3(-0.5, 0.75, 0);
  const box = new THREE.Vector3(0.9, 1.05, 0.2);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      for (let i = 0; i < N; i++) {
        const k = ((t / 3 + i / N) % 1);
        const p = desk.clone().lerp(box, k);
        p.y += Math.sin(k * Math.PI) * 1.1;
        d.position.copy(p);
        d.rotation.set(Math.sin(t * 4 + i) * 0.4, t * 2 + i, 0);
        d.scale.setScalar(k > 0.92 ? (1 - k) * 12 : 1);
        d.updateMatrix();
        ref.current.setMatrixAt(i, d.matrix);
      }
      ref.current.instanceMatrix.needsUpdate = true;
    }
    if (scrolls.current) {
      for (let i = 0; i < 5; i++) {
        const k = (t / 5 + i / 5) % 1;
        d.position.set(-0.2 + Math.sin(i * 2 + k * 6) * 0.6, 0.5 + k * 4, Math.cos(i * 3 + k * 5) * 0.6);
        d.rotation.set(t + i, t * 0.7, 0);
        d.scale.setScalar(Math.sin(k * Math.PI));
        d.updateMatrix();
        scrolls.current.setMatrixAt(i, d.matrix);
      }
      scrolls.current.instanceMatrix.needsUpdate = true;
    }
    if (arm.current) arm.current.rotation.z = -0.6 + Math.sin(t * (Math.PI * 2 / 3) * N) * 0.5;
  });
  const piles = useMemo(() => {
    const r = rng(4);
    return Array.from({ length: 14 }, () => [-1 + r() * 0.8, 0.22 + r() * 0.15, -0.5 + r() * 1] as [number, number, number]);
  }, []);
  return (
    <group position={[...P.mail]} rotation-y={-0.5}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[2.8, 0.2, 1.6]} />
        <meshStandardMaterial color="#8a5a34" roughness={1} />
      </mesh>
      {piles.map((p, i) => (
        <mesh key={i} position={p} rotation-y={i}>
          <boxGeometry args={[0.18, 0.04, 0.12]} />
          <meshStandardMaterial color="#f5ecd6" />
        </mesh>
      ))}
      {/* desk */}
      <mesh position={[-0.5, 0.5, 0]}>
        <boxGeometry args={[0.7, 0.5, 0.5]} />
        <meshStandardMaterial color="#5a3820" />
      </mesh>
      {/* sorting elf */}
      <group position={[-0.95, 0.2, 0]} rotation-y={Math.PI / 2}>
        <ElfBody color="#2a9d8f" />
        <mesh ref={arm} position={[0.14, 0.42, 0]}>
          <boxGeometry args={[0.05, 0.22, 0.05]} />
          <meshStandardMaterial color="#2a9d8f" />
        </mesh>
      </group>
      {/* magical mailbox */}
      <group position={[0.9, 0.2, 0.2]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} />
          <meshStandardMaterial color="#3a2a2a" />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[0.45, 0.32, 0.32]} />
          <meshStandardMaterial color="#b3122b" emissive="#ff4060" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.8, 0.165]}>
          <planeGeometry args={[0.28, 0.05]} />
          <meshBasicMaterial color={GOLD} toneMapped={false} />
        </mesh>
      </group>
      <instancedMesh ref={ref} args={[undefined, undefined, N]}>
        <boxGeometry args={[0.16, 0.02, 0.11]} />
        <meshBasicMaterial color="#ffe7a8" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={scrolls} args={[undefined, undefined, 5]}>
        <cylinderGeometry args={[0.03, 0.03, 0.18, 6]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ---------- characters ----------
type ElfRefs = { legs?: React.RefObject<THREE.Group | null>; arms?: React.RefObject<THREE.Group | null>; head?: React.RefObject<THREE.Group | null>; eyes?: React.RefObject<THREE.Group | null> };
export function ElfBody({ color = "#2d8a4e", legs, arms, head, eyes, wave }: { color?: string; wave?: boolean } & ElfRefs) {
  const skin = "#f2c7a5";
  return (
    <group>
      <group ref={legs ?? null}>
        {[-0.05, 0.05].map((x) => (
          <group key={x} position={[x, 0.17, 0]}>
            <mesh position={[0, -0.08, 0]}>
              <capsuleGeometry args={[0.025, 0.1, 3, 6]} />
              <meshStandardMaterial color="#c8102e" />
            </mesh>
            <mesh position={[0, -0.16, 0.03]} rotation-x={0.3}>
              <coneGeometry args={[0.035, 0.12, 6]} />
              <meshStandardMaterial color="#3a2a1a" />
            </mesh>
          </group>
        ))}
      </group>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.07, 0.14, 0.3, 10]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.122, 0.125, 0.035, 10]} />
        <meshStandardMaterial color="#1a1410" />
      </mesh>
      <mesh position={[0, 0.22, 0.12]}>
        <boxGeometry args={[0.04, 0.035, 0.01]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <torusGeometry args={[0.065, 0.025, 6, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <group ref={arms ?? null}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.1, 0.42, 0]} rotation-z={wave && s > 0 ? -2.4 : s * 0.25}>
            <mesh position={[0, -0.08, 0]}>
              <capsuleGeometry args={[0.022, 0.12, 3, 6]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, -0.17, 0]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshStandardMaterial color={skin} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={head ?? null} position={[0, 0.52, 0]}>
        <mesh>
          <sphereGeometry args={[0.09, 14, 14]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.09, 0.01, 0]} rotation-z={-s * 1.1}>
            <coneGeometry args={[0.025, 0.09, 6]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        ))}
        <group ref={eyes ?? null}>
          {[-0.032, 0.032].map((x) => (
            <mesh key={x} position={[x, 0.01, 0.083]}>
              <sphereGeometry args={[0.013, 6, 6]} />
              <meshBasicMaterial color="#1a1020" />
            </mesh>
          ))}
        </group>
        <mesh position={[0, -0.015, 0.09]}>
          <sphereGeometry args={[0.016, 6, 6]} />
          <meshStandardMaterial color="#f08a7a" />
        </mesh>
        {[-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, -0.025, 0.07]}>
            <sphereGeometry args={[0.018, 6, 6]} />
            <meshStandardMaterial color="#ff9a9a" transparent opacity={0.6} />
          </mesh>
        ))}
        <mesh position={[0, 0.11, -0.02]} rotation-x={-0.35}>
          <coneGeometry args={[0.085, 0.24, 10]} />
          <meshStandardMaterial color="#c8102e" />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <torusGeometry args={[0.078, 0.018, 6, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.22, -0.07]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  );
}

const elfPath = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(P.elfops[0] - 1.6, 0.05, P.elfops[2] - 0.8),
    new THREE.Vector3(P.elfops[0] + 1.8, 0.05, P.elfops[2] - 1.4),
    new THREE.Vector3(P.qa[0] + 1.6, 0.05, P.qa[2] + 1.8),
    new THREE.Vector3(P.qa[0] - 1.6, 0.05, P.qa[2] + 1.6),
    new THREE.Vector3(P.qa[0] - 2.2, 0.05, P.qa[2] + 3.6),
  ],
  true,
);
function WalkingElf({ offset, color, gift, wave }: { offset: number; color: string; gift?: string; wave?: boolean }) {
  const g = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group>(null);
  const arms = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const lastStep = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const u = (t * 0.025 + offset) % 1;
    const p = elfPath.getPointAt(u);
    const n = elfPath.getPointAt((u + 0.01) % 1);
    const ph = t * 8 + offset * 10;
    if (g.current) {
      g.current.position.set(p.x, p.y + Math.abs(Math.sin(ph)) * 0.04, p.z);
      g.current.lookAt(n.x, g.current.position.y, n.z);
      g.current.rotation.z = Math.sin(ph) * 0.06;
      const step = Math.floor(ph / Math.PI);
      if (step !== lastStep.current) {
        lastStep.current = step;
        const side = step % 2 ? 1 : -1;
        const ry = Math.atan2(n.x - p.x, n.z - p.z);
        addFootprint(p.x + Math.cos(ry) * 0.05 * side, p.z - Math.sin(ry) * 0.05 * side, -ry, t);
      }
    }
    legs.current?.children.forEach((c, i) => { c.rotation.x = Math.sin(ph + i * Math.PI) * 0.6; });
    arms.current?.children.forEach((c, i) => {
      if (wave && i === 1) c.rotation.z = -2.4 + Math.sin(t * 9) * 0.5;
      else if (!gift) c.rotation.x = Math.sin(ph + (i ? 0 : Math.PI)) * 0.5;
      else c.rotation.x = -1.1;
    });
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.7 + offset * 20) * 0.5;
      head.current.rotation.x = Math.sin(ph * 2) * 0.05;
    }
    if (eyes.current) eyes.current.scale.y = (t + offset * 7) % 3.5 < 0.12 ? 0.1 : 1;
  });
  return (
    <group ref={g} scale={1.1}>
      <ElfBody color={color} legs={legs} arms={arms} head={head} eyes={eyes} wave={!!wave} />
      {gift && (
        <group position={[0, 0.34, 0.15]}>
          <mesh>
            <boxGeometry args={[0.18, 0.15, 0.14]} />
            <meshStandardMaterial color={gift} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.19, 0.155, 0.03]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Reindeer({ p, rot, phase }: { p: [number, number, number]; rot: number; phase: number }) {
  const neck = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Mesh>(null);
  const ears = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group>(null);
  const w = useMemo<Walker>(() => {
    rand(Math.floor(phase * 1000) + 7);
    return { x: p[0], z: p[2], ry: rot + Math.PI / 2, speed: 0, state: "idle", timer: 1 + phase, tx: p[0], tz: p[2], seed: phase };
  }, [p, rot, phase]);
  const pick = useMemo(() => () => {
    const a = rand() * Math.PI * 2, r = 0.25 + rand() * 0.55;
    return [p[0] + Math.cos(a) * r, p[2] + Math.sin(a) * r] as [number, number];
  }, [p]);
  const anim = useRef({ graze: 0, look: 0, gait: 0, ear: [0, 0] as [number, number], nextTwitch: 2 });
  useFrame(({ clock }, d) => {
    const dt = Math.min(d, 0.05), t = clock.elapsedTime + phase, A = anim.current;
    stepWalker(w, dt, "reindeer", pick);
    const ease = (cur: number, to: number, rate: number) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
    // idle → look around, action → lower head & eat snow
    A.graze = ease(A.graze, w.state === "action" ? 1 : 0, 2.2);
    A.look = ease(A.look, w.state === "idle" ? Math.sin(t * 0.6) * 0.55 : 0, 1.5);
    A.gait += w.speed * dt * 22;
    const moving = Math.min(1, w.speed / FEEL.reindeer.max);
    if (neck.current) {
      neck.current.rotation.z = -A.graze * 1.15 + Math.sin(t * 1.1) * 0.04 + (A.graze > 0.8 ? Math.sin(t * 9) * 0.05 : 0) - moving * Math.sin(A.gait * 2) * 0.05;
      neck.current.rotation.y = A.look;
    }
    if (body.current) body.current.scale.y = 1 + Math.sin(t * 2.2) * 0.02;
    if (tail.current) tail.current.rotation.y = Math.sin(t * 7) * 0.3 + (Math.sin(t * 0.7) > 0.95 ? Math.sin(t * 30) * 0.5 : 0);
    // random ear twitches
    A.nextTwitch -= dt;
    if (A.nextTwitch <= 0) { A.ear[Math.random() > 0.5 ? 0 : 1] = 1; A.nextTwitch = 1.2 + Math.random() * 3.5; }
    ears.current?.children.forEach((e, i) => {
      A.ear[i] = ease(A.ear[i]!, 0, 6);
      e.rotation.x = (i ? 0.5 : -0.5) + A.ear[i]! * Math.sin(t * 40) * 0.5;
    });
    if (eyes.current) eyes.current.scale.y = t % 4 < 0.13 ? 0.15 : 1;
    legs.current?.children.forEach((l, i) => { l.rotation.z = moving * Math.sin(A.gait + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.4; });
    if (root.current) {
      root.current.position.set(w.x, p[1] + moving * Math.abs(Math.sin(A.gait)) * 0.025, w.z);
      root.current.rotation.y = w.ry - Math.PI / 2;
    }
  });
  const brown = "#8a5a3a";
  const belly = "#d9b48a";
  return (
    <group ref={root} position={p} scale={0.8}>
      <group ref={body}>
        <mesh position={[0, 0.55, 0]} rotation-z={Math.PI / 2} castShadow>
          <capsuleGeometry args={[0.17, 0.45, 6, 12]} />
          <meshStandardMaterial color={brown} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.47, 0]} rotation-z={Math.PI / 2} scale={[0.85, 1, 0.9]}>
          <capsuleGeometry args={[0.15, 0.35, 4, 10]} />
          <meshStandardMaterial color={belly} roughness={1} />
        </mesh>
        <mesh position={[0.22, 0.62, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial color="#f2e6d6" roughness={1} />
        </mesh>
      </group>
      <group ref={legs}>
        {[[-0.26, 0.1], [-0.26, -0.1], [0.26, 0.1], [0.26, -0.1]].map(([x, z], i) => (
          <group key={i} position={[x!, 0.42, z!]}>
            <mesh position={[0, -0.2, 0]}>
              <capsuleGeometry args={[0.04, 0.3, 3, 6]} />
              <meshStandardMaterial color="#5a3a24" />
            </mesh>
            <mesh position={[0, -0.39, 0]}>
              <cylinderGeometry args={[0.045, 0.05, 0.05, 8]} />
              <meshStandardMaterial color="#1a120c" />
            </mesh>
          </group>
        ))}
      </group>
      <mesh ref={tail} position={[-0.42, 0.65, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#f2f6ff" />
      </mesh>
      <group ref={neck} position={[0.33, 0.65, 0]}>
        <mesh position={[0.08, 0.15, 0]} rotation-z={-0.5}>
          <capsuleGeometry args={[0.07, 0.25, 4, 8]} />
          <meshStandardMaterial color={brown} />
        </mesh>
        <group position={[0.2, 0.33, 0]}>
          <mesh scale={[1.4, 0.85, 0.85]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color={brown} />
          </mesh>
          <mesh position={[0.12, -0.03, 0]} scale={[1, 0.8, 0.9]}>
            <sphereGeometry args={[0.065, 10, 10]} />
            <meshStandardMaterial color={belly} />
          </mesh>
          <mesh position={[0.18, -0.02, 0]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color={phase === 0 ? "#ff3030" : "#2a1a12"} toneMapped={false} />
          </mesh>
          <group ref={eyes}>
            {[-0.06, 0.06].map((z) => (
              <mesh key={z} position={[0.04, 0.035, z]}>
                <sphereGeometry args={[0.018, 6, 6]} />
                <meshBasicMaterial color="#0d0806" />
              </mesh>
            ))}
          </group>
          <group ref={ears}>
            {[-0.08, 0.08].map((z) => (
              <mesh key={z} position={[-0.06, 0.06, z]} rotation-x={z > 0 ? 0.5 : -0.5}>
                <coneGeometry args={[0.025, 0.09, 6]} />
                <meshStandardMaterial color={brown} />
              </mesh>
            ))}
          </group>
          {[-0.05, 0.05].map((z) => (
            <group key={z} position={[-0.05, 0.08, z]} rotation-x={z > 0 ? 0.4 : -0.4}>
              <mesh position={[0, 0.12, 0]}>
                <cylinderGeometry args={[0.012, 0.015, 0.25, 4]} />
                <meshStandardMaterial color="#d8c3a0" />
              </mesh>
              <mesh position={[0.05, 0.16, 0]} rotation-z={-0.8}>
                <cylinderGeometry args={[0.01, 0.012, 0.12, 4]} />
                <meshStandardMaterial color="#d8c3a0" />
              </mesh>
              <mesh position={[-0.04, 0.2, 0]} rotation-z={0.7}>
                <cylinderGeometry args={[0.008, 0.01, 0.1, 4]} />
                <meshStandardMaterial color="#d8c3a0" />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

function Gingerbread({ p, phase }: { p: [number, number, number]; phase: number }) {
  const g = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 4 + phase;
    if (g.current) {
      g.current.position.y = p[1] + Math.abs(Math.sin(t)) * 0.12;
      g.current.rotation.z = Math.sin(t) * 0.25;
      g.current.rotation.y = Math.sin(t * 0.25) * 1.2;
    }
    if (armL.current) armL.current.rotation.z = 1.2 + Math.sin(t * 2) * 0.6;
    if (armR.current) armR.current.rotation.z = -1.2 - Math.sin(t * 2 + 1) * 0.6;
  });
  const c = "#b8692e";
  return (
    <group ref={g} position={p} scale={0.9}>
      <mesh position={[0, 0.28, 0]}>
        <capsuleGeometry args={[0.1, 0.16, 4, 10]} />
        <meshStandardMaterial color={c} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color={c} roughness={0.8} />
      </mesh>
      {[0.32, 0.24].map((y) => (
        <mesh key={y} position={[0, y, 0.1]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color={y > 0.3 ? "#e63946" : "#2a9d8f"} />
        </mesh>
      ))}
      {[-0.035, 0.035].map((x) => (
        <mesh key={x} position={[x, 0.54, 0.09]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
      <mesh ref={armL} position={[-0.13, 0.35, 0]}>
        <capsuleGeometry args={[0.035, 0.12, 4, 6]} />
        <meshStandardMaterial color={c} />
      </mesh>
      <mesh ref={armR} position={[0.13, 0.35, 0]}>
        <capsuleGeometry args={[0.035, 0.12, 4, 6]} />
        <meshStandardMaterial color={c} />
      </mesh>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 0.07, 0]}>
          <capsuleGeometry args={[0.04, 0.08, 4, 6]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- scattered pines ----------
function Trees() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const snowRef = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const arr: { x: number; z: number; s: number }[] = [];
    const r = rng(7);
    const clear = [P.office, P.magic, P.qa, P.reindeer, P.elfops, P.cafe, P.mail, [0, 0, 0] as const];
    for (let i = 0; i < 260 && arr.length < 90; i++) {
      const a = r() * Math.PI * 2, d = 3 + r() * 8.2;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (clear.some((c) => Math.hypot(x - c[0], z - c[2]) < 2.6)) continue;
      if (Math.hypot(x + 3.5, z - 5) < 3) continue; // hangar strip
      arr.push({ x, z, s: 0.55 + r() * 0.6 });
    }
    return arr;
  }, []);
  useEffect(() => {
    const d = new THREE.Object3D();
    items.forEach((t, i) => {
      d.position.set(t.x, t.s * 0.7, t.z);
      d.scale.setScalar(t.s);
      d.updateMatrix();
      ref.current?.setMatrixAt(i, d.matrix);
      d.position.y = t.s * 1.05;
      d.scale.set(t.s * 0.62, t.s * 0.5, t.s * 0.62);
      d.updateMatrix();
      snowRef.current?.setMatrixAt(i, d.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    if (snowRef.current) snowRef.current.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow>
        <coneGeometry args={[0.45, 1.5, 7]} />
        <meshStandardMaterial color="#1c3b34" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={snowRef} args={[undefined, undefined, items.length]}>
        <coneGeometry args={[0.45, 0.9, 7]} />
        <meshStandardMaterial color="#eef3ff" roughness={0.8} />
      </instancedMesh>
    </>
  );
}

// ---------- mini city (2GIS-style dense blocks) ----------
const CITY_STEP = 1.5;
function useWindowTex() {
  return useMemo(() => {
    const t = canvasTex(64, 64, (g) => {
      g.fillStyle = "#000"; g.fillRect(0, 0, 64, 64);
      const r = rng(3);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        if (r() < 0.35) continue;
        g.fillStyle = r() < 0.8 ? "#ffcf6a" : "#fff2c4";
        g.fillRect(6 + x * 15, 6 + y * 15, 7, 9);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, []);
}
function City({ names }: { names: Record<string, string> }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const roof = useRef<THREE.InstancedMesh>(null);
  const win = useWindowTex();
  const items = useMemo(() => {
    const arr: { x: number; z: number; w: number; d: number; h: number; ry: number; tower: boolean }[] = [];
    const r = rng(42);
    const clear = [P.office, P.magic, P.qa, P.reindeer, P.elfops, P.cafe, P.mail];
    for (let gx = -12; gx <= 12; gx++) for (let gz = -12; gz <= 12; gz++) {
      if (gx % 4 === 0 || gz % 4 === 0) continue; // streets
      const x = gx * CITY_STEP + (r() - 0.5) * 0.2, z = gz * CITY_STEP + (r() - 0.5) * 0.2;
      const d = Math.hypot(x, z);
      if (d > 17.2 || d < 9.5) continue;
      if (clear.some((c) => Math.hypot(x - c[0], z - c[2]) < 2.8)) continue;
      if (Math.hypot(x + 2, z + 13) < 2.6) continue; // lake
      if (r() < 0.12) continue;
      const tower = r() < 0.1;
      arr.push({ x, z, w: 0.8 + r() * 0.4, d: 0.8 + r() * 0.4, h: tower ? 1.8 + r() * 1.4 : 0.6 + r() * 0.6, ry: (r() < 0.5 ? 0 : Math.PI / 2), tower });
    }
    return arr;
  }, []);
  const roads = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number] }[] = [];
    for (let k = -12; k <= 12; k += 4) {
      const c = k * CITY_STEP;
      const half = Math.sqrt(Math.max(0, 17.3 ** 2 - c * c));
      if (half < 1) continue;
      out.push({ p: [c, 0.03, 0], s: [0.45, half * 2] });
      out.push({ p: [0, 0.03, c], s: [half * 2, 0.45] });
    }
    return out;
  }, []);
  useEffect(() => {
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    const pal = ["#3b4466", "#46365a", "#5a3a3a", "#33485a", "#4a4a5e", "#6a4632"];
    items.forEach((b, i) => {
      o.position.set(b.x, b.h / 2, b.z);
      o.rotation.set(0, b.ry, 0);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      body.current?.setMatrixAt(i, o.matrix);
      body.current?.setColorAt(i, col.set(pal[i % pal.length]!));
      o.position.set(b.x, b.h + (b.tower ? 0.35 : 0.3), b.z);
      o.rotation.set(0, b.ry + Math.PI / 4, 0);
      o.scale.set(b.w * 0.78, b.tower ? 0.7 : 0.6, b.d * 0.78);
      o.updateMatrix();
      roof.current?.setMatrixAt(i, o.matrix);
    });
    for (const m of [body.current, roof.current]) if (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }, [items]);
  return (
    <group>
      {roads.map((r, i) => (
        <mesh key={i} position={r.p} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={r.s} />
          <meshStandardMaterial color="#2a2f45" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[-2, 0.04, -13]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[2.4, 40]} />
        <meshPhysicalMaterial color="#5f86d8" emissive="#1b3a80" emissiveIntensity={0.4} roughness={0.1} clearcoat={1} />
      </mesh>
      <instancedMesh ref={body} args={[undefined, undefined, items.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial emissiveMap={win} emissive="#ffc36a" emissiveIntensity={1.6} roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={roof} args={[undefined, undefined, items.length]} castShadow>
        <coneGeometry args={[0.75, 1, 4]} />
        <meshStandardMaterial color="#e6ecfa" roughness={0.85} flatShading />
      </instancedMesh>
    </group>
  );
}

// ---------- snow with wind ----------
function Snowfall() {
  const N = 1600;
  const ref = useRef<THREE.Points>(null);
  const stormK = useRef(0);
  const tex = useGlowTex();
  const { pos, vel } = useMemo(() => {
    const pos = new Float32Array(N * 3), vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 34;
      pos[i * 3 + 1] = -6 + Math.random() * 22;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 34;
      vel[i] = 0.4 + Math.random() * 0.8;
    }
    return { pos, vel };
  }, []);
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    stormK.current += ((world.weather === "storm" ? 1 : 0) - stormK.current) * (1 - Math.exp(-1.2 * dt));
    const sk = stormK.current;
    const m = ref.current?.material as THREE.PointsMaterial | undefined;
    if (m) { const target = SNOW_AMOUNT[world.weather] * 0.95; m.opacity += (target - m.opacity) * (1 - Math.exp(-1.5 * dt)); m.visible = m.opacity > 0.02; }
    const wind = (0.6 + Math.sin(t * 0.3) * 0.5) * (1 + sk * 6);
    const a = ref.current?.geometry.attributes["position"] as THREE.BufferAttribute | undefined;
    if (!a) return;
    for (let i = 0; i < N; i++) {
      pos[i * 3]! += (wind + Math.sin(t * 1.3 + i) * 0.3) * dt;
      pos[i * 3 + 1]! -= vel[i]! * dt * (0.6 + sk * 2.4);
      pos[i * 3 + 2]! += Math.cos(t * 0.9 + i * 0.7) * 0.25 * dt;
      if (pos[i * 3 + 1]! < 0) {
        pos[i * 3 + 1] = 16;
        pos[i * 3] = (Math.random() - 0.5) * 34 - 6;
      }
      if (pos[i * 3]! > 17) pos[i * 3]! -= 34;
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial map={tex} size={0.09} transparent depthWrite={false} opacity={0.9} color="#ffffff" />
    </points>
  );
}

// ---------- markers ----------
function Marker({ loc, hovered, onHover, onSelect, hideCard }: {
  loc: QuestLocation; hovered: boolean; hideCard: boolean;
  onHover: (id: string | null) => void; onSelect: (l: QuestLocation) => void;
}) {
  const gem = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, d) => {
    const t = clock.elapsedTime;
    if (gem.current) {
      gem.current.rotation.y += d * 1.2;
      gem.current.position.y = Math.sin(t * 2 + loc.position[0]) * 0.12;
      gem.current.scale.setScalar(THREE.MathUtils.lerp(gem.current.scale.x, hovered ? 1.5 : 1, 0.1));
    }
  });
  return (
    <group position={loc.position}>
      <mesh
        ref={gem}
        onPointerOver={(e) => { e.stopPropagation(); onHover(loc.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = ""; }}
        onClick={(e) => { e.stopPropagation(); onSelect(loc); }}
      >
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color={LIME} emissive={LIME} emissiveIntensity={hovered ? 6 : 3} toneMapped={false} />
      </mesh>
      <Sparkles count={hovered ? 60 : 24} scale={[2.6, 2.2, 2.6]} size={hovered ? 5 : 3} speed={0.5} color={LIME} position={[0, -1, 0]} />
      {hovered && !hideCard && (
        <Html position={[0, 0.7, 0]} center distanceFactor={10} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="glass-card animate-card-in w-72 rounded-xl p-4">
            <p className="font-display text-[10px] uppercase tracking-[0.3em] text-gold/80">{loc.subtitle}</p>
            <h3 className="font-display mt-1 text-lg text-gold">{loc.name}</h3>
            <p className="mt-2 font-body text-sm leading-snug text-parchment/85">{loc.description}</p>
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------- mountain ring with snowy pines around the floating island ----------
function makePeak(seed: number) {
  const r = rng(seed);
  const g = new THREE.ConeGeometry(1, 1, 28, 14);
  g.translate(0, 0.5, 0);
  const p = g.attributes["position"]!;
  const ph = [r() * 10, r() * 10, r() * 10];
  const cols: number[] = [];
  const rock = new THREE.Color("#4d566b"), rock2 = new THREE.Color("#6b7389"), snowC = new THREE.Color("#f3f6fc"), c = new THREE.Color();
  const snowLine = 0.45 + r() * 0.15;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    // ridges + crags
    const n = Math.sin(a * 3 + ph[0]!) * 0.18 + Math.sin(a * 7 + y * 6 + ph[1]!) * 0.09 + Math.sin(a * 17 + y * 13 + ph[2]!) * 0.04;
    const k = 1 + n * (1 - y * 0.6);
    x *= k; z *= k;
    y += Math.sin(a * 5 + ph[1]!) * 0.04 * (1 - y);
    if (y > 0.97) { x += 0.05 * Math.sin(ph[0]!); }
    p.setXYZ(i, x, y, z);
    const crag = Math.sin(a * 11 + y * 20 + ph[2]!) * 0.08;
    if (y + crag > snowLine) c.copy(snowC);
    else c.copy(rock).lerp(rock2, (Math.sin(a * 9 + y * 30) + 1) / 2 * 0.6).lerp(snowC, Math.max(0, (y - 0.15)) * 0.35);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

function Mountains() {
  const data = useMemo(() => {
    const r = rng(77);
    const geos = Array.from({ length: 6 }, (_, i) => makePeak(100 + i));
    const peaks: { p: [number, number, number]; h: number; w: number; d: number; rot: number; g: number }[] = [];
    // two ranges: nearer foothills and tall back ridge
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 22 : 30;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.2;
        const R = ring ? 62 + r() * 14 : 40 + r() * 8;
        const h = ring ? 26 + r() * 22 : 9 + r() * 10;
        const w = ring ? 16 + r() * 10 : 8 + r() * 6;
        peaks.push({ p: [Math.cos(a) * R, -0.5, Math.sin(a) * R], h, w, d: w * (0.7 + r() * 0.5), rot: r() * Math.PI, g: Math.floor(r() * geos.length) });
      }
    }
    const pines: [number, number, number, number][] = [];
    for (let i = 0; i < 320; i++) {
      const a = r() * Math.PI * 2, R = 21 + Math.pow(r(), 0.8) * 20;
      pines.push([Math.cos(a) * R, 0, Math.sin(a) * R, 1.4 + r() * 2.2]);
    }
    return { geos, peaks, pines };
  }, []);
  const pineRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
    data.pines.forEach(([x, y, z, h], i) => {
      v.set(x, y + h * 0.55, z); sc.set(h * 0.3, h * 0.9, h * 0.3); m.compose(v, q, sc); pineRef.current?.setMatrixAt(i, m);
      v.set(x, y + h * 0.8, z); sc.set(h * 0.2, h * 0.45, h * 0.2); m.compose(v, q, sc); capRef.current?.setMatrixAt(i, m);
      v.set(x, y + h * 0.08, z); sc.set(h * 0.05, h * 0.16, h * 0.05); m.compose(v, q, sc); trunkRef.current?.setMatrixAt(i, m);
    });
    for (const r of [pineRef, capRef, trunkRef]) if (r.current) r.current.instanceMatrix.needsUpdate = true;
  }, [data]);
  return (
    <group>
      {data.peaks.map((k, i) => (
        <mesh key={i} geometry={data.geos[k.g]!} position={k.p} rotation-y={k.rot} scale={[k.w, k.h, k.d]}>
          <meshStandardMaterial vertexColors roughness={0.95} flatShading />
        </mesh>
      ))}
      <instancedMesh ref={pineRef} args={[undefined, undefined, data.pines.length]}>
        <coneGeometry args={[1, 1, 8]} />
        <meshStandardMaterial color="#1b3f33" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[undefined, undefined, data.pines.length]}>
        <coneGeometry args={[1, 1, 8]} />
        <meshStandardMaterial color="#eef3fb" roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, data.pines.length]}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshStandardMaterial color="#4a3222" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

// ---------- PR points: HR desk & bulletin board ----------
function Poi({ p, rot, label, onOpen, children }: { p: [number, number, number]; rot: number; label: string; onOpen?: (() => void) | undefined; children: ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <group position={p} rotation-y={rot} scale={hover ? 1.06 : 1}
      onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
      {children}
      <Html position={[0, 2.3, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
        <span className="map-label">{label}</span>
      </Html>
    </group>
  );
}
function HRDesk({ onOpen }: { onOpen?: (() => void) | undefined }) {
  const wood = "#8a5a32";
  return (
    <Poi p={[-2.9, 0, 2.4]} rot={0.8} label="● 2GIS Talent Acquisition Desk" onOpen={onOpen}>
      <mesh position-y={0.45} castShadow><boxGeometry args={[1.6, 0.9, 0.6]} /><meshStandardMaterial color={wood} roughness={0.8} /></mesh>
      <mesh position-y={0.93}><boxGeometry args={[1.75, 0.06, 0.72]} /><meshStandardMaterial color="#eef3ff" roughness={0.9} /></mesh>
      {[-0.75, 0.75].map((x) => <mesh key={x} position={[x, 1.3, -0.25]}><cylinderGeometry args={[0.05, 0.05, 1.4]} /><meshStandardMaterial color={wood} /></mesh>)}
      <mesh position={[0, 1.95, -0.25]}><boxGeometry args={[1.8, 0.12, 0.6]} /><meshStandardMaterial color="#c8102e" roughness={0.6} /></mesh>
      <mesh position={[0, 0.6, 0.31]}><planeGeometry args={[1.1, 0.35]} /><meshStandardMaterial color="#c8f03c" emissive="#c8f03c" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.4, 1.05, 0]}><boxGeometry args={[0.35, 0.22, 0.03]} /><meshStandardMaterial color="#1a2458" emissive="#4cc9f0" emissiveIntensity={0.8} /></mesh>
    </Poi>
  );
}
function Board({ onOpen }: { onOpen?: (() => void) | undefined }) {
  const notes = ["#fff6d6", "#d7f5ff", "#ffe0e6", "#e9ffd1", "#fff6d6"];
  return (
    <Poi p={[3.6, 0, -1.4]} rot={-1.2} label="● Доска объявлений" onOpen={onOpen}>
      {[-0.8, 0.8].map((x) => <mesh key={x} position={[x, 0.9, 0]} castShadow><boxGeometry args={[0.12, 1.8, 0.12]} /><meshStandardMaterial color="#6b4226" /></mesh>)}
      <mesh position-y={1.3} castShadow><boxGeometry args={[1.7, 1.0, 0.08]} /><meshStandardMaterial color="#9a6a3c" roughness={0.85} /></mesh>
      <mesh position={[0, 1.88, 0]} rotation-z={Math.PI / 4}><boxGeometry args={[0.01, 0.01, 0.01]} /></mesh>
      <mesh position={[0, 1.95, 0]}><boxGeometry args={[1.9, 0.12, 0.3]} /><meshStandardMaterial color="#eef3ff" /></mesh>
      {notes.map((c, i) => (
        <mesh key={i} position={[-0.55 + (i % 3) * 0.55, 1.5 - Math.floor(i / 3) * 0.42, 0.05]} rotation-z={(i % 2 ? 1 : -1) * 0.08}>
          <planeGeometry args={[0.42, 0.32]} /><meshStandardMaterial color={c} roughness={0.9} />
        </mesh>
      ))}
    </Poi>
  );
}

// ---------- grand chest next to the tree ----------
function GrandChest({ unlocked, onOpen }: { unlocked: boolean; onOpen?: (() => void) | undefined }) {
  const lid = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useFrame(({ clock }, d) => {
    const t = clock.elapsedTime;
    if (lid.current) {
      const target = unlocked ? -0.35 - Math.sin(t * 2) * 0.08 : 0;
      lid.current.rotation.x += (target - lid.current.rotation.x) * Math.min(1, d * 4);
    }
  });
  return (
    <group position={CHEST_POS} rotation-y={-0.7} scale={0.9}
      onClick={(e) => { e.stopPropagation(); if (unlocked) onOpen?.(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = unlocked ? "pointer" : "not-allowed"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
      <mesh position-y={0.35} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.7, 0.85]} />
        <meshStandardMaterial color="#7a3d1c" roughness={0.75} />
      </mesh>
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.36, 0]}><boxGeometry args={[0.1, 0.74, 0.88]} /><meshStandardMaterial color="#d9a83a" metalness={0.9} roughness={0.3} /></mesh>
      ))}
      <group ref={lid} position={[0, 0.7, -0.42]}>
        <mesh position={[0, 0.12, 0.42]} castShadow>
          <boxGeometry args={[1.34, 0.26, 0.9]} />
          <meshStandardMaterial color="#8a4622" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.27, 0.42]}><boxGeometry args={[1.36, 0.06, 0.92]} /><meshStandardMaterial color="#eef3ff" roughness={0.9} /></mesh>
      </group>
      <mesh position={[0, 0.55, 0.44]}>
        <boxGeometry args={[0.2, 0.24, 0.05]} />
        <meshStandardMaterial color={unlocked ? "#c8f03c" : "#9aa0b4"} emissive={unlocked ? "#c8f03c" : "#000000"} emissiveIntensity={unlocked ? 1.5 : 0} metalness={0.8} roughness={0.3} />
      </mesh>
      {unlocked && (
        <mesh position-y={0.75}><sphereGeometry args={[0.3, 16, 16]} /><meshBasicMaterial color="#ffe08a" transparent opacity={0.5} toneMapped={false} /></mesh>
      )}
      <Html position={[0, 1.6, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
        <span className="map-label">{unlocked ? "✦ Грандиозный сундук" : "🔒 Сундук · пройди 5 квестов"}</span>
      </Html>
    </group>
  );
}

// ---------- camera rig + intro ----------
const HOME_POS = new THREE.Vector3(13, 15, 15);
const HOME_TGT = new THREE.Vector3(0, 0.8, 0);
const INTRO_DUR = 6.5;
// opens on a wide panorama of the island, then glides forward and down into the village
const INTRO_START = new THREE.Vector3(30, 22, 34);
const introCurve = new THREE.CatmullRomCurve3([
  INTRO_START.clone(),
  new THREE.Vector3(24, 19, 27),
  new THREE.Vector3(17, 16.5, 20),
  HOME_POS.clone(),
]);
export const CHEST_POS: [number, number, number] = [2.4, 0, 2.6];
const CHEST_CAM = new THREE.Vector3(4.6, 2.2, 5.4);
const CHEST_TGT = new THREE.Vector3(2.4, 0.6, 2.6);
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const CAFE_V = new THREE.Vector3(...P.cafe);
const HANGAR_V = new THREE.Vector3(...P.reindeer);

const _tt = new THREE.Vector3();
const _tp = new THREE.Vector3();
function CameraRig({ focus, hoverId, controls, dofRef, skipIntro, onIntroDone, finale }: {
  finale: boolean;
  dofRef: React.RefObject<{ cocMaterial: { worldFocusDistance: number } } | null>;
  focus: QuestLocation | null; hoverId: string | null;
  controls: React.RefObject<OrbitImpl | null>;
  skipIntro: boolean; onIntroDone: () => void;
}) {
  const { camera } = useThree();
  const flying = useRef(false);
  const intro = useRef(skipIntro ? INTRO_DUR : 0);
  const prevFocus = useRef<QuestLocation | null>(null);
  const audioTick = useRef(0);
  useEffect(() => {
    if (skipIntro) { camera.position.copy(HOME_POS); onIntroDone(); }
  }, [skipIntro, onIntroDone, camera]);
  const delay = useRef(0);
  const lastInput = useRef(performance.now());
  const tour = useRef({ on: false, ang: 0, i: 0, t: 0 });
  useEffect(() => {
    const poke = () => { lastInput.current = performance.now(); tour.current.on = false; };
    const evs = ["pointerdown", "wheel", "keydown", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, poke, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, poke));
  }, []);
  useEffect(() => {
    if (focus !== prevFocus.current) { flying.current = true; delay.current = focus ? 0.55 : 0; }
    prevFocus.current = focus;
  }, [focus]);
  useEffect(() => { flying.current = true; delay.current = 0; }, [finale]);
  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(delta, 0.05);
    const k = 1 - Math.exp(-2.2 * dt);
    if (intro.current < INTRO_DUR) {
      intro.current += dt;
      const u = ease(Math.min(intro.current / INTRO_DUR, 1));
      camera.position.copy(introCurve.getPointAt(u));
      c.target.copy(HOME_TGT);
      c.enabled = false;
      if (intro.current >= INTRO_DUR) {
        c.enabled = true;
        onIntroDone();
      }
    } else if (flying.current && delay.current > 0) {
      delay.current -= dt; // let the magic burst play before the fly-in
    } else if (flying.current) {
      const tp = finale ? CHEST_CAM : focus ? new THREE.Vector3(...focus.camera) : HOME_POS;
      const tt = finale ? CHEST_TGT : focus ? new THREE.Vector3(...focus.position).setY(focus.position[1] - 1.8) : HOME_TGT;
      camera.position.lerp(tp, k);
      c.target.lerp(tt, k);
      if (camera.position.distanceTo(tp) < 0.05) flying.current = false;
    } else if (!focus && !finale && performance.now() - lastInput.current > 12000) {
      // idle: slow cinematic drift around the village, visiting campuses in turn
      const T = tour.current;
      if (!T.on) { T.on = true; T.ang = Math.atan2(camera.position.z - c.target.z, camera.position.x - c.target.x); T.t = 0; }
      T.t += dt; T.ang += dt * 0.07;
      if (T.t > 9) { T.t = 0; T.i = (T.i + 1) % LOCATIONS.length; }
      const loc = LOCATIONS[T.i];
      const kk = 1 - Math.exp(-0.35 * dt);
      _tt.set((loc?.position[0] ?? 0) * 0.6, 0.8, (loc?.position[2] ?? 0) * 0.6);
      c.target.lerp(_tt, kk);
      const r = 17 + Math.sin(T.ang * 1.7) * 4;
      _tp.set(c.target.x + Math.cos(T.ang) * r, 7 + Math.sin(T.ang * 1.3) * 2.5, c.target.z + Math.sin(T.ang) * r);
      camera.position.lerp(_tp, kk);
    } else if (!focus && !finale) {
      const h = LOCATIONS.find((l) => l.id === hoverId);
      const tt = h ? new THREE.Vector3(...h.position).multiplyScalar(0.25).add(HOME_TGT) : HOME_TGT;
      c.target.lerp(tt, k * 0.5);
      if (h) {
        const dir = camera.position.clone().sub(c.target);
        if (dir.length() > 13) camera.position.sub(dir.normalize().multiplyScalar(k * 0.6));
      }
    }
    if (dofRef.current) dofRef.current.cocMaterial.worldFocusDistance = camera.position.distanceTo(c.target);
    audioTick.current += dt;
    if (audioTick.current > 0.25) {
      audioTick.current = 0;
      const prox = (v: THREE.Vector3) => THREE.MathUtils.clamp((9 - camera.position.distanceTo(v)) / 5, 0, 1);
      setZoneMix(prox(CAFE_V), prox(HANGAR_V));
    }
  });
  return null;
}

// ---------- time of day: eases sky, fog, lights and glow toward the active preset ----------
function TimeOfDay({ phase, storm }: { phase: Phase; storm: boolean }) {
  const { scene } = useThree();
  const hemi = useRef<THREE.HemisphereLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const tmp = useMemo(() => ({ c: new THREE.Color(), v: new THREE.Vector3() }), []);
  useEffect(() => {
    if (!scene.background) scene.background = new THREE.Color(PRESETS[phase].sky);
    if (!scene.fog) scene.fog = new THREE.Fog(PRESETS[phase].fog, 34, 130);
  }, [scene, phase]);
  useFrame(({ clock }, d) => {
    const k = 1 - Math.exp(-1.6 * Math.min(d, 0.05));
    const p = PRESETS[phase];
    (scene.background as THREE.Color).lerp(tmp.c.set(storm ? "#4a5578" : p.sky), k);
    const fog = scene.fog as THREE.Fog;
    fog.color.lerp(tmp.c.set(storm ? "#5a6588" : p.fog), k);
    fog.near += ((storm ? 16 : 34) - fog.near) * k;
    fog.far += ((storm ? 60 : 130) - fog.far) * k;
    if (hemi.current) {
      hemi.current.color.lerp(tmp.c.set(p.hemiSky), k);
      hemi.current.groundColor.lerp(tmp.c.set(p.hemiGround), k);
      hemi.current.intensity += (p.hemi - hemi.current.intensity) * k;
    }
    if (amb.current) amb.current.intensity += (p.ambient - amb.current.intensity) * k;
    if (sun.current) {
      sun.current.color.lerp(tmp.c.set(p.sun), k);
      sun.current.intensity += ((storm ? p.sunI * 0.5 : p.sunI) - sun.current.intensity) * k;
      sun.current.position.lerp(tmp.v.set(...p.sunPos), k);
    }
    world.glow += (p.glow - world.glow) * k;
    world.aurora += ((storm ? 0 : p.aurora * auroraWave(clock.elapsedTime)) - world.aurora) * k * 0.5;
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={["#5d78c9", "#1a1630", 0.75]} />
      <ambientLight ref={amb} color="#ffcf9a" intensity={0.18} />
      <directionalLight ref={sun} position={[-8, 14, -6]} color="#9fb8ff" intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    </>
  );
}

function Ready() {
  useEffect(() => {
    const id = requestAnimationFrame(() => document.getElementById("quest-canvas")?.setAttribute("data-scene-ready", "true"));
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

export default function Scene({ focus, hoverId, onHover, onSelect, onIntroDone, districtNames = {}, phase = "night", storm = false, completed = [], chestOpen = false, finale = false, onChest, onPoi, paused = false }: {
  paused?: boolean;
  chestOpen?: boolean; finale?: boolean; onChest?: () => void; onPoi?: (k: "hr" | "board") => void;
  phase?: Phase; storm?: boolean; completed?: string[];
  focus: QuestLocation | null; hoverId: string | null;
  onHover: (id: string | null) => void; onSelect: (l: QuestLocation) => void;
  onIntroDone: () => void; districtNames?: Record<string, string>;
}) {
  const controls = useRef<OrbitImpl | null>(null);
  const dofRef = useRef<{ cocMaterial: { worldFocusDistance: number } } | null>(null);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const noFx = params.has("nofx");
  const noDof = !params.has("dof");
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, 1.25));
  const skipIntro = params.has("nointro");
  const i: Interact = { onHover, onSelect };
  return (
    <div id="quest-canvas" className="absolute inset-0">
      <Canvas frameloop={paused ? "never" : "always"} dpr={dpr} camera={{ position: [30, 22, 34], fov: 42 }} gl={{ antialias: false }}>
        <color attach="background" args={["#0b1330"]} />
        <fog attach="fog" args={["#16214a", 34, 130]} />
        <TimeOfDay phase={phase} storm={storm} />
        {!storm && (phase === "night" || phase === "evening") && <Stars radius={70} depth={30} count={phase === "night" ? 1200 : 500} factor={phase === "night" ? 4 : 2.5} fade speed={0.6} />}
        <Aurora />
        <CabinGlow />
        <mesh position={[-18, 16, -26]}>
          <sphereGeometry args={[1.8, 32, 32]} />
          <meshBasicMaterial color="#f2f0ff" toneMapped={false} />
        </mesh>
        <Environment resolution={64}>
          <Lightformer intensity={0.6} color="#6f88d8" position={[0, 6, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
          <Lightformer intensity={0.8} color="#ffb070" position={[-5, 1, 3]} rotation-y={Math.PI / 2} scale={[12, 1, 1]} />
        </Environment>
        <Island />
        <Hit id="office" i={i}><Office /></Hit>
        <Hit id="magic" i={i}><MagicTower /></Hit>
        <Hit id="qa" i={i}><QAFactory /></Hit>
        <Hit id="reindeer" i={i}><Hangar /></Hit>
        <Hit id="elfops" i={i}><ElfOps /></Hit>
        <ChristmasTree />
        <Garlands />
        <Cafe />
        <MailDeck />
        <WalkingElf offset={0} color="#2d8a4e" gift="#e63946" />
        <WalkingElf offset={0.22} color="#c8102e" gift="#4cc9f0" />
        <WalkingElf offset={0.45} color="#2a9d8f" wave />
        <WalkingElf offset={0.63} color="#2d8a4e" gift="#e9c46a" />
        <WalkingElf offset={0.82} color="#7b2cbf" wave />
        <SneezeOnClick at={[-3.4, 0, 7.4] as [number, number, number]}><Reindeer p={[-3.4, 0, 7.4]} rot={0.4} phase={0} /></SneezeOnClick>
        <SneezeOnClick at={[-5.6, 0, 8] as [number, number, number]}><Reindeer p={[-5.6, 0, 8]} rot={-0.3} phase={2.5} /></SneezeOnClick>
        <SneezeOnClick at={[-7.6, 0, 6.4] as [number, number, number]}><Reindeer p={[-7.6, 0, 6.4]} rot={1.2} phase={5} /></SneezeOnClick>
        <Gingerbread p={[-1.5, 0, 8.1]} phase={0} />
        <Gingerbread p={[1.4, 0, 8.3]} phase={1.6} />
        <Gingerbread p={[0, 0, 8.6]} phase={3.1} />
        <Trees />
        <City names={districtNames} />
        <GingerHouse p={[8.9, 0, -0.2]} rot={-1.4} seed={0} />
        <GingerHouse p={[8.3, 0, 3.4]} rot={-1.0} seed={1} scale={1.25} sign="Волшебная пекарня" />
        <GingerHouse p={[3.2, 0, 8.5]} rot={-0.3} seed={2} />
        <Barn p={[-8.6, 0, 2.6]} rot={1.1} />
        <SneezeOnClick at={[-7.4, 0, 3.8] as [number, number, number]}><Reindeer p={[-7.4, 0, 3.8]} rot={2.2} phase={1.3} /></SneezeOnClick>
        <Living />
        {LOCATIONS.filter((l) => completed.includes(l.id)).map((l) => <GoldHalo key={l.id} p={[l.position[0], 0, l.position[2]]} h={l.position[1]} />)}
        <Footprints />
        <GrandChest unlocked={chestOpen} onOpen={onChest} />
        <HRDesk onOpen={() => onPoi?.("hr")} />
        <Board onOpen={() => onPoi?.("board")} />
        <Mountains />
        <Burst focus={focus} />
        <SantaSleigh />
        <Flicker />
        <Snowfall />
        <Sparkles count={70} scale={[24, 6, 24]} position={[0, 3, 0]} size={2.5} speed={0.3} color={GOLD} opacity={0.6} />
        {LOCATIONS.map((l) => (
          <Marker key={l.id} loc={l} hovered={hoverId === l.id || focus?.id === l.id} hideCard={!!focus} onHover={onHover} onSelect={onSelect} />
        ))}
        <OrbitControls
          ref={controls}
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.75}
          zoomSpeed={1}
          minDistance={3}
          maxDistance={48}
          maxPolarAngle={Math.PI / 2.15}
          enablePan={false}
          target={[0, 0.8, 0]}
        />
        <CameraRig focus={focus} hoverId={hoverId} controls={controls} dofRef={dofRef} skipIntro={skipIntro} onIntroDone={onIntroDone} finale={finale} />
        {!noFx && (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            {!noDof ? <DepthOfField ref={dofRef as never} worldFocusDistance={20} worldFocusRange={10} bokehScale={3} /> : <></>}
            <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.75} luminanceSmoothing={0.3} />
            <Vignette offset={0.25} darkness={0.75} />
          </EffectComposer>
        )}
        <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.6, d - 0.25))} onIncline={() => setDpr((d) => Math.min(1.25, d + 0.25))} />
        <Ready />
      </Canvas>
    </div>
  );
}
