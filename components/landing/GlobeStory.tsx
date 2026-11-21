"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { IceCream } from "@phosphor-icons/react";
import { ANAMBRA_CENTER, L0, L1, L2, LM, RIVER1, RIVER2, RIVERM } from "./globe-data";

export type StoryPhoto = { id: string; src: string; srcSet: string; full: string; alt: string };

type Seg = "globe" | "approach" | "ngHold" | "dive" | "photos" | "end";
type Zoom = { ng: number; an: number; pin: number };
type Frame = {
  lon: number; lat: number; k: number; ng: number; an: number; river: number;
  ngLabel: number; anLabel: number; cities: number; pin: number; photos: number; dim: number; caption: number; spin: boolean;
};
type Group = { cls: number; fade: number; shared: number; start: number; end: number };
// STRIDE floats per point: lon, sin(lat), cos(lat), class, edge alpha, shared (also a point of the next-coarser grid)
type Layer = { stepDeg: number; n: number; data: Float32Array; groups: Group[] };
type View = { W: number; H: number; dpr: number; cx: number; cy: number; R: number; lam0: number; sP: number; cP: number };
// per layer: alpha of its own new points, alpha of points it shares with the coarser grid; back = far side of the globe
type Paint = { colors: number[][]; alphas: number[]; sizes: number[]; layer: number[]; shared: number[]; back: number; radius: number };
type GridSpec = { lon0: number; lat0: number; step: number; cols: number; rows: number; land: string; ng: string; an: string };

const STRIDE = 6;
const DEG = Math.PI / 180;
const NG = [8.68, 9.08] as const;
const AN = [ANAMBRA_CENTER[0], ANAMBRA_CENTER[1]] as const;
const OGIDI = [6.8707, 6.153] as const;
const GLOBE_LON = [-38, -14] as const;
const GLOBE_LAT = 14;
const DOT = 0.17; // dot radius as a share of the grid spacing

const CAPTIONS = [
  { title: "Let’s find Creamy Castle", sub: "Keep scrolling — we’ll take you there." },
  { eyebrow: "West Africa", title: "Nigeria", sub: "Home of Creamy Castle." },
  { eyebrow: "South-East Nigeria", title: "Anambra State", sub: "Right by the River Niger." },
  { eyebrow: "Ogidi, Anambra", title: "Here we are", sub: "Just minutes from Onitsha." },
  { eyebrow: "Ogidi, Anambra", title: "A look inside", sub: "Real photos from the venue." },
];

// point classes: 0 land, 1 Nigeria, 2 Anambra, 3 river
const BASE = [226, 239, 255];
const AMBER = [255, 184, 77];
const GOLD = [255, 222, 89];
const RIVER = [130, 220, 255];
const FADE = [1, 0.6, 0.3];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerpAngle = (a: number, b: number, t: number) => a + (((((b - a) % 360) + 540) % 360) - 180) * t;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i], t));

function timeline(hasPhotos: boolean): [Seg, number][] {
  const base: [Seg, number][] = [["globe", 1], ["approach", 1.5], ["ngHold", 0.4], ["dive", 1.9]];
  return hasPhotos ? [...base, ["photos", 1.3], ["end", 0.35]] : [...base, ["end", 0.45]];
}

// Nigeria → Anambra → Ogidi as one eased camera move (no stop in between). The zoom is
// log-linear in eased time, and the aim point slides from Anambra's centre to Ogidi.
function diveFrame(f: Frame, t: number, z: Zoom) {
  const e = ease(t);
  const k = z.ng * Math.pow(z.pin / z.ng, e);
  const m = smooth(0.5, 1, t);
  const P = [lerp(AN[0], OGIDI[0], m), lerp(AN[1], OGIDI[1], m)];
  const s = (z.ng / k) * (1 - e); // keeps the aim point on screen while it drifts to the centre
  Object.assign(f, {
    k, lon: P[0] - (P[0] - NG[0]) * s, lat: P[1] - (P[1] - NG[1]) * s,
    an: smooth(0.15, 0.45, t), ngLabel: 1 - smooth(0, 0.2, t), anLabel: smooth(0.42, 0.58, t) * (1 - smooth(0.8, 0.95, t)),
    cities: smooth(0.55, 0.72, t), pin: smooth(0.8, 0.97, t), caption: t < 0.35 ? 1 : t < 0.78 ? 2 : 3,
  });
}
function photosFrame(f: Frame, t: number, z: Zoom) {
  Object.assign(f, { k: z.pin * (1 + 0.12 * t), lon: OGIDI[0], lat: OGIDI[1], an: 1, ngLabel: 0, anLabel: 0, cities: 1 - smooth(0, 0.3, t), pin: 1 - smooth(0.1, 0.4, t), photos: t, dim: smooth(0, 0.35, t), caption: t < 0.2 ? 3 : 4 });
}

function frameAt(u: number, tl: [Seg, number][], z: Zoom, drift: number): Frame {
  let acc = 0, seg: Seg = tl[tl.length - 1][0], t = 1;
  for (const [name, len] of tl) {
    if (u < acc + len) { seg = name; t = clamp01((u - acc) / len); break; }
    acc += len;
  }
  const f: Frame = { lon: NG[0], lat: NG[1], k: z.ng, ng: 1, an: 0, river: 1, ngLabel: 1, anLabel: 0, cities: 0, pin: 0, photos: 0, dim: 0, caption: 1, spin: false };
  switch (seg) {
    case "globe":
      Object.assign(f, { lon: lerp(GLOBE_LON[0], GLOBE_LON[1], t) + drift, lat: GLOBE_LAT, k: 1, ng: 0, river: 0, ngLabel: 0, caption: 0, spin: true });
      break;
    case "approach": {
      // turn toward Nigeria and zoom in at the same time, so the globe never stops between the two
      const rot = ease(clamp01(t / 0.65));
      Object.assign(f, {
        lon: lerpAngle(GLOBE_LON[1] + drift, NG[0], rot), lat: lerp(GLOBE_LAT, NG[1], rot), k: Math.pow(z.ng, ease(t)),
        ng: smooth(0.15, 0.6, t), river: smooth(0.6, 1, t), ngLabel: smooth(0.8, 1, t), caption: t < 0.3 ? 0 : 1, spin: rot < 1,
      });
      break;
    }
    case "dive": diveFrame(f, t, z); break;
    case "photos": photosFrame(f, t, z); break;
    case "end": if (tl.some(([n]) => n === "photos")) photosFrame(f, 1, z); else diveFrame(f, 1, z); break;
  }
  return f;
}

function bits(b64: string) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return (i: number) => (u[i >> 3] >> (i & 7)) & 1;
}

type Raw = { lon: number; lat: number; cls: number; fade: number; shared: number };

// Points are sorted into (class, edge-fade, shared) groups so the 2D fallback can batch them.
function toLayer(raw: Raw[], stepDeg: number): Layer {
  const key = (p: Raw) => p.cls * 8 + p.fade * 2 + p.shared;
  raw.sort((a, b) => key(a) - key(b));
  const n = raw.length, data = new Float32Array(n * STRIDE), groups: Group[] = [];
  raw.forEach((p, i) => {
    const o = i * STRIDE;
    data[o] = p.lon * DEG; data[o + 1] = Math.sin(p.lat * DEG); data[o + 2] = Math.cos(p.lat * DEG);
    data[o + 3] = p.cls; data[o + 4] = FADE[p.fade]; data[o + 5] = p.shared;
    const g = groups[groups.length - 1];
    if (g && key(raw[g.start]) === key(p)) g.end = i + 1;
    else groups.push({ cls: p.cls, fade: p.fade, shared: p.shared, start: i, end: i + 1 });
  });
  return { stepDeg, n, data, groups };
}

// Regional grids fade out toward their edges so the dense dots never show a hard box.
function edgeFade(lon: number, lat: number, box: GridSpec) {
  const hw = (box.cols * box.step) / 2, hh = (box.rows * box.step) / 2;
  const d = Math.hypot((lon - box.lon0 - hw) / hw, (lat - box.lat0 - hh) / hh);
  return d < 0.78 ? 0 : d < 0.9 ? 1 : d < 1 ? 2 : -1;
}

// nested: the grid is 3× finer than the previous one and aligned to it, so points at
// (row, col) ≡ (1, 1) mod 3 coincide with the coarser grid's points.
function gridLayer(spec: GridSpec, river: number[], nested: boolean): Layer {
  const land = bits(spec.land), ng = bits(spec.ng), an = bits(spec.an), raw: Raw[] = [];
  let li = 0, ni = 0;
  for (let i = 0; i < spec.rows; i++) for (let j = 0; j < spec.cols; j++) {
    if (!land(i * spec.cols + j)) continue;
    const cls = ng(li++) ? (an(ni++) ? 2 : 1) : 0;
    const lon = spec.lon0 + (j + 0.5) * spec.step, lat = spec.lat0 + (i + 0.5) * spec.step, fade = edgeFade(lon, lat, spec);
    if (fade >= 0) raw.push({ lon, lat, cls, fade, shared: nested && i % 3 === 1 && j % 3 === 1 ? 1 : 0 });
  }
  for (let i = 0; i < river.length; i += 2) {
    const lon = river[i] / 1000, lat = river[i + 1] / 1000, fade = edgeFade(lon, lat, spec);
    if (fade >= 0) raw.push({ lon, lat, cls: 3, fade, shared: 0 });
  }
  return toLayer(raw, spec.step);
}

let layersCache: Layer[] | null = null;
function layers(): Layer[] {
  if (layersCache) return layersCache;
  const r0: Raw[] = [];
  const land = bits(L0.land), ng = bits(L0.ng);
  let k = 0, li = 0;
  for (let i = 0; i < L0.rows; i++) {
    const lat = -90 + ((i + 0.5) * 180) / L0.rows;
    for (let j = 0; j < L0.cols[i]; j++, k++) if (land(k)) r0.push({ lon: -180 + ((j + 0.5) * 360) / L0.cols[i], lat, cls: ng(li++), fade: 0, shared: 0 });
  }
  layersCache = [toLayer(r0, 180 / L0.rows), gridLayer(L1, RIVER1, false), gridLayer(LM, RIVERM, true), gridLayer(L2, RIVER2, true)];
  return layersCache;
}

const RIVER_LABEL = (() => {
  let best = [6.75, 6.6], d = Infinity;
  for (let i = 0; i < RIVER2.length; i += 2) {
    const lon = RIVER2[i] / 1000, lat = RIVER2[i + 1] / 1000;
    if (lon < 6.9 && Math.abs(lat - 6.55) < d) { d = Math.abs(lat - 6.55); best = [lon, lat]; }
  }
  return best;
})();

const LABELS: { text: string; lon: number; lat: number; kind: "region" | "river" | "city-l" | "city-r"; show: (f: Frame) => number }[] = [
  { text: "NIGERIA", lon: 8.4, lat: 10.2, kind: "region", show: (f) => f.ngLabel },
  { text: "ANAMBRA", lon: 7.13, lat: 6.58, kind: "region", show: (f) => f.anLabel },
  { text: "River Niger", lon: RIVER_LABEL[0], lat: RIVER_LABEL[1], kind: "river", show: (f) => f.cities * 0.9 },
  { text: "Onitsha", lon: 6.7853, lat: 6.1449, kind: "city-l", show: (f) => f.cities },
  { text: "Awka", lon: 7.0678, lat: 6.2069, kind: "city-r", show: (f) => f.cities },
  { text: "Nnewi", lon: 6.9184, lat: 6.0177, kind: "city-r", show: (f) => f.cities },
];

const VERT = `
attribute vec4 a_geo;
attribute vec2 a_meta;
uniform vec2 u_view;
uniform vec2 u_center;
uniform float u_R, u_lam0, u_sP, u_cP, u_dpr, u_radius, u_back, u_layer, u_shared;
uniform vec3 u_color[4];
uniform float u_alpha[4];
uniform float u_size[4];
varying vec4 v_color;
void main() {
  float dl = a_geo.x - u_lam0;
  float cd = cos(dl);
  float depth = u_sP * a_geo.y + u_cP * a_geo.z * cd;
  vec2 p = vec2(u_center.x + u_R * a_geo.z * sin(dl), u_center.y - u_R * (u_cP * a_geo.y - u_sP * a_geo.z * cd));
  vec3 col = u_color[0];
  float a = u_alpha[0];
  float size = u_radius * u_size[0];
  if (a_geo.w > 2.5) { col = u_color[3]; a = u_alpha[3]; size = u_radius * u_size[3]; }
  else if (a_geo.w > 1.5) { col = u_color[2]; a = u_alpha[2]; size = u_radius * u_size[2]; }
  else if (a_geo.w > 0.5) { col = u_color[1]; a = u_alpha[1]; size = u_radius * u_size[1]; }
  a *= a_meta.x * mix(u_layer, u_shared, a_meta.y);
  if (depth <= 0.0) a *= u_back;
  else if (depth <= 0.22) a *= 0.55;
  v_color = vec4(col, a);
  gl_PointSize = size * 2.0 * u_dpr;
  gl_Position = a > 0.003 ? vec4(p.x / u_view.x * 2.0 - 1.0, 1.0 - p.y / u_view.y * 2.0, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FRAG = `
precision mediump float;
varying vec4 v_color;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float a = v_color.a * (1.0 - smoothstep(0.6, 1.0, d));
  gl_FragColor = vec4(v_color.rgb * a, a);
}`;

type Renderer = { draw: (v: View, p: Paint) => void; dispose: () => void };

// WebGL: every point is uploaded once and projected on the GPU, so a frame is a few uniforms + a draw per layer.
function glRenderer(canvas: HTMLCanvasElement, data: Layer[], onRestore: () => void): Renderer | null {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  let prog: WebGLProgram | null = null, bufs: (WebGLBuffer | null)[] = [];
  let loc: Record<string, WebGLUniformLocation | null> = {}, aGeo = -1, aMeta = -1;
  const init = () => {
    const shader = (type: number, src: string) => { const s = gl.createShader(type); if (!s) return null; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG), program = gl.createProgram();
    if (!program || !vs || !fs) return false;
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    prog = program;
    loc = Object.fromEntries(["u_view", "u_center", "u_R", "u_lam0", "u_sP", "u_cP", "u_dpr", "u_radius", "u_back", "u_layer", "u_shared", "u_color", "u_alpha", "u_size"].map((n) => [n, gl.getUniformLocation(program, n)]));
    aGeo = gl.getAttribLocation(program, "a_geo"); aMeta = gl.getAttribLocation(program, "a_meta");
    bufs = data.map((L) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, L.data, gl.STATIC_DRAW); return b; });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  };
  if (!init()) return null;
  let lost = false;
  const onLost = (e: Event) => { e.preventDefault(); lost = true; };
  const onRestored = () => { lost = !init(); onRestore(); };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  return {
    draw(v, p) {
      if (lost) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniform2f(loc.u_view, v.W, v.H); gl.uniform2f(loc.u_center, v.cx, v.cy);
      gl.uniform1f(loc.u_R, v.R); gl.uniform1f(loc.u_lam0, v.lam0); gl.uniform1f(loc.u_sP, v.sP); gl.uniform1f(loc.u_cP, v.cP);
      gl.uniform1f(loc.u_dpr, v.dpr); gl.uniform1f(loc.u_radius, p.radius);
      gl.uniform3fv(loc.u_color, p.colors.flat().map((c) => c / 255)); gl.uniform1fv(loc.u_alpha, p.alphas); gl.uniform1fv(loc.u_size, p.sizes);
      gl.enableVertexAttribArray(aGeo); gl.enableVertexAttribArray(aMeta);
      data.forEach((L, i) => {
        if (p.layer[i] <= 0.005 && p.shared[i] <= 0.005) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, bufs[i]);
        gl.vertexAttribPointer(aGeo, 4, gl.FLOAT, false, STRIDE * 4, 0);
        gl.vertexAttribPointer(aMeta, 2, gl.FLOAT, false, STRIDE * 4, 16);
        gl.uniform1f(loc.u_layer, p.layer[i]); gl.uniform1f(loc.u_shared, p.shared[i]); gl.uniform1f(loc.u_back, i === 0 ? p.back : 0);
        gl.drawArrays(gl.POINTS, 0, L.n);
      });
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    },
  };
}

// Canvas 2D fallback for devices without WebGL: same projection, batched into one path per bucket.
function canvasRenderer(canvas: HTMLCanvasElement, data: Layer[]): Renderer | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return {
    draw(v, p) {
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      ctx.clearRect(0, 0, v.W, v.H);
      data.forEach((L, li) => {
        const back = li === 0 ? p.back : 0;
        for (const g of L.groups) {
          const la = g.shared ? p.shared[li] : p.layer[li];
          if (la <= 0.005) continue;
          const paths = [new Path2D(), new Path2D(), new Path2D()]; // front, limb, far side
          const r = p.radius * p.sizes[g.cls];
          for (let i = g.start; i < g.end; i++) {
            const o = i * STRIDE, dl = L.data[o] - v.lam0, cd = Math.cos(dl), sl = L.data[o + 1], cl = L.data[o + 2];
            const depth = v.sP * sl + v.cP * cl * cd;
            const b = depth > 0.22 ? 0 : depth > 0 ? 1 : 2;
            if (b === 2 && back <= 0.005) continue;
            const x = v.cx + v.R * cl * Math.sin(dl), y = v.cy - v.R * (v.cP * sl - v.sP * cl * cd);
            if (x < -8 || x > v.W + 8 || y < -8 || y > v.H + 8) continue;
            if (r < 1) paths[b].rect(x - r, y - r, r * 2, r * 2);
            else { paths[b].moveTo(x + r, y); paths[b].arc(x, y, r, 0, Math.PI * 2); }
          }
          const a = p.alphas[g.cls] * FADE[g.fade] * la, c = p.colors[g.cls];
          [a, a * 0.55, a * back].forEach((alpha, b) => {
            if (alpha <= 0.005) return;
            ctx.fillStyle = `rgba(${c.map(Math.round).join(",")},${Math.min(1, alpha)})`;
            ctx.fill(paths[b]);
          });
        }
      });
    },
    dispose() {},
  };
}

export function GlobeStory({ photos }: { photos: StoryPhoto[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const atmoRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const photoRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const hasPhotos = photos.length > 0;
  const total = timeline(hasPhotos).reduce((s, [, len]) => s + len, 0);

  useEffect(() => {
    const sectionEl = sectionRef.current, stickyEl = stickyRef.current, canvasEl = canvasRef.current;
    if (!sectionEl || !stickyEl || !canvasEl) return;
    const section = sectionEl, sticky = stickyEl, canvas = canvasEl;
    const tl = timeline(hasPhotos);
    const total = tl.reduce((s, [, len]) => s + len, 0);
    const data = layers();
    const maybeRenderer = glRenderer(canvas, data, () => { dirty = true; }) ?? canvasRenderer(canvas, data);
    if (!maybeRenderer) return;
    const renderer = maybeRenderer;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R0 = 1;
    let z: Zoom = { ng: 1, an: 1, pin: 1 };
    let photoOffsets: [number, number][] = [];
    const photoState: number[] = [];
    const labelState: number[] = [];

    function measurePhotos() {
      const grid = gridRef.current;
      if (!grid) return;
      photoOffsets = photoRefs.current.map((el) => {
        if (!el) return [0, 0];
        const x = grid.offsetLeft + el.offsetLeft + el.offsetWidth / 2, y = grid.offsetTop + el.offsetTop + el.offsetHeight / 2;
        return [cx - x, cy - y];
      });
      photoState.length = 0;
    }
    function resize() {
      W = sticky.clientWidth; H = sticky.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      cx = W / 2; cy = H * 0.6;
      R0 = Math.min(W * 0.42, H * 0.34);
      const fit = Math.min(W * 0.86, H * 0.56);
      z = { ng: fit / (12.5 * DEG) / R0, an: fit / (1.2 * DEG) / R0, pin: (fit / (1.2 * DEG) / R0) * 1.35 };
      const atmo = atmoRef.current;
      if (atmo) { atmo.style.width = atmo.style.height = `${R0 * 2}px`; }
      measurePhotos();
    }

    function render(fr: Frame) {
      const R = R0 * fr.k;
      const v: View = { W, H, dpr, cx, cy, R, lam0: fr.lon * DEG, sP: Math.sin(fr.lat * DEG), cP: Math.cos(fr.lat * DEG) };
      const mapA = 1 - 0.7 * fr.dim;

      // Level of detail, tied to the zoom path so every screen size switches at the same framing.
      // Each finer grid is fully in before the coarser one starts to leave, so the map never empties.
      const lk = Math.log(fr.k);
      const win = (a: number, b: number) => smooth(Math.log(a), Math.log(b), lk);
      const in1 = win(z.ng ** 0.3, z.ng ** 0.55), out0 = 1 - win(z.ng ** 0.55, z.ng ** 0.8);
      const inM = win(z.ng * 1.25, z.ng * 2), out1 = 1 - win(z.ng * 2, z.ng * 3);
      const in2 = win(z.ng * 3, z.ng * 4.6), outM = 1 - win(z.ng * 4.6, z.ng * 6.5);
      const layer = [out0, in1 * out1, inM * outM, in2].map((a) => a * mapA);
      const shared = [0, 0, (1 - out1) * outM, 1 - outM].map((a) => a * mapA);
      // one dot size for every layer, easing from the coarse grid's size to the finer one's as it arrives
      const rad = (L: Layer) => Math.min(2.6, Math.max(0.7, L.stepDeg * DEG * R * DOT));
      let radius = rad(data[0]);
      [in1, inM, in2].forEach((a, i) => { radius = lerp(radius, rad(data[i + 1]), a); });

      renderer.draw(v, {
        // highlighted places get warmer and a little larger; the rest of Nigeria steps back once Anambra is the focus
        colors: [BASE, mix(BASE, AMBER, fr.ng * (1 - fr.an)), mix(BASE, GOLD, Math.max(fr.ng, fr.an)), RIVER],
        alphas: [0.85 * (1 - 0.45 * fr.ng), 0.95 * (1 - 0.45 * fr.an), 1, 0.95 * fr.river],
        sizes: [1, 1 + 0.25 * fr.ng * (1 - fr.an), 1 + 0.25 * fr.ng + 0.55 * fr.an, 0.85],
        layer, shared, radius,
        back: 0.13 * (1 - smooth(1.05, 1.4, fr.k)),
      });

      // the globe never reaches the bottom edge, so the bottom fade only comes in as the zoom starts
      if (edgeRef.current) edgeRef.current.style.opacity = String(clamp01((fr.k - 1.45) / 1.5));

      const atmo = atmoRef.current;
      if (atmo) {
        const a = out0 * mapA;
        atmo.style.opacity = String(a);
        if (a > 0.005) atmo.style.transform = `translate3d(${cx - R0}px, ${cy - R0}px, 0) scale(${fr.k})`;
      }

      const project = (lon: number, lat: number): [number, number] | null => {
        const dl = lon * DEG - v.lam0, cd = Math.cos(dl), sl = Math.sin(lat * DEG), cl = Math.cos(lat * DEG);
        if (v.sP * sl + v.cP * cl * cd <= 0) return null;
        return [cx + R * cl * Math.sin(dl), cy - R * (v.cP * sl - v.sP * cl * cd)];
      };
      const place = (el: HTMLElement, lon: number, lat: number, a: number) => {
        const p = a > 0.005 ? project(lon, lat) : null;
        el.style.opacity = p ? String(a) : "0";
        if (p) el.style.transform = `translate3d(${p[0]}px, ${p[1]}px, 0)`;
      };
      LABELS.forEach((l, i) => {
        const el = labelRefs.current[i];
        const a = l.show(fr) * mapA;
        if (!el || (labelState[i] === 0 && a <= 0.005)) return;
        labelState[i] = a > 0.005 ? a : 0;
        place(el, l.lon, l.lat, a);
      });

      const pin = pinRef.current;
      if (pin) {
        place(pin, OGIDI[0], OGIDI[1], fr.pin);
        if (fr.pin > 0.005) pin.style.transform += ` translateY(${-(1 - fr.pin) * 24}px)`;
      }

      photoRefs.current.forEach((el, i) => {
        if (!el) return;
        const e = 1 - Math.pow(1 - clamp01((fr.photos - (0.05 + i * 0.09)) / 0.35), 3);
        if (photoState[i] !== undefined && Math.abs(photoState[i] - e) < 0.001) return;
        photoState[i] = e;
        const [dx, dy] = photoOffsets[i] ?? [0, 0];
        el.style.opacity = String(e);
        el.style.visibility = e > 0 ? "visible" : "hidden";
        el.style.transform = `translate3d(${dx * (1 - e)}px, ${dy * (1 - e)}px, 0) scale(${0.3 + 0.7 * e})`;
      });

      captionRefs.current.forEach((el, i) => {
        if (el) { const on = i === fr.caption ? "1" : "0"; if (el.dataset.on !== on) el.dataset.on = on; }
      });
    }

    let raf = 0, uCur = -1, lastDrawn = -1, last = performance.now(), dirty = true;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(64, now - last); last = now;
      const span = section.offsetHeight - H;
      const target = span > 0 ? clamp01(-section.getBoundingClientRect().top / span) * total : 0;
      // glide toward the scroll position so wheel steps and flicks become one continuous move
      uCur = uCur < 0 ? target : uCur + (target - uCur) * (1 - Math.exp(-dt / 150));
      if (Math.abs(target - uCur) < 1e-4) uCur = target;
      const drift = reduced ? 0 : (((now - t0) / 1000) * 3) % 360;
      const fr = frameAt(uCur, tl, z, drift);
      if (!dirty && !(fr.spin && !reduced) && Math.abs(uCur - lastDrawn) < 1e-5) return;
      dirty = false; lastDrawn = uCur;
      render(fr);
    };

    resize();
    const ro = new ResizeObserver(() => { resize(); dirty = true; });
    ro.observe(sticky);
    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry.isIntersecting) { last = performance.now(); dirty = true; raf = requestAnimationFrame(tick); }
    }, { rootMargin: "200px 0px" });
    io.observe(section);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); };
  }, [hasPhotos]);

  const captions = hasPhotos ? CAPTIONS : CAPTIONS.slice(0, 4);

  return (
    <section ref={sectionRef} className="cc-story" id="find-us" aria-labelledby="story-title" style={{ "--story-units": total } as CSSProperties}>
      <div ref={stickyRef} className="cc-story-sticky">
        <div ref={atmoRef} className="cc-story-atmo" aria-hidden="true" />
        <canvas ref={canvasRef} className="cc-story-canvas" aria-hidden="true" />
        {LABELS.map((l, i) => (
          <div key={l.text} ref={(el) => { labelRefs.current[i] = el; }} className={`cc-story-label cc-story-label--${l.kind}`} aria-hidden="true">
            <span>{l.kind === "city-r" && <i />}{l.text}{l.kind === "city-l" && <i />}</span>
          </div>
        ))}
        <div ref={pinRef} className="cc-story-pin" aria-hidden="true">
          <span className="cc-story-pin-ring" />
          <span className="cc-story-pin-dot" />
          <span className="cc-story-pin-label"><IceCream size={18} weight="duotone" /> Creamy Castle</span>
        </div>
        <div className="cc-story-vignette" aria-hidden="true" />
        <div ref={edgeRef} className="cc-story-edge" aria-hidden="true" />
        {hasPhotos && (
          <div className="cc-story-photos">
            <div ref={gridRef} className="cc-story-grid">
              {photos.map((p, i) => (
                <a key={p.id} ref={(el) => { photoRefs.current[i] = el; }} href={p.full} target="_blank" rel="noreferrer" className="cc-story-photo" aria-label={`Open photo: ${p.alt}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} srcSet={p.srcSet} sizes="(min-width: 700px) 320px, 50vw" alt={p.alt} loading="lazy" decoding="async" />
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="cc-story-captions">
          {captions.map((c, i) => (
            <div key={c.title} ref={(el) => { captionRefs.current[i] = el; }} className="cc-story-caption" data-on={i === 0 ? "1" : "0"}>
              {c.eyebrow && <p className="cc-eyebrow">{c.eyebrow}</p>}
              {i === 0 ? <h2 id="story-title" className="cc-story-title">{c.title}</h2> : <p className="cc-story-title">{c.title}</p>}
              <p className="cc-story-sub">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
