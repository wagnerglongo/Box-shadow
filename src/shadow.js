/**
 * Funções puras que transformam o estado do editor em CSS.
 * Não tocam no DOM, por isso são testadas em tests/shadow.test.js.
 */

/** Limites de cada propriedade de uma camada. Usados pela interface e pela validação. */
export const LIMITS = {
  x: { min: -100, max: 100 },
  y: { min: -100, max: 100 },
  blur: { min: 0, max: 150 },
  spread: { min: -50, max: 100 },
  opacity: { min: 0, max: 1 },
  radius: { min: 0, max: 120 },
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const isHexColor = (value) => typeof value === "string" && HEX.test(value);

/** "#1e3" ou "#11ee33" → [17, 238, 51] */
export function hexToRgb(hex) {
  const match = HEX.exec(hex);
  if (!match) throw new TypeError(`Cor inválida: ${hex}`);
  let digits = match[1];
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join("");
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
}

/** Arredonda sem deixar lixo de ponto flutuante (0.30000000000000004 → 0.3). */
const round = (value, places = 2) => Number(value.toFixed(places));

const px = (value) => (value === 0 ? "0" : `${value}px`);

/** Uma camada → "inset 0 4px 12px 0 rgba(0, 0, 0, 0.2)" */
export function layerToCss({ x, y, blur, spread, color, opacity, inset }) {
  const [r, g, b] = hexToRgb(color);
  const parts = [px(x), px(y), px(blur), px(spread), `rgba(${r}, ${g}, ${b}, ${round(opacity)})`];
  if (inset) parts.unshift("inset");
  return parts.join(" ");
}

/** Lista de camadas → valor completo da propriedade box-shadow. */
export const shadowToCss = (layers) => (layers.length ? layers.map(layerToCss).join(", ") : "none");

/** Declaração pronta para colar no CSS. */
export const toCssDeclaration = (layers) => `box-shadow: ${shadowToCss(layers)};`;

/**
 * Classe arbitrária do Tailwind: espaços viram "_" e o espaço depois da vírgula some.
 * Ex.: shadow-[0_4px_12px_0_rgba(0,0,0,0.2)]
 */
export function toTailwind(layers) {
  const value = shadowToCss(layers).replace(/,\s+/g, ",").replace(/\s+/g, "_");
  return `shadow-[${value}]`;
}
