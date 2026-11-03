import { useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { ElfBody } from "./Scene";
import { addFootprint } from "./Magic";
import { LOCATIONS } from "./locations";
import { makeCounter, rand, stepWalker, unlockSecret, world, type SecretId, type Walker } from "./sim";
import { sfx } from "./audio";

const GOLD = "#ffb347";
const RINK = new THREE.Vector3(2.9, 0, 2.5);
const FORT = new THREE.Vector3(-2.9, 0, 2.3);

// ---------- gnome ----------
function GnomeBody({ arms, hat = "#2a5ac8" }: { arms?: React.RefObject<THREE.Group | null>; hat?: string }) {
  return (
    <group>
      <mesh position={[0, 0.17, 0]}>
        <sphereGeometry args={[0.15, 12, 10]} />
        <meshStandardMaterial color="#6b4b2a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <sphereGeometry args={[0.085, 12, 10]} />
        <meshStandardMaterial color="#f0c3a0" />
      </mesh>
      <mesh position={[0, 0.27, 0.07]} rotation-x={Math.PI}>
        <coneGeometry args={[0.09, 0.2, 10]} />
        <meshStandardMaterial color="#f4f4f8" roughness={1} />
      </mesh>
      <mesh position={[0, 0.36, 0.085]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#e88a7a" />
      </mesh>
      <mesh position={[0, 0.54, -0.02]} rotation-x={-0.2}>
        <coneGeometry args={[0.095, 0.32, 10]} />
        <meshStandardMaterial color={hat} />
      </mesh>
      <group ref={arms ?? null}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.14, 0.24, 0]} rotation-z={s * 0.4}>
            <mesh position={[0, -0.07, 0]}>
              <capsuleGeometry args={[0.03, 0.1, 3, 6]} />
              <meshStandardMaterial color="#6b4b2a" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------- state-machine wanderer ----------
export function Wanderer({ kind, color, seed, area }: { kind: "elf" | "gnome"; color: string; seed: number; area: [number, number, number] }) {
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group>(null);
  const arms = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const scroll = useRef<THREE.Mesh>(null);
  const phase = useRef(0);
  const lastStep = useRef(0);
  const pick = useMemo(() => () => {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * area[2];
    return [area[0] + Math.cos(a) * r, area[1] + Math.sin(a) * r] as [number, number];
  }, [area]);
  const w = useMemo<Walker>(() => {
    rand(seed * 977 + 13);
    const [x, z] = pick();
    return { x, z, ry: rand() * 6, speed: 0, state: "idle", timer: rand() * 2, tx: x, tz: z, seed };
  }, [seed, pick]);
  useFrame(({ clock }, d) => {
    const dt = Math.min(d, 0.05), t = clock.elapsedTime;
    const storm = world.weather === "storm";
    stepWalker(w, storm ? dt * 1.6 : dt, kind, pick);
    const cadence = kind === "elf" ? 11 : 6.5;
    phase.current += w.speed * cadence * dt * 1.6;
    const ph = phase.current, moving = w.speed > 0.05;
    if (!g.current) return;
    const bounce = Math.abs(Math.sin(ph)) * (kind === "elf" ? 0.045 : 0.03) * Math.min(1, w.speed * 2);
    g.current.position.set(w.x, 0.05 + bounce, w.z);
    g.current.rotation.y = w.ry;
    if (body.current) body.current.rotation.z = Math.sin(ph) * (kind === "gnome" ? 0.1 : 0.05) * Math.min(1, w.speed * 2);
    if (moving) {
      const step = Math.floor(ph / Math.PI);
      if (step !== lastStep.current) {
        lastStep.current = step;
        const side = step % 2 ? 1 : -1;
        addFootprint(w.x + Math.cos(w.ry) * 0.05 * side, w.z - Math.sin(w.ry) * 0.05 * side, -w.ry, t);
      }
    }
    legs.current?.children.forEach((c, i) => { c.rotation.x = Math.sin(ph + i * Math.PI) * 0.6 * Math.min(1, w.speed * 2); });
    const ac = arms.current?.children;
    if (ac) ac.forEach((c, i) => {
      const s = i ? 1 : -1;
      if (storm) { c.rotation.x = -2.2; c.rotation.z = s * -0.3; return; } // shield face
      if (w.state === "action" && kind === "elf") { c.rotation.x = -1.1; c.rotation.z = s * -0.3; return; } // reading scroll
      if (w.state === "action" && kind === "gnome") { c.rotation.x = i ? -1.2 + Math.sin(t * 12) * 0.5 : -0.6; c.rotation.z = s * 0.3; return; } // fixing
      c.rotation.x = moving ? Math.sin(ph + (i ? 0 : Math.PI)) * 0.5 : 0;
      c.rotation.z = s * (kind === "elf" ? 0.25 : 0.4);
    });
    if (head.current) {
      head.current.rotation.y = w.state === "idle" ? Math.sin(t * 1.3 + seed) * 0.8 : 0;
      head.current.rotation.x = w.state === "action" ? 0.35 : 0;
    }
    if (eyes.current) eyes.current.scale.y = (t + seed * 7) % 3.3 < 0.12 ? 0.1 : 1;
    if (scroll.current) scroll.current.visible = w.state === "action" && kind === "elf" && !storm;
  });
  return (
    <group ref={g} scale={kind === "elf" ? 1.1 : 1.15}>
      <group ref={body}>
        {kind === "elf" ? <ElfBody color={color} legs={legs} arms={arms} head={head} eyes={eyes} /> : <GnomeBody arms={arms} hat={color} />}
      </group>
      <mesh ref={scroll} position={[0, 0.36, 0.17]} rotation-x={-0.5} visible={false}>
        <planeGeometry args={[0.14, 0.1]} />
        <meshBasicMaterial color="#ffe6a0" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---------- ice rink with skaters ----------
function Skater({ i, kind, color }: { i: number; kind: "elf" | "gnome"; color: string }) {
  const g = useRef<THREE.Group>(null);
  const lean = useRef<THREE.Group>(null);
  const prev = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.35 + i * (Math.PI / 2);
    // figure-eight (lemniscate of Gerono)
    const x = Math.sin(t) * 1.25, z = Math.sin(t) * Math.cos(t) * 1.2;
    const dx = Math.cos(t) * 1.25, dz = Math.cos(2 * t) * 1.2;
    const ry = Math.atan2(dx, dz);
    let turn = ry - prev.current;
    if (turn > Math.PI) turn -= Math.PI * 2;
    if (turn < -Math.PI) turn += Math.PI * 2;
    prev.current = ry;
    if (g.current) { g.current.position.set(RINK.x + x, 0.1, RINK.z + z); g.current.rotation.y = ry; }
    if (lean.current) lean.current.rotation.z = THREE.MathUtils.lerp(lean.current.rotation.z, THREE.MathUtils.clamp(-turn * 25, -0.45, 0.45), 0.1);
  });
  return (
    <group ref={g}>
      <group ref={lean}>
        {kind === "elf" ? <ElfBody color={color} /> : <GnomeBody hat={color} />}
      </group>
    </group>
  );
}
function IceRink() {
  const N = 28;
  const lights = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const m = lights.current;
    if (!m) return;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      o.position.set(RINK.x + Math.cos(a) * 1.9, 0.32, RINK.z + Math.sin(a) * 1.55);
      o.updateMatrix();
      m.setMatrixAt(k, o.matrix);
      const on = 0.6 + 0.4 * Math.sin(clock.elapsedTime * 3 + k);
      m.setColorAt(k, col.set(k % 3 === 0 ? "#c8f03c" : k % 3 === 1 ? "#ffd27a" : "#9fe8ff").multiplyScalar(1.5 * on));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <group>
      <mesh position={[RINK.x, 0.07, RINK.z]} rotation-x={-Math.PI / 2} scale={[1.9, 1.55, 1]} receiveShadow>
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial color="#bfe3ff" metalness={0.6} roughness={0.05} envMapIntensity={1.5} />
      </mesh>
      <mesh position={[RINK.x, 0.1, RINK.z]} rotation-x={-Math.PI / 2} scale={[1.9, 1.55, 1]}>
        <ringGeometry args={[0.97, 1.06, 48]} />
        <meshStandardMaterial color="#f4f8ff" roughness={1} />
      </mesh>
      <instancedMesh ref={lights} args={[undefined, undefined, N]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <Skater i={0} kind="elf" color="#c8102e" />
      <Skater i={1} kind="gnome" color="#7b2cbf" />
      <Skater i={2} kind="elf" color="#2a9d8f" />
      <Skater i={3} kind="gnome" color="#e63946" />
    </group>
  );
}

// ---------- snowball fight ----------
function Thrower({ p, face, kind, color, phase }: { p: [number, number]; face: number; kind: "elf" | "gnome"; color: string; phase: number }) {
  const arms = useRef<THREE.Group>(null);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const c = ((clock.elapsedTime + phase) % 2.4) / 2.4; // throw cycle
    const right = arms.current?.children[1];
    if (right) right.rotation.x = c < 0.3 ? -c * 9 : c < 0.4 ? -2.7 + (c - 0.3) * 30 : 0.3 * (1 - c);
    if (g.current) g.current.position.y = 0.05 + (c < 0.4 && c > 0.28 ? 0.05 : 0);
  });
  return (
    <group ref={g} position={[FORT.x + p[0], 0.05, FORT.z + p[1]]} rotation-y={face}>
      {kind === "elf" ? <ElfBody color={color} arms={arms} /> : <GnomeBody hat={color} arms={arms} />}
    </group>
  );
}
function SnowballFight() {
  const balls = useRef<(THREE.Mesh | null)[]>([]);
  const pairs = useMemo(() => [
    { a: [-0.9, -0.3], b: [0.9, -0.2], ph: 0 },
    { a: [-0.9, 0.35], b: [0.9, 0.3], ph: 1.2 },
    { a: [0.9, -0.2], b: [-0.9, 0.35], ph: 0.6 },
    { a: [0.9, 0.3], b: [-0.9, -0.3], ph: 1.8 },
  ], []);
  useFrame(({ clock }) => {
    pairs.forEach((pr, i) => {
      const m = balls.current[i];
      if (!m) return;
      const c = ((clock.elapsedTime + pr.ph) % 2.4) / 2.4;
      const u = (c - 0.38) / 0.45;
      m.visible = u >= 0 && u <= 1;
      if (!m.visible) return;
      m.position.set(FORT.x + THREE.MathUtils.lerp(pr.a[0]!, pr.b[0]!, u), 0.55 + Math.sin(u * Math.PI) * 0.7, FORT.z + THREE.MathUtils.lerp(pr.a[1]!, pr.b[1]!, u));
    });
  });
  return (
    <group>
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[FORT.x + x, 0, FORT.z]}>
          <mesh position={[0, 0.16, 0]} castShadow>
            <boxGeometry args={[0.18, 0.32, 1.1]} />
            <meshStandardMaterial color="#eef4ff" roughness={1} />
          </mesh>
          {[-0.4, 0, 0.4].map((z) => (
            <mesh key={z} position={[0, 0.36, z]}>
              <sphereGeometry args={[0.09, 8, 6]} />
              <meshStandardMaterial color="#f6f9ff" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
      <Thrower p={[-0.9, -0.3]} face={Math.PI / 2} kind="elf" color="#2d8a4e" phase={0} />
      <Thrower p={[-0.9, 0.35]} face={Math.PI / 2} kind="elf" color="#c8102e" phase={1.2} />
      <Thrower p={[0.9, -0.2]} face={-Math.PI / 2} kind="gnome" color="#2a5ac8" phase={0.6} />
      <Thrower p={[0.9, 0.3]} face={-Math.PI / 2} kind="gnome" color="#e9c46a" phase={1.8} />
      {pairs.map((_, i) => (
        <mesh key={i} ref={(m) => { balls.current[i] = m; }} visible={false}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#e8fbff" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- couriers ----------
const courierPath = new THREE.CatmullRomCurve3(
  LOCATIONS.map((l) => new THREE.Vector3(l.position[0] * 0.72, 0.06, l.position[2] * 0.72 + 1.2)),
  true,
);
function Courier({ type, offset }: { type: "scooter" | "sled"; offset: number }) {
  const g = useRef<THREE.Group>(null);
  const cargo = useRef<THREE.Group>(null);
  const arms = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, sp = type === "scooter" ? 0.03 : 0.016;
    const u = (t * sp + offset) % 1;
    const p = courierPath.getPointAt(u), n = courierPath.getPointAt((u + 0.005) % 1);
    if (g.current) {
      g.current.position.set(p.x, 0.06 + (type === "scooter" ? Math.sin(t * 6) * 0.015 : Math.abs(Math.sin(t * 5)) * 0.03), p.z);
      g.current.lookAt(n.x, g.current.position.y, n.z);
    }
    // cycle cargo every lap quarter: letter / sack / garland
    if (cargo.current) {
      const k = Math.floor(u * 5) % 3;
      cargo.current.children.forEach((c, i) => { c.visible = i === k; });
    }
    const ac = arms.current?.children;
    if (ac && type === "sled") ac.forEach((c) => { c.rotation.x = 1.0; });
    if (ac && type === "scooter") ac.forEach((c) => { c.rotation.x = -1.2; });
  });
  return (
    <group ref={g}>
      {type === "scooter" ? (
        <group>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.16, 0.04, 0.5]} />
            <meshStandardMaterial color="#c8f03c" emissive="#c8f03c" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.3, 0.22]}>
            <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
            <meshStandardMaterial color="#d9dbe6" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.02, -0.26]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.1, 10]} />
            <meshBasicMaterial color="#9fe8ff" transparent opacity={0.5} toneMapped={false} />
          </mesh>
          <group position={[0, 0.06, -0.05]}><ElfBody color="#c8102e" arms={arms} /></group>
          <group ref={cargo} position={[0, 0.25, -0.22]}>
            <Cargo />
          </group>
        </group>
      ) : (
        <group>
          <GnomeBody hat="#c8102e" arms={arms} />
          <mesh position={[0, 0.12, -0.35]} rotation-x={0.6}>
            <cylinderGeometry args={[0.008, 0.008, 0.4, 4]} />
            <meshStandardMaterial color="#6b4428" />
          </mesh>
          <group position={[0, 0, -0.75]}>
            <mesh position={[0, 0.08, 0]}>
              <boxGeometry args={[0.32, 0.05, 0.5]} />
              <meshStandardMaterial color="#8a5a32" roughness={0.9} />
            </mesh>
            {[-0.15, 0.15].map((x) => (
              <mesh key={x} position={[x, 0.03, 0]}>
                <boxGeometry args={[0.02, 0.02, 0.56]} />
                <meshStandardMaterial color="#c9a14a" metalness={0.7} />
              </mesh>
            ))}
            <group ref={cargo} position={[0, 0.2, 0]}><Cargo big /></group>
          </group>
        </group>
      )}
    </group>
  );
}
function Cargo({ big }: { big?: boolean }) {
  const s = big ? 1.6 : 1;
  return (
    <>
      <mesh scale={s}>
        <boxGeometry args={[0.12, 0.08, 0.01]} />
        <meshBasicMaterial color="#fff1b8" toneMapped={false} />
      </mesh>
      <mesh scale={s} position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color="#9a1b22" roughness={0.9} />
      </mesh>
      <mesh scale={s} rotation-z={Math.PI / 2}>
        <torusGeometry args={[0.06, 0.03, 6, 12]} />
        <meshStandardMaterial color="#2d8a4e" emissive="#c8f03c" emissiveIntensity={0.3} />
      </mesh>
    </>
  );
}

// ---------- reindeer corrals ----------
function Corral({ c, w, d, rot = 0 }: { c: [number, number]; w: number; d: number; rot?: number }) {
  const posts = useMemo(() => {
    const out: [number, number][] = [];
    const per = (len: number) => Math.max(2, Math.round(len / 0.45));
    for (const [ax, len] of [[0, w], [1, d]] as const) {
      const n = per(len);
      for (let k = 0; k <= n; k++) {
        const v = -len / 2 + (k / n) * len;
        for (const s of [-1, 1]) out.push(ax === 0 ? [v, (s * d) / 2] : [(s * w) / 2, v]);
      }
    }
    return out;
  }, [w, d]);
  return (
    <group position={[c[0], 0, c[1]]} rotation-y={rot}>
      {posts.map(([x, z], k) => (
        <mesh key={k} position={[x, 0.2, z]}>
          <boxGeometry args={[0.06, 0.4, 0.06]} />
          <meshStandardMaterial color="#5a3a22" roughness={1} />
        </mesh>
      ))}
      {[0.16, 0.32].map((y) => (
        <group key={y}>
          {[-1, 1].map((s) => (
            <mesh key={`a${s}`} position={[0, y, (s * d) / 2]}><boxGeometry args={[w, 0.04, 0.03]} /><meshStandardMaterial color="#6b4428" /></mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`b${s}`} position={[(s * w) / 2, y, 0]}><boxGeometry args={[0.03, 0.04, d]} /><meshStandardMaterial color="#6b4428" /></mesh>
          ))}
        </group>
      ))}
      {[[-w / 4, -d / 5], [w / 5, d / 6], [0, -d / 4]].map(([x, z], k) => (
        <mesh key={k} position={[x!, 0.07, z!]} scale={[1, 0.35, 1]}>
          <sphereGeometry args={[0.32, 10, 8]} />
          <meshStandardMaterial color="#d8b04a" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- lanterns ----------
function Lanterns() {
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; out.push([Math.cos(a) * 4.6, Math.sin(a) * 4.6]); }
    return out;
  }, []);
  return (
    <group>
      {spots.map(([x, z], k) => (
        <group key={k} position={[x, 0, z]}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.02, 0.03, 0.8, 6]} />
            <meshStandardMaterial color="#1c1c22" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.86, 0]}>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshBasicMaterial color="#ffd89a" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- easter eggs ----------
function Confetti({ trigger, at, colors }: { trigger: React.RefObject<number>; at: [number, number, number]; colors: string[] }) {
  const N = 50;
  const pts = useRef<THREE.Points>(null);
  const { pos, vel, col } = useMemo(() => {
    const col = new Float32Array(N * 3), c = new THREE.Color();
    for (let k = 0; k < N; k++) { c.set(colors[k % colors.length]!); col.set([c.r * 1.5, c.g * 1.5, c.b * 1.5], k * 3); }
    return { pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), col };
  }, [colors]);
  const seen = useRef(0);
  const age = useRef(99);
  useFrame((_, d) => {
    const dt = Math.min(d, 0.05);
    if (trigger.current !== seen.current) {
      seen.current = trigger.current;
      age.current = 0;
      for (let k = 0; k < N; k++) {
        pos.set(at, k * 3);
        vel.set([(Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3], k * 3);
      }
    }
    age.current += dt;
    const p = pts.current;
    if (!p) return;
    p.visible = age.current < 2.2;
    if (!p.visible) return;
    for (let k = 0; k < N; k++) {
      vel[k * 3 + 1]! -= 3 * dt;
      for (let j = 0; j < 3; j++) pos[k * 3 + j]! += vel[k * 3 + j]! * dt;
    }
    p.geometry.attributes["position"]!.needsUpdate = true;
    (p.material as THREE.PointsMaterial).opacity = 1 - age.current / 2.2;
  });
  return (
    <points ref={pts} visible={false} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        <bufferAttribute attach="attributes-color" args={[col, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.09} vertexColors transparent depthWrite={false} toneMapped={false} />
    </points>
  );
}

/** Wrap a reindeer: 3 clicks → colorful sneeze. */
export function SneezeOnClick({ at, children }: { at: [number, number, number]; children: ReactNode }) {
  const counter = useMemo(() => makeCounter(3), []);
  const trig = useRef(0);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    sfx("crunch");
    if (counter()) { trig.current++; sfx("sneeze"); unlockSecret("sneeze"); }
  };
  return (
    <group onClick={onClick}>
      {children}
      <Confetti trigger={trig} at={[at[0], at[1] + 0.9, at[2]]} colors={["#c8f03c", "#ff5d8f", "#4cc9f0", "#ffd166", "#b06bff"]} />
    </group>
  );
}

/** Generic invisible click trigger that unlocks a secret with a particle burst. */
function SecretSpot({ id, at, size, colors, label }: { id: SecretId; at: [number, number, number]; size: [number, number, number]; colors: string[]; label?: string }) {
  const trig = useRef(0);
  return (
    <group>
      <mesh
        position={at}
        onClick={(e) => { e.stopPropagation(); trig.current++; sfx("spirit"); unlockSecret(id); }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = ""; }}
      >
        <boxGeometry args={size} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Confetti trigger={trig} at={at} colors={colors} />
      {label && (
        <Html position={[at[0], at[1] + size[1] / 2 + 0.5, at[2]]} center distanceFactor={14} zIndexRange={[5, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-full bg-night/85 px-3 py-1 font-display text-[11px] font-semibold text-parchment"><span className="dot mr-1.5 align-middle" />{label}</div>
        </Html>
      )}
    </group>
  );
}

// ---------- weather-driven stars dimmer ----------
export function useStormFactor() {
  const f = useRef(0);
  useFrame((_, d) => { f.current += ((world.weather === "storm" ? 1 : 0) - f.current) * (1 - Math.exp(-1.5 * Math.min(d, 0.05))); });
  return f;
}

export default function Living() {
  const wanderers = useMemo(() => [
    { kind: "elf" as const, color: "#2d8a4e", area: [-1.5, -2.6, 2] as [number, number, number] },
    { kind: "elf" as const, color: "#c8102e", area: [1.8, -2.2, 1.8] as [number, number, number] },
    { kind: "gnome" as const, color: "#2a5ac8", area: [-4.4, -1.2, 1.4] as [number, number, number] },
    { kind: "gnome" as const, color: "#e9c46a", area: [4.4, -0.8, 1.4] as [number, number, number] },
    { kind: "elf" as const, color: "#7b2cbf", area: [3.6, 4.4, 1.2] as [number, number, number] },
    { kind: "gnome" as const, color: "#c8102e", area: [-6.0, -4.4, 1.2] as [number, number, number] },
  ], []);
  return (
    <group>
      <IceRink />
      <SnowballFight />
      <Courier type="scooter" offset={0} />
      <Courier type="sled" offset={0.5} />
      <Corral c={[-4.6, 7.7]} w={3.2} d={1.7} rot={0.1} />
      <Corral c={[-7.6, 5.9]} w={1.9} d={2.2} rot={0.4} />
      <Lanterns />
      {wanderers.map((w, k) => <Wanderer key={k} kind={w.kind} color={w.color} seed={k + 1} area={w.area} />)}
      <SecretSpot id="spirit" at={[3.8 + 0.9, 1.05, -4.2 + 0.2]} size={[0.6, 0.8, 0.6]} colors={["#9fe8ff", "#ffffff", "#c8f03c"]} />
      <SecretSpot id="key" at={[8.3, 0.7, 3.4]} size={[1.2, 1.4, 1.1]} colors={["#f4a261", "#ffe6a0", "#e63946"]} />
      <SecretSpot id="ticket" at={[0, 5.45, 0]} size={[0.8, 0.8, 0.8]} colors={[GOLD, "#fff1b8", "#c8f03c"]} />
    </group>
  );
}
