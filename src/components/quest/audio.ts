// Generative celesta ambience + two proximity zones (cafe, reindeer hangar), all synthesized with Web Audio.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let cafeGain: GainNode | null = null;
let mechGain: GainNode | null = null;
let musicGain: GainNode | null = null;
const timers: number[] = [];

const SCALE = [64, 67, 71, 72, 74, 76, 79, 83, 84, 88];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function bell(freq: number, when: number, vol: number, out: AudioNode) {
  if (!ctx) return;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 3.4);
  [1, 2, 3.01].forEach((m, i) => {
    const o = ctx!.createOscillator();
    o.type = "sine";
    o.frequency.value = freq * m;
    const og = ctx!.createGain();
    og.gain.value = [1, 0.12, 0.03][i] ?? 0;
    o.connect(og).connect(g);
    o.start(when);
    o.stop(when + 3.5);
  });
  g.connect(out);
}

// Calm progression: Cmaj7 – Am7 – Fmaj7 – G6, 8 s per chord
const CHORDS = [[48, 55, 59, 64, 67, 71], [45, 52, 55, 60, 64, 69], [41, 48, 52, 57, 60, 64], [43, 50, 55, 59, 62, 64]];
const padOsc: OscillatorNode[] = [];
function pad(out: AudioNode) {
  if (!ctx) return;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  lp.connect(out);
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = midi(CHORDS[0]![i]!);
    const g = ctx.createGain();
    g.gain.value = 0.022;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.04;
    const lg = ctx.createGain();
    lg.gain.value = 0.01;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(lp);
    o.start();
    lfo.start();
    padOsc.push(o);
  }
}
function setChord(k: number) {
  if (!ctx) return;
  const c = CHORDS[k % CHORDS.length]!;
  padOsc.forEach((o, i) => o.frequency.setTargetAtTime(midi(c[i]!), ctx!.currentTime, 1.2));
}

function noiseBuffer() {
  const b = ctx!.createBuffer(1, ctx!.sampleRate * 2, ctx!.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// Cozy cafe: warm brown-noise murmur + fireplace crackles + soft cup clinks
function cafeLayer(out: GainNode) {
  const src = ctx!.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const lp = ctx!.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const g = ctx!.createGain();
  g.gain.value = 0.12;
  src.connect(lp).connect(g).connect(out);
  src.start();
  timers.push(window.setInterval(() => {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) if (Math.random() > 0.4) {
      const o = ctx.createBufferSource();
      o.buffer = src.buffer;
      const bp = ctx.createBiquadFilter();
      bp.type = "highpass";
      bp.frequency.value = 2500;
      const cg = ctx.createGain();
      const w = t + Math.random() * 0.3;
      cg.gain.setValueAtTime(0.25, w);
      cg.gain.exponentialRampToValueAtTime(0.001, w + 0.03);
      o.connect(bp).connect(cg).connect(out);
      o.start(w, Math.random(), 0.05);
    }
    if (Math.random() > 0.8) bell(1800 + Math.random() * 600, t, 0.03, out);
  }, 350));
}

// Reindeer hangar: low machine hum + magical ratchet pings
function mechLayer(out: GainNode) {
  const o = ctx!.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = 55;
  const lp = ctx!.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 180;
  const g = ctx!.createGain();
  g.gain.value = 0.04;
  o.connect(lp).connect(g).connect(out);
  o.start();
  timers.push(window.setInterval(() => {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const p = ctx.createOscillator();
      p.type = "square";
      p.frequency.value = 900 + i * 120;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.008, t + i * 0.07);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.05);
      p.connect(pg).connect(out);
      p.start(t + i * 0.07);
      p.stop(t + i * 0.07 + 0.06);
    }
    bell(midi(88 + Math.floor(Math.random() * 5)), t + 0.4, 0.05, out);
  }, 1900));
}

export function startAudio() {
  if (ctx) {
    void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 1;
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.5;
  const fb = ctx.createGain();
  fb.gain.value = 0.28;
  musicGain.connect(master);
  musicGain.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(master);
  cafeGain = ctx.createGain();
  cafeGain.gain.value = 0;
  cafeGain.connect(master);
  mechGain = ctx.createGain();
  mechGain.gain.value = 0;
  mechGain.connect(master);
  master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 6);
  pad(musicGain);
  cafeLayer(cafeGain);
  mechLayer(mechGain);
  let step = 0;
  let note = 3;
  timers.push(window.setInterval(() => {
    if (!ctx || !musicGain) return;
    const t = ctx.currentTime + 0.05;
    const chord = Math.floor(step / 8) % CHORDS.length;
    if (step % 8 === 0) setChord(chord);
    // gentle random walk over chord tones, with plenty of rests
    if (Math.random() > 0.38) {
      note = Math.max(2, Math.min(5, note + (Math.random() > 0.5 ? 1 : -1)));
      bell(midi(CHORDS[chord]![note]! + 12), t, 0.045 + Math.random() * 0.02, musicGain);
    }
    if (step % 8 === 0) bell(midi(CHORDS[chord]![0]!), t, 0.03, musicGain);
    step++;
  }, 1000));
}

/** 0..1 proximity of the camera to each zone; crossfades the music against zone sounds. */
export function setZoneMix(cafe: number, mech: number) {
  if (!ctx || !cafeGain || !mechGain || !musicGain) return;
  const t = ctx.currentTime;
  cafeGain.gain.setTargetAtTime(cafe * 0.5, t, 0.4);
  mechGain.gain.setTargetAtTime(mech * 0.5, t, 0.4);
  musicGain.gain.setTargetAtTime(1 - Math.max(cafe, mech) * 0.6, t, 0.4);
}

export function setMuted(muted: boolean) {
  if (!ctx || !master) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.linearRampToValueAtTime(muted ? 0 : 0.22, ctx.currentTime + 0.8);
}

export function stopAudio() {
  timers.forEach((t) => clearInterval(t));
  timers.length = 0;
  void ctx?.close();
  ctx = null;
  padOsc.length = 0;
  master = cafeGain = mechGain = musicGain = null;
}

/** Crisp UI sounds: glass chime or snow crunch. Safe to call before audio starts. */
export function sfx(kind: "chime" | "crunch" | "sneeze" | "spirit") {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  if (kind === "chime" || kind === "spirit") {
    const base = kind === "chime" ? 84 : 79;
    [0, 4, 7, 12].forEach((n, i) => bell(midi(base + n), t + i * (kind === "chime" ? 0.04 : 0.12), 0.07, master!));
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = kind === "crunch" ? 1800 : 900;
  bp.Q.value = kind === "crunch" ? 0.8 : 2;
  const g = ctx.createGain();
  const dur = kind === "crunch" ? 0.18 : 0.35;
  for (let i = 0; i < (kind === "crunch" ? 5 : 1); i++) {
    const w = t + i * 0.025;
    g.gain.setValueAtTime(0.35, w);
    g.gain.exponentialRampToValueAtTime(0.01, w + 0.02);
  }
  if (kind === "sneeze") { g.gain.setValueAtTime(0.5, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + dur); }
  src.connect(bp).connect(g).connect(master);
  src.start(t, Math.random(), dur);
}

/** Jolly "Хо-хо-хо!": three low vocal-ish bursts (sawtooth through a vowel formant). */
export function hoHoHo() {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + 0.05;
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.32;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(150 - i * 8, t);
    o.frequency.exponentialRampToValueAtTime(105 - i * 6, t + 0.24);
    const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 520; f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    o.connect(f1).connect(f2).connect(g).connect(master);
    o.start(t); o.stop(t + 0.3);
  }
  [0, 4, 7].forEach((n, i) => bell(midi(76 + n), t0 + 1 + i * 0.1, 0.03, master!));
}
