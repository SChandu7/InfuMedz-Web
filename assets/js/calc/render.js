/* Medical calculators - the page that draws any definition.
 *
 * Same behaviour as the app's CalculatorScreen: answers update the result as
 * you type; nothing is shown until every required field holds a value in
 * its plausible range (fail closed, with a unit hint); switching a unit
 * converts what was typed; the matching reference-table row is highlighted.
 * Nothing is stored or sent anywhere.
 */

import { fmt as ufmt } from '../ui.js';
import { fmtSmart } from './core.js';
import { defaults, makeValues } from './definitions.js';

const esc = (s) => ufmt.esc(s == null ? '' : String(s));
const TONE = { low: '#0F766E', moderate: '#B45309', high: '#C2410C', neutral: '#0E5FD8' };

export function renderCalculator(def, host) {
  const answers = defaults(def);
  const texts = {};
  const units = {};
  def.fields.forEach((f) => {
    if (f.type === 'number') { texts[f.id] = ''; units[f.id] = f.units[0].id; }
  });

  const unitOf = (f) => f.units.find((u) => u.id === units[f.id]) || f.units[0];
  const raw = (f) => {
    const t = (texts[f.id] || '').trim().replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && /^[0-9]*\.?[0-9]*$/.test(t) ? n : NaN;
  };
  const numberError = (f) => {
    const n = raw(f);
    if (n === null) return null;
    if (Number.isNaN(n)) return 'Enter a number';
    const u = unitOf(f);
    if (n < u.min || n > u.max) {
      return `Expected ${fmtSmart(u.min, u.decimals)}–${fmtSmart(u.max, u.decimals)} ${u.label}` + (u.hint ? '. ' + u.hint : '');
    }
    return null;
  };

  /* ── layout ── */

  host.innerHTML =
    '<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">' +
      '<div>' +
        '<div class="mb-3 flex items-center justify-between">' +
          '<h2 class="text-lg">Inputs</h2>' +
          '<button type="button" class="btn-ghost btn-sm" data-clear>Clear all</button>' +
        '</div>' +
        '<div class="space-y-3" data-fields></div>' +
      '</div>' +
      '<div class="lg:sticky lg:top-20" data-result-col>' +
        '<h2 class="mb-3 text-lg">Result</h2>' +
        '<div data-result aria-live="polite"></div>' +
      '</div>' +
    '</div>' +
    '<div class="mt-8 grid gap-4 lg:grid-cols-2" data-footer></div>';

  const fieldsHost = host.querySelector('[data-fields]');

  /* ── fields ── */

  function badge(points, on) {
    if (!points) return '';
    return '<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ' +
      (on ? 'bg-primary text-white' : 'bg-chip text-primary') + '">' + esc(points) + '</span>';
  }

  function labelBlock(f) {
    return '<div class="min-w-0">' +
      '<p class="text-sm font-semibold text-navy">' + esc(f.label) + '</p>' +
      (f.help ? '<p class="mt-0.5 text-xs leading-relaxed text-ink-muted">' + esc(f.help) + '</p>' : '') +
    '</div>';
  }

  function fieldHtml(f) {
    if (f.type === 'bool') {
      const on = answers[f.id] === true;
      return '<button type="button" role="switch" aria-checked="' + on + '" data-bool="' + f.id + '" ' +
        'class="flex w-full items-center gap-3 rounded-xl2 border p-3.5 text-left transition ' +
        (on ? 'border-primary/50 bg-chip' : 'border-line bg-white hover:border-primary/30') + '">' +
        '<span class="flex-1">' + labelBlock(f) + '</span>' + badge(f.points, on) +
        '<span class="relative h-6 w-11 shrink-0 rounded-full transition ' + (on ? 'bg-primary' : 'bg-line') + '">' +
          '<span class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ' + (on ? 'left-[22px]' : 'left-0.5') + '"></span>' +
        '</span>' +
      '</button>';
    }
    if (f.type === 'choice') {
      const opts = f.options.map((o) => {
        const sel = answers[f.id] === o.value;
        if (f.vertical) {
          return '<button type="button" data-choice="' + f.id + '" data-value="' + esc(o.value) + '" aria-pressed="' + sel + '" ' +
            'class="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ' +
            (sel ? 'border-primary bg-chip font-semibold text-navy' : 'border-line bg-white text-ink-soft hover:border-primary/30') + '">' +
            '<span class="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ' + (sel ? 'border-primary' : 'border-line') + '">' +
              (sel ? '<span class="h-2 w-2 rounded-full bg-primary"></span>' : '') + '</span>' +
            '<span class="flex-1">' + esc(o.label) + '</span>' + badge(o.points, sel) +
          '</button>';
        }
        return '<button type="button" data-choice="' + f.id + '" data-value="' + esc(o.value) + '" aria-pressed="' + sel + '" ' +
          'class="rounded-xl border px-3.5 py-2 text-sm font-semibold transition ' +
          (sel ? 'border-primary bg-primary text-white' : 'border-line bg-white text-navy hover:border-primary/40') + '">' +
          esc(o.label) + (o.points ? ' <span class="' + (sel ? 'text-white/80' : 'text-primary') + '">' + esc(o.points) + '</span>' : '') +
        '</button>';
      }).join('');
      return '<div class="card p-4">' + labelBlock(f) +
        '<div class="mt-3 ' + (f.vertical ? 'space-y-1.5' : 'flex flex-wrap gap-2') + '">' + opts + '</div></div>';
    }
    const u = unitOf(f);
    const err = numberError(f);
    const multi = f.units.length > 1;
    return '<div class="card p-4">' + labelBlock(f) +
      '<div class="mt-3 flex items-start gap-2">' +
        '<div class="relative flex-1">' +
          '<input class="field pr-14 text-base font-semibold ' + (err ? 'border-bad' : '') + '" inputmode="decimal" autocomplete="off" ' +
            'data-num="' + f.id + '" value="' + esc(texts[f.id]) + '" placeholder="' + fmtSmart(u.min, u.decimals) + '–' + fmtSmart(u.max, u.decimals) + '" ' +
            'aria-label="' + esc(f.label) + '"' + (err ? ' aria-invalid="true"' : '') + '>' +
          (multi ? '' : '<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">' + esc(u.label) + '</span>') +
        '</div>' +
        (multi ? '<div class="flex shrink-0 rounded-xl bg-chip p-1">' + f.units.map((x) =>
          '<button type="button" data-unit="' + f.id + '" data-unit-id="' + x.id + '" class="rounded-lg px-2.5 py-1.5 text-xs font-bold transition ' +
          (x.id === u.id ? 'bg-primary text-white' : 'text-primary') + '">' + esc(x.label) + '</button>').join('') + '</div>' : '') +
      '</div>' +
      '<p class="mt-1.5 text-xs text-bad ' + (err ? '' : 'hidden') + '" data-err="' + f.id + '">' + esc(err || '') + '</p>' +
    '</div>';
  }

  function drawFields() {
    fieldsHost.innerHTML = def.fields.map((f) => '<div data-field="' + f.id + '">' + fieldHtml(f) + '</div>').join('');
  }

  function redrawField(id) {
    const f = def.fields.find((x) => x.id === id);
    const wrap = fieldsHost.querySelector('[data-field="' + id + '"]');
    if (f && wrap) wrap.innerHTML = fieldHtml(f);
  }

  /* ── evaluation ── */

  function evaluate() {
    const values = {};
    const missing = [];
    const invalid = [];
    def.fields.forEach((f) => {
      if (f.type === 'bool') values[f.id] = answers[f.id] === true;
      else if (f.type === 'choice') {
        values[f.id] = answers[f.id];
        if (answers[f.id] == null && f.required) missing.push(f.label);
      } else {
        const n = raw(f);
        if (n === null) { if (f.required) missing.push(f.label); }
        else if (numberError(f)) invalid.push(f.label);
        else values[f.id] = unitOf(f).toBase(n);
      }
    });
    if (missing.length || invalid.length) return { missing, invalid };
    return { result: def.compute(makeValues(values, units)) };
  }

  /* ── result ── */

  function linesCard(lines) {
    return '<div class="card divide-y divide-line">' + lines.map((l) =>
      '<div class="flex items-start justify-between gap-4 px-4 py-2.5">' +
        '<div class="min-w-0"><p class="text-sm ' + (l.emphasis ? 'font-bold text-navy' : 'text-ink-soft') + '">' + esc(l.label) + '</p>' +
          (l.note ? '<p class="text-xs text-ink-muted">' + esc(l.note) + '</p>' : '') + '</div>' +
        '<p class="shrink-0 text-right text-sm font-bold ' + (l.emphasis ? 'text-primary' : 'text-navy') + '">' + esc(l.value) + '</p>' +
      '</div>').join('') + '</div>';
  }

  function tableHtml(t) {
    return '<div>' +
      '<h3 class="mb-2 text-sm font-bold text-navy">' + esc(t.title) + '</h3>' +
      '<div class="overflow-x-auto rounded-xl2 border border-line">' +
        '<table class="w-full min-w-[280px] text-left text-sm">' +
          '<thead class="bg-chip text-xs font-bold text-navy"><tr>' + t.columns.map((c) => '<th class="px-3 py-2.5">' + esc(c) + '</th>').join('') + '</tr></thead>' +
          '<tbody>' + t.rows.map((row, i) => {
            const hit = t.highlight.has(i);
            return '<tr class="border-t border-line ' + (hit ? 'bg-primary/10 font-bold text-primary-dark' : 'bg-white text-ink') + '"' +
              (hit ? ' style="box-shadow: inset 4px 0 0 #0E5FD8"' : '') + '>' +
              row.map((cell, j) => '<td class="px-3 py-2.5 ' + (j === 0 && !hit ? 'font-semibold' : '') + '">' + esc(cell) + '</td>').join('') + '</tr>';
          }).join('') + '</tbody>' +
        '</table>' +
      '</div>' +
      (t.highlight.size ? '<p class="mt-1.5 text-xs text-ink-muted">Highlighted row = your result</p>' : '') +
      (t.footnote ? '<p class="mt-1 text-xs leading-relaxed text-ink-muted">' + esc(t.footnote) + '</p>' : '') +
    '</div>';
  }

  function drawResult() {
    const out = host.querySelector('[data-result]');
    const e = evaluate();
    if (!e.result) {
      out.innerHTML = '<div class="rounded-xl2 border border-primary/25 bg-chip p-5">' +
        '<p class="font-bold text-navy">Result appears here</p>' +
        (e.invalid.length ? '<p class="mt-1 text-sm text-bad">Check: ' + esc(e.invalid.join(', ')) + '</p>' : '') +
        (e.missing.length ? '<p class="mt-1 text-sm text-ink-soft">Still needed: ' + esc(e.missing.join(', ')) + '</p>' : '') +
      '</div>';
      return;
    }
    const r = e.result;
    const tone = TONE[r.tone] || TONE.neutral;
    out.innerHTML =
      '<div class="rounded-xl2 bg-brand-grad p-5 text-white shadow-lift">' +
        '<p class="text-sm font-semibold text-white/75">' + esc(r.valueLabel) + '</p>' +
        (r.blocked ? '' : '<p class="mt-1"><span class="text-4xl font-black">' + esc(r.value) + '</span>' +
          (r.unit ? '<span class="ml-2 text-sm font-semibold text-white/75">' + esc(r.unit) + '</span>' : '') + '</p>') +
        '<span class="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-bold" style="color:' + tone + '">' +
          '<span class="h-2 w-2 rounded-full" style="background:' + tone + '"></span>' + esc(r.band) + '</span>' +
      '</div>' +
      (r.extra.length ? '<div class="mt-3">' + linesCard(r.extra) + '</div>' : '') +
      r.warnings.map((w) => '<div class="mt-3 rounded-xl2 border border-warn/40 bg-warn/10 p-3 text-sm leading-relaxed text-navy">' + esc(w) + '</div>').join('') +
      (r.breakdown.length ? '<h3 class="mb-2 mt-5 text-sm font-bold text-navy">How the result was reached</h3>' + linesCard(r.breakdown) : '') +
      (r.interpretation.length ? '<h3 class="mb-2 mt-5 text-sm font-bold text-navy">Interpretation</h3>' +
        '<ul class="card space-y-2 p-4">' + r.interpretation.map((t) =>
          '<li class="flex gap-2.5 text-sm leading-relaxed text-ink"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span><span>' + esc(t) + '</span></li>').join('') + '</ul>' : '') +
      r.tables.map((t) => '<div class="mt-5">' + tableHtml(t) + '</div>').join('');
  }

  function drawFooter() {
    host.querySelector('[data-footer]').innerHTML =
      '<details class="card p-4" open>' +
        '<summary class="cursor-pointer text-sm font-bold text-navy">Definitions &amp; notes</summary>' +
        '<ul class="mt-3 space-y-2">' + def.notes.map((n) => '<li class="text-sm leading-relaxed text-ink-soft">• ' + esc(n) + '</li>').join('') + '</ul>' +
      '</details>' +
      '<details class="card p-4" open>' +
        '<summary class="cursor-pointer text-sm font-bold text-navy">References <span class="font-normal text-ink-muted">· ' + esc(def.version) + '</span></summary>' +
        '<ol class="mt-3 space-y-2">' + def.references.map((r, i) =>
          '<li class="text-sm leading-relaxed text-ink-soft">' + (i + 1) + '. ' +
            (r.url ? '<a class="hover:text-primary hover:underline" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.text) + '</a>' : esc(r.text)) +
          '</li>').join('') + '</ol>' +
      '</details>' +
      '<p class="rounded-xl2 border border-line bg-canvas p-4 text-xs leading-relaxed text-ink-muted lg:col-span-2">' +
        'For medical education only. Not a medical device and not a substitute for clinical judgement. Check results against the original source ' +
        'before any clinical use. Nothing you enter is saved or sent — calculations run in your browser.' +
      '</p>';
  }

  /* ── events (delegated, so redraws need no rewiring) ── */

  fieldsHost.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bool]');
    if (b) { answers[b.dataset.bool] = !answers[b.dataset.bool]; redrawField(b.dataset.bool); drawResult(); return; }
    const c = e.target.closest('[data-choice]');
    if (c) {
      const f = def.fields.find((x) => x.id === c.dataset.choice);
      answers[f.id] = answers[f.id] === c.dataset.value && !f.required ? null : c.dataset.value;
      redrawField(f.id); drawResult(); return;
    }
    const u = e.target.closest('[data-unit]');
    if (u) {
      const field = def.fields.find((x) => x.id === u.dataset.unit);
      const targets = field.unitGroup
        ? def.fields.filter((x) => x.type === 'number' && x.unitGroup === field.unitGroup && x.units.some((y) => y.id === u.dataset.unitId))
        : [field];
      targets.forEach((f) => {
        const oldU = unitOf(f);
        const n = raw(f);
        units[f.id] = u.dataset.unitId;
        const newU = unitOf(f);
        if (n !== null && !Number.isNaN(n) && n >= oldU.min && n <= oldU.max && oldU.id !== newU.id) {
          texts[f.id] = fmtSmart(newU.fromBase(oldU.toBase(n)), newU.decimals);
        }
        redrawField(f.id);
      });
      drawResult();
    }
  });

  fieldsHost.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-num]');
    if (!inp) return;
    const f = def.fields.find((x) => x.id === inp.dataset.num);
    texts[f.id] = inp.value;
    // Update only the error line, so the caret stays where it is.
    const err = numberError(f);
    const errEl = fieldsHost.querySelector('[data-err="' + f.id + '"]');
    errEl.textContent = err || '';
    errEl.classList.toggle('hidden', !err);
    inp.classList.toggle('border-bad', !!err);
    drawResult();
  });

  host.querySelector('[data-clear]').addEventListener('click', () => {
    Object.assign(answers, defaults(def));
    def.fields.forEach((f) => { if (f.type === 'number') { texts[f.id] = ''; units[f.id] = f.units[0].id; } });
    drawFields(); drawResult();
  });

  drawFields();
  drawResult();
  drawFooter();
}
