import { test } from "node:test";
import assert from "node:assert/strict";
import { hexToRgb, layerToCss, shadowToCss, toCssDeclaration, toTailwind, clamp } from "../src/shadow.js";
import { createLayer } from "../src/state.js";

test("hexToRgb converte cores de 6 e 3 dígitos", () => {
  assert.deepEqual(hexToRgb("#000000"), [0, 0, 0]);
  assert.deepEqual(hexToRgb("#2b5cff"), [43, 92, 255]);
  assert.deepEqual(hexToRgb("#fff"), [255, 255, 255]);
  assert.deepEqual(hexToRgb("1e3"), [17, 238, 51]);
});

test("hexToRgb rejeita cor inválida", () => {
  assert.throws(() => hexToRgb("#12"), TypeError);
  assert.throws(() => hexToRgb("red"), TypeError);
});

test("layerToCss escreve 0 sem unidade e arredonda a opacidade", () => {
  const css = layerToCss(createLayer({ x: 0, y: 4, blur: 12, spread: 0, color: "#000", opacity: 0.1 + 0.2 }));
  assert.equal(css, "0 4px 12px 0 rgba(0, 0, 0, 0.3)");
});

test("layerToCss adiciona inset no começo", () => {
  const css = layerToCss(createLayer({ x: 0, y: 2, blur: 6, spread: 0, color: "#000", opacity: 0.25, inset: true }));
  assert.equal(css, "inset 0 2px 6px 0 rgba(0, 0, 0, 0.25)");
});

test("shadowToCss junta várias camadas com vírgula", () => {
  const layers = [
    createLayer({ x: 0, y: 1, blur: 2, spread: 0, color: "#000", opacity: 0.1 }),
    createLayer({ x: 0, y: 8, blur: 24, spread: -4, color: "#000", opacity: 0.2 }),
  ];
  assert.equal(shadowToCss(layers), "0 1px 2px 0 rgba(0, 0, 0, 0.1), 0 8px 24px -4px rgba(0, 0, 0, 0.2)");
  assert.equal(toCssDeclaration(layers), `box-shadow: ${shadowToCss(layers)};`);
});

test("shadowToCss sem camadas devolve none", () => {
  assert.equal(shadowToCss([]), "none");
});

test("toTailwind gera classe arbitrária válida", () => {
  const layers = [
    createLayer({ x: 0, y: 1, blur: 2, spread: 0, color: "#000", opacity: 0.1 }),
    createLayer({ x: 0, y: 8, blur: 24, spread: -4, color: "#000", opacity: 0.2, inset: true }),
  ];
  assert.equal(
    toTailwind(layers),
    "shadow-[0_1px_2px_0_rgba(0,0,0,0.1),inset_0_8px_24px_-4px_rgba(0,0,0,0.2)]",
  );
  assert.doesNotMatch(toTailwind(layers), /\s/);
});

test("clamp limita ao intervalo", () => {
  assert.equal(clamp(150, 0, 100), 100);
  assert.equal(clamp(-5, 0, 100), 0);
  assert.equal(clamp(42, 0, 100), 42);
});
