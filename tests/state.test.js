import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STATE, MAX_LAYERS, PRESETS, decodeState, encodeState, sanitizeState } from "../src/state.js";
import { shadowToCss } from "../src/shadow.js";

test("estado vai e volta da URL sem perder nada", () => {
  const state = { ...structuredClone(DEFAULT_STATE), radius: 40, boxColor: "#fafafa" };
  assert.deepEqual(decodeState(encodeState(state)), state);
});

test("hash inválido ou corrompido vira o estado padrão", () => {
  assert.deepEqual(decodeState("isso-nao-e-base64-json"), DEFAULT_STATE);
  assert.deepEqual(decodeState(""), DEFAULT_STATE);
});

test("valores fora do limite são cortados", () => {
  const state = sanitizeState({ layers: [{ x: 9999, y: -9999, blur: -10, opacity: 7 }], radius: 1000 });
  const [layer] = state.layers;
  assert.equal(layer.x, 100);
  assert.equal(layer.y, -100);
  assert.equal(layer.blur, 0);
  assert.equal(layer.opacity, 1);
  assert.equal(state.radius, 120);
});

test("cores e tipos maliciosos são descartados", () => {
  const state = sanitizeState({
    layers: [{ color: "red; background:url(javascript:alert(1))", inset: "true", x: "10" }],
    boxColor: "<script>",
  });
  const [layer] = state.layers;
  assert.equal(layer.color, "#0f172a");
  assert.equal(layer.inset, false, "só aceita booleano de verdade");
  assert.equal(layer.x, 10, "número em texto é aceito e convertido");
  assert.equal(state.boxColor, DEFAULT_STATE.boxColor);
});

test("limita a quantidade de camadas", () => {
  const state = sanitizeState({ layers: Array.from({ length: 20 }, () => ({})) });
  assert.equal(state.layers.length, MAX_LAYERS);
});

test("todos os modelos prontos geram CSS válido", () => {
  for (const [name, layers] of Object.entries(PRESETS)) {
    assert.match(shadowToCss(layers), /rgba\(/, name);
  }
});
