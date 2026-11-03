import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { QuestLocation } from "./locations";
import { world } from "./sim";

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function useStarTex() {
  return useMemo(() => tex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#fff"; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 7 : 20, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.fill();
  }), []);
}
function useRingTex() {
  return useMemo(() => tex(64, 64, (g) => {
    g.strokeStyle = "#fff"; g.lineWidth = 5; g.shadowColor = "#fff"; g.shadowBlur = 8;
    g.beginPath(); g.arc(32, 32, 20, 0, 6.283); g.stroke();
  }), []);
}

// ---------- Aurora borealis ----------
const auroraVert = `varying vec2 vUv; uniform float uTime; void main(){ vUv=uv; vec3 p=position; p.z+=sin(p.x*0.08+uTime*0.25)*3.0+sin(p.x*0.21-uTime*0.4)*1.2; p.y+=sin(p.x*0.12+uTime*0.3)*1.2; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);} `;
const auroraFrag = `varying vec2 vUv; uniform float uTime; uniform float uSeed; uniform float uAlpha;
float n(float x){return sin(x)*0.5+0.5;}
void main(){
  float x=vUv.x*12.0+uSeed;
  float curtain=n(x*1.3+uTime*0.6)*n(x*0.7-uTime*0.35)*n(x*2.9+uTime*0.9+uSeed);
  float fadeY=smoothstep(0.0,0.25,vUv.y)*(1.0-smoothstep(0.35,1.0,vUv.y));
  float fadeX=smoothstep(0.0,0.15,vUv.x)*(1.0-smoothstep(0.85,1.0,vUv.x));
  vec3 teal=vec3(0.1,0.9,0.8); vec3 green=vec3(0.35,1.0,0.45); vec3 purple=vec3(0.55,0.2,0.95);
  vec3 col=mix(green,teal,n(x*0.5+uTime*0.2)); col=mix(col,purple,smoothstep(0.35,0.95,vUv.y));
  float rays=0.6+0.4*n(vUv.x*180.0+uTime*2.0);
  gl_FragColor=vec4(col*1.4, curtain*fadeY*fadeX*rays*0.55*uAlpha);
}`;
export function Aurora() {
  const mats = useRef<THREE.ShaderMaterial[]>([]);
  const bands = [
    { p: [-6, 20, -46] as const, r: 0.05, s: 0 },
    { p: [22, 23, -38] as const, r: -0.6, s: 3.1 },
    { p: [-34, 18, -24] as const, r: 0.9, s: 6.7 },
  ];
  useFrame(({ clock }) => { for (const m of mats.current) if (m) { m.uniforms["uTime"]!.value = clock.elapsedTime; m.uniforms["uAlpha"]!.value = world.aurora; } });
  return (
    <group>
      {bands.map((b, i) => (
        <mesh key={i} position={b.p} rotation-y={b.r} rotation-x={0.25}>
          <planeGeometry args={[70, 16, 64, 1]} />
          <shaderMaterial
            ref={(m) => { if (m) mats.current[i] = m; }}
            vertexShader={auroraVert}
            fragmentShader={auroraFrag}
            uniforms={{ uTime: { value: 0 }, uSeed: { value: b.s }, uAlpha: { value: 1 } }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            toneMapped={false}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------- click shockwave burst ----------
const BURST_N = 70;
export function Burst({ focus }: { focus: QuestLocation | null }) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const pts = useRef<THREE.Points>(null);
  const t0 = useRef(-1);
  const startT = useRef(0);
  const starTex = useStarTex();
  const { pos, vel } = useMemo(() => ({ pos: new Float32Array(BURST_N * 3), vel: new Float32Array(BURST_N * 3) }), []);
  useEffect(() => {
    if (!focus) return;
    t0.current = 0;
    for (let i = 0; i < BURST_N; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 1.4, s = 3 + Math.random() * 5;
      vel.set([Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 1.5, Math.sin(a) * Math.cos(e) * s], i * 3);
      pos.set([0, 0, 0], i * 3);
    }
    g.current?.position.set(focus.position[0], focus.position[1] - 0.8, focus.position[2]);
  }, [focus, pos, vel]);
  useFrame(({ clock }, d) => {
    const dt = Math.min(d, 0.05);
    if (t0.current < 0) { if (g.current) g.current.visible = false; return; }
    if (t0.current === 0) startT.current = clock.elapsedTime;
    t0.current += dt;
    const k = t0.current / 1.1;
    if (!g.current) return;
    g.current.visible = k < 1;
    if (k >= 1) { t0.current = -1; return; }
    const fade = 1 - k;
    for (const [r, sp] of [[ring.current, 7], [ring2.current, 4.5]] as const) {
      if (!r) continue;
      r.scale.setScalar(0.2 + (1 - Math.pow(1 - k, 3)) * sp);
      (r.material as THREE.MeshBasicMaterial).opacity = fade;
    }
    for (let i = 0; i < BURST_N; i++) {
      vel[i * 3 + 1]! -= 4 * dt;
      for (let j = 0; j < 3; j++) { vel[i * 3 + j]! *= Math.exp(-2 * dt); pos[i * 3 + j]! += vel[i * 3 + j]! * dt; }
    }
    if (pts.current) {
      pts.current.geometry.attributes["position"]!.needsUpdate = true;
      (pts.current.material as THREE.PointsMaterial).opacity = fade;
    }
  });
  return (
    <group ref={g} visible={false}>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial color="#c8f03c" transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2} rotation-x={-Math.PI / 2.4}>
        <ringGeometry args={[0.85, 1, 64]} />
        <meshBasicMaterial color="#ffd27a" transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <points ref={pts} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        </bufferGeometry>
        <pointsMaterial map={starTex} size={0.35} color="#fff1b8" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <pointLight color="#c8f03c" intensity={12} distance={8} />
    </group>
  );
}

// ---------- star / ring particles from a chimney ----------
export function StarSmoke({ p }: { p: [number, number, number] }) {
  const starTex = useStarTex();
  const ringTex = useRingTex();
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const N = 6;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const s = refs.current[i];
      if (!s) continue;
      const cyc = (t * 0.16 + i * 0.37) % 1;
      const active = Math.sin(i * 12.9 + Math.floor(t * 0.16 + i * 0.37) * 3.7) > 0.1; // occasional
      s.visible = active;
      s.position.set(p[0] + cyc * 0.8 + Math.sin(cyc * 7 + i) * 0.2, p[1] + cyc * 3.4, p[2] + Math.cos(cyc * 5 + i) * 0.15);
      s.scale.setScalar(0.15 + cyc * 0.25);
      s.material.opacity = Math.sin(cyc * Math.PI) * 0.7;
      s.material.rotation = t * 0.8 + i;
    }
  });
  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <sprite key={i} ref={(s) => { refs.current[i] = s; }}>
          <spriteMaterial map={i % 2 ? ringTex : starTex} color={i % 3 ? "#ffe9a8" : "#c8f03c"} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

// ---------- elf footprints (shared pool) ----------
const FP_N = 160;
const FP_LIFE = 4;
const fp = { x: new Float32Array(FP_N), z: new Float32Array(FP_N), ry: new Float32Array(FP_N), born: new Float32Array(FP_N).fill(-99), head: 0 };
export function addFootprint(x: number, z: number, ry: number, now: number) {
  const i = fp.head; fp.head = (fp.head + 1) % FP_N;
  fp.x[i] = x; fp.z[i] = z; fp.ry[i] = ry; fp.born[i] = now;
}
export function Footprints() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const now = clock.elapsedTime;
    for (let i = 0; i < FP_N; i++) {
      const a = 1 - (now - fp.born[i]!) / FP_LIFE;
      o.position.set(fp.x[i]!, 0.06, fp.z[i]!);
      o.rotation.set(-Math.PI / 2, 0, fp.ry[i]!);
      const s = a > 0 ? 0.3 + a * 0.7 : 0;
      o.scale.set(s, s * 1.6, s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, FP_N]} frustumCulled={false}>
      <circleGeometry args={[0.035, 8]} />
      <meshStandardMaterial color="#9fb0d8" roughness={1} transparent opacity={0.7} depthWrite={false} />
    </instancedMesh>
  );
}

// ---------- reindeer barn ----------
export function Barn({ p, rot = 0 }: { p: [number, number, number]; rot?: number }) {
  const lamp = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => { if (lamp.current) lamp.current.intensity = 5 + Math.sin(clock.elapsedTime * 7) * 0.6; });
  return (
    <group position={p} rotation-y={rot}>
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 1.6, 1.8]} />
        <meshStandardMaterial color="#8c2f24" roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.62, 1.95, 0]} rotation-z={-s * 0.62} castShadow>
          <boxGeometry args={[1.5, 0.1, 2]} />
          <meshStandardMaterial color="#eef3ff" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 1.95, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[1.22, 1.22, 1.78, 3, 1]} />
        <meshStandardMaterial color="#8c2f24" roughness={0.9} />
      </mesh>
      {/* white X doors */}
      <mesh position={[0, 0.6, 0.91]}>
        <planeGeometry args={[0.9, 1.1]} />
        <meshStandardMaterial color="#3a1a12" />
      </mesh>
      {[0.85, -0.85].map((r) => (
        <mesh key={r} position={[0, 0.6, 0.92]} rotation-z={r}>
          <planeGeometry args={[0.07, 1.35]} />
          <meshStandardMaterial color="#f2f6ff" />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0.92]}>
        <circleGeometry args={[0.18, 16]} />
        <meshBasicMaterial color="#ffc35a" toneMapped={false} />
      </mesh>
      {/* hay bales */}
      {[[-1.5, 0.5], [-1.4, -0.3], [1.55, 0.4]].map(([x, z], i) => (
        <mesh key={i} position={[x!, 0.2, z!]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.22, 0.22, 0.4, 12]} />
          <meshStandardMaterial color="#d8b04a" roughness={1} />
        </mesh>
      ))}
      {/* fence */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[-1.5 + i * 0.5, 0.2, 1.9]}>
          <boxGeometry args={[0.06, 0.4, 0.06]} />
          <meshStandardMaterial color="#6b4428" />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 1.9]}>
        <boxGeometry args={[3.1, 0.05, 0.04]} />
        <meshStandardMaterial color="#6b4428" />
      </mesh>
      <pointLight ref={lamp} position={[0, 1.5, 1.4]} color="#ffb060" intensity={5} distance={5} />
    </group>
  );
}

// ---------- golden halo/aurora around a secured campus ----------
const haloVert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `;
const haloFrag = `varying vec2 vUv; uniform float uTime;
void main(){
  float a=vUv.x*6.2831;
  float waves=0.55+0.45*sin(a*5.0+uTime*1.3)*sin(a*3.0-uTime*0.8);
  float fade=(1.0-vUv.y)*smoothstep(0.0,0.08,vUv.y);
  vec3 col=mix(vec3(1.0,0.72,0.25), vec3(1.0,0.92,0.55), vUv.y);
  gl_FragColor=vec4(col*1.8, fade*waves*0.55);
}`;
export function GoldHalo({ p, h }: { p: [number, number, number]; h: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (mat.current) mat.current.uniforms["uTime"]!.value = t;
    if (ring.current) { ring.current.rotation.z = t * 0.4; ring.current.position.y = h * 0.75 + Math.sin(t * 1.2) * 0.15; }
  });
  return (
    <group position={p}>
      <mesh position={[0, h * 0.55, 0]}>
        <cylinderGeometry args={[2.3, 2.6, h * 1.1, 48, 1, true]} />
        <shaderMaterial ref={mat} vertexShader={haloVert} fragmentShader={haloFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[1.9, 0.05, 8, 72]} />
        <meshBasicMaterial color="#ffc94a" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.6, 2.5, 64]} />
        <meshBasicMaterial color="#ffb83a" transparent opacity={0.35} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
