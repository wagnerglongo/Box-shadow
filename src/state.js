/**
 * Estado do editor, modelos prontos e serialização para a URL.
 * O estado vindo da URL é tratado como entrada não confiável: tudo é validado
 * e limitado antes de chegar na interface.
 */
import { LIMITS, clamp, isHexColor } from "./shadow.js";

export const MAX_LAYERS = 6;

export const createLayer = (overrides = {}) => ({
  x: 0,
  y: 8,
  blur: 24,
  spread: -4,
  color: "#0f172a",
  opacity: 0.18,
  inset: false,
  ...overrides,
});

export const DEFAULT_STATE = {
  layers: [
    createLayer({ y: 2, blur: 4, spread: 0, opacity: 0.08 }),
    createLayer({ y: 12, blur: 24, spread: -6, opacity: 0.16 }),
    createLayer({ y: 32, blur: 64, spread: -12, opacity: 0.22 }),
  ],
  radius: 18,
  boxColor: "#ffffff",
  background: "#e9edf2",
};

export const PRESETS = {
  Suave: [
    createLayer({ y: 1, blur: 2, spread: 0, opacity: 0.12 }),
    createLayer(),
  ],
  Flutuante: [
    createLayer({ y: 2, blur: 4, spread: 0, opacity: 0.08 }),
    createLayer({ y: 12, blur: 24, spread: -6, opacity: 0.16 }),
    createLayer({ y: 32, blur: 64, spread: -12, opacity: 0.22 }),
  ],
  Brutalista: [createLayer({ x: 8, y: 8, blur: 0, spread: 0, color: "#000000", opacity: 1 })],
  Interna: [createLayer({ y: 2, blur: 6, spread: 0, opacity: 0.25, inset: true })],
  Brilho: [
    createLayer({ y: 0, blur: 12, spread: 2, color: "#2b5cff", opacity: 0.55 }),
    createLayer({ y: 0, blur: 40, spread: 8, color: "#2b5cff", opacity: 0.3 }),
  ],
};

const num = (value, { min, max }, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
};

const color = (value, fallback) => (isHexColor(value) ? (value.startsWith("#") ? value : `#${value}`) : fallback);

/** Converte qualquer objeto em uma camada válida. */
export function sanitizeLayer(raw = {}) {
  const base = createLayer();
  return {
    x: num(raw.x, LIMITS.x, base.x),
    y: num(raw.y, LIMITS.y, base.y),
    blur: num(raw.blur, LIMITS.blur, base.blur),
    spread: num(raw.spread, LIMITS.spread, base.spread),
    color: color(raw.color, base.color),
    opacity: num(raw.opacity, LIMITS.opacity, base.opacity),
    inset: raw.inset === true,
  };
}

/** Converte qualquer objeto em um estado válido (ou devolve o padrão). */
export function sanitizeState(raw) {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_STATE);
  const layers = Array.isArray(raw.layers) ? raw.layers.slice(0, MAX_LAYERS).map(sanitizeLayer) : [];
  return {
    layers: layers.length ? layers : structuredClone(DEFAULT_STATE.layers),
    radius: num(raw.radius, LIMITS.radius, DEFAULT_STATE.radius),
    boxColor: color(raw.boxColor, DEFAULT_STATE.boxColor),
    background: color(raw.background, DEFAULT_STATE.background),
  };
}

/* Base64 seguro para URL, funcionando no navegador e no Node */
const toBase64Url = (text) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (text) => {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeState = (state) => toBase64Url(JSON.stringify(state));

/** Nunca lança erro: um hash quebrado ou malicioso vira o estado padrão. */
export function decodeState(hash) {
  try {
    return sanitizeState(JSON.parse(fromBase64Url(hash)));
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}
