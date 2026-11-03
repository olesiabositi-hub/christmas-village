import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world } from "./sim";

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rx = 1, ry = 1) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
}

// ---------- shared textures (created once) ----------
let logTex: THREE.CanvasTexture | null = null;
function useLogTex() {
  return useMemo(() => {
    if (logTex) return logTex;
    logTex = canvasTex(256, 256, (g) => {
      const n = 8, h = 256 / n;
      for (let i = 0; i < n; i++) {
        const y = i * h;
        const grd = g.createLinearGradient(0, y, 0, y + h);
        grd.addColorStop(0, "#1e120a"); grd.addColorStop(0.18, "#5a3a22"); grd.addColorStop(0.45, "#6e4a2c");
        grd.addColorStop(0.8, "#3e2716"); grd.addColorStop(1, "#140b06");
        g.fillStyle = grd; g.fillRect(0, y, 256, h);
        // grain streaks
        g.strokeStyle = "rgba(20,10,4,0.35)"; g.lineWidth = 1;
        for (let k = 0; k < 6; k++) {
          const yy = y + 5 + ((k * 37 + i * 13) % (h - 8));
          g.beginPath(); g.moveTo(0, yy);
          for (let x = 0; x <= 256; x += 32) g.lineTo(x, yy + Math.sin(x * 0.05 + k + i) * 1.5);
          g.stroke();
        }
        // knots
        g.fillStyle = "rgba(25,12,5,0.55)";
        g.beginPath(); g.ellipse((i * 71) % 230 + 12, y + h / 2, 6, 3, 0, 0, 6.28); g.fill();
      }
    });
    return logTex;
  }, []);
}
let endTex: THREE.CanvasTexture | null = null;
function useEndGrainTex() {
  return useMemo(() => {
    if (endTex) return endTex;
    endTex = canvasTex(64, 64, (g) => {
      g.fillStyle = "#b07a48"; g.fillRect(0, 0, 64, 64);
      for (let r = 30; r > 2; r -= 4) { g.strokeStyle = r % 8 ? "#8a5a32" : "#c99560"; g.lineWidth = 2; g.beginPath(); g.arc(32, 32, r, 0, 6.28); g.stroke(); }
    });
    return endTex;
  }, []);
}

// ---------- bulbs whose brightness follows time of day ----------
const bulbMats: THREE.MeshBasicMaterial[] = [];
const roomMats: THREE.MeshBasicMaterial[] = [];
const downLights: THREE.PointLight[] = [];
const base = new THREE.Color("#ffc46a");
const roomBase = new THREE.Color("#b9773e");
export function CabinGlow() {
  useFrame(({ clock }) => {
    const g = world.glow, t = clock.elapsedTime;
    bulbMats.forEach((m, i) => m.color.copy(base).multiplyScalar(0.6 + g * 1.4 + Math.sin(t * 2 + i) * 0.1));
    roomMats.forEach((m) => m.color.copy(roomBase).multiplyScalar(1 + g * 0.35));
    downLights.forEach((l) => { l.intensity = 2 + g * 6; });
  });
  return null;
}
function useBulbMat() {
  return useMemo(() => { const m = new THREE.MeshBasicMaterial({ color: "#ffc46a", toneMapped: false }); bulbMats.push(m); return m; }, []);
}

/** Sagging string of warm bulbs from a to b. */
function BulbString({ a, b, n = 12, sag = 0.08 }: { a: [number, number, number]; b: [number, number, number]; n?: number; sag?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useBulbMat();
  const geo = useMemo(() => new THREE.SphereGeometry(0.035, 6, 5), []);
  return (
    <instancedMesh
      ref={ref}
      args={[geo, mat, n]}
      onUpdate={(m) => {
        const o = new THREE.Object3D();
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1);
          o.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * sag - (i % 2 ? 0.025 : 0), a[2] + (b[2] - a[2]) * u);
          o.updateMatrix(); m.setMatrixAt(i, o.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
      }}
    />
  );
}

// ---------- tiny animated office behind glass ----------
function MiniElf({ color, kind, x, seed }: { color: string; kind: "type" | "walk" | "clip"; x: number; seed: number }) {
  const g = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const clip = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (!g.current) return;
    if (kind === "type") {
      g.current.position.y = Math.abs(Math.sin(t * 1.5)) * 0.004;
      if (armL.current) armL.current.rotation.x = -1.3 + Math.sin(t * 22) * 0.25;
      if (armR.current) armR.current.rotation.x = -1.3 + Math.sin(t * 22 + 1.7) * 0.25;
      g.current.rotation.y = Math.PI + Math.sin(t * 0.4) * 0.15;
    } else {
      // walk between desks, pause and read the clipboard
      const c = (t * 0.18) % 2, u = c < 1 ? c : 2 - c;
      const moving = Math.abs(((t * 0.18) % 1) - 0.5) < 0.38;
      g.current.position.x = x + (THREE.MathUtils.smoothstep(u, 0, 1) - 0.5) * 0.7;
      g.current.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.015 : 0;
      g.current.rotation.y = moving ? (c < 1 ? Math.PI / 2 : -Math.PI / 2) : 0;
      if (armL.current) armL.current.rotation.x = moving ? Math.sin(t * 12) * 0.6 : -1.2;
      if (armR.current) armR.current.rotation.x = moving ? -Math.sin(t * 12) * 0.6 : -1.0;
      if (clip.current) clip.current.rotation.x = -0.6 + Math.sin(t * 3) * 0.15;
    }
  });
  return (
    <group ref={g} position={[x, 0, kind === "type" ? 0.02 : 0.12]}>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.03, 0.05, 0.12, 8]} /><meshBasicMaterial color={color} /></mesh>
      <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.035, 10, 8]} /><meshBasicMaterial color="#f2c7a5" /></mesh>
      <mesh position={[0, 0.26, -0.005]} rotation-x={-0.3}><coneGeometry args={[0.03, 0.08, 8]} /><meshBasicMaterial color="#c8102e" /></mesh>
      <mesh ref={armL} position={[-0.05, 0.14, 0]}><boxGeometry args={[0.015, 0.015, 0.07]} /><meshBasicMaterial color={color} /></mesh>
      <mesh ref={armR} position={[0.05, 0.14, 0]}><boxGeometry args={[0.015, 0.015, 0.07]} /><meshBasicMaterial color={color} /></mesh>
      {kind !== "type" && (
        <mesh ref={clip} position={[0, 0.14, 0.05]}><boxGeometry args={[0.05, 0.065, 0.006]} /><meshBasicMaterial color="#fff1c8" toneMapped={false} /></mesh>
      )}
    </group>
  );
}
function OfficeBay({ p, w = 0.9, seed = 0 }: { p: [number, number, number]; w?: number; seed?: number }) {
  const roomMat = useMemo(() => { const m = new THREE.MeshBasicMaterial({ color: "#ffcf8a" }); roomMats.push(m); return m; }, []);
  const screens = useRef<THREE.MeshBasicMaterial[]>([]);
  useFrame(({ clock }) => {
    screens.current.forEach((m, i) => { if (m) m.color.setHSL(0.48 + Math.sin(clock.elapsedTime * 0.7 + i) * 0.03, 0.9, 0.55 + Math.sin(clock.elapsedTime * 9 + i * 3) * 0.04); });
  });
  const h = 0.55, d = 0.42;
  return (
    <group position={p}>
      {/* room shell (inside faces) */}
      <mesh position={[0, h / 2, 0.001]} material={roomMat}><planeGeometry args={[w, h]} /></mesh>
      <mesh position={[0, h, d / 2]} rotation-x={Math.PI / 2} material={roomMat}><planeGeometry args={[w, d]} /></mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[(sx * w) / 2, h / 2, d / 2]} rotation-y={-sx * Math.PI / 2} material={roomMat}><planeGeometry args={[d, h]} /></mesh>
      ))}
      {/* outer casing so the bay reads as a box from the side */}
      {[-1, 1].map((sx) => (
        <mesh key={`o${sx}`} position={[(sx * (w / 2 + 0.03)), h / 2, d / 2]}><boxGeometry args={[0.04, h + 0.06, d]} /><meshStandardMaterial color="#2a180c" roughness={0.9} /></mesh>
      ))}
      <mesh position={[0, h + 0.05, d / 2]}><boxGeometry args={[w + 0.1, 0.04, d + 0.04]} /><meshStandardMaterial color="#2a180c" roughness={0.9} /></mesh>
      <mesh position={[0, h + 0.1, d / 2]} scale={[1, 0.5, 1]}><boxGeometry args={[w + 0.14, 0.12, d + 0.1]} /><meshStandardMaterial color="#f4f8ff" roughness={1} /></mesh>
      {/* back wall stripe + floor */}
      <mesh position={[0, 0.005, d / 2]} rotation-x={-Math.PI / 2}><planeGeometry args={[w - 0.01, d - 0.01]} /><meshBasicMaterial color="#7a4a26" /></mesh>
      {/* desks + monitors */}
      {[-w / 4, w / 4].map((x, i) => (
        <group key={x} position={[x, 0, 0.12]}>
          <mesh position={[0, 0.09, 0]}><boxGeometry args={[0.26, 0.02, 0.12]} /><meshBasicMaterial color="#4a2c16" /></mesh>
          <mesh position={[0, 0.16, -0.03]}>
            <boxGeometry args={[0.12, 0.08, 0.01]} />
            <meshBasicMaterial ref={(m) => { if (m) screens.current[i] = m; }} color="#5ef0d8" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <MiniElf color="#2d8a4e" kind="type" x={-w / 4} seed={seed} />
      <MiniElf color="#c8102e" kind="type" x={w / 4} seed={seed + 2} />
      <MiniElf color="#2a9d8f" kind="clip" x={0} seed={seed + 4} />
      {/* glass + frame */}
      <mesh position={[0, h / 2, d + 0.005]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.12} roughness={0.05} metalness={0} depthWrite={false} />
      </mesh>
      {[[0, h + 0.02, w + 0.08, 0.05], [0, -0.02, w + 0.08, 0.05], [0, h / 2, 0.035, h], [-w / 2 - 0.02, h / 2, 0.05, h + 0.04], [w / 2 + 0.02, h / 2, 0.05, h + 0.04]].map(([x, y, sw, sh], k) => (
        <mesh key={k} position={[x!, y!, d + 0.01]}><boxGeometry args={[sw!, sh!, 0.04]} /><meshStandardMaterial color="#2a180c" roughness={0.9} /></mesh>
      ))}
      {/* snow on the sill */}
      <mesh position={[0, -0.04, d + 0.04]} rotation-z={Math.PI / 2} scale={[0.35, 1, 1]}><capsuleGeometry args={[0.05, w, 4, 8]} /><meshStandardMaterial color="#f6f9ff" roughness={1} /></mesh>
    </group>
  );
}

// ---------- log cabin ----------
export type CabinProps = {
  w: number; d: number; h: number; pitch?: number; rot?: number; seed?: number;
  door?: boolean; bay?: boolean; children?: ReactNode;
};
export function LogCabin({ w, d, h, pitch = 0.62, rot = 0, seed = 0, door = true, bay = true, children }: CabinProps) {
  const log = useLogTex();
  const endGrain = useEndGrainTex();
  const wallMat = useMemo(() => {
    const t = log.clone(); t.needsUpdate = true; t.repeat.set(w / 1.6, h / 1.2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, color: "#ffffff" });
  }, [log, w, h]);
  const sideMat = useMemo(() => {
    const t = log.clone(); t.needsUpdate = true; t.repeat.set(d / 1.6, h / 1.2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  }, [log, d, h]);
  const light = useRef<THREE.PointLight>(null);
  const rise = (w / 2) * Math.tan(pitch);
  const slope = (w / 2) / Math.cos(pitch);
  const over = 0.35;
  const snowT = 0.28;
  // corner log ends (Finnish saddle-notch look)
  const ends = useMemo(() => {
    const out: [number, number, number, number][] = [];
    const n = Math.round(h / 0.15);
    for (let i = 0; i < n; i++) {
      const y = 0.075 + i * (h / n);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        if (i % 2) out.push([sx * (w / 2 + 0.06), y, sz * (d / 2 - 0.02), 0]);
        else out.push([sx * (w / 2 - 0.02), y, sz * (d / 2 + 0.06), 1]);
      }
    }
    return out;
  }, [w, d, h]);
  const icicles = useMemo(() => Array.from({ length: Math.round(w * 4) }, (_, i) => ({ x: -w / 2 - over + 0.15 + (i / (w * 4)) * (w + over * 2 - 0.3), l: 0.06 + ((i * 7 + seed * 3) % 5) * 0.03 })), [w, seed]);
  return (
    <group rotation-y={rot}>
      {/* stone base */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[w + 0.2, 0.16, d + 0.2]} />
        <meshStandardMaterial color="#5b5f6b" roughness={1} />
      </mesh>
      {/* log walls: front/back use wall texture, sides use side texture */}
      <mesh position={[0, h / 2 + 0.1, 0]} castShadow receiveShadow material={[sideMat, sideMat, wallMat, wallMat, wallMat, wallMat]}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* gable triangles */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, h + 0.1, s * (d / 2)]} rotation-y={s < 0 ? Math.PI : 0} material={wallMat}>
          <shapeGeometry args={[new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)])]} />
        </mesh>
      ))}
      {ends.map(([x, y, z, ax], k) => (
        <mesh key={k} position={[x, y + 0.1, z]} rotation={ax ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.075, 0.075, 0.16, 8]} />
          <meshStandardMaterial map={endGrain} roughness={1} />
        </mesh>
      ))}
      {/* roof: dark planks + thick fluffy snow blanket overhanging */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 4), h + 0.1 + rise / 2, 0]} rotation-z={-s * pitch}>
          <mesh castShadow position={[0, 0.04, 0]}>
            <boxGeometry args={[slope + over, 0.08, d + over * 2]} />
            <meshStandardMaterial color="#2a1c12" roughness={1} />
          </mesh>
          <mesh castShadow position={[s * 0.03, 0.08 + snowT / 2, 0]} scale={[1, 1, 1]}>
            <boxGeometry args={[slope + over - 0.05, snowT, d + over * 2 + 0.02]} />
            <meshStandardMaterial color="#f4f8ff" roughness={1} />
          </mesh>
          {/* rounded overhanging snow lip at eave */}
          <mesh position={[s * ((slope + over) / 2), 0.03, 0]} rotation-x={Math.PI / 2}>
            <capsuleGeometry args={[snowT * 0.62, d + over * 2 - 0.1, 6, 12]} />
            <meshStandardMaterial color="#eef4ff" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* icicles + bulb strings under both eaves along the length (z) */}
      {[-1, 1].map((s) => {
        const ex = s * (w / 2 + over * Math.cos(pitch) - 0.05);
        const ey = h + 0.1 - over * Math.sin(pitch) - 0.08;
        return (
          <group key={s}>
            <BulbString a={[ex, ey, -d / 2 - over + 0.1]} b={[ex, ey, d / 2 + over - 0.1]} n={Math.round(d * 7)} />
            {icicles.slice(0, Math.round(d * 4)).map((ic, k) => (
              <mesh key={k} position={[ex, ey - 0.02 - ic.l / 2, -d / 2 - over + 0.15 + k * 0.25]} rotation-x={Math.PI}>
                <coneGeometry args={[0.02, ic.l, 5]} />
                <meshStandardMaterial color="#d8f0ff" roughness={0.1} transparent opacity={0.85} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* bulbs along front gable edge */}
      {[-1, 1].map((s) => (
        <BulbString key={s} a={[s * (w / 2 + 0.25), h + 0.1 - 0.12, d / 2 + over - 0.05]} b={[0, h + 0.1 + rise - 0.05, d / 2 + over - 0.05]} n={Math.round(w * 5)} sag={0.05} />
      ))}
      {/* door with porch lamp */}
      {door && (
        <group position={[bay ? -w / 4 - 0.1 : 0, 0.16, d / 2 + 0.01]}>
          <mesh position={[0, 0.42, 0]}><boxGeometry args={[0.5, 0.84, 0.05]} /><meshStandardMaterial color="#3a2010" roughness={0.9} /></mesh>
          <mesh position={[0.17, 0.42, 0.04]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#c9a14a" metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[0, 0.98, 0.05]}><sphereGeometry args={[0.07, 10, 8]} /><meshBasicMaterial color="#ffd89a" toneMapped={false} /></mesh>
        </group>
      )}
      {bay && <OfficeBay p={[door ? w / 4 + 0.05 : 0, 0.42, d / 2]} w={Math.min(1.2, w * 0.4)} seed={seed} />}
      <pointLight
        ref={(l) => { if (l && !downLights.includes(l)) downLights.push(l); light.current = l; }}
        position={[0, h - 0.1, d / 2 + 0.7]}
        color="#ffb562"
        intensity={8}
        distance={4.5}
        decay={1.6}
      />
      {children}
    </group>
  );
}

/** Rotation so a building at (x,z) faces point (cx,cz). */
export function faceTo(x: number, z: number, cx: number, cz: number) {
  return Math.atan2(cx - x, cz - z);
}

// ---------- gingerbread house (chocolate dough, icing, marmalade windows) ----------
let doughTex: THREE.CanvasTexture | null = null;
function useDoughTex() {
  return useMemo(() => {
    if (doughTex) return doughTex;
    doughTex = canvasTex(256, 256, (g) => {
      const grd = g.createLinearGradient(0, 0, 256, 256);
      grd.addColorStop(0, "#7a3e18"); grd.addColorStop(1, "#5a2a0e");
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) {
        const x = (i * 97) % 256, y = (i * 61 + (i * i) % 37) % 256;
        g.fillStyle = i % 3 ? "rgba(40,16,4,0.25)" : "rgba(190,110,50,0.25)";
        g.beginPath(); g.arc(x, y, 1 + (i % 3), 0, 6.28); g.fill();
      }
      // baked edge glaze
      g.strokeStyle = "rgba(255,190,120,0.12)"; g.lineWidth = 10; g.strokeRect(0, 0, 256, 256);
    });
    return doughTex;
  }, []);
}
function Icing({ a, b, r = 0.035 }: { a: [number, number, number]; b: [number, number, number]; r?: number }) {
  const { pos, len, q } = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    return { pos: va.clone().add(vb).multiplyScalar(0.5), len: dir.length(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()) };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={q}>
      <capsuleGeometry args={[r, len, 4, 8]} />
      <meshStandardMaterial color="#fffaf2" roughness={0.35} />
    </mesh>
  );
}
export function GingerHouse({ p, rot = 0, seed = 0, scale = 1, sign }: { p: [number, number, number]; rot?: number; seed?: number; scale?: number; sign?: string }) {
  const dough = useDoughTex();
  const marm = useRef<THREE.MeshPhysicalMaterial[]>([]);
  useFrame(({ clock }) => {
    const g = world.glow;
    marm.current.forEach((m, i) => { if (m) m.emissiveIntensity = 0.8 + g * 1.6 + Math.sin(clock.elapsedTime * 2.5 + i + seed) * 0.25; });
  });
  const signTex = useMemo(() => sign ? canvasTex(512, 128, (g) => {
    g.fillStyle = "#3a1808"; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = "#fffaf2"; g.lineWidth = 8; g.setLineDash([14, 10]); g.strokeRect(8, 8, 496, 112);
    g.font = "bold 52px Onest, Georgia, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = "#ff9a2a"; g.shadowBlur = 18; g.fillStyle = "#ffd28a"; g.fillText(sign, 256, 66);
  }) : null, [sign]);
  const W = 1.3, D = 1.1, H = 1.0, pitch = 0.75, rise = (W / 2) * Math.tan(pitch), slope = (W / 2) / Math.cos(pitch);
  const candy = ["#e63946", "#2a9d8f", "#f4a261", "#c8f03c"];
  const wins: [number, number][] = [[-0.36, 0.55], [0.36, 0.55]];
  return (
    <group position={p} rotation-y={rot} scale={scale}>
      <mesh position={[0, H / 2, 0]} castShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial map={dough} roughness={0.75} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, H, s * (D / 2)]} rotation-y={s < 0 ? Math.PI : 0}>
          <shapeGeometry args={[new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, rise)])]} />
          <meshStandardMaterial map={dough} roughness={0.75} />
        </mesh>
      ))}
      {/* chocolate roof slabs with thick icing */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (W / 4), H + rise / 2, 0]} rotation-z={-s * pitch}>
          <mesh castShadow position={[0, 0.04, 0]}>
            <boxGeometry args={[slope + 0.2, 0.09, D + 0.3]} />
            <meshStandardMaterial color="#3a1a08" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[slope + 0.1, 0.05, D + 0.2]} />
            <meshStandardMaterial color="#fff6ee" roughness={0.6} />
          </mesh>
          {/* scalloped icing drips at eave */}
          {Array.from({ length: 8 }, (_, k) => (
            <mesh key={k} position={[s * ((slope + 0.2) / 2), 0, -D / 2 - 0.1 + (k / 7) * (D + 0.2)]}>
              <sphereGeometry args={[0.055, 8, 6]} />
              <meshStandardMaterial color="#fffaf2" roughness={0.35} />
            </mesh>
          ))}
        </group>
      ))}
      {/* icing outlines on the front */}
      <Icing a={[-W / 2 - 0.08, H - 0.05, D / 2 + 0.03]} b={[0, H + rise + 0.03, D / 2 + 0.03]} />
      <Icing a={[W / 2 + 0.08, H - 0.05, D / 2 + 0.03]} b={[0, H + rise + 0.03, D / 2 + 0.03]} />
      <Icing a={[-W / 2, 0.05, D / 2 + 0.02]} b={[-W / 2, H, D / 2 + 0.02]} r={0.025} />
      <Icing a={[W / 2, 0.05, D / 2 + 0.02]} b={[W / 2, H, D / 2 + 0.02]} r={0.025} />
      <Icing a={[-W / 2, H - 0.12, D / 2 + 0.02]} b={[W / 2, H - 0.12, D / 2 + 0.02]} r={0.02} />
      {Array.from({ length: 7 }, (_, k) => (
        <mesh key={k} position={[-0.48 + k * 0.16, H - 0.2, D / 2 + 0.03]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color={candy[(k + seed) % 4]!} emissive={candy[(k + seed) % 4]!} emissiveIntensity={0.5} roughness={0.2} />
        </mesh>
      ))}
      {/* marmalade windows (translucent, glowing) with icing frames */}
      {wins.map(([x, y], k) => (
        <group key={k} position={[x, y, D / 2 + 0.01]}>
          <mesh>
            <circleGeometry args={[0.15, 20]} />
            <meshPhysicalMaterial ref={(m) => { if (m) marm.current[k] = m; }} color="#ff8a1a" emissive="#ff7a10" emissiveIntensity={2} roughness={0.15} clearcoat={1} transparent opacity={0.92} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.01]}><torusGeometry args={[0.16, 0.025, 6, 20]} /><meshStandardMaterial color="#fffaf2" roughness={0.35} /></mesh>
          <mesh position={[0, 0, 0.012]}><boxGeometry args={[0.3, 0.02, 0.01]} /><meshStandardMaterial color="#fffaf2" /></mesh>
          <mesh position={[0, 0, 0.012]}><boxGeometry args={[0.02, 0.3, 0.01]} /><meshStandardMaterial color="#fffaf2" /></mesh>
        </group>
      ))}
      {/* door */}
      <mesh position={[0, 0.24, D / 2 + 0.01]}>
        <planeGeometry args={[0.28, 0.46]} />
        <meshStandardMaterial color="#2a1206" />
      </mesh>
      <Icing a={[-0.15, 0.02, D / 2 + 0.025]} b={[-0.15, 0.47, D / 2 + 0.025]} r={0.02} />
      <Icing a={[0.15, 0.02, D / 2 + 0.025]} b={[0.15, 0.47, D / 2 + 0.025]} r={0.02} />
      <Icing a={[-0.15, 0.48, D / 2 + 0.025]} b={[0.15, 0.48, D / 2 + 0.025]} r={0.02} />
      {/* candy cane posts */}
      {[-0.8, 0.8].map((x) => (
        <group key={x} position={[x, 0, D / 2 + 0.25]}>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.035, 0.035, 0.6, 8]} /><meshStandardMaterial color="#ffffff" emissive="#e63946" emissiveIntensity={0.15} /></mesh>
          <mesh position={[0.07, 0.6, 0]} rotation-z={Math.PI / 2}><torusGeometry args={[0.07, 0.035, 6, 10, Math.PI]} /><meshStandardMaterial color="#e63946" /></mesh>
        </group>
      ))}
      {signTex && (
        <mesh position={[0, H + rise + 0.32, D / 2 + 0.1]}>
          <planeGeometry args={[1.4, 0.35]} />
          <meshBasicMaterial map={signTex} toneMapped={false} />
        </mesh>
      )}
      <mesh position={[0.3, H + rise * 0.7, -0.2]}><boxGeometry args={[0.16, 0.36, 0.16]} /><meshStandardMaterial color="#3a1a08" /></mesh>
      <pointLight position={[0, 0.6, D / 2 + 0.6]} color="#ff9a3a" intensity={4} distance={3.5} />
    </group>
  );
}
