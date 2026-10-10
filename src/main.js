import { LIMITS, clamp, layerToCss, shadowToCss, toTailwind } from "./shadow.js";
import { MAX_LAYERS, PRESETS, createLayer, decodeState, encodeState } from "./state.js";

/* -------------------------------------------------------------------------
   Estado
   ------------------------------------------------------------------------- */
const hash = location.hash.slice(1);
const state = decodeState(hash); // sem hash, decodeState devolve o padrão
let selected = 0;
let format = "css";

/* -------------------------------------------------------------------------
   Definição dos campos: a interface é gerada a partir daqui
   ------------------------------------------------------------------------- */
const LAYER_FIELDS = [
  { key: "x", label: "Horizontal", type: "range", unit: "px", ...LIMITS.x },
  { key: "y", label: "Vertical", type: "range", unit: "px", ...LIMITS.y },
  { key: "blur", label: "Desfoque", type: "range", unit: "px", ...LIMITS.blur },
  { key: "spread", label: "Espalhamento", type: "range", unit: "px", ...LIMITS.spread },
  { key: "opacity", label: "Opacidade", type: "range", unit: "%", min: 0, max: 100, scale: 100 },
  { key: "color", label: "Cor", type: "color" },
  { key: "inset", label: "Sombra interna (inset)", type: "toggle" },
];

const BOX_FIELDS = [
  { key: "radius", label: "Arredondamento", type: "range", unit: "px", ...LIMITS.radius },
  { key: "boxColor", label: "Cor da caixa", type: "color" },
  { key: "background", label: "Cor do fundo", type: "color" },
];

const $ = (selector) => document.querySelector(selector);
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

/**
 * Cria um campo ligado a um objeto alvo. O alvo é lido na hora (getTarget),
 * porque a camada selecionada muda.
 */
function buildField(field, getTarget, prefix) {
  const id = `${prefix}-${field.key}`;
  const scale = field.scale ?? 1;
  const wrapper = el("div", { className: `field field--${field.type}` });

  if (field.type === "toggle") {
    const input = el("input", { type: "checkbox", id });
    input.addEventListener("change", () => {
      getTarget()[field.key] = input.checked;
      render();
    });
    wrapper.append(el("label", { htmlFor: id, className: "toggle" }, [input, el("span", { textContent: field.label })]));
    return { node: wrapper, sync: () => (input.checked = getTarget()[field.key]) };
  }

  if (field.type === "color") {
    const picker = el("input", { type: "color", id });
    const text = el("input", { type: "text", className: "field__text", spellcheck: false, maxLength: 7, ariaLabel: `${field.label} em hexadecimal` });
    const update = (value) => {
      if (/^#[0-9a-f]{6}$/i.test(value)) {
        getTarget()[field.key] = value.toLowerCase();
        render();
      }
    };
    picker.addEventListener("input", () => update(picker.value));
    text.addEventListener("change", () => update(text.value.startsWith("#") ? text.value : `#${text.value}`));
    wrapper.append(el("label", { htmlFor: id, textContent: field.label }), el("div", { className: "field__pair" }, [picker, text]));
    return {
      node: wrapper,
      sync: () => {
        picker.value = getTarget()[field.key];
        if (document.activeElement !== text) text.value = getTarget()[field.key];
      },
    };
  }

  // range + número, sempre sincronizados nos dois sentidos
  const range = el("input", { type: "range", id, min: field.min, max: field.max, step: 1 });
  const number = el("input", { type: "number", className: "field__number", min: field.min, max: field.max, step: 1, ariaLabel: `${field.label} (${field.unit})` });
  const set = (raw) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    getTarget()[field.key] = clamp(value, field.min, field.max) / scale;
    render();
  };
  range.addEventListener("input", () => set(range.value));
  number.addEventListener("change", () => set(number.value));
  wrapper.append(
    el("label", { htmlFor: id, textContent: field.label }),
    el("div", { className: "field__pair" }, [range, number, el("span", { className: "field__unit", textContent: field.unit })]),
  );
  return {
    node: wrapper,
    sync: () => {
      const value = Math.round(getTarget()[field.key] * scale);
      range.value = value;
      if (document.activeElement !== number) number.value = value;
    },
  };
}

const currentLayer = () => state.layers[selected];
const layerFields = LAYER_FIELDS.map((f) => buildField(f, currentLayer, "layer"));
const boxFields = BOX_FIELDS.map((f) => buildField(f, () => state, "box"));
$("#layer-fields").append(...layerFields.map((f) => f.node));
$("#box-fields").append(...boxFields.map((f) => f.node));

/* -------------------------------------------------------------------------
   Modelos e camadas
   ------------------------------------------------------------------------- */
for (const [name, layers] of Object.entries(PRESETS)) {
  const button = el("button", { type: "button", className: "chip", textContent: name });
  button.addEventListener("click", () => {
    state.layers = structuredClone(layers);
    selected = 0;
    render();
  });
  $("#presets").append(button);
}

$("#add-layer").addEventListener("click", () => {
  if (state.layers.length >= MAX_LAYERS) return;
  state.layers.splice(selected + 1, 0, createLayer({ ...currentLayer() }));
  selected += 1;
  render();
});

$("#remove-layer").addEventListener("click", () => {
  if (state.layers.length <= 1) return;
  state.layers.splice(selected, 1);
  selected = Math.min(selected, state.layers.length - 1);
  render();
});

function renderLayers() {
  const list = $("#layers");
  list.replaceChildren(
    ...state.layers.map((layer, i) => {
      const button = el("button", { type: "button", className: "layer", role: "radio" }, [
        el("span", { className: "layer__swatch", style: `--swatch: ${layer.color}` }),
        el("span", { textContent: `Camada ${i + 1}${layer.inset ? " · interna" : ""}` }),
      ]);
      button.setAttribute("aria-checked", String(i === selected));
      button.tabIndex = i === selected ? 0 : -1;
      button.addEventListener("click", () => {
        selected = i;
        render();
      });
      return button;
    }),
  );
  $("#add-layer").disabled = state.layers.length >= MAX_LAYERS;
  $("#remove-layer").disabled = state.layers.length <= 1;
}

// Setas navegam entre as camadas (padrão de radiogroup)
$("#layers").addEventListener("keydown", (event) => {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  selected = (selected + step + state.layers.length) % state.layers.length;
  render();
  $("#layers").children[selected].focus();
});

/* -------------------------------------------------------------------------
   Arrastar e teclado no palco
   ------------------------------------------------------------------------- */
const stage = $("#stage");
let drag = null;

stage.addEventListener("pointerdown", (event) => {
  drag = { startX: event.clientX, startY: event.clientY, x: currentLayer().x, y: currentLayer().y };
  stage.setPointerCapture(event.pointerId);
  stage.classList.add("is-dragging");
});

stage.addEventListener("pointermove", (event) => {
  if (!drag) return;
  // 0,5 deixa o movimento mais fino que o do mouse
  currentLayer().x = Math.round(clamp(drag.x + (event.clientX - drag.startX) * 0.5, LIMITS.x.min, LIMITS.x.max));
  currentLayer().y = Math.round(clamp(drag.y + (event.clientY - drag.startY) * 0.5, LIMITS.y.min, LIMITS.y.max));
  render();
});

const endDrag = () => {
  drag = null;
  stage.classList.remove("is-dragging");
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

stage.addEventListener("keydown", (event) => {
  const delta = event.shiftKey ? 10 : 1;
  const move = { ArrowLeft: ["x", -delta], ArrowRight: ["x", delta], ArrowUp: ["y", -delta], ArrowDown: ["y", delta] }[event.key];
  if (!move) return;
  event.preventDefault();
  const [axis, amount] = move;
  currentLayer()[axis] = clamp(currentLayer()[axis] + amount, LIMITS[axis].min, LIMITS[axis].max);
  render();
});

/* -------------------------------------------------------------------------
   Código gerado, cópia e link
   ------------------------------------------------------------------------- */
const code = () =>
  format === "css" ? `box-shadow:\n  ${state.layers.map(layerToCss).join(",\n  ")};` : toTailwind(state.layers);

function setFormat(next) {
  format = next;
  $("#tab-css").setAttribute("aria-selected", String(next === "css"));
  $("#tab-tailwind").setAttribute("aria-selected", String(next === "tailwind"));
  renderCode();
}
$("#tab-css").addEventListener("click", () => setFormat("css"));
$("#tab-tailwind").addEventListener("click", () => setFormat("tailwind"));

function renderCode() {
  $("#code code").textContent = code();
}

let statusTimer;
function announce(message) {
  $("#status").textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => ($("#status").textContent = ""), 2500);
}

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    announce(message);
  } catch {
    announce("Não deu para copiar automaticamente. Selecione o código e use Ctrl+C.");
  }
}

$("#copy-code").addEventListener("click", () => copy(code(), format === "css" ? "CSS copiado." : "Classe do Tailwind copiada."));
$("#copy-link").addEventListener("click", () => copy(location.href, "Link copiado. Quem abrir verá esta mesma sombra."));

/* -------------------------------------------------------------------------
   Render
   ------------------------------------------------------------------------- */
let hashTimer;
function render() {
  const box = $("#box");
  box.style.boxShadow = shadowToCss(state.layers);
  box.style.borderRadius = `${state.radius}px`;
  box.style.background = state.boxColor;
  stage.style.background = state.background;

  renderLayers();
  layerFields.forEach((f) => f.sync());
  boxFields.forEach((f) => f.sync());
  renderCode();

  // Atualiza a URL sem poluir o histórico do navegador
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => history.replaceState(null, "", `#${encodeState(state)}`), 150);
}

render();
