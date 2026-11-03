import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { hoHoHo } from "./audio";

const FLY = 16; // seconds per pass
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function Deer({ x }: { x: number }) {
  return (
    <group position={[0, 0, x]}>
      <mesh position={[0, 0.35, 0]}><boxGeometry args={[0.28, 0.28, 0.6]} /><meshStandardMaterial color="#7a4a2a" /></mesh>
      <mesh position={[0, 0.6, 0.32]}><boxGeometry args={[0.18, 0.2, 0.24]} /><meshStandardMaterial color="#8a5532" /></mesh>
      <mesh position={[0, 0.88, 0.3]}><boxGeometry args={[0.36, 0.06, 0.04]} /><meshStandardMaterial color="#e8d6b0" /></mesh>
      {[-0.1, 0.1].map((sx) => [-0.2, 0.2].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[sx, 0.12, sz]}><boxGeometry args={[0.06, 0.24, 0.06]} /><meshStandardMaterial color="#4a2c18" /></mesh>
      )))}
    </group>
  );
}

/** Santa's sleigh: every 25–55 s it flies across the sky over the village and shouts «Хо-хо-хо!». */
export function SantaSleigh() {
  const g = useRef<THREE.Group>(null);
  const nose = useRef<THREE.Mesh>(null);
  const st = useRef({ t: -rnd(8, 18), a: new THREE.Vector3(), b: new THREE.Vector3(), said: false, on: false });
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), q: new THREE.Vector3() }), []);
  const [talk, setTalk] = useState(false);
  const pos = (u: number, out: THREE.Vector3) => {
    const s = st.current;
    out.lerpVectors(s.a, s.b, u);
    out.y += Math.sin(u * Math.PI) * 5 + Math.sin(u * 18) * 0.25;
    return out;
  };
  useFrame((_, d) => {
    const s = st.current;
    s.t += Math.min(d, 0.05);
    if (!g.current) return;
    if (s.t < 0) { g.current.visible = false; return; }
    if (!s.on) {
      s.on = true;
      const ang = Math.random() * Math.PI * 2;
      s.a.set(Math.cos(ang) * 60, rnd(9, 13), Math.sin(ang) * 60);
      const back = ang + Math.PI + rnd(-0.5, 0.5);
      s.b.set(Math.cos(back) * 60, rnd(9, 13), Math.sin(back) * 60);
      s.said = false;
      g.current.visible = true;
    }
    const u = s.t / FLY;
    if (u >= 1) { s.on = false; s.t = -rnd(25, 55); g.current.visible = false; setTalk(false); return; }
    pos(u, tmp.p); pos(Math.min(u + 0.01, 1), tmp.q);
    g.current.position.copy(tmp.p);
    g.current.lookAt(tmp.q);
    if (!s.said && u > 0.42) { s.said = true; hoHoHo(); setTalk(true); window.setTimeout(() => setTalk(false), 2600); }
    if (nose.current) nose.current.scale.setScalar(1 + 0.35 * Math.sin(s.t * 8));
  });
  return (
    <group ref={g} visible={false} scale={1.3}>
      {/* sleigh */}
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.8, 0.4, 1.1]} /><meshStandardMaterial color="#b3122b" roughness={0.5} /></mesh>
      <mesh position={[0, 0.6, -0.45]}><boxGeometry args={[0.8, 0.4, 0.2]} /><meshStandardMaterial color="#b3122b" /></mesh>
      {[-0.38, 0.38].map((x) => (
        <mesh key={x} position={[x, 0.04, 0.05]}><boxGeometry args={[0.05, 0.05, 1.4]} /><meshStandardMaterial color="#e9c46a" metalness={0.8} roughness={0.3} /></mesh>
      ))}
      {/* Santa */}
      <mesh position={[0, 0.75, -0.1]}><sphereGeometry args={[0.26, 12, 10]} /><meshStandardMaterial color="#d62839" /></mesh>
      <mesh position={[0, 1.08, -0.08]}><sphereGeometry args={[0.15, 12, 10]} /><meshStandardMaterial color="#f1c9a5" /></mesh>
      <mesh position={[0, 0.98, 0.02]}><sphereGeometry args={[0.13, 10, 8]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0, 1.24, -0.08]}><coneGeometry args={[0.14, 0.28, 10]} /><meshStandardMaterial color="#d62839" /></mesh>
      <mesh position={[0.25, 0.65, -0.35]}><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial color="#6b4423" /></mesh>
      {/* harness + reindeer */}
      <Deer x={1.3} /><Deer x={2.1} /><Deer x={2.9} />
      <mesh ref={nose} position={[0, 0.62, 3.25]}><sphereGeometry args={[0.07, 8, 6]} /><meshBasicMaterial color="#ff3040" toneMapped={false} /></mesh>
      {talk && (
        <Html position={[0, 1.9, 0]} center zIndexRange={[5, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-full bg-card px-3 py-1 font-display text-sm text-foreground shadow-lg">Хо-хо-хо! 🎅</div>
        </Html>
      )}
    </group>
  );
}
