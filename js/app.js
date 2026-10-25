/* Regletas de Cuisenaire virtuales — lógica principal (sin dependencias) */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Constantes
  const UNIT = 40;                 // píxeles por unidad con zoom 100 %
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4;
  const STORAGE_KEY = 'regletas-cuisenaire.v1';
  const CUSTOM_DEFAULT_LEN = 12;
  const CUSTOM_MAX_LEN = 200;
  const DRAG_THRESHOLD = 5;        // px antes de considerar que hay arrastre
  const PAL_SIZE = 32;             // lado de la regleta 1 en la paleta (px)
  const PAL_STEP = 6;              // crecimiento de cada regleta en la paleta (px)
  const PEN_WIDTHS = [0.06, 0.12, 0.22];
  const HL_WIDTHS = [0.35, 0.6, 1];
  const SHAPE_TOOLS = ['line', 'arrow', 'rect', 'circle']; // se dibujan arrastrando (la poligonal va por toques)
  const INK_COLORS = ['#1a1a1a', '#e53935', '#1e88e5', '#43a047', '#fdd835', '#fb8c00', '#8e24aa', '#6d4c41', '#9e9e9e', '#ec407a', '#ffffff'];

  // Colores de las regletas 1..10 (índice = valor - 1)
  const ROD_STYLES = [
    { fill: '#ECECEC', stroke: '#8F8F8F', text: '#333333' }, // 1  gris claro
    { fill: '#E53935', stroke: '#A72825', text: '#FFFFFF' }, // 2  rojo
    { fill: '#8BC34A', stroke: '#5B8A27', text: '#1F3A0A' }, // 3  verde claro
    { fill: '#D46CC0', stroke: '#9A3F8A', text: '#FFFFFF' }, // 4  rosa
    { fill: '#FFE14D', stroke: '#C9A400', text: '#4A3B00' }, // 5  amarillo
    { fill: '#1E7D4F', stroke: '#11553A', text: '#FFFFFF' }, // 6  verde oscuro
    { fill: '#5F6368', stroke: '#3A3D40', text: '#FFFFFF' }, // 7  gris oscuro
    { fill: '#7B5240', stroke: '#52342A', text: '#FFFFFF' }, // 8  marrón
    { fill: '#3F51B5', stroke: '#283593', text: '#FFFFFF' }, // 9  azul
    { fill: '#FF6D1F', stroke: '#C24E0E', text: '#FFFFFF' }, // 10 naranja
  ];
  const CUSTOM_STYLE = { fill: '#E91E63', stroke: '#A3124A', text: '#FFFFFF' };
  const PLATE_FILL = '#E6C29A';    // placa de 100: canela clarito
  const HOLLOW_STROKE = '#1F1F1F'; // contorno de las regletas sin relleno

  // Regletas de María Antonia Canals (índice 10 = regleta especial)
  const CANALS_FILLS = ['#E8CFA0', '#F4A3BE', '#3E9BDB', '#E0352B', '#3FA34D', '#A980CF', '#FFD633', '#8A4B2E', '#1F3A8F', '#4A2E22', '#E91E63'];

  // Letras asociadas a cada color según el idioma: índices 0..9 regletas, 10 especial (fucsia), 11 placa de 100.
  // Si dos colores empiezan igual, la regleta pequeña va en minúscula y la grande en mayúscula.
  const LETTERS = {
    es: ['b', 'r', 'v', 'R', 'a', 'V', 'n', 'm', 'A', 'N', 'f', 'P'],
    en: ['w', 'r', 'g', 'p', 'y', 'd', 'k', 'n', 'e', 'o', 'f', 'P'],
    fr: ['b', 'r', 'v', 'rs', 'j', 'vf', 'n', 'm', 'bl', 'o', 'f', 'P'],
  };
  const LETTERS_CANALS = {
    es: ['md', 'rs', 'az', 'r', 'v', 'l', 'a', 'm', 'ao', 'mo', 'f', 'P'],
    en: ['w', 'p', 'b', 'r', 'g', 'l', 'y', 'n', 'nb', 'dn', 'f', 'P'],
    fr: ['b', 'rs', 'bl', 'r', 'v', 'l', 'j', 'm', 'bf', 'mf', 'f', 'P'],
  };
  // Tamaños de letra de los textos (en unidades: con 0,8 una línea mide lo mismo que una regleta)
  const TEXT_SIZES = [0.5, 0.65, 0.8, 1, 1.25, 1.6, 2, 2.5, 3.2];
  const LABEL_MODES = { basic: 'modeBasic', integers: 'modeIntegers', decimals: 'modeDecimals', letters: 'modeLetters', fractions: 'modeFractions' };

  // ---------------------------------------------------------------- Utilidades
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function detectLang() {
    const l = (navigator.language || 'es').slice(0, 2).toLowerCase();
    return ['es', 'en', 'fr'].includes(l) ? l : 'es';
  }

  // ---------------------------------------------------------------- Estado
  let rods = [];      // { id, len, custom, x, y, vertical, filled, locked } · textos: { id, text, size, x, y, locked }
  // Dibujos (también en `rods`): { id, shape: 'free'|'line'|'arrow'|'poly'|'rect'|'ellipse', x, y, w, h,
  //   pts: [[u,v],...] relativos a x, y, color, width, hl (subrayador), closed (poligonal cerrada), fill }
  let polyDraft = null; // poligonal que se está dibujando: { rod, pts: vértices ya fijados }
  let nextId = 1;
  let selection = new Set();
  let mode = 'select'; // 'select': seleccionar y mover regletas · 'pan': mover el lienzo
  let drawMode = false;
  let chain = null;    // inserción rápida por clic: última regleta añadida
  let gesture = null;
  const pointers = new Map();

  const prefs = {
    lang: detectLang(),
    labelMode: 'basic',
    ref: 10,
    grid: true,
    unitLines: false,
    freeRotate: false, // muestra el asa de giro libre (de 3 en 3 grados)
    vertical: false,
    contrast: false,
    snap: true,
    numberFromBottom: false, // la numeración de los cuadritos empieza abajo (tabla del 100 con el 1 abajo)
    paletteOpen: true,
    tool: 'pen',
    inkColor: INK_COLORS[0],
    inkSize: 0,
    colorSet: 'cuisenaire', // juego de colores: 'cuisenaire' | 'canals'
    rodColors: {},          // colores personalizados por índice (0..9 regletas, 10 especial)
    autoColorSpecial: true, // la regleta especial toma el color de la regleta de su misma longitud
    titleSize: 1.6,         // tamaño de letra de los textos libres (los de dentro de una regleta miden lo que ella)
  };
  const view = { x: UNIT, y: UNIT, zoom: 1 };

  // ---------------------------------------------------------------- Elementos
  const board = $('#board');
  const world = $('#world');
  const rodsLayer = $('#rodsLayer');
  const selLayer = $('#selLayer');
  const inkLayer = $('#inkLayer');
  const gridPath = $('#gridPath');
  const marqueeEl = $('#marquee');
  const eraserCursor = $('#eraserCursor');
  const palette = $('#palette');
  const paletteList = $('#paletteList');
  const rodMenu = $('#rodMenu');
  const labelsMenu = $('#labelsMenu');
  const settingsMenu = $('#settingsMenu');
  const drawbar = $('#drawbar');
  const toastEl = $('#toast');
  const emptyHint = $('#emptyHint');
  let bRect = board.getBoundingClientRect();

  // ---------------------------------------------------------------- Idioma
  function t(key, vars) {
    const dict = window.I18N[prefs.lang] || window.I18N.es;
    let s = dict[key] != null ? dict[key] : (window.I18N.es[key] != null ? window.I18N.es[key] : key);
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }

  const numFormats = {};
  function fmtNum(v, maxFrac) {
    const key = prefs.lang + maxFrac;
    if (!numFormats[key]) numFormats[key] = new Intl.NumberFormat(prefs.lang, { maximumFractionDigits: maxFrac });
    return numFormats[key].format(v);
  }

  function applyI18n() {
    document.documentElement.lang = prefs.lang;
    document.title = t('appTitle');
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-title]').forEach((el) => {
      el.title = t(el.dataset.i18nTitle);
      el.setAttribute('aria-label', el.title);
    });
    updateToolbar();
    buildPalette();
    buildRefChips();
    buildTextKeys();
    palette.dataset.dropText = t('dropToDelete');
  }

  // ---------------------------------------------------------------- Persistencia
  function sceneObj() { return { rods }; }
  function snapshot() { return JSON.stringify(sceneObj()); }

  function applyScene(sc) {
    rods = (sc.rods || []).map((r) => Object.assign({}, r, r.pts ? { pts: r.pts.map((q) => q.slice()) } : null));
    // Los trazos de versiones anteriores pasan a ser dibujos que se pueden seleccionar y mover
    for (const st of sc.strokes || []) {
      const r = { id: st.id, shape: 'free', color: st.color, width: st.width, locked: false, angle: 0 };
      if (st.tool === 'hl') r.hl = true;
      setPoints(r, st.points.map(([x, y]) => ({ x, y })));
      rods.push(r);
    }
    nextId = Math.max(0, ...rods.map((r) => Math.max(r.id, r.group || 0, r.numBlock || 0))) + 1;
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!data) {
        // Primera visita en pantallas estrechas: paleta plegada para dejar sitio al lienzo
        if (window.innerWidth < 600) prefs.paletteOpen = false;
        return;
      }
      if (data.prefs) Object.assign(prefs, data.prefs);
      if (data.view) Object.assign(view, data.view);
      if (data.scene) applyScene(data.scene);
    } catch (e) { /* almacenamiento no disponible o datos corruptos */ }
  }

  let saveTimer = null;
  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ prefs, view, scene: sceneObj() })); } catch (e) { /* sin almacenamiento */ }
  }
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }

  // ---------------------------------------------------------------- Historial
  const past = [];
  const future = [];
  let current = '';

  function commit() {
    const s = snapshot();
    if (s === current) return;
    past.push(current);
    if (past.length > 200) past.shift();
    current = s;
    future.length = 0;
    afterChange();
  }

  function undo() {
    finishPoly();
    if (!past.length) return;
    cancelGesture();
    future.push(current);
    current = past.pop();
    applyScene(JSON.parse(current));
    afterChange(true);
  }

  function redo() {
    finishPoly();
    if (!future.length) return;
    cancelGesture();
    past.push(current);
    current = future.pop();
    applyScene(JSON.parse(current));
    afterChange(true);
  }

  // Vuelve al último estado confirmado (p. ej. al cancelar un arrastre)
  function revert() {
    applyScene(JSON.parse(current));
    pruneSelection();
    renderRods();
  }

  function afterChange(reloaded) {
    if (reloaded) {
      pruneSelection();
      closeRodMenu();
      chain = null;
      renderRods();
    }
    $('#btnUndo').disabled = !past.length;
    $('#btnRedo').disabled = !future.length;
    emptyHint.hidden = rods.length > 0;
    saveSoon();
  }

  // ---------------------------------------------------------------- Selección
  function selectedRods() { return rods.filter((r) => selection.has(r.id)); }
  // Añade a la selección el resto de regletas de los bloques ya seleccionados
  function withGroups(ids) {
    const groups = new Set(rods.filter((r) => ids.has(r.id) && r.group).map((r) => r.group));
    if (groups.size) for (const r of rods) if (groups.has(r.group)) ids.add(r.id);
    return ids;
  }
  function groupMembers(r) { return r.group ? rods.filter((o) => o.group === r.group) : [r]; }
  function selectOnly(id) { selection = withGroups(new Set(id == null ? [] : [id])); }
  function pruneSelection() { selection = new Set(rods.filter((r) => selection.has(r.id)).map((r) => r.id)); }
  function clearSelection() {
    if (!selection.size) return;
    selection.clear();
    renderRods();
  }

  // ---------------------------------------------------------------- Geometría
  function findRod(id) { return rods.find((r) => r.id === id); }
  // Los textos viven en la misma lista que las regletas: se seleccionan, mueven, unen y bloquean igual
  const isText = (r) => r.text != null;
  const isDrawing = (r) => r.shape != null;
  const isRod = (r) => !isText(r) && !isDrawing(r);
  // La regleta personalizable adopta el color de la regleta estándar de su misma longitud (1 a 10),
  // salvo que se desactive el autocoloreado (así el color no delata su valor)
  const isStandardLen = (len) => Number.isInteger(len) && len >= 1 && len <= 10;
  const keepsSpecialColor = (len, custom) => custom && (!prefs.autoColorSpecial || !isStandardLen(len));
  function styleOf(r) {
    if (r.plate) return styles[11];
    return keepsSpecialColor(r.len, r.custom) ? styles[10] : styles[r.len - 1];
  }
  function dims(r) {
    if (isText(r)) { const L = layoutText(r.text, r.size); return { w: L.w, h: L.h }; }
    if (isDrawing(r)) return { w: r.w, h: r.h };
    if (r.plate) return { w: 10, h: 10 };
    return r.vertical ? { w: 1, h: r.len } : { w: r.len, h: 1 };
  }
  function scale() { return UNIT * view.zoom; }

  // Giro libre: `angle` (grados) gira la regleta sobre su centro; `x, y` es la esquina sin girar
  const ROTATE_STEP = 3;
  function rodTransform(r) {
    const { w, h } = dims(r);
    return `translate(${r.x} ${r.y})` + (r.angle ? ` rotate(${r.angle} ${w / 2} ${h / 2})` : '');
  }

  // Esquinas reales (con el giro aplicado), empezando por la superior izquierda local
  function rodCorners(r, x = r.x, y = r.y) {
    const { w, h } = dims(r);
    const cx = x + w / 2, cy = y + h / 2;
    const a = (r.angle || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
      .map(([u, v]) => ({ x: cx + u * c - v * s, y: cy + u * s + v * c }));
  }

  // ¿Se tocan dos polígonos convexos? (teorema del eje separador)
  function polygonsIntersect(A, B) {
    for (const poly of [A, B]) {
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const nx = q.y - p.y, ny = p.x - q.x;
        let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
        for (const v of A) { const d = v.x * nx + v.y * ny; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
        for (const v of B) { const d = v.x * nx + v.y * ny; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
        if (aMax <= bMin + 1e-9 || bMax <= aMin + 1e-9) return false;
      }
    }
    return true;
  }

  // Rectángulo envolvente alineado con los ejes
  function aabb(r) {
    if (!r.angle) { const d = dims(r); return { x0: r.x, y0: r.y, x1: r.x + d.w, y1: r.y + d.h }; }
    const cs = rodCorners(r);
    return {
      x0: Math.min(...cs.map((p) => p.x)), y0: Math.min(...cs.map((p) => p.y)),
      x1: Math.max(...cs.map((p) => p.x)), y1: Math.max(...cs.map((p) => p.y)),
    };
  }

  function bounds(list) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of list) {
      const b = aabb(r);
      x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0);
      x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
    }
    return { x0, y0, x1, y1 };
  }

  // Vértice de giro libre: el inferior izquierdo de la regleta (opuesto al asa)
  function rodPivot(r) { return rodCorners(r)[3]; }

  // Gira la regleta `delta` grados (sentido horario en pantalla) dejando fijo el punto `pivot`
  function rotateAbout(r, delta, pivot) {
    const d = dims(r);
    const cx = r.x + d.w / 2, cy = r.y + d.h / 2;
    const a = delta * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const nx = pivot.x + (cx - pivot.x) * c - (cy - pivot.y) * s;
    const ny = pivot.y + (cx - pivot.x) * s + (cy - pivot.y) * c;
    r.x = r3(nx - d.w / 2); r.y = r3(ny - d.h / 2);
    r.angle = (r.angle || 0) + delta;
  }

  // Marco de un bloque orientado como su regleta de referencia (la más antigua).
  // Devuelve sus extremos en ese marco y el vértice de giro (inferior izquierdo del bloque).
  function blockFrame(list) {
    const ref = list.reduce((a, b) => (b.id < a.id ? b : a));
    const ang = ref.angle || 0;
    const a = ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const r of list) {
      for (const p of rodCorners(r)) {
        const u = p.x * c + p.y * s, v = -p.x * s + p.y * c;
        minU = Math.min(minU, u); maxU = Math.max(maxU, u);
        minV = Math.min(minV, v); maxV = Math.max(maxV, v);
      }
    }
    const toWorld = (U, V) => ({ x: U * c - V * s, y: U * s + V * c });
    return { ref, ang, minU, maxU, minV, maxV, pivot: toWorld(minU, maxV) };
  }

  // Gira todas las regletas de un bloque alrededor de su vértice de giro
  function rotateBlockBy(list, delta) {
    const pivot = blockFrame(list).pivot;
    list.forEach((r) => rotateAbout(r, delta, pivot));
    list.forEach(normalizeAngle);
  }

  // ¿Se puede mostrar el asa de giro en la selección actual?
  function canFreeRotate(list) {
    if (!prefs.freeRotate || mode !== 'select' || drawMode || !list.length || list.some((r) => r.locked || !isRod(r))) return false;
    return list.length === 1 || isSingleBlock(list);
  }

  // Deja el ángulo entre 0 y 359. Los giros de 90°, 180° y 270° se conservan como giro para que
  // el vértice de giro siga en la misma esquina y duplicar continúe el polígono.
  function normalizeAngle(r) {
    r.angle = (((r.angle || 0) % 360) + 360) % 360;
  }

  function screenToWorld(cx, cy) {
    const s = scale();
    return { x: (cx - bRect.left - view.x) / s, y: (cy - bRect.top - view.y) / s };
  }

  function visibleWorld() {
    const s = scale();
    return { x0: -view.x / s, y0: -view.y / s, x1: (bRect.width - view.x) / s, y1: (bRect.height - view.y) / s };
  }

  function overlaps(x, y, w, h, ignore) {
    const e = 1e-6;
    return rods.some((o) => {
      if ((ignore && ignore.has(o)) || isDrawing(o)) return false; // los dibujos no ocupan sitio
      const b = aabb(o);
      return x < b.x1 - e && x + w > b.x0 + e && y < b.y1 - e && y + h > b.y0 + e;
    });
  }

  // Ajuste magnético: a la cuadrícula (si está visible) y a los bordes de las regletas cercanas.
  // `ignore`: regletas que se están moviendo y no sirven de referencia.
  function snapPosition(r, x, y, ignore) {
    if (!prefs.snap) return { x: r3(x), y: r3(y) };
    const { w, h } = dims(r);
    const TH = 0.3;

    // Con regletas giradas, se unen vértice con vértice (para construir polígonos)
    const VERTEX_TH = 0.45;
    let best = null;
    const mine = rodCorners(r, x, y);
    for (const o of rods) {
      if (o === r || (ignore && ignore.has(o)) || (!r.angle && !o.angle)) continue;
      for (const p of rodCorners(o)) {
        for (const m of mine) {
          const d = Math.hypot(p.x - m.x, p.y - m.y);
          if (d < VERTEX_TH && (!best || d < best.d)) best = { d, dx: p.x - m.x, dy: p.y - m.y };
        }
      }
    }
    if (best) return { x: r3(x + best.dx), y: r3(y + best.dy) };
    if (r.angle) {
      if (r.angle % 90 === 0 && prefs.grid) {
        const b = aabb(r);
        const bx0 = b.x0 + (x - r.x), by0 = b.y0 + (y - r.y);
        return { x: r3(x + Math.round(bx0) - bx0), y: r3(y + Math.round(by0) - by0) };
      }
      return { x: r3(x), y: r3(y) };
    }

    const toGrid = prefs.grid;
    let bx = toGrid ? Math.round(x) : x, by = toGrid ? Math.round(y) : y;
    let bdx = toGrid ? Math.abs(bx - x) : TH, bdy = toGrid ? Math.abs(by - y) : TH;
    for (const o of rods) {
      if (o === r || (ignore && ignore.has(o)) || o.angle) continue;
      const od = dims(o);
      const nearY = y < o.y + od.h + 1 && y + h > o.y - 1;
      const nearX = x < o.x + od.w + 1 && x + w > o.x - 1;
      if (nearY) {
        for (const c of [o.x + od.w, o.x - w, o.x, o.x + od.w - w]) {
          const d = Math.abs(c - x);
          if (d < TH && d < bdx - 1e-9) { bx = c; bdx = d; }
        }
      }
      if (nearX) {
        for (const c of [o.y + od.h, o.y - h, o.y, o.y + od.h - h]) {
          const d = Math.abs(c - y);
          if (d < TH && d < bdy - 1e-9) { by = c; bdy = d; }
        }
      }
    }
    return { x: r3(bx), y: r3(by) };
  }

  // Primer hueco libre visible: filas hacia abajo (horizontal) o columnas a la derecha (vertical)
  function findFreeSpot(w, h, vertical) {
    const vw = visibleWorld();
    const x0 = Math.ceil(vw.x0 + 0.5);
    const y0 = Math.ceil(vw.y0 + 0.5);
    for (let i = 0; i < 1000; i++) {
      const x = vertical ? x0 + i : x0;
      const y = vertical ? y0 : y0 + i;
      if (!overlaps(x, y, w, h)) return { x, y };
    }
    return { x: x0, y: y0 };
  }

  function ensureVisible(list) {
    const s = scale();
    const b = bounds(list);
    const m = 24;
    const left = view.x + b.x0 * s, top = view.y + b.y0 * s;
    const right = view.x + b.x1 * s, bottom = view.y + b.y1 * s;
    let dx = 0, dy = 0;
    if (right > bRect.width - m) dx = bRect.width - m - right;
    if (left + dx < m) dx = m - left;
    if (bottom > bRect.height - m) dy = bRect.height - m - bottom;
    if (top + dy < m) dy = m - top;
    if (dx || dy) { view.x += dx; view.y += dy; applyView(); }
  }

  // ---------------------------------------------------------------- Vista
  function applyView() {
    world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${scale()})`);
    renderGrid();
    $('#zoomLabel').textContent = Math.round(view.zoom * 100) + '%';
    if (selection.size) renderSel(); // el asa de giro mantiene su tamaño en pantalla
    positionRodMenu();
    positionTextEditor();
    saveSoon();
  }

  function renderGrid() {
    const s = scale();
    if (!prefs.grid || s < 6) { gridPath.setAttribute('d', ''); return; }
    const W = bRect.width, H = bRect.height;
    let d = '';
    for (let x = ((view.x % s) + s) % s; x <= W; x += s) d += `M${Math.round(x) + 0.5} 0V${H}`;
    for (let y = ((view.y % s) + s) % s; y <= H; y += s) d += `M0 ${Math.round(y) + 0.5}H${W}`;
    gridPath.setAttribute('d', d);
  }

  function zoomAt(cx, cy, factor) {
    const z = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const k = z / view.zoom;
    const px = cx - bRect.left, py = cy - bRect.top;
    view.x = px - (px - view.x) * k;
    view.y = py - (py - view.y) * k;
    view.zoom = z;
    applyView();
  }

  function zoomCenter(factor) {
    zoomAt(bRect.left + bRect.width / 2, bRect.top + bRect.height / 2, factor);
  }

  function fitToScreen() {
    let { x0, y0, x1, y1 } = bounds(rods);
    if (!isFinite(x0)) {
      view.x = UNIT; view.y = UNIT; view.zoom = 1;
    } else {
      x0 -= 1; y0 -= 1; x1 += 1; y1 += 1;
      const z = clamp(Math.min(bRect.width / ((x1 - x0) * UNIT), bRect.height / ((y1 - y0) * UNIT)), MIN_ZOOM, 2.5);
      view.zoom = z;
      view.x = (bRect.width - (x1 - x0) * UNIT * z) / 2 - x0 * UNIT * z;
      view.y = (bRect.height - (y1 - y0) * UNIT * z) / 2 - y0 * UNIT * z;
    }
    applyView();
  }

  // ---------------------------------------------------------------- Etiquetas
  function labelFor(len, custom, mode = prefs.labelMode) {
    switch (mode) {
      case 'integers':
        return { text: fmtNum(len, 1) };
      case 'decimals': {
        const v = len / prefs.ref;
        const rounded = Math.round(v * 100) / 100;
        return { text: (Math.abs(rounded - v) > 1e-9 ? '≈' : '') + fmtNum(v, 2) };
      }
      case 'letters':
        if (!custom && len === 100) return { text: letters()[11] };
        return { text: keepsSpecialColor(len, custom) ? letters()[10] : letters()[len - 1] };
      case 'fractions': {
        let n = len, d = prefs.ref;
        if (!Number.isInteger(n)) { n = Math.round(len * 10); d = prefs.ref * 10; }
        const g = gcd(n, d);
        n /= g; d /= g;
        return d === 1 ? { text: String(n) } : { frac: true, n, d };
      }
      default:
        return null;
    }
  }

  function letters() {
    const set = prefs.colorSet === 'canals' ? LETTERS_CANALS : LETTERS;
    return set[prefs.lang] || set.es;
  }

  // ---------------------------------------------------------------- Colores
  let styles = [];

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixHex(hex, target, k) {
    const a = hexToRgb(hex), b = hexToRgb(target);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  // Borde y texto calculados a partir del color de relleno
  function deriveStyle(fill) {
    const [r, g, b] = hexToRgb(fill).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return { fill: fill.toUpperCase(), stroke: mixHex(fill, '#000000', 0.35), text: lum > 0.4 ? mixHex(fill, '#000000', 0.72) : '#FFFFFF' };
  }
  function baseFill(i) {
    if (i === 11) return PLATE_FILL;
    if (prefs.colorSet === 'canals') return CANALS_FILLS[i];
    return i === 10 ? CUSTOM_STYLE.fill : ROD_STYLES[i].fill;
  }
  function computeStyles() {
    styles = [];
    for (let i = 0; i <= 10; i++) {
      const custom = prefs.rodColors && prefs.rodColors[i];
      if (custom) styles.push(deriveStyle(custom));
      else if (prefs.colorSet === 'canals') styles.push(deriveStyle(CANALS_FILLS[i]));
      else styles.push(i === 10 ? CUSTOM_STYLE : ROD_STYLES[i]);
    }
    const plate = prefs.rodColors && prefs.rodColors[11];
    styles.push(deriveStyle(plate || PLATE_FILL));
  }

  // ---------------------------------------------------------------- Textos y operaciones
  // Escritura rápida: "1/2" se muestra como fracción, "5^2" como potencia y "(a+b)/c" agrupa con paréntesis
  const measureCtx = document.createElement('canvas').getContext('2d');
  function measure(s, fs) {
    measureCtx.font = '600 100px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    return measureCtx.measureText(s).width / 100 * fs;
  }
  const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const unwrap = (s) => (/^\(.*\)$/.test(s) ? s.slice(1, -1) : s);
  const OPERAND = '\\([^()]*\\)|\\d+(?:[.,]\\d+)?|[A-Za-zÀ-ÖØ-öø-ÿ]+|\\?';
  const MATH_RE = new RegExp(`(${OPERAND})\\/(${OPERAND})|(${OPERAND})\\^(-?(?:${OPERAND}))`, 'g');

  // Trozos de texto: { s } texto normal, { s, sup } base con exponente, { n, d } fracción
  function parseMath(str) {
    str = str.replace(/\*/g, '×').replace(/<=/g, '≤').replace(/>=/g, '≥');
    const toks = [];
    let last = 0;
    for (const m of str.matchAll(MATH_RE)) {
      if (m.index > last) toks.push({ s: str.slice(last, m.index) });
      if (m[1] != null) toks.push({ n: unwrap(m[1]), d: unwrap(m[2]) });
      else toks.push({ s: m[3], sup: unwrap(m[4]) });
      last = m.index + m[0].length;
    }
    if (last < str.length) toks.push({ s: str.slice(last) });
    return toks;
  }

  // Composición del texto en unidades del lienzo (se guarda en caché: dims() la consulta a menudo)
  const textCache = new Map();
  function layoutText(str, fs) {
    const key = fs + '|' + str;
    let L = textCache.get(key);
    if (L) return L;
    const toks = parseMath(str);
    const h = fs * (toks.some((t) => t.d != null) ? 2.1 : 1.25);
    const mid = h / 2, pad = fs * 0.15;
    const text = (v, x, y, size, center) =>
      `<text x="${r3(x)}" y="${r3(y)}" font-size="${r3(size)}" dominant-baseline="central"${center ? ' text-anchor="middle"' : ''}>${escHtml(v)}</text>`;
    let x = pad, svg = '';
    for (const t of toks) {
      if (t.d != null) {
        const k = fs * 0.75;
        const fw = Math.max(measure(t.n, k), measure(t.d, k)) + fs * 0.25;
        svg += text(t.n, x + fw / 2, mid - fs * 0.45, k, true) +
          `<path d="M${r3(x + fs * 0.06)} ${r3(mid)}H${r3(x + fw - fs * 0.06)}" stroke-width="${r3(fs * 0.07)}"/>` +
          text(t.d, x + fw / 2, mid + fs * 0.5, k, true);
        x += fw;
      } else {
        svg += text(t.s, x, mid, fs);
        x += measure(t.s, fs);
        if (t.sup != null) {
          const k = fs * 0.6;
          svg += text(t.sup, x + fs * 0.03, mid - fs * 0.38, k);
          x += measure(t.sup, k) + fs * 0.06;
        }
      }
    }
    L = { w: r3(Math.max(x + pad, fs * 0.9)), h: r3(h), svg };
    textCache.set(key, L);
    return L;
  }

  // Regleta unida a un texto sobre la que este empieza (su etiqueta), o null
  function textHost(r) {
    if (!r.group) return null;
    const L = layoutText(r.text, r.size);
    const px = r.x + Math.min(L.w, 1) / 2, py = r.y + L.h / 2;
    const dot = [{ x: px, y: py }, { x: px + 0.01, y: py }, { x: px + 0.01, y: py + 0.01 }, { x: px, y: py + 0.01 }];
    for (let i = rods.length - 1; i >= 0; i--) {
      const o = rods[i];
      if (isRod(o) && o.group === r.group && polygonsIntersect(rodCorners(o), dot)) return o;
    }
    return null;
  }

  function textMarkup(r) {
    const L = layoutText(r.text, r.size);
    // Sobre una regleta, el texto toma el color de sus etiquetas para que se lea bien (blanco sobre la azul…)
    const host = textHost(r);
    const color = host && host.filled !== false ? styleOf(host).text : null;
    const cls = ['rod', 'text-item'];
    if (!r.text.trim()) cls.push('empty');
    if (r.locked) cls.push('locked');
    if (selection.has(r.id)) cls.push('selected');
    let s = `<g class="${cls.join(' ')}" data-id="${r.id}" transform="${rodTransform(r)}">` +
      `<rect class="text-hit" width="${L.w}" height="${L.h}"/><g class="txt"${color ? ` style="color:${color}"` : ''}>${L.svg}</g>`;
    if (r.locked) s += `<use href="#i-lock" class="lock-badge" x="${L.w}" y="-0.3" width="0.3" height="0.3"/>`;
    return s + '</g>';
  }

  // ---------------------------------------------------------------- Dibujo de regletas
  function rodMarkup(r) {
    if (isText(r)) return textMarkup(r);
    if (isDrawing(r)) return drawingMarkup(r);
    const st = styleOf(r);
    const { w, h } = dims(r);
    const filled = r.filled !== false;
    // Sin relleno: contorno negro punteado, sin el color de la regleta (representa "lo que falta")
    const outline = filled ? st.stroke : HOLLOW_STROKE;
    const ink = filled ? st.text : HOLLOW_STROKE;
    const selected = selection.has(r.id);
    const cls = ['rod'];
    if (r.custom) cls.push('custom');
    if (r.vertical) cls.push('vertical');
    if (!filled) cls.push('hollow');
    if (r.locked) cls.push('locked');
    if (selected) cls.push('selected');

    let s = `<g class="${cls.join(' ')}" data-id="${r.id}" transform="${rodTransform(r)}">`;
    s += `<rect class="rod-body" width="${w}" height="${h}" rx="0.03" fill="${filled ? st.fill : 'none'}" stroke="${outline}"/>`;

    // Una regleta numerada siempre muestra sus cuadritos
    if ((prefs.unitLines || r.numbered) && r.len > 1) {
      let d = '';
      if (r.plate) for (let i = 1; i < 10; i++) d += `M${i} 0V10M0 ${i}H10`;
      else for (let i = 1; i < r.len - 1e-6; i++) d += r.vertical ? `M0 ${i}H1` : `M${i} 0V1`;
      s += `<path class="unit-lines" d="${d}" stroke="${filled ? st.stroke : '#8A8A8A'}"/>`;
    }

    const hasHandle = r.custom && !r.locked;
    if (r.numbered) s += numbersMarkup(r, ink, hasHandle && selected);
    else if (!labelledRods.has(r)) s += labelMarkup(r, w, h, ink, hasHandle);

    if (hasHandle) {
      if (r.vertical) {
        const cy = h - 0.32;
        s += `<g class="handle"><rect class="handle-hit" x="-0.1" y="${h - 0.65}" width="1.2" height="0.85"/>` +
          `<path class="handle-arrows" fill="${ink}" d="M0.5 ${cy - 0.22}L0.34 ${cy - 0.04}H0.66ZM0.5 ${cy + 0.22}L0.34 ${cy + 0.04}H0.66Z"/></g>`;
      } else {
        const cx = w - 0.32;
        s += `<g class="handle"><rect class="handle-hit" x="${w - 0.65}" y="-0.1" width="0.85" height="1.2"/>` +
          `<path class="handle-arrows" fill="${ink}" d="M${cx - 0.22} 0.5L${cx - 0.04} 0.34V0.66ZM${cx + 0.22} 0.5L${cx + 0.04} 0.34V0.66Z"/></g>`;
      }
    }
    if (r.locked) {
      s += `<use href="#i-lock" class="lock-badge" x="${w - 0.36}" y="0.05" width="0.3" height="0.3" style="color:${ink}"/>`;
    }
    return s + '</g>';
  }

  function labelMarkup(r, w, h, color, hasHandle) {
    // Una regleta sin relleno no desvela su valor: muestra "?" si las etiquetas están activadas
    // Cada regleta puede tener su propio etiquetado (`label`); si no, sigue el general
    const mode = r.label || prefs.labelMode;
    const lab = r.filled === false ? (mode === 'basic' ? null : { text: '?' }) : labelFor(r.len, r.custom, mode);
    if (!lab) return '';
    let cx = w / 2, cy = h / 2;
    // Deja sitio al asidero de la regleta personalizable
    if (hasHandle && r.len >= 1.6) {
      if (r.vertical) cy = (h - 0.6) / 2; else cx = (w - 0.6) / 2;
    }
    const k = r.plate ? 3 : 1; // en la placa de 100 la etiqueta es más grande
    // La etiqueta se mantiene derecha aunque la regleta esté girada
    const upright = r.angle ? ` transform="rotate(${-r.angle} ${cx} ${cy})"` : '';
    if (lab.frac) {
      const bw = (Math.max(String(lab.n).length, String(lab.d).length) * 0.11 + 0.06) * k;
      return `<g class="rod-label" fill="${color}" font-size="${0.3 * k}"${upright}>` +
        `<text x="${cx}" y="${cy - 0.19 * k}" dominant-baseline="central">${lab.n}</text>` +
        `<path class="frac-bar" d="M${cx - bw} ${cy}H${cx + bw}" stroke="${color}"/>` +
        `<text x="${cx}" y="${cy + 0.2 * k}" dominant-baseline="central">${lab.d}</text></g>`;
    }
    const looksVertical = r.vertical !== (Math.abs(Math.sin((r.angle || 0) * Math.PI / 180)) > 0.7);
    const avail = looksVertical && !r.plate ? 1 : (hasHandle ? Math.max(1, w - 0.6) : w);
    const fs = Math.min(0.5 * k, (avail * 0.88) / (lab.text.length * 0.58));
    return `<g class="rod-label" fill="${color}" font-size="${r3(fs)}"${upright}><text x="${cx}" y="${cy}" dominant-baseline="central">${lab.text}</text></g>`;
  }

  // Numeración de los cuadritos (sustituye a la etiqueta): de izquierda a derecha, o de arriba abajo
  // si es vertical; la placa de 100 se numera por filas, como una tabla del 100.
  // Con «Numerar desde abajo», las filas de la placa y las regletas verticales se numeran de abajo arriba.
  function numbersMarkup(r, color, hasHandle) {
    let s = '';
    const add = (n, x, y) => {
      const upright = r.angle ? ` transform="rotate(${-r.angle} ${x} ${y})"` : '';
      s += `<text x="${x}" y="${y}" dominant-baseline="central"${upright}>${n}</text>`;
    };
    const k0 = r.numStart || 0; // al numerar varias como un bloque, continúa donde acaba la anterior
    let fs;
    if (r.plate) {
      fs = k0 + 100 >= 1000 ? 0.28 : 0.36;
      for (let i = 0; i < 100; i++) {
        const row = Math.floor(i / 10);
        add(k0 + i + 1, (i % 10) + 0.5, (prefs.numberFromBottom ? 9 - row : row) + 0.5);
      }
    } else {
      const n = Math.floor(r.len + 1e-6);
      fs = k0 + n >= 1000 ? 0.24 : k0 + n >= 100 ? 0.3 : 0.4;
      const up = r.vertical && prefs.numberFromBottom;
      for (let i = 0; i < n; i++) {
        const a = up ? r.len - i - 1 : i; // comienzo del cuadrito a lo largo de la regleta
        // Bajo el asidero de la regleta personalizable el número se aparta hacia el inicio del cuadrito
        const u = hasHandle && a + 1 > r.len - 0.65 ? a + 0.25 : a + 0.5;
        if (r.vertical) add(k0 + i + 1, 0.5, u); else add(k0 + i + 1, u, 0.5);
      }
    }
    return `<g class="rod-label rod-numbers" fill="${color}" font-size="${fs}">${s}</g>`;
  }

  // El borde de selección va en una capa por encima de todas las regletas para que las vecinas no lo tapen
  function selMarkup(r) {
    const { w, h } = dims(r);
    let s = `<g class="sel" data-id="${r.id}" transform="${rodTransform(r)}">` +
      `<rect class="sel-halo" width="${w}" height="${h}" rx="0.03"/>` +
      `<rect class="sel-line" width="${w}" height="${h}" rx="0.03"/>`;
    // Asa de giro: solo con una regleta seleccionada y desbloqueada
    if (selection.size === 1 && canFreeRotate([r])) {
      const k = 1 / view.zoom;
      const vert = r.vertical && !r.plate;
      const kx = vert ? w / 2 : w + 1.0 * k, ky = vert ? -1.0 * k : h / 2;
      const sx = vert ? w / 2 : w, sy = vert ? 0 : h / 2;
      s += `<circle class="rot-pivot" cx="0" cy="${h}" r="${0.13 * k}"/>` +
        `<line class="rot-stem" x1="${sx}" y1="${sy}" x2="${kx}" y2="${ky}"/>` +
        `<g class="rot-knob"><circle class="rot-hit" cx="${kx}" cy="${ky}" r="${0.6 * k}"/>` +
        `<circle class="rot-dot" cx="${kx}" cy="${ky}" r="${0.26 * k}"/>` +
        `<use href="#i-rotate" class="rot-icon" x="${kx - 0.17 * k}" y="${ky - 0.17 * k}" width="${0.34 * k}" height="${0.34 * k}"/></g>`;
    }
    // Tiradores para cambiar una figura: extremos, vértices, esquinas o lados
    if (selection.size === 1 && isDrawing(r) && r.shape !== 'free' && !r.locked && mode === 'select' && !drawMode) {
      const k = 1 / view.zoom;
      s += shapeHandles(r).map(([u, v], i) =>
        `<circle class="shape-hit" data-h="${i}" cx="${r3(u)}" cy="${r3(v)}" r="${r3(0.45 * k)}"/>` +
        `<circle class="shape-handle" cx="${r3(u)}" cy="${r3(v)}" r="${r3(0.15 * k)}"/>`).join('');
    }
    return s + '</g>';
  }

  function renderSel() {
    const sel = rods.filter((r) => selection.has(r.id));
    let html = '';
    const blockKnob = sel.length > 1 && canFreeRotate(sel);
    for (const gid of new Set(sel.map((r) => r.group).filter(Boolean))) {
      const f = blockFrame(rods.filter((r) => r.group === gid));
      const pad = 0.3;
      let inner = `<rect class="group-rect" x="${f.minU - pad}" y="${f.minV - pad}" width="${f.maxU - f.minU + 2 * pad}" height="${f.maxV - f.minV + 2 * pad}" rx="0.15"/>`;
      if (blockKnob) {
        const k = 1 / view.zoom;
        const mv = (f.minV + f.maxV) / 2, kx = f.maxU + 1.0 * k;
        inner += `<circle class="rot-pivot" cx="${f.minU}" cy="${f.maxV}" r="${0.13 * k}"/>` +
          `<line class="rot-stem" x1="${f.maxU + pad}" y1="${mv}" x2="${kx}" y2="${mv}"/>` +
          `<g class="rot-knob"><circle class="rot-hit" cx="${kx}" cy="${mv}" r="${0.6 * k}"/>` +
          `<circle class="rot-dot" cx="${kx}" cy="${mv}" r="${0.26 * k}"/>` +
          `<use href="#i-rotate" class="rot-icon" x="${kx - 0.17 * k}" y="${mv - 0.17 * k}" width="${0.34 * k}" height="${0.34 * k}"/></g>`;
      }
      html += `<g class="group-box"><g transform="rotate(${f.ang})">${inner}</g></g>`;
    }
    selLayer.innerHTML = html + sel.map(selMarkup).join('');
  }

  let labelledRods = new Set();
  function renderRods() {
    // Una regleta con un texto escrito encima no muestra su propia etiqueta, para que no se monten
    labelledRods = new Set(rods.filter((r) => isText(r) && r.text.trim()).map(textHost).filter(Boolean));
    // Por capas: regletas, dibujos y, encima de todo, textos
    rodsLayer.innerHTML = rods.filter(isRod).concat(rods.filter(isDrawing), rods.filter(isText)).map(rodMarkup).join('');
    renderSel();
  }

  function rodElements(id) {
    return [rodsLayer.querySelector(`.rod[data-id="${id}"]`), selLayer.querySelector(`.sel[data-id="${id}"]`)];
  }

  // ---------------------------------------------------------------- Trazos (modo pizarra)
  function pathData(pts) {
    if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}h0.001`;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    if (pts.length === 2) return d + `L${pts[1][0]} ${pts[1][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      d += `Q${x1} ${y1} ${r3((x1 + x2) / 2)} ${r3((y1 + y2) / 2)}`;
    }
    const last = pts[pts.length - 1];
    return d + `L${last[0]} ${last[1]}`;
  }

  function strokeMarkup(s) {
    return `<path class="ink ${s.tool}" data-id="${s.id}" d="${pathData(s.points)}" stroke="${s.color}" stroke-width="${s.width}"/>`;
  }

  // ---------------------------------------------------------------- Figuras (líneas, flechas, poligonales, rectángulos, elipses)
  const canFill = (r) => r.shape === 'rect' || r.shape === 'ellipse' || (r.shape === 'poly' && !!r.closed);
  const isFilled = (r) => (isRod(r) ? r.filled !== false : !!r.fill);

  // Con ajuste magnético y cuadrícula, los puntos caen en los cruces de la cuadrícula
  function snapPoint(p) {
    return prefs.snap && prefs.grid ? { x: Math.round(p.x), y: Math.round(p.y) } : { x: r3(p.x), y: r3(p.y) };
  }

  function newDrawing(shape) {
    return { id: nextId++, shape, x: 0, y: 0, w: 0, h: 0, color: prefs.inkColor, width: PEN_WIDTHS[prefs.inkSize], locked: false, angle: 0 };
  }

  // Guarda los puntos (absolutos) y recalcula el recuadro que los contiene
  function setPoints(r, pts) {
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
    r.x = r3(Math.min(...xs)); r.y = r3(Math.min(...ys));
    r.w = r3(Math.max(...xs) - r.x); r.h = r3(Math.max(...ys) - r.y);
    r.pts = pts.map((q) => [r3(q.x - r.x), r3(q.y - r.y)]);
  }

  // Rectángulo o elipse entre dos esquinas opuestas
  function setBox(r, a, b) {
    r.x = r3(Math.min(a.x, b.x)); r.y = r3(Math.min(a.y, b.y));
    r.w = r3(Math.abs(a.x - b.x)); r.h = r3(Math.abs(a.y - b.y));
  }

  // Contorno como lista de puntos absolutos (lo usa la goma)
  function outline(r) {
    if (r.shape === 'rect') return [[0, 0], [r.w, 0], [r.w, r.h], [0, r.h], [0, 0]].map(([u, v]) => [r.x + u, r.y + v]);
    if (r.shape === 'ellipse') {
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * 2 * Math.PI;
        pts.push([r.x + r.w / 2 * (1 + Math.cos(a)), r.y + r.h / 2 * (1 + Math.sin(a))]);
      }
      return pts;
    }
    const pts = r.pts.map(([u, v]) => [r.x + u, r.y + v]);
    if (r.closed) pts.push(pts[0]);
    return pts;
  }

  // Tiradores en coordenadas locales: esquinas del rectángulo; lados de la elipse (estiran en óvalo)
  // más uno en diagonal que la agranda sin deformarla; extremos o vértices en el resto
  function shapeHandles(r) {
    if (r.shape === 'rect') return [[0, 0], [r.w, 0], [r.w, r.h], [0, r.h]];
    if (r.shape === 'ellipse') {
      const rx = r.w / 2, ry = r.h / 2;
      return [[r.w, ry], [0, ry], [rx, 0], [rx, r.h], [rx + rx * Math.SQRT1_2, ry + ry * Math.SQRT1_2]];
    }
    return r.pts;
  }

  // Arrastre de un tirador hasta el punto `raw` (siempre desde la forma inicial `g.start`)
  function editShape(g, raw) {
    const r = g.rod, s0 = g.start, p = snapPoint(raw);
    if (r.shape === 'rect') {
      const opp = [[s0.x + s0.w, s0.y + s0.h], [s0.x, s0.y + s0.h], [s0.x, s0.y], [s0.x + s0.w, s0.y]][g.h];
      setBox(r, p, { x: opp[0], y: opp[1] });
    } else if (r.shape === 'ellipse') {
      // El centro queda fijo, como con un compás
      const cx = s0.x + s0.w / 2, cy = s0.y + s0.h / 2;
      let rx = s0.w / 2, ry = s0.h / 2;
      if (g.h < 2) rx = Math.abs(p.x - cx);
      else if (g.h < 4) ry = Math.abs(p.y - cy);
      else {
        const k = Math.hypot(raw.x - cx, raw.y - cy) / (Math.hypot(rx, ry) * Math.SQRT1_2 || 1);
        rx *= k; ry *= k;
        if (prefs.snap && prefs.grid) { rx = Math.round(rx); ry = Math.round(ry); }
      }
      setBox(r, { x: cx - rx, y: cy - ry }, { x: cx + rx, y: cy + ry });
    } else {
      const pts = s0.pts.map(([u, v]) => ({ x: s0.x + u, y: s0.y + v }));
      pts[g.h] = p;
      setPoints(r, pts);
    }
  }

  // Mientras se dibuja con el dedo o el ratón desde `p0`
  function drawShapeTo(r, p0, raw) {
    if (r.shape === 'ellipse') {
      let rad = Math.hypot(raw.x - p0.x, raw.y - p0.y);
      if (prefs.snap && prefs.grid) rad = Math.round(rad);
      setBox(r, { x: p0.x - rad, y: p0.y - rad }, { x: p0.x + rad, y: p0.y + rad });
    } else if (r.shape === 'rect') {
      setBox(r, p0, snapPoint(raw));
    } else {
      setPoints(r, [p0, snapPoint(raw)]);
    }
  }

  // Las figuras de tamaño casi nulo (un toque sin arrastrar) no se conservan
  function tooSmall(r) {
    if (r.shape === 'rect') return r.w < 0.1 || r.h < 0.1;
    return r.w < 0.1 && r.h < 0.1;
  }

  function drawingMarkup(r) {
    const cls = ['rod', 'sketch'];
    const fill = r.fill && canFill(r);
    if (fill) cls.push('filled');
    if (r.locked) cls.push('locked');
    if (selection.has(r.id)) cls.push('selected');
    const pts = r.pts || [];
    const line = (list) => 'M' + list.map((q) => q.join(' ')).join('L');
    let geo, hit, extra = '';
    switch (r.shape) {
      case 'rect':
        geo = hit = `<rect width="${r.w}" height="${r.h}"`;
        break;
      case 'ellipse':
        geo = hit = `<ellipse cx="${r3(r.w / 2)}" cy="${r3(r.h / 2)}" rx="${r3(r.w / 2)}" ry="${r3(r.h / 2)}"`;
        // El centro queda marcado, como el pinchazo del compás
        extra = `<circle class="draw-center" cx="${r3(r.w / 2)}" cy="${r3(r.h / 2)}" r="${r3(Math.max(0.06, r.width))}" style="fill:${r.color}"/>`;
        break;
      case 'free':
        geo = hit = `<path d="${pathData(pts)}"`;
        break;
      case 'arrow': {
        const [a, b] = pts;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
        const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
        const L = Math.min(len, Math.max(0.35, r.width * 5)), half = L * 0.5;
        const base = [r3(b[0] - ux * L), r3(b[1] - uy * L)];
        geo = `<path d="${line([a, base])}"`;
        hit = `<path d="${line([a, b])}"`;
        extra = `<path class="ink" d="M${b.join(' ')}L${r3(base[0] - uy * half)} ${r3(base[1] + ux * half)}L${r3(base[0] + uy * half)} ${r3(base[1] - ux * half)}Z" ` +
          `stroke="${r.color}" stroke-width="${r3(r.width * 0.6)}" style="fill:${r.color}"/>`;
        break;
      }
      default: // línea y poligonal
        geo = hit = `<path d="${line(pts)}${r.closed ? 'Z' : ''}"`;
    }
    let s = `<g class="${cls.join(' ')}" data-id="${r.id}" transform="${rodTransform(r)}">` +
      `${hit} class="draw-hit"/>` +
      `${geo} class="ink${r.hl ? ' hl' : ''}" stroke="${r.color}" stroke-width="${r.width}"${fill ? ` style="fill:${r.color};fill-opacity:.22"` : ''}/>` + extra;
    // Vértices de la poligonal que se está dibujando; el primero, resaltado para cerrarla
    if (polyDraft && polyDraft.rod === r) {
      const k = 1 / view.zoom;
      polyDraft.pts.forEach((q, i) => {
        s += `<circle class="${i ? 'poly-vertex' : 'poly-start'}" cx="${r3(q.x - r.x)}" cy="${r3(q.y - r.y)}" r="${r3((i ? 0.1 : 0.2) * k)}"/>`;
      });
    }
    if (r.locked) s += `<use href="#i-lock" class="lock-badge" x="${r.w}" y="-0.3" width="0.3" height="0.3"/>`;
    return s + '</g>';
  }

  // Poligonal: cada toque fija un vértice; tocar el primero la cierra y tocar el último la termina
  function polyDown(e, w) {
    const p = snapPoint(w);
    const near = (q) => Math.hypot(q.x - p.x, q.y - p.y) < Math.min(0.45, 16 / scale());
    if (polyDraft) {
      const pts = polyDraft.pts;
      if (pts.length >= 3 && near(pts[0])) { polyDraft.rod.closed = true; finishPoly(); return; }
      if (near(pts[pts.length - 1])) { finishPoly(); return; }
      pts.push(p);
    } else {
      const r = newDrawing('poly');
      rods.push(r);
      polyDraft = { rod: r, pts: [p] };
      toast(t('polyHint'));
    }
    setPoints(polyDraft.rod, polyDraft.pts);
    renderRods();
    gesture = { type: 'polyPt', pid: e.pointerId };
  }

  function finishPoly() {
    if (!polyDraft) return;
    const { rod, pts } = polyDraft;
    polyDraft = null;
    if (pts.length < 2) deleteRods([rod]); else setPoints(rod, pts);
    renderRods();
    commit();
  }

  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    let k = l2 ? ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / l2 : 0;
    k = clamp(k, 0, 1);
    return Math.hypot(p.x - (a[0] + k * dx), p.y - (a[1] + k * dy));
  }

  function drawingHit(r, p, rad) {
    const pts = outline(r);
    if (pts.length === 1) return Math.hypot(p.x - pts[0][0], p.y - pts[0][1]) <= rad;
    for (let i = 0; i < pts.length - 1; i++) if (segDist(p, pts[i], pts[i + 1]) <= rad) return true;
    return false;
  }

  function eraserRadius() { return 12 / scale(); }

  function eraseAlong(from, to) {
    const rad = eraserRadius();
    const steps = Math.max(1, Math.ceil(dist(from, to) / (rad / 2)));
    let removed = false;
    for (let i = 1; i <= steps; i++) {
      const p = { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps };
      // La goma borra dibujos y figuras enteros (no los bloqueados), nunca regletas ni textos
      const hit = rods.filter((r) => isDrawing(r) && !r.locked && drawingHit(r, p, rad + r.width / 2));
      if (hit.length) { deleteRods(hit); removed = true; }
    }
    if (removed) renderRods();
    return removed;
  }

  function updateEraserCursor(p) {
    if (!p) { eraserCursor.setAttribute('display', 'none'); return; }
    eraserCursor.setAttribute('display', '');
    eraserCursor.setAttribute('cx', p.x);
    eraserCursor.setAttribute('cy', p.y);
    eraserCursor.setAttribute('r', eraserRadius());
  }

  // ---------------------------------------------------------------- Creación de regletas
  function newRod(len, custom) {
    return {
      id: nextId++,
      len: custom ? CUSTOM_DEFAULT_LEN : len,
      custom: !!custom,
      plate: !custom && len === 100,
      x: 0, y: 0,
      vertical: prefs.vertical,
      filled: true,
      locked: false,
      angle: 0,
    };
  }

  // Lleva al frente las regletas indicadas conservando su orden relativo
  function bringToFront(list) {
    const set = new Set(list);
    rods = rods.filter((r) => !set.has(r)).concat(rods.filter((r) => set.has(r)));
  }

  // Clic en la paleta: las regletas del mismo valor se encadenan una tras otra;
  // un valor distinto empieza en el siguiente hueco libre (fila o columna).
  function clickInsert(len, custom) {
    const r = newRod(len, custom);
    const last = chain && findRod(chain.id);
    if (last && last.x === chain.x && last.y === chain.y && last.vertical === r.vertical &&
        last.custom === r.custom && last.len === r.len && !last.angle) {
      const ld = dims(last);
      if (r.vertical) { r.x = last.x; r.y = last.y + ld.h; } else { r.x = last.x + ld.w; r.y = last.y; }
    } else {
      const d = dims(r);
      const p = findFreeSpot(d.w, d.h, r.vertical);
      r.x = p.x; r.y = p.y;
    }
    rods.push(r);
    selectOnly(r.id);
    chain = { id: r.id, x: r.x, y: r.y };
    closeRodMenu();
    renderRods();
    commit();
    ensureVisible([r]);
  }

  // ---------------------------------------------------------------- Acciones sobre la selección
  // Giro de 90° en sentido horario alrededor de la esquina superior izquierda del grupo
  function rotateGroup(list) {
    if (!list.length) return;
    const b = bounds(list);
    const H = b.y1 - b.y0;
    for (const r of list) {
      const d = dims(r);
      const u = r.x - b.x0, v = r.y - b.y0;
      r.x = r3(b.x0 + (H - v - d.h));
      r.y = r3(b.y0 + u);
      r.vertical = !r.vertical;
    }
    bringToFront(list);
  }

  // Copia el grupo junto al original (debajo; a la derecha si es una sola regleta vertical)
  function duplicateGroup(list) {
    const groupMap = new Map();
    const copies = list.map((r) => {
      const c = Object.assign({}, r, { id: nextId++, locked: false });
      if (r.pts) c.pts = r.pts.map((q) => q.slice());
      if (r.group) {
        if (!groupMap.has(r.group)) groupMap.set(r.group, nextId++);
        c.group = groupMap.get(r.group);
      }
      if (r.numBlock) {
        if (!groupMap.has('n' + r.numBlock)) groupMap.set('n' + r.numBlock, nextId++);
        c.numBlock = groupMap.get('n' + r.numBlock);
      }
      return c;
    });
    if (list.length === 1 && list[0].angle) {
      // Su vértice de giro queda en el extremo inferior derecho del original, listo para seguir girando
      const [, , end, start] = rodCorners(list[0]);
      copies[0].x = r3(copies[0].x + end.x - start.x);
      copies[0].y = r3(copies[0].y + end.y - start.y);
      rods.push(copies[0]);
      selection = new Set([copies[0].id]);
      return copies;
    }
    const sideways = list.length === 1 && list[0].vertical;
    let off = { x: 1, y: 1 };
    search:
    for (let k = 1; k < 80; k++) {
      for (const sign of [1, -1]) {
        const dx = sideways ? sign * k : 0, dy = sideways ? 0 : sign * k;
        if (copies.every((c) => !overlaps(c.x + dx, c.y + dy, dims(c).w, dims(c).h))) { off = { x: dx, y: dy }; break search; }
      }
    }
    for (const c of copies) { c.x = r3(c.x + off.x); c.y = r3(c.y + off.y); }
    rods.push(...copies);
    selection = new Set(copies.map((c) => c.id));
    return copies;
  }

  // Numera la selección como un único bloque: cada regleta continúa donde acaba la anterior.
  // Orden de lectura en el marco de la regleta más antigua: por filas, o por columnas si todas son verticales;
  // con «Numerar desde abajo», las filas (y cada columna) se recorren de abajo arriba.
  function numberAsBlock(list) {
    const fromBottom = prefs.numberFromBottom;
    const { ang } = blockFrame(list);
    const a = ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const pos = new Map(list.map((r) => {
      const cs = rodCorners(r).map((p) => ({ u: p.x * c + p.y * s, v: -p.x * s + p.y * c }));
      const v = fromBottom ? -Math.max(...cs.map((p) => p.v)) : Math.min(...cs.map((p) => p.v));
      return [r, { u: Math.min(...cs.map((p) => p.u)), v }];
    }));
    const [major, minor] = list.every((r) => r.vertical && !r.plate) ? ['u', 'v'] : ['v', 'u'];
    const sorted = list.slice().sort((A, B) => {
      const p = pos.get(A), q = pos.get(B);
      return Math.abs(p[major] - q[major]) > 0.5 ? p[major] - q[major] : p[minor] - q[minor];
    });
    // Se recuerda qué regletas forman el bloque para renumerarlas si cambia el sentido
    const bid = list.length > 1 ? nextId++ : 0;
    let k = 0;
    for (const r of sorted) {
      r.numbered = true;
      if (k) r.numStart = k; else delete r.numStart;
      if (bid) r.numBlock = bid; else delete r.numBlock;
      k += r.plate ? 100 : Math.floor(r.len + 1e-6);
    }
  }

  function deleteRods(list) {
    const set = new Set(list);
    rods = rods.filter((r) => !set.has(r));
    // Un bloque que se queda con una sola pieza deja de ser bloque
    for (const r of rods) if (r.group && !rods.some((o) => o !== r && o.group === r.group)) delete r.group;
    pruneSelection();
    if (!selection.size) closeRodMenu();
  }

  // ---------------------------------------------------------------- Menú de regleta(s)
  function openRodMenu() {
    if (!selection.size) return;
    closePopovers();
    refreshRodMenu();
    rodMenu.hidden = false;
    positionRodMenu();
  }

  function refreshRodMenu() {
    const list = selectedRods();
    if (!list.length) return;
    const bars = list.filter(isRod);
    const fillable = list.filter((r) => isRod(r) || canFill(r));
    const allFilled = fillable.every(isFilled);
    const allLocked = list.every((r) => r.locked);
    const anyLocked = list.some((r) => r.locked);
    $('#fillIcon').setAttribute('href', allFilled ? '#i-box-check' : '#i-box');
    $('#numberText').textContent = t(bars.every((r) => r.numbered) ? 'unnumber' : 'number');
    // Relleno: regletas y figuras cerradas; numeración: solo regletas; textos y dibujos no giran
    rodMenu.querySelector('[data-act="edit"]').hidden = !(list.length === 1 && isText(list[0]));
    rodMenu.querySelector('[data-act="fill"]').hidden = !fillable.length;
    rodMenu.querySelector('[data-act="number"]').hidden = !bars.length;
    $('#lockIcon').setAttribute('href', allLocked ? '#i-unlock' : '#i-lock');
    const lockBtn = rodMenu.querySelector('[data-act="lock"]');
    lockBtn.title = t(allLocked ? 'unlock' : 'lock');
    lockBtn.setAttribute('aria-label', lockBtn.title);
    rodMenu.querySelector('[data-act="rotate"]').disabled = anyLocked || bars.length !== list.length;
    rodMenu.querySelector('[data-act="delete"]').disabled = allLocked;
    const oneBlock = isSingleBlock(list);
    const groupBtn = rodMenu.querySelector('[data-act="group"]');
    groupBtn.hidden = list.length < 2;
    $('#groupIcon').setAttribute('href', oneBlock ? '#i-unlink' : '#i-link');
    $('#groupText').textContent = t(oneBlock ? 'ungroup' : 'group');
  }

  // ¿La selección es exactamente un bloque de regletas unidas?
  function isSingleBlock(list) {
    const groups = new Set(list.map((r) => r.group));
    return groups.size === 1 && !!list[0].group;
  }

  function positionRodMenu() {
    if (rodMenu.hidden) return;
    const list = selectedRods();
    if (!list.length) { closeRodMenu(); return; }
    const s = scale();
    const b = bounds(list);
    const left = bRect.left + view.x + b.x0 * s;
    const top = bRect.top + view.y + b.y0 * s;
    const right = bRect.left + view.x + b.x1 * s;
    const bottom = bRect.top + view.y + b.y1 * s;
    const mw = rodMenu.offsetWidth, mh = rodMenu.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = right + 12, y = top;
    if (x + mw > vw - 8) x = left - 12 - mw;
    if (x < 8) {
      x = clamp(left, 8, vw - mw - 8);
      y = bottom + 12;
      if (y + mh > vh - 8) y = top - 12 - mh;
    }
    rodMenu.style.left = x + 'px';
    rodMenu.style.top = clamp(y, 8, vh - mh - 8) + 'px';
  }

  function closeRodMenu() { rodMenu.hidden = true; }

  function rodAction(act) {
    const list = selectedRods();
    if (!list.length) return;
    const unlocked = list.filter((r) => !r.locked);
    const bars = list.filter(isRod);
    switch (act) {
      case 'edit':
        if (list.length === 1 && isText(list[0])) openTextEditor(list[0]);
        return;
      case 'fill': {
        const fillable = list.filter((r) => isRod(r) || canFill(r));
        if (!fillable.length) return;
        const allFilled = fillable.every(isFilled);
        fillable.forEach((r) => {
          if (isRod(r)) r.filled = !allFilled;
          else if (allFilled) delete r.fill;
          else r.fill = true;
        });
        break;
      }
      case 'number': {
        if (!bars.length) return;
        if (bars.every((r) => r.numbered)) bars.forEach((r) => { delete r.numbered; delete r.numStart; delete r.numBlock; });
        else numberAsBlock(bars);
        break;
      }
      case 'rotate':
        if (unlocked.length !== list.length || bars.length !== list.length) return;
        if (list.length > 1 && isSingleBlock(list) && list.some((r) => r.angle)) {
          rotateBlockBy(list, 90);
          bringToFront(list);
        } else if (list.some((r) => r.angle)) {
          // Con regletas giradas libremente: cada una gira 90° sobre su centro
          list.forEach((r) => { r.angle = (r.angle || 0) + 90; normalizeAngle(r); });
          bringToFront(list);
        } else {
          rotateGroup(list);
        }
        break;
      case 'duplicate':
        duplicateGroup(list);
        closeRodMenu();
        break;
      case 'group':
        if (list.length < 2) return;
        if (isSingleBlock(list)) list.forEach((r) => { delete r.group; });
        else { const gid = nextId++; list.forEach((r) => { r.group = gid; }); }
        break;
      case 'lock': {
        const allLocked = list.every((r) => r.locked);
        list.forEach((r) => { r.locked = !allLocked; });
        break;
      }
      case 'delete':
        deleteRods(unlocked);
        break;
    }
    chain = null;
    renderRods();
    commit();
    if (!rodMenu.hidden) { refreshRodMenu(); positionRodMenu(); }
  }

  // ---------------------------------------------------------------- Menús emergentes de la barra
  function closePopovers() {
    for (const [btn, pop] of [[$('#btnLabels'), labelsMenu], [$('#btnSettings'), settingsMenu]]) {
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  // Se abren hacia arriba, porque la barra está en la parte inferior
  function togglePopover(btn, pop) {
    const willOpen = pop.hidden;
    closePopovers();
    closeRodMenu();
    if (!willOpen) return;
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect();
    pop.style.top = Math.max(8, r.top - 6 - pop.offsetHeight) + 'px';
    pop.style.left = clamp(r.left, 8, window.innerWidth - pop.offsetWidth - 8) + 'px';
  }

  // ---------------------------------------------------------------- Cartela del ángulo de giro
  const angleBadge = $('#angleBadge');
  function showAngle(e, angle) {
    // Internamente el giro es horario (SVG); se muestra en sentido antihorario, como en geometría
    angleBadge.textContent = ((360 - angle) % 360) + '°';
    angleBadge.hidden = false;
    const x = clamp(e.clientX - bRect.left + 22, 8, bRect.width - angleBadge.offsetWidth - 8);
    const y = clamp(e.clientY - bRect.top - 56, 8, bRect.height - angleBadge.offsetHeight - 8);
    angleBadge.style.transform = `translate(${x}px, ${y}px)`;
  }
  function hideAngle() { angleBadge.hidden = true; }

  // ---------------------------------------------------------------- Aviso flotante
  let toastTimer = null;
  function toast(msg, actionLabel, action) {
    toastEl.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = msg;
    toastEl.appendChild(span);
    if (actionLabel) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = actionLabel;
      b.addEventListener('click', () => { hideToast(); action(); });
      toastEl.appendChild(b);
    }
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 5000);
  }
  function hideToast() { toastEl.hidden = true; }

  // ---------------------------------------------------------------- Paleta
  // La regleta 1 es cuadrada y cada una crece un poco: se ve el orden sin ocupar tanto ancho
  function buildPalette() {
    let html = '';
    // 1..10, la regleta especial y, al final, la placa de 100
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'custom', 100]) {
      const custom = n === 'custom';
      const plate = n === 100;
      const len = custom ? 11 : n;
      const st = custom ? styles[10] : plate ? styles[11] : styles[n - 1];
      const lab = labelFor(custom ? CUSTOM_DEFAULT_LEN : len, custom);
      let labHtml = '';
      if (lab && !custom) labHtml = lab.frac ? `<span class="frac"><span>${lab.n}</span><span>${lab.d}</span></span>` : lab.text;
      const name = custom ? t('customRod') : plate ? t('plate100') : t('rodN', { n });
      const width = plate ? 46 : PAL_SIZE + (len - 1) * PAL_STEP;
      html += `<button type="button" class="pal-item" data-len="${len}"${custom ? ' data-custom="1"' : ''} title="${name}" aria-label="${name}">` +
        `<span class="pal-label">${labHtml}</span>` +
        `<span class="pal-rod${plate ? ' plate' : ''}" style="--w:${width}px;background-color:${st.fill};border-color:${st.stroke};color:${st.text}">` +
        (custom ? '<svg class="ico"><use href="#i-resize"/></svg>' : '') + '</span></button>';
    }
    paletteList.innerHTML = html;
  }

  function buildRefChips() {
    let html = '';
    for (let n = 1; n <= 10; n++) {
      const st = styles[n - 1];
      html += `<button type="button" class="ref-chip" data-ref="${n}" aria-pressed="${prefs.ref === n}" ` +
        `style="background:${st.fill};color:${st.text};border-color:${st.stroke}" aria-label="${t('rodN', { n })}">${n}</button>`;
    }
    // La placa de 100 como unidad (útil para el euro: placa = 1 €, regleta blanca = 1 céntimo)
    const ps = styles[11];
    html += `<button type="button" class="ref-chip plate" data-ref="100" aria-pressed="${prefs.ref === 100}" ` +
      `style="background-color:${ps.fill};color:${ps.text};border-color:${ps.stroke}" aria-label="${t('plate100')}">${t('plate100')}</button>`;
    $('#refChips').innerHTML = html;
  }

  function overPalette(cx, cy) {
    if (palette.hidden) return false;
    const r = palette.getBoundingClientRect();
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }

  function insideBoard(cx, cy) {
    return cx >= bRect.left && cx <= bRect.right && cy >= bRect.top && cy <= bRect.bottom;
  }

  paletteList.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.pal-item');
    if (!item || e.button > 0 || gesture) return;
    bRect = board.getBoundingClientRect();
    closePopovers();
    gesture = {
      type: 'palette',
      pid: e.pointerId,
      len: +item.dataset.len,
      custom: !!item.dataset.custom,
      startX: e.clientX,
      startY: e.clientY,
      rod: null,
    };
  });
  paletteList.addEventListener('click', (e) => {
    // Activación con teclado (Enter / Espacio)
    const item = e.target.closest('.pal-item');
    if (item && e.detail === 0) clickInsert(+item.dataset.len, !!item.dataset.custom);
  });
  palette.addEventListener('contextmenu', (e) => e.preventDefault());

  function paletteMove(e, g) {
    if (!g.rod) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return;
      g.rod = newRod(g.len, g.custom);
      rods.push(g.rod);
      selectOnly(g.rod.id);
      closeRodMenu();
    }
    const p = screenToWorld(e.clientX, e.clientY);
    const d = dims(g.rod);
    const sp = snapPosition(g.rod, p.x - Math.min(d.w, 3) / 2, p.y - Math.min(d.h, 3) / 2);
    g.rod.x = sp.x; g.rod.y = sp.y;
    renderRods();
  }

  function paletteUp(e, g) {
    if (!g.rod) {
      clickInsert(g.len, g.custom);
      return;
    }
    if (insideBoard(e.clientX, e.clientY) && !overPalette(e.clientX, e.clientY)) {
      chain = null;
      commit();
    } else {
      deleteRods([g.rod]);
      renderRods();
    }
  }

  // ---------------------------------------------------------------- Gestos en el lienzo
  board.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button === 2) return; // lo gestiona 'contextmenu'
    bRect = board.getBoundingClientRect();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignorar */ }
    closePopovers();
    hideToast();

    // Dos dedos: zoom y desplazamiento en cualquier modo
    if (pointers.size === 2) { cancelGesture(); startPinch(); return; }
    if (pointers.size > 2 || gesture) return;

    chain = null;
    const w = screenToWorld(e.clientX, e.clientY);

    if (drawMode && e.button !== 1) {
      closeRodMenu();
      if (prefs.tool === 'eraser') {
        gesture = { type: 'erase', pid: e.pointerId, last: w, changed: eraseAlong(w, w) };
      } else if (prefs.tool === 'poly') {
        polyDown(e, w);
      } else if (SHAPE_TOOLS.includes(prefs.tool)) {
        const p0 = snapPoint(w);
        const r = newDrawing(prefs.tool === 'circle' ? 'ellipse' : prefs.tool);
        drawShapeTo(r, p0, p0);
        rods.push(r);
        renderRods();
        gesture = { type: 'shape', pid: e.pointerId, rod: r, p0 };
      } else {
        const hl = prefs.tool === 'highlighter';
        const s = {
          id: nextId++,
          tool: hl ? 'hl' : 'pen',
          color: prefs.inkColor,
          width: (hl ? HL_WIDTHS : PEN_WIDTHS)[prefs.inkSize],
          points: [[r3(w.x), r3(w.y)]],
        };
        inkLayer.insertAdjacentHTML('beforeend', strokeMarkup(s));
        gesture = { type: 'draw', pid: e.pointerId, stroke: s, el: inkLayer.lastElementChild };
      }
      return;
    }

    // Tirador de una figura
    const sh = e.target.closest('.shape-hit');
    if (sh && mode === 'select' && selection.size === 1) {
      const r = selectedRods()[0];
      closeRodMenu();
      gesture = { type: 'shapeEdit', pid: e.pointerId, rod: r, h: +sh.dataset.h, start: { x: r.x, y: r.y, w: r.w, h: r.h, pts: r.pts }, moved: false };
      return;
    }

    // Asa de giro libre de un bloque
    if (e.target.closest('.rot-knob') && selection.size > 1) {
      const members = selectedRods();
      const f = blockFrame(members);
      closeRodMenu();
      bringToFront(members);
      renderRods();
      gesture = {
        type: 'rotateBlock', pid: e.pointerId, members, pivot: f.pivot, ref: f.ref,
        starts: new Map(members.map((r) => [r, { x: r.x, y: r.y, angle: r.angle || 0, vertical: r.vertical }])),
        a0: Math.atan2(w.y - f.pivot.y, w.x - f.pivot.x) * 180 / Math.PI, angle0: f.ang,
        moved: false, shown: f.ang,
      };
      showAngle(e, f.ang);
      return;
    }

    // Asa de giro libre
    if (e.target.closest('.rot-knob') && selection.size === 1) {
      const r = selectedRods()[0];
      const pivot = rodPivot(r);
      closeRodMenu();
      bringToFront([r]);
      renderRods();
      gesture = {
        type: 'rotate', pid: e.pointerId, rod: r, pivot,
        start: { x: r.x, y: r.y, angle: r.angle || 0 },
        a0: Math.atan2(w.y - pivot.y, w.x - pivot.x) * 180 / Math.PI, angle0: r.angle || 0,
        moved: false, els: rodElements(r.id),
      };
      showAngle(e, r.angle || 0);
      return;
    }

    const rodEl = e.target.closest('.rod');
    const r = rodEl && findRod(+rodEl.dataset.id);
    // Volver a tocar una regleta ya seleccionada (sin menú abierto) abre su menú
    const tapOpensMenu = !!r && selection.has(r.id) && rodMenu.hidden;
    closeRodMenu();

    // Modo "mover lienzo" o botón central: arrastrar desplaza; tocar una regleta la selecciona
    if (mode === 'pan' || e.button === 1) {
      startPan(e);
      if (r) {
        gesture.tapRod = r.id;
        gesture.tapOpensMenu = tapOpensMenu;
      }
      return;
    }

    if (!r) {
      // Fondo: recuadro de selección
      gesture = { type: 'marquee', pid: e.pointerId, start: w, startX: e.clientX, startY: e.clientY, moved: false, additive: e.shiftKey, base: new Set(selection) };
      return;
    }

    if (e.shiftKey) {
      // Mayúsculas + clic: añadir o quitar de la selección
      const members = groupMembers(r);
      if (selection.has(r.id)) members.forEach((o) => selection.delete(o.id)); else members.forEach((o) => selection.add(o.id));
      renderRods();
      return;
    }

    if (!selection.has(r.id)) { selectOnly(r.id); renderRods(); }

    if (!r.locked && e.target.closest('.handle')) {
      gesture = { type: 'resize', pid: e.pointerId, rod: r, moved: false };
      return;
    }

    // Se mueven juntas todas las regletas seleccionadas que no estén bloqueadas
    const moving = r.locked ? [] : selectedRods().filter((o) => !o.locked);
    if (!moving.length) {
      // Regleta bloqueada: arrastrar hace un recuadro de selección; tocarla abre el menú
      gesture = { type: 'marquee', pid: e.pointerId, start: w, startX: e.clientX, startY: e.clientY, moved: false, additive: false, base: new Set(), tapRod: r.id, tapOpensMenu };
      return;
    }
    gesture = {
      type: 'drag', pid: e.pointerId, lead: r, moving,
      origins: new Map(moving.map((o) => [o, { x: o.x, y: o.y }])),
      startX: e.clientX, startY: e.clientY,
      moved: false, tapOpensMenu, els: null,
    };
  });

  function startPan(e) {
    gesture = { type: 'pan', pid: e.pointerId, startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y, moved: false };
  }

  function startPinch() {
    const [a, b] = Array.from(pointers.values());
    gesture = {
      type: 'pinch',
      d0: Math.max(10, dist(a, b)),
      c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      zoom0: view.zoom, vx: view.x, vy: view.y,
    };
    closeRodMenu();
  }

  function updatePinch() {
    const g = gesture;
    const [a, b] = Array.from(pointers.values());
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const z = clamp(g.zoom0 * dist(a, b) / g.d0, MIN_ZOOM, MAX_ZOOM);
    const s0 = UNIT * g.zoom0;
    const wx = (g.c0.x - bRect.left - g.vx) / s0;
    const wy = (g.c0.y - bRect.top - g.vy) / s0;
    view.zoom = z;
    view.x = c.x - bRect.left - wx * UNIT * z;
    view.y = c.y - bRect.top - wy * UNIT * z;
    applyView();
  }

  function cancelGesture() {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    if (g.type === 'drag' || g.type === 'resize' || g.type === 'rotate' || g.type === 'rotateBlock' || g.type === 'shapeEdit') {
      hideAngle();
      revert();
    } else if (g.type === 'draw') {
      if (g.el) g.el.remove();
    } else if (g.type === 'shape') {
      deleteRods([g.rod]);
      renderRods();
    } else if (g.type === 'erase') {
      if (g.changed) commit();
    } else if (g.type === 'palette' && g.rod) {
      deleteRods([g.rod]);
      renderRods();
    } else if (g.type === 'marquee') {
      marqueeEl.setAttribute('display', 'none');
    }
    palette.classList.remove('drop-delete');
  }

  function updateMarquee(g, p) {
    const x = Math.min(g.start.x, p.x), y = Math.min(g.start.y, p.y);
    const w = Math.abs(p.x - g.start.x), h = Math.abs(p.y - g.start.y);
    marqueeEl.setAttribute('display', '');
    marqueeEl.setAttribute('x', x);
    marqueeEl.setAttribute('y', y);
    marqueeEl.setAttribute('width', w);
    marqueeEl.setAttribute('height', h);
    // Se seleccionan las regletas que toca el recuadro
    const next = new Set(g.additive ? g.base : []);
    const box = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    for (const r of rods) {
      if (polygonsIntersect(rodCorners(r), box)) next.add(r.id);
    }
    withGroups(next);
    if (next.size !== selection.size || [...next].some((id) => !selection.has(id))) {
      selection = next;
      renderRods();
    }
  }

  window.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture;

    if (!g) {
      if (drawMode && prefs.tool === 'eraser' && board.contains(e.target)) {
        updateEraserCursor(screenToWorld(e.clientX, e.clientY));
      }
      // Con ratón, la poligonal muestra el siguiente lado hasta el puntero
      if (drawMode && polyDraft && board.contains(e.target)) {
        setPoints(polyDraft.rod, polyDraft.pts.concat([snapPoint(screenToWorld(e.clientX, e.clientY))]));
        renderRods();
      }
      return;
    }
    if (g.type === 'pinch') { if (pointers.size >= 2) updatePinch(); return; }
    if (g.pid !== e.pointerId) return;

    switch (g.type) {
      case 'palette':
        paletteMove(e, g);
        break;

      case 'pan': {
        const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
        if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        g.moved = true;
        view.x = g.vx + dx;
        view.y = g.vy + dy;
        applyView();
        break;
      }

      case 'marquee': {
        if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return;
        g.moved = true;
        updateMarquee(g, screenToWorld(e.clientX, e.clientY));
        break;
      }

      case 'drag': {
        const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
        if (!g.moved) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          g.moved = true;
          bringToFront(g.moving);
          renderRods();
          g.els = g.moving.map((o) => [o, rodElements(o.id)]);
          g.movingSet = new Set(g.moving);
        }
        // La regleta que se arrastra decide el ajuste; las demás la acompañan
        const s = scale();
        const lo = g.origins.get(g.lead);
        const p = snapPosition(g.lead, lo.x + dx / s, lo.y + dy / s, g.movingSet);
        const ox = p.x - lo.x, oy = p.y - lo.y;
        for (const [o, els] of g.els) {
          const og = g.origins.get(o);
          o.x = r3(og.x + ox); o.y = r3(og.y + oy);
          for (const el of els) if (el) el.setAttribute('transform', rodTransform(o));
        }
        if (!g.boxes) g.boxes = Array.from(selLayer.querySelectorAll('.group-box'));
        for (const box of g.boxes) box.setAttribute('transform', `translate(${ox} ${oy})`);
        palette.classList.toggle('drop-delete', overPalette(e.clientX, e.clientY));
        break;
      }

      case 'rotateBlock': {
        const p = screenToWorld(e.clientX, e.clientY);
        const a = Math.atan2(p.y - g.pivot.y, p.x - g.pivot.x) * 180 / Math.PI;
        let angle = Math.round((g.angle0 + a - g.a0) / ROTATE_STEP) * ROTATE_STEP;
        angle = ((angle % 360) + 360) % 360;
        if (angle !== g.shown) {
          // Siempre desde la posición inicial, para que el bloque no se deforme por redondeos
          const delta = angle - g.angle0;
          for (const r of g.members) {
            Object.assign(r, g.starts.get(r));
            rotateAbout(r, delta, g.pivot);
          }
          g.shown = angle;
          g.moved = true;
          renderRods();
        }
        showAngle(e, angle);
        break;
      }

      case 'resize': {
        // Se mide a lo largo del eje de la regleta (aunque esté girada) y el extremo inicial queda fijo
        const r = g.rod;
        const p = screenToWorld(e.clientX, e.clientY);
        const start = rodCorners(r)[0];
        const a = (r.angle || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        const dir = r.vertical ? { x: -s, y: c } : { x: c, y: s };
        let len = (p.x - start.x) * dir.x + (p.y - start.y) * dir.y;
        len = prefs.snap ? Math.round(len) : Math.round(len * 10) / 10;
        len = clamp(len, 1, CUSTOM_MAX_LEN);
        if (len !== r.len) {
          r.len = len;
          const d = dims(r);
          const cx = start.x + (d.w / 2) * c - (d.h / 2) * s;
          const cy = start.y + (d.w / 2) * s + (d.h / 2) * c;
          r.x = r3(cx - d.w / 2); r.y = r3(cy - d.h / 2);
          g.moved = true;
          renderRods();
        }
        break;
      }

      case 'rotate': {
        const p = screenToWorld(e.clientX, e.clientY);
        const a = Math.atan2(p.y - g.pivot.y, p.x - g.pivot.x) * 180 / Math.PI;
        let angle = Math.round((g.angle0 + a - g.a0) / ROTATE_STEP) * ROTATE_STEP;
        angle = ((angle % 360) + 360) % 360;
        if (angle !== (g.rod.angle || 0)) {
          // Se parte siempre de la posición inicial para que el vértice no se desplace por redondeos
          Object.assign(g.rod, g.start);
          rotateAbout(g.rod, angle - g.angle0, g.pivot);
          g.rod.angle = angle;
          g.moved = true;
          for (const el of g.els) if (el) el.setAttribute('transform', rodTransform(g.rod));
          // La etiqueta se vuelve a dibujar para mantenerla derecha
          const rodEl = g.els[0];
          if (rodEl) { rodEl.outerHTML = rodMarkup(g.rod); g.els[0] = rodElements(g.rod.id)[0]; }
        }
        showAngle(e, angle);
        break;
      }

      case 'shape':
        drawShapeTo(g.rod, g.p0, screenToWorld(e.clientX, e.clientY));
        renderRods();
        break;

      case 'polyPt': {
        const pts = polyDraft && polyDraft.pts;
        if (!pts) break;
        pts[pts.length - 1] = snapPoint(screenToWorld(e.clientX, e.clientY));
        setPoints(polyDraft.rod, pts);
        renderRods();
        break;
      }

      case 'shapeEdit':
        editShape(g, screenToWorld(e.clientX, e.clientY));
        g.moved = true;
        renderRods();
        break;

      case 'draw': {
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        const pts = g.stroke.points;
        const minD = 1.5 / scale();
        for (const ev of (evs.length ? evs : [e])) {
          const p = screenToWorld(ev.clientX, ev.clientY);
          const last = pts[pts.length - 1];
          if (Math.hypot(p.x - last[0], p.y - last[1]) >= minD) pts.push([r3(p.x), r3(p.y)]);
        }
        g.el.setAttribute('d', pathData(pts));
        break;
      }

      case 'erase': {
        const p = screenToWorld(e.clientX, e.clientY);
        if (eraseAlong(g.last, p)) g.changed = true;
        g.last = p;
        updateEraserCursor(p);
        break;
      }
    }
  });

  // Toque sin arrastre sobre una regleta: la selecciona o, si ya lo estaba, abre su menú
  function tapRod(id, opensMenu) {
    if (opensMenu) { openRodMenu(); return; }
    if (!selection.has(id) || selection.size > 1) { selectOnly(id); renderRods(); }
  }

  function pointerEnd(e, cancelled) {
    pointers.delete(e.pointerId);
    const g = gesture;
    if (!g) return;
    if (g.type === 'pinch') {
      if (pointers.size < 2) { gesture = null; saveSoon(); }
      return;
    }
    if (g.pid !== e.pointerId) return;
    if (cancelled) { cancelGesture(); return; }
    gesture = null;
    palette.classList.remove('drop-delete');

    switch (g.type) {
      case 'palette':
        paletteUp(e, g);
        break;
      case 'pan':
        if (!g.moved) {
          if (g.tapRod) tapRod(g.tapRod, g.tapOpensMenu);
          else clearSelection();
        }
        break;
      case 'marquee':
        marqueeEl.setAttribute('display', 'none');
        if (!g.moved) {
          if (g.tapRod) tapRod(g.tapRod, g.tapOpensMenu);
          else if (!g.additive) clearSelection();
        }
        break;
      case 'drag':
        if (g.moved) {
          if (overPalette(e.clientX, e.clientY)) deleteRods(g.moving);
          renderRods();
          commit();
        } else {
          tapRod(g.lead.id, g.tapOpensMenu);
        }
        break;
      case 'resize':
        if (g.moved) commit();
        break;
      case 'rotateBlock':
        hideAngle();
        if (g.moved) {
          g.members.forEach(normalizeAngle);
          // Si el bloque queda recto, se ajusta a la cuadrícula como una sola pieza
          if (g.members.every((r) => r.angle % 90 === 0)) {
            const ref = g.ref;
            const p = snapPosition(ref, ref.x, ref.y, new Set(g.members));
            const dx = p.x - ref.x, dy = p.y - ref.y;
            g.members.forEach((r) => { r.x = r3(r.x + dx); r.y = r3(r.y + dy); });
          }
          renderRods();
          commit();
          positionRodMenu();
        }
        break;
      case 'rotate':
        hideAngle();
        if (g.moved) {
          normalizeAngle(g.rod);
          if (g.rod.angle % 90 === 0) { const p = snapPosition(g.rod, g.rod.x, g.rod.y); g.rod.x = p.x; g.rod.y = p.y; }
          renderRods();
          commit();
          positionRodMenu();
        }
        break;
      case 'draw': {
        // El trazo terminado pasa a ser un dibujo que luego se puede seleccionar y mover
        const st = g.stroke;
        g.el.remove();
        const r = newDrawing('free');
        Object.assign(r, { id: st.id, color: st.color, width: st.width });
        if (st.tool === 'hl') r.hl = true;
        setPoints(r, st.points.map(([x, y]) => ({ x, y })));
        rods.push(r);
        renderRods();
        commit();
        break;
      }
      case 'shape':
        if (tooSmall(g.rod)) { deleteRods([g.rod]); renderRods(); } else commit();
        break;
      case 'shapeEdit':
        if (g.moved) { commit(); positionRodMenu(); }
        break;
      case 'erase':
        if (g.changed) commit();
        break;
    }
  }
  window.addEventListener('pointerup', (e) => pointerEnd(e, false));
  window.addEventListener('pointercancel', (e) => pointerEnd(e, true));

  board.addEventListener('pointerleave', () => { if (!gesture) updateEraserCursor(null); });

  // Clic derecho (o pulsación larga en táctil) sobre una regleta
  board.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (drawMode) return;
    const rodEl = e.target.closest('.rod');
    if (!rodEl) return;
    if (gesture && gesture.type !== 'pinch') cancelGesture();
    const id = +rodEl.dataset.id;
    if (!selection.has(id)) selectOnly(id);
    renderRods();
    openRodMenu();
  });

  board.addEventListener('wheel', (e) => {
    e.preventDefault();
    bRect = board.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));          // pellizco en trackpad
    } else if (e.deltaMode === 0 && (e.deltaX !== 0 || Math.abs(e.deltaY) < 40)) {
      view.x -= e.deltaX; view.y -= e.deltaY; applyView();               // desplazamiento en trackpad
    } else {
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;            // rueda del ratón
      zoomAt(e.clientX, e.clientY, Math.exp(-dy * 0.0015));
    }
  }, { passive: false });

  // Cierra menús al pulsar fuera de ellos
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.popover') && !e.target.closest('[aria-haspopup]')) closePopovers();
    if (!e.target.closest('#rodMenu') && !e.target.closest('#board')) closeRodMenu();
    if (editing && !e.target.closest('#textEditor')) closeTextEditor();
  }, true);

  // Doble clic sobre un texto: editarlo
  board.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.text-item');
    const r = el && !drawMode && findRod(+el.dataset.id);
    if (r) openTextEditor(r);
  });

  // ---------------------------------------------------------------- Teclado
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (mod && key === 'a' && !drawMode) {
      e.preventDefault();
      selection = new Set(rods.map((r) => r.id));
      renderRods();
      if (!rodMenu.hidden) refreshRodMenu();
      return;
    }
    if (mod) return;

    if (polyDraft && (e.key === 'Escape' || e.key === 'Enter')) { finishPoly(); return; }
    if (e.key === 'Escape') {
      if (!colorsDialog.hidden) { closeColors(); return; }
      if (!rodMenu.hidden || !labelsMenu.hidden || !settingsMenu.hidden) { closeRodMenu(); closePopovers(); }
      else if (drawMode) setDrawMode(false);
      else clearSelection();
      return;
    }
    if (e.key === '+' || e.key === '=') { zoomCenter(1.2); return; }
    if (e.key === '-') { zoomCenter(1 / 1.2); return; }
    if (key === 't' && !drawMode) { e.preventDefault(); addText(); return; }

    const list = selectedRods();
    if (!list.length || drawMode) return;
    const unlocked = list.filter((r) => !r.locked);
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      rodAction('delete');
    } else if ((e.key === '[' || e.key === ']') && canFreeRotate(list)) {
      const step = e.key === ']' ? ROTATE_STEP : -ROTATE_STEP;
      if (list.length === 1) list.forEach((r) => { rotateAbout(r, step, rodPivot(r)); normalizeAngle(r); });
      else rotateBlockBy(list, step);
      renderRods(); commit(); positionRodMenu();
    } else if (key === 'r') {
      rodAction('rotate');
    } else if (key === 'd') {
      rodAction('duplicate');
    } else if (key === 'n') {
      rodAction('number');
    } else if (e.key.startsWith('Arrow') && unlocked.length) {
      e.preventDefault();
      const step = prefs.snap && prefs.grid ? 1 : 0.1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      unlocked.forEach((r) => { r.x = r3(r.x + dx); r.y = r3(r.y + dy); });
      renderRods(); commit(); positionRodMenu();
    }
  });

  // ---------------------------------------------------------------- Modos de interacción
  function setMode(m) {
    mode = m;
    if (drawMode) setDrawMode(false);
    updateToolbar();
    renderSel();
  }

  // ---------------------------------------------------------------- Modo dibujo
  function setDrawMode(on) {
    finishPoly();
    drawMode = on;
    cancelGesture();
    document.body.classList.toggle('drawing', on);
    drawbar.hidden = !on;
    if (on) {
      closeRodMenu();
      clearSelection();
    } else {
      updateEraserCursor(null);
    }
    updateToolbar();
  }

  function buildDrawbar() {
    $('#drawSizes').innerHTML = [6, 10, 16].map((px, i) =>
      `<button type="button" class="db-size" data-size="${i}"><span style="width:${px}px;height:${px}px"></span></button>`).join('');
    $('#drawColors').innerHTML = INK_COLORS.map((c) =>
      `<button type="button" class="db-swatch" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
  }

  function updateDrawbar() {
    $$('.db-tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === prefs.tool)));
    const eraser = prefs.tool === 'eraser';
    $$('.db-size').forEach((b) => {
      b.setAttribute('aria-pressed', String(+b.dataset.size === prefs.inkSize));
      b.disabled = eraser;
      b.title = t('size');
      b.setAttribute('aria-label', b.title);
    });
    $$('.db-swatch').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.color === prefs.inkColor));
      b.disabled = eraser;
    });
    document.body.classList.toggle('tool-eraser', eraser);
    if (!eraser) updateEraserCursor(null);
  }

  $('#drawTools').addEventListener('click', (e) => {
    const b = e.target.closest('.db-tool');
    if (!b) return;
    finishPoly();
    prefs.tool = b.dataset.tool;
    updateDrawbar();
    saveSoon();
  });
  $('#drawSizes').addEventListener('click', (e) => {
    const b = e.target.closest('.db-size');
    if (!b) return;
    prefs.inkSize = +b.dataset.size;
    updateDrawbar();
    saveSoon();
  });
  $('#drawColors').addEventListener('click', (e) => {
    const b = e.target.closest('.db-swatch');
    if (!b) return;
    prefs.inkColor = b.dataset.color;
    updateDrawbar();
    saveSoon();
  });
  $('#drawExit').addEventListener('click', () => setDrawMode(false));
  $('#drawClear').addEventListener('click', () => {
    finishPoly();
    const ink = rods.filter((r) => isDrawing(r) && !r.locked);
    if (!ink.length) return;
    deleteRods(ink);
    renderRods();
    commit();
    toast(t('inkCleared'), t('undo'), undo);
  });

  // ---------------------------------------------------------------- Barra de herramientas
  function updateToolbar() {
    $('#btnPalette').setAttribute('aria-pressed', String(prefs.paletteOpen));
    palette.hidden = !prefs.paletteOpen;
    $('#labelsText').textContent = t(LABEL_MODES[prefs.labelMode]);
    document.body.dataset.labels = prefs.labelMode;
    refreshLabelsMenu();
    $$('.ref-chip').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.ref === prefs.ref)));

    $('#btnModeSelect').setAttribute('aria-pressed', String(mode === 'select' && !drawMode));
    $('#btnModePan').setAttribute('aria-pressed', String(mode === 'pan' && !drawMode));
    document.body.classList.toggle('mode-pan', mode === 'pan');

    $('#orientIcon').setAttribute('href', prefs.vertical ? '#i-orient-v' : '#i-orient-h');
    $('#orientText').textContent = t(prefs.vertical ? 'vertical' : 'horizontal');
    $('#btnGrid').setAttribute('aria-pressed', String(prefs.grid));
    $('#btnUnits').setAttribute('aria-pressed', String(prefs.unitLines));
    $('#btnRotate').setAttribute('aria-pressed', String(prefs.freeRotate));
    $('#btnDraw').setAttribute('aria-pressed', String(drawMode));

    document.body.classList.toggle('hc', prefs.contrast);
    $('#optContrast').checked = prefs.contrast;
    $('#optSnap').checked = prefs.snap;
    $('#optNumBottom').checked = prefs.numberFromBottom;
    $$('#settingsMenu [data-lang]').forEach((b) => b.classList.toggle('active', b.dataset.lang === prefs.lang));

    const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    $('#fsIcon').setAttribute('href', fs ? '#i-fullscreen-exit' : '#i-fullscreen');
    const fsBtn = $('#btnFullscreen');
    fsBtn.title = t(fs ? 'exitFullscreen' : 'fullscreen');
    fsBtn.setAttribute('aria-label', fsBtn.title);
    fsBtn.hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    updateDrawbar();
  }

  function setPref(key, value) {
    prefs[key] = value;
    updateToolbar();
    saveSoon();
  }

  $('#btnPalette').addEventListener('click', () => setPref('paletteOpen', !prefs.paletteOpen));
  // Con regletas seleccionadas, el menú de etiquetas solo cambia esas regletas
  function refreshLabelsMenu() {
    const list = selectedRods().filter(isRod);
    const modes = new Set(list.map((r) => r.label || 'inherit'));
    const current = selection.size ? (modes.size === 1 ? [...modes][0] : null) : prefs.labelMode;
    $('#labelsScope').hidden = !selection.size;
    $('#labelsScope').textContent = t(list.length === 1 ? 'labelsOne' : 'labelsSelection', { n: list.length });
    labelsMenu.querySelector('[data-mode="inherit"]').hidden = !selection.size;
    $('#labelsInheritText').textContent = t('labelsInherit', { mode: t(LABEL_MODES[prefs.labelMode]) });
    $$('#labelsMenu .menu-item').forEach((b) => b.classList.toggle('active', b.dataset.mode === current));
    // La regleta que vale 1 es común a todas: se muestra si algún etiquetado la usa
    const used = [prefs.labelMode, ...rods.map((r) => r.label)];
    $('#refRow').hidden = !used.some((m) => m === 'decimals' || m === 'fractions');
  }

  $('#btnLabels').addEventListener('click', (e) => { refreshLabelsMenu(); togglePopover(e.currentTarget, labelsMenu); });
  $('#btnSettings').addEventListener('click', (e) => togglePopover(e.currentTarget, settingsMenu));
  $('#btnModeSelect').addEventListener('click', () => setMode('select'));
  $('#btnModePan').addEventListener('click', () => setMode('pan'));

  labelsMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-mode]');
    const chip = e.target.closest('[data-ref]');
    const list = selectedRods().filter(isRod);
    if (item && selection.size) {
      const m = item.dataset.mode;
      list.forEach((r) => { if (m === 'inherit') delete r.label; else r.label = m; });
      renderRods();
      commit();
      refreshLabelsMenu();
    } else {
      if (item) setPref('labelMode', item.dataset.mode);
      else if (chip) setPref('ref', +chip.dataset.ref);
      else return;
      buildPalette();
      renderRods();
    }
    // El menú cambia de alto al mostrar u ocultar la fila de referencia: se recoloca encima del botón
    const r = $('#btnLabels').getBoundingClientRect();
    labelsMenu.style.top = Math.max(8, r.top - 6 - labelsMenu.offsetHeight) + 'px';
  });

  $('#btnReset').addEventListener('click', () => {
    cancelGesture();
    polyDraft = null;
    const hadContent = rods.length;
    rods = [];
    selection.clear();
    chain = null;
    closeRodMenu();
    renderRods();
    view.x = UNIT; view.y = UNIT; view.zoom = 1;
    applyView();
    if (hadContent) {
      commit();
      toast(t('resetDone'), t('undo'), undo);
    }
  });

  // Orientación: transpone toda la escena manteniendo su esquina superior izquierda
  $('#btnOrient').addEventListener('click', () => {
    cancelGesture();
    const px = rods.length ? Math.min(...rods.map((r) => r.x)) : 0;
    const py = rods.length ? Math.min(...rods.map((r) => r.y)) : 0;
    for (const r of rods) {
      const x = r.x, y = r.y;
      r.x = r3(px + (y - py));
      r.y = r3(py + (x - px));
      r.vertical = !r.vertical;
      if (r.angle) r.angle = (360 - r.angle) % 360;
    }
    prefs.vertical = !prefs.vertical;
    chain = null;
    closeRodMenu();
    updateToolbar();
    renderRods();
    commit();
    saveSoon();
  });

  $('#btnGrid').addEventListener('click', () => { setPref('grid', !prefs.grid); renderGrid(); });
  $('#btnUnits').addEventListener('click', () => { setPref('unitLines', !prefs.unitLines); renderRods(); });
  $('#btnRotate').addEventListener('click', () => { setPref('freeRotate', !prefs.freeRotate); renderSel(); });
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnZoomIn').addEventListener('click', () => zoomCenter(1.25));
  $('#btnZoomOut').addEventListener('click', () => zoomCenter(1 / 1.25));
  $('#btnZoomReset').addEventListener('click', () => zoomCenter(1 / view.zoom));
  $('#btnFit').addEventListener('click', fitToScreen);
  $('#btnDraw').addEventListener('click', () => setDrawMode(!drawMode));

  $('#btnFullscreen').addEventListener('click', () => {
    const d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } else {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) Promise.resolve(req.call(el)).catch(() => {});
    }
  });
  document.addEventListener('fullscreenchange', updateToolbar);
  document.addEventListener('webkitfullscreenchange', updateToolbar);

  // Ajustes
  $('#optContrast').addEventListener('change', (e) => setPref('contrast', e.target.checked));
  $('#optSnap').addEventListener('change', (e) => setPref('snap', e.target.checked));
  $('#optNumBottom').addEventListener('change', (e) => {
    setPref('numberFromBottom', e.target.checked);
    // Los bloques ya numerados se renumeran siguiendo el nuevo sentido
    const blocks = new Set(rods.filter((r) => r.numbered && r.numBlock).map((r) => r.numBlock));
    blocks.forEach((b) => numberAsBlock(rods.filter((r) => r.numbered && r.numBlock === b)));
    renderRods();
    commit();
  });
  settingsMenu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b) return;
    prefs.lang = b.dataset.lang;
    applyI18n();
    renderRods();
    saveSoon();
  });

  // ---------------------------------------------------------------- Colores de las regletas
  const colorsDialog = $('#colorsDialog');

  function applyColors() {
    computeStyles();
    buildPalette();
    buildRefChips();
    updateToolbar();
    renderRods();
    saveSoon();
  }

  function buildColorsDialog() {
    $$('.preset-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === prefs.colorSet)));
    $('#optAutoColor').checked = prefs.autoColorSpecial;
    $$('[data-swatches]').forEach((el) => {
      const fills = el.dataset.swatches === 'canals' ? CANALS_FILLS : ROD_STYLES.map((st) => st.fill);
      el.innerHTML = fills.slice(0, 10).map((f, i) => `<i style="background:${f};height:${8 + i * 2}px"></i>`).join('');
    });
    let html = '';
    for (let i = 0; i <= 11; i++) {
      const st = styles[i];
      const name = i === 10 ? t('specialRod') : i === 11 ? t('plate100') : t('rodN', { n: i + 1 });
      const changed = !!(prefs.rodColors && prefs.rodColors[i]);
      html += `<label class="color-cell${changed ? ' changed' : ''}" title="${name}">` +
        `<span class="color-chip" style="background:${st.fill};border-color:${st.stroke};color:${st.text}">${i === 10 ? '↔' : i === 11 ? '100' : i + 1}</span>` +
        `<span class="color-name">${name}</span>` +
        `<input type="color" data-index="${i}" value="${st.fill.toLowerCase()}" aria-label="${name}"></label>`;
    }
    $('#colorGrid').innerHTML = html;
  }

  function openColors() {
    closePopovers();
    buildColorsDialog();
    colorsDialog.hidden = false;
    $('#colorsClose').focus();
  }
  function closeColors() { colorsDialog.hidden = true; }

  $('#btnColors').addEventListener('click', openColors);
  $('#optAutoColor').addEventListener('change', (e) => {
    prefs.autoColorSpecial = e.target.checked;
    renderRods();
    saveSoon();
  });
  $('#colorsClose').addEventListener('click', closeColors);
  colorsDialog.addEventListener('click', (e) => {
    if (e.target === colorsDialog) { closeColors(); return; }
    const preset = e.target.closest('[data-set]');
    if (preset) {
      prefs.colorSet = preset.dataset.set;
      prefs.rodColors = {};
      applyColors();
      buildColorsDialog();
    }
  });
  $('#colorGrid').addEventListener('input', (e) => {
    const i = +e.target.dataset.index;
    if (!e.target.matches('input[type="color"]')) return;
    const value = e.target.value.toUpperCase();
    prefs.rodColors = Object.assign({}, prefs.rodColors);
    if (value === baseFill(i).toUpperCase()) delete prefs.rodColors[i]; else prefs.rodColors[i] = value;
    applyColors();
    // Actualiza solo la muestra para no cerrar el selector de color del sistema
    const st = styles[i];
    const chip = e.target.parentElement.querySelector('.color-chip');
    chip.style.background = st.fill; chip.style.borderColor = st.stroke; chip.style.color = st.text;
    e.target.parentElement.classList.toggle('changed', !!prefs.rodColors[i]);
  });
  $('#colorsRestore').addEventListener('click', () => {
    prefs.rodColors = {};
    applyColors();
    buildColorsDialog();
  });

  // Menú de regleta(s)
  rodMenu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) rodAction(b.dataset.act);
  });

  // ---------------------------------------------------------------- Editor de textos
  const textEditor = $('#textEditor');
  const teInput = $('#teInput');
  let editing = null;   // texto que se está escribiendo
  let centerX = null;  // en un texto libre nuevo, su centro: crece hacia los dos lados mientras se escribe

  // Teclado en pantalla de 8 columnas; también se puede escribir con el teclado del dispositivo
  const TE_KEYS = [
    '7', '8', '9', '+', '−', '×', '÷', { k: 'back' },
    '4', '5', '6', '=', ':', '(', ')', '?',
    '1', '2', '3', '<', '>', '≤', '≥', '%',
    ',', '0', '.', { k: 'frac', v: '/' }, { k: 'pow', v: '^' }, 'a', 'b', 'c',
    { k: 'space', v: ' ', span: 3 }, '€', { k: 'left' }, { k: 'right' }, { k: 'keyboard' }, { k: 'done' },
  ];

  function buildTextKeys() {
    const ico = (id) => `<svg class="ico"><use href="#${id}"/></svg>`;
    const faces = {
      back: [ico('i-backspace'), 'backspace'],
      frac: ['<span class="k-frac"><i>a</i><i>b</i></span>', 'fraction'],
      pow: ['x<sup>n</sup>', 'power'],
      space: [t('space'), 'space'],
      left: [ico('i-chevron-left'), 'cursorLeft'],
      right: [ico('i-chevron-right'), 'cursorRight'],
      keyboard: [ico('i-keyboard'), 'deviceKeyboard'],
      done: [t('done'), 'done'],
    };
    $('#teKeys').innerHTML = TE_KEYS.map((key, i) => {
      if (typeof key === 'string') {
        const cls = /[0-9,.]/.test(key) ? 'num' : /^[abc]$/.test(key) ? 'var' : 'op';
        return `<button type="button" class="te-key ${cls}" data-i="${i}">${escHtml(key)}</button>`;
      }
      const [face, title] = faces[key.k];
      const cls = key.k === 'done' ? 'done' : key.v ? 'op' : 'fn';
      return `<button type="button" class="te-key ${cls}" data-i="${i}" title="${t(title)}" aria-label="${t(title)}"` +
        `${key.span ? ` style="grid-column: span ${key.span}"` : ''}${key.k === 'keyboard' ? ' aria-pressed="false"' : ''}>${face}</button>`;
    }).join('');
  }

  function addText() {
    if (drawMode) setDrawMode(false);
    // Con una regleta seleccionada, el texto nace dentro de ella, a la izquierda, con su misma altura,
    // y se une a ella para que la acompañe; si no, centrado en la vista y con letra grande
    const host = selectedRods().filter(isRod).sort((a, b) => aabb(a).y0 - aabb(b).y0 || aabb(a).x0 - aabb(b).x0)[0];
    const r = { id: nextId++, text: '', size: host ? 0.8 : prefs.titleSize, x: 0, y: 0, locked: false, angle: 0 };
    if (host) {
      const c = host.angle ? rodCorners(host)[0] : { x: host.x, y: host.y };
      r.x = r3(c.x); r.y = r3(c.y);
      r.group = host.group || nextId++;
      host.group = r.group;
    } else {
      // A un tercio de la altura (el teclado cabe debajo) o en la fila libre más cercana
      const vw = visibleWorld(), h = dims(r).h;
      const cx = (vw.x0 + vw.x1) / 2, y0 = Math.round(vw.y0 + (vw.y1 - vw.y0) * 0.3 - h / 2);
      r.x = Math.round(cx - 1.5);
      r.y = y0;
      for (let k = 0; k < 60; k++) {
        const y = y0 + (k % 2 ? -1 : 1) * Math.ceil(k / 2);
        if (!overlaps(cx - 4, y, 8, h)) { r.y = y; break; }
      }
    }
    rods.push(r);
    selectOnly(r.id);
    chain = null;
    renderRods();
    ensureVisible([r]);
    openTextEditor(r);
    if (!host) centerX = r.x + dims(r).w / 2;
  }

  function openTextEditor(r) {
    closeRodMenu();
    closePopovers();
    editing = r;
    centerX = null;
    teInput.value = r.text;
    textEditor.hidden = false;
    updateSizeButtons();
    positionTextEditor();
    teInput.focus({ preventScroll: true });
    teInput.setSelectionRange(r.text.length, r.text.length);
  }

  // Al terminar, un texto vacío desaparece
  function closeTextEditor() {
    if (!editing) return;
    const r = editing;
    editing = null;
    centerX = null;
    textEditor.hidden = true;
    teInput.blur();
    if (!r.text.trim()) deleteRods([r]);
    renderRods();
    commit();
  }

  // Debajo del texto; si no cabe, encima
  function positionTextEditor() {
    if (!editing) return;
    const s = scale();
    const b = bounds([editing]);
    const left = bRect.left + view.x + b.x0 * s;
    const top = bRect.top + view.y + b.y0 * s;
    const bottom = bRect.top + view.y + b.y1 * s;
    const mw = textEditor.offsetWidth, mh = textEditor.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let y = bottom + 10;
    if (y + mh > vh - 8) y = top - 10 - mh;
    textEditor.style.left = clamp(left, 8, vw - mw - 8) + 'px';
    textEditor.style.top = clamp(y, 8, vh - mh - 8) + 'px';
  }

  function recenter() {
    if (centerX != null) editing.x = r3(centerX - dims(editing).w / 2);
  }

  function textChanged() {
    editing.text = teInput.value;
    recenter();
    renderRods();
    positionTextEditor();
  }

  function updateSizeButtons() {
    const i = TEXT_SIZES.indexOf(editing.size);
    $('#teSmaller').disabled = i === 0;
    $('#teBigger').disabled = i === TEXT_SIZES.length - 1;
  }

  function changeTextSize(dir) {
    let i = TEXT_SIZES.indexOf(editing.size);
    if (i < 0) i = TEXT_SIZES.indexOf(0.8);
    editing.size = TEXT_SIZES[clamp(i + dir, 0, TEXT_SIZES.length - 1)];
    if (!editing.group) prefs.titleSize = editing.size; // se recuerda para los próximos textos libres
    recenter();
    updateSizeButtons();
    renderRods();
    positionTextEditor();
    saveSoon();
  }

  function textKey(key) {
    const len = teInput.value.length;
    const a = teInput.selectionStart != null ? teInput.selectionStart : len;
    const b = teInput.selectionEnd != null ? teInput.selectionEnd : a;
    if (typeof key === 'string' || key.v) {
      teInput.setRangeText(typeof key === 'string' ? key : key.v, a, b, 'end');
      textChanged();
      return;
    }
    switch (key.k) {
      case 'back':
        if (a !== b) teInput.setRangeText('', a, b, 'end');
        else if (a > 0) teInput.setRangeText('', a - 1, a, 'end');
        textChanged();
        break;
      case 'left': { const p = a === b ? Math.max(0, a - 1) : Math.min(a, b); teInput.setSelectionRange(p, p); break; }
      case 'right': { const p = a === b ? Math.min(len, a + 1) : Math.max(a, b); teInput.setSelectionRange(p, p); break; }
      case 'keyboard': {
        // Muestra u oculta el teclado del sistema (en pantallas táctiles)
        const on = teInput.inputMode === 'none';
        teInput.inputMode = on ? 'text' : 'none';
        $('#teKeys [aria-pressed]').setAttribute('aria-pressed', String(on));
        teInput.blur();
        teInput.focus({ preventScroll: true });
        break;
      }
      case 'done':
        closeTextEditor();
        break;
    }
  }

  // Los botones no roban el foco al cuadro de texto: así se conserva la posición del cursor
  textEditor.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  textEditor.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !editing) return;
    if (b.id === 'teSmaller') changeTextSize(-1);
    else if (b.id === 'teBigger') changeTextSize(1);
    else if (b.dataset.i != null) textKey(TE_KEYS[+b.dataset.i]);
  });
  teInput.addEventListener('input', () => { if (editing) textChanged(); });
  teInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); closeTextEditor(); }
  });
  $('#btnText').addEventListener('click', addText);

  // ---------------------------------------------------------------- Instalación PWA
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    $('#installWrap').hidden = false;
  });
  $('#btnInstall').addEventListener('click', async () => {
    if (!installEvent) return;
    closePopovers();
    installEvent.prompt();
    try { await installEvent.userChoice; } catch (err) { /* ignorar */ }
    installEvent = null;
    $('#installWrap').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('#installWrap').hidden = true; });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').then((reg) => {
        if (hadController) return;
        const sw = reg.installing || reg.waiting;
        if (!sw) return;
        sw.addEventListener('statechange', () => { if (sw.state === 'activated') toast(t('offlineReady')); });
      }).catch(() => { /* sin service worker */ });
    });
  }

  // ---------------------------------------------------------------- Ciclo de vida
  new ResizeObserver(() => {
    bRect = board.getBoundingClientRect();
    renderGrid();
    positionRodMenu();
  }).observe(board);

  window.addEventListener('resize', () => { closePopovers(); positionRodMenu(); positionTextEditor(); });
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  // ---------------------------------------------------------------- Inicio
  load();
  if (!LABEL_MODES[prefs.labelMode]) prefs.labelMode = 'basic';
  if (!window.I18N[prefs.lang]) prefs.lang = 'es';
  if (prefs.colorSet !== 'canals') prefs.colorSet = 'cuisenaire';
  if (!prefs.rodColors || typeof prefs.rodColors !== 'object') prefs.rodColors = {};
  if (!TEXT_SIZES.includes(prefs.titleSize)) prefs.titleSize = 1.6;
  computeStyles();
  buildDrawbar();
  applyI18n();
  bRect = board.getBoundingClientRect();
  applyView();
  renderRods();
  current = snapshot();
  afterChange();
})();
