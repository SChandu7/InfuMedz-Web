/* Medical calculators - shared maths.
 *
 * A line-for-line port of the app's lib/features/calculators/engine/
 * calc_format.dart and formulas/cardio_formulas.dart, so the website and the
 * app give identical numbers. src/calc_test.mjs runs the same reference
 * cases as the app's test/calculators_test.dart. Nothing here rounds except
 * the display helpers.
 */

/* ── display rounding ─────────────────────────────────────── */

/** Half away from zero, immune to binary representation (428.65 -> 428.7). */
export function roundHalfUp(value, decimals = 0) {
  if (!Number.isFinite(value)) return value;
  const scale = Math.pow(10, decimals);
  const scaled = Math.abs(value) * scale;
  const nudged = scaled + scaled * 1e-12 + 1e-9;
  const rounded = Math.floor(nudged + 0.5) / scale;
  return value < 0 ? -rounded : rounded;
}

export function fmt(value, decimals = 0) {
  const text = roundHalfUp(value, decimals).toFixed(decimals);
  return Number(text) === 0 ? (0).toFixed(decimals) : text;
}

/** Up to `decimals` decimals without trailing zeros: 3.5, 0.13, 60. */
export function fmtSmart(value, decimals = 1) {
  let text = fmt(value, decimals);
  if (text.includes('.')) text = text.replace(/\.?0+$/, '');
  return text;
}

/** "+3", "0", "−2" (real minus sign). */
export function fmtSigned(value, decimals = 0) {
  const text = fmtSmart(value, decimals);
  if (text.startsWith('-')) return '−' + text.slice(1);
  return Number(text) > 0 ? '+' + text : text;
}

/* ── unit factors ─────────────────────────────────────────── */

export const creatinineUmolPerMgdl = 88.4;
export const cholesterolMgdlPerMmol = 38.67;
export const triglycerideMgdlPerMmol = 88.57;
export const kgPerLb = 0.45359237;
export const cmPerInch = 2.54;

/* ── QTc (Vandenberk 2016), ms ───────────────────────────── */

export const rrSeconds = (hr) => 60 / hr;
export const qtcBazett = (qt, hr) => qt / Math.sqrt(rrSeconds(hr));
export const qtcFridericia = (qt, hr) => qt / Math.pow(rrSeconds(hr), 1 / 3);
export const qtcFramingham = (qt, hr) => qt + 154 * (1 - rrSeconds(hr));
export const qtcHodges = (qt, hr) => qt + 1.75 * (hr - 60);
export const qtWideQrsAdjusted = (qt, qrs) => qt - 0.485 * qrs;

/* ── kidney ───────────────────────────────────────────────── */

export function egfrCkdEpi2021(scrMgdl, age, female) {
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const ratio = scrMgdl / kappa;
  return 142 * Math.pow(Math.min(ratio, 1), alpha) * Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, age) * (female ? 1.012 : 1);
}

export const crclCockcroftGault = (scrMgdl, age, weightKg, female) =>
  (140 - age) * weightKg / (72 * scrMgdl) * (female ? 0.85 : 1);

/* ── lipids, mg/dL ────────────────────────────────────────── */

export const nonHdl = (tc, hdl) => tc - hdl;
export const ldlFriedewald = (tc, hdl, tg) => tc - hdl - tg / 5;
export function ldlSampson(tc, hdl, tg) {
  const nh = tc - hdl;
  return tc / 0.948 - hdl / 0.971 - (tg / 8.56 + tg * nh / 2140 - tg * tg / 16100) - 9.44;
}

export const martinTgLower = [7, 50, 57, 62, 67, 72, 76, 80, 84, 88, 93, 97, 101, 106, 111, 116, 121, 127, 133, 139, 147, 155, 164, 174, 186, 202, 221, 248, 293, 400];
export const martinNonHdlLower = [0, 100, 130, 160, 190, 220];
export const martinFactors = [
  [3.5, 3.4, 3.3, 3.3, 3.2, 3.1], [4.0, 3.9, 3.7, 3.6, 3.6, 3.4], [4.3, 4.1, 4.0, 3.9, 3.8, 3.6],
  [4.5, 4.3, 4.1, 4.0, 3.9, 3.9], [4.7, 4.4, 4.3, 4.2, 4.1, 3.9], [4.8, 4.6, 4.4, 4.2, 4.2, 4.1],
  [4.9, 4.6, 4.5, 4.3, 4.3, 4.2], [5.0, 4.8, 4.6, 4.4, 4.3, 4.2], [5.1, 4.8, 4.6, 4.5, 4.4, 4.3],
  [5.2, 4.9, 4.7, 4.6, 4.4, 4.3], [5.3, 5.0, 4.8, 4.7, 4.5, 4.4], [5.4, 5.1, 4.8, 4.7, 4.5, 4.3],
  [5.5, 5.2, 5.0, 4.7, 4.6, 4.5], [5.6, 5.3, 5.0, 4.8, 4.6, 4.5], [5.7, 5.4, 5.1, 4.9, 4.7, 4.5],
  [5.8, 5.5, 5.2, 5.0, 4.8, 4.6], [6.0, 5.5, 5.3, 5.0, 4.8, 4.6], [6.1, 5.7, 5.3, 5.1, 4.9, 4.7],
  [6.2, 5.8, 5.4, 5.2, 5.0, 4.7], [6.3, 5.9, 5.6, 5.3, 5.0, 4.8], [6.5, 6.0, 5.7, 5.4, 5.1, 4.8],
  [6.7, 6.2, 5.8, 5.4, 5.2, 4.9], [6.8, 6.3, 5.9, 5.5, 5.3, 5.0], [7.0, 6.5, 6.0, 5.7, 5.4, 5.1],
  [7.3, 6.7, 6.2, 5.8, 5.5, 5.2], [7.6, 6.9, 6.4, 6.0, 5.6, 5.3], [8.0, 7.2, 6.6, 6.2, 5.9, 5.4],
  [8.5, 7.6, 7.0, 6.5, 6.1, 5.6], [9.5, 8.3, 7.5, 7.0, 6.5, 5.9], [11.9, 10.0, 8.8, 8.1, 7.5, 6.7],
];

function stratum(bounds, value) {
  let index = 0;
  for (let i = 0; i < bounds.length; i++) if (value >= bounds[i]) index = i;
  return index;
}

export const martinFactor = (tg, nh) => martinFactors[stratum(martinTgLower, tg)][stratum(martinNonHdlLower, nh)];
export const ldlMartinHopkins = (tc, hdl, tg) => nonHdl(tc, hdl) - tg / martinFactor(tg, nonHdl(tc, hdl));

/* ── echo ─────────────────────────────────────────────────── */

export const lvotArea = (d) => Math.PI * Math.pow(d / 2, 2);
export const avaContinuity = (d, lvotVti, avVti) => lvotArea(d) * lvotVti / avVti;
export const peakGradient = (v) => 4 * v * v;
export const lvMassAse = (lvidd, ivsd, pwd) => 0.8 * 1.04 * (Math.pow(lvidd + ivsd + pwd, 3) - Math.pow(lvidd, 3)) + 0.6;
export const relativeWallThickness = (pwd, lvidd) => 2 * pwd / lvidd;

/* ── body size ────────────────────────────────────────────── */

export const bmi = (w, h) => w / Math.pow(h / 100, 2);
export const bsaMosteller = (w, h) => Math.sqrt(h * w / 3600);
export const bsaDuBois = (w, h) => 0.007184 * Math.pow(w, 0.425) * Math.pow(h, 0.725);

/* ── exercise test ────────────────────────────────────────── */

export const dukeTreadmillScore = (minutes, st, angina) => minutes - 5 * st - 4 * angina;
