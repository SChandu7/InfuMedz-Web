// Reference cases for the website calculators - the same vectors as the
// app's test/calculators_test.dart, so both copies give identical numbers.
//   node src/calc_test.mjs

import * as c from '../assets/js/calc/core.js';
import { CALCULATORS, byId, defaults, indianBmiRow, kdigoStage, makeValues, whoBmiRow } from '../assets/js/calc/definitions.js';

let passed = 0;
const failures = [];
function eq(name, got, want) {
  const ok = typeof want === 'number' ? Math.abs(got - want) < 1e-9 : JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed++;
  else failures.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

function run(id, values, units) {
  const def = byId(id);
  return def.compute(makeValues(Object.assign(defaults(def), values), units));
}
const extra = (r, start) => r.extra.find((l) => l.label.startsWith(start)).value;

// rounding
eq('428.65', c.roundHalfUp(428.65, 1), 428.7);
eq('2.5', c.roundHalfUp(2.5, 0), 3);
eq('-2.5', c.roundHalfUp(-2.5, 0), -3);
eq('1.005', c.roundHalfUp(1.005, 2), 1.01);
eq('0.125', c.roundHalfUp(0.125, 2), 0.13);
eq('-0', c.fmt(-0.001, 1), '0.0');
eq('signed -9', c.fmtSigned(-9), '−9');
eq('signed 12', c.fmtSigned(12), '+12');
eq('smart 3.5', c.fmtSmart(3.5, 2), '3.5');
eq('smart 133', c.fmtSmart(132.6, 0), '133');

// QTc
const q = (qt, hr, b, f, fr, h) => {
  eq(`bazett ${qt}@${hr}`, c.roundHalfUp(c.qtcBazett(qt, hr), 1), b);
  eq(`frid ${qt}@${hr}`, c.roundHalfUp(c.qtcFridericia(qt, hr), 1), f);
  eq(`fram ${qt}@${hr}`, c.roundHalfUp(c.qtcFramingham(qt, hr), 1), fr);
  eq(`hodges ${qt}@${hr}`, c.roundHalfUp(c.qtcHodges(qt, hr), 1), h);
};
q(400, 60, 400, 400, 400, 400);
q(360, 100, 464.8, 426.8, 421.6, 430.0);
q(440, 50, 401.7, 414.1, 409.2, 422.5);
q(c.qtWideQrsAdjusted(480, 160), 75, 449.9, 433.5, 433.2, 428.7);
let r = run('qtc', { qt: 360, hr: 100, sex: 'male' });
eq('qtc male value', [r.value, r.band], ['427', 'Normal range']);
r = run('qtc', { qt: 360, hr: 100, sex: 'male', formula: 'bazett' });
eq('qtc bazett', [r.value, r.band, r.warnings.length > 0], ['465', 'Prolonged', true]);
eq('455 male', run('qtc', { qt: 455, hr: 60, sex: 'male' }).band, 'Prolonged');
eq('455 female', run('qtc', { qt: 455, hr: 60, sex: 'female' }).band, 'Normal range');
eq('520', run('qtc', { qt: 520, hr: 60, sex: 'female' }).band, 'Markedly prolonged');
eq('380', run('qtc', { qt: 380, hr: 60, sex: 'female' }).band, 'Short');
r = run('qtc', { qt: 470, hr: 60, sex: 'male', baseline: 400 });
eq('rise', [r.band.includes('rise over 60 ms'), r.tone, [...r.tables[0].highlight].sort()], [true, 'high', [2, 4]]);
r = run('qtc', { qt: 560, hr: 60, sex: 'male', qrs: 160 });
eq('wide qrs', [r.value, r.band, extra(r, 'Wide-QRS adjusted')], ['560', 'Markedly prolonged', '482 ms']);

// kidney
eq('egfr1', c.roundHalfUp(c.egfrCkdEpi2021(1.0, 50, false), 1), 91.7);
eq('egfr2', c.roundHalfUp(c.egfrCkdEpi2021(0.8, 60, true), 1), 84.3);
eq('egfr3', c.roundHalfUp(c.egfrCkdEpi2021(2.0, 70, false), 1), 35.2);
eq('egfr4', c.roundHalfUp(c.egfrCkdEpi2021(0.6, 30, true), 1), 123.8);
eq('egfr5', c.roundHalfUp(c.egfrCkdEpi2021(1.5, 80, true), 1), 35.0);
eq('cg1', c.roundHalfUp(c.crclCockcroftGault(2.0, 70, 70, false), 1), 34.0);
eq('cg2', c.roundHalfUp(c.crclCockcroftGault(1.2, 70, 70, false), 1), 56.7);
eq('cg3', c.roundHalfUp(c.crclCockcroftGault(0.9, 45, 90, false), 1), 131.9);
eq('cg4', c.roundHalfUp(c.crclCockcroftGault(1.5, 80, 55, true), 1), 26.0);
r = run('egfr', { sex: 'female', age: 80, scr: 1.5, weight: 55 });
eq('egfr screen', [r.value, r.band.startsWith('G3b'), extra(r, 'Creatinine clearance'), r.warnings[0].includes('Cockcroft-Gault')], ['35', true, '26 mL/min', true]);
const umol = byId('egfr').fields.find((f) => f.id === 'scr').units[1];
eq('umol same', run('egfr', { sex: 'male', age: 70, scr: umol.toBase(176.8) }).value, run('egfr', { sex: 'male', age: 70, scr: 2.0 }).value);
eq('stage 59.6', kdigoStage(c.roundHalfUp(59.6, 0)), 1);

// lipids
const lip = (tc, hdl, tg, fried, factor, martin, sampson) => {
  if (fried != null) eq(`fried ${tc}`, c.roundHalfUp(c.ldlFriedewald(tc, hdl, tg), 1), fried);
  eq(`factor ${tc}`, c.martinFactor(tg, tc - hdl), factor);
  eq(`martin ${tc}`, c.roundHalfUp(c.ldlMartinHopkins(tc, hdl, tg), 1), martin);
  eq(`sampson ${tc}`, c.roundHalfUp(c.ldlSampson(tc, hdl, tg), 1), sampson);
};
lip(200, 50, 150, 120.0, 5.7, 123.7, 123.4);
lip(180, 40, 300, 80.0, 7.5, 100.0, 90.2);
lip(150, 45, 90, 87.0, 4.9, 86.6, 88.0);
lip(120, 45, 180, 39.0, 7.0, 49.3, 45.5);
lip(220, 35, 500, null, 8.1, 123.3, 100.5);
eq('martin table', [c.martinFactors.length, c.martinFactors.every((row) => row.length === 6)], [30, true]);
r = run('ldl', { tc: 200, hdl: 50, tg: 150 });
eq('ldl low tg', [r.valueLabel.includes('Martin'), r.value], [true, '124']);
r = run('ldl', { tc: 220, hdl: 35, tg: 500 });
eq('ldl sampson', [r.valueLabel.includes('Sampson'), r.value, extra(r, 'Friedewald')], [true, '100', 'Not valid']);
r = run('ldl', { tc: 300, hdl: 30, tg: 900 });
eq('ldl blocked', [r.blocked, extra(r, 'Non-HDL')], [true, '270 mg/dL']);
eq('impossible ldl', run('ldl', { tc: 100, hdl: 90, tg: 300 }).blocked, true);
eq('hdl>tc', run('ldl', { tc: 150, hdl: 160, tg: 100 }).blocked, true);
r = run('ldl', { tc: 200, hdl: 50, tg: 150, risk: 'high' });
eq('goal', [r.band, [...r.tables[0].highlight]], ['Above the <70 mg/dL goal', [1]]);
r = run('ldl', { tc: 200, hdl: 50, tg: 150 }, { tc: 'mmol', hdl: 'mmol', tg: 'mmol' });
eq('mmol', [r.unit, r.value], ['mmol/L', '3.20']);

// echo
eq('ava1', c.roundHalfUp(c.avaContinuity(2.0, 20, 100), 2), 0.63);
eq('ava2', c.roundHalfUp(c.avaContinuity(2.2, 22, 88), 2), 0.95);
eq('gradients', [2.5, 3, 4, 5].map(c.peakGradient), [25, 36, 64, 100]);
r = run('ava', { lvotd: 2.0, lvotvti: 20, avvti: 100, meang: 30, bsa: 1.8 });
eq('ava screen', [r.value, r.band, r.warnings.some((w) => w.includes('low-flow')), extra(r, 'Stroke volume index')], ['0.63', 'Severe range by AVA', true, '35 mL/m²']);
eq('ava moderate', run('ava', { lvotd: 2.2, lvotvti: 22, avvti: 70 }).band, 'Moderate range by AVA');
eq('ava mild', run('ava', { lvotd: 2.2, lvotvti: 22, avvti: 40 }).band, 'Mild range by AVA');
r = run('lvmass', { lvidd: 5.0, ivsd: 1.0, pwd: 1.0, sex: 'male', bsa: 1.8 });
eq('lvm a', [r.value, extra(r, 'LV mass index'), extra(r, 'Relative wall'), r.band], ['182', '101 g/m²', '0.40', 'Normal geometry']);
r = run('lvmass', { lvidd: 5.8, ivsd: 1.2, pwd: 1.1, sex: 'male', bsa: 1.9 });
eq('lvm b', [r.value, r.band], ['280', 'Eccentric hypertrophy']);
r = run('lvmass', { lvidd: 4.4, ivsd: 1.3, pwd: 1.3, sex: 'female', bsa: 1.6 });
eq('lvm c', [r.value, r.band], ['215', 'Concentric hypertrophy']);

// BMI
eq('bmi', c.roundHalfUp(c.bmi(70, 170), 2), 24.22);
eq('mosteller', c.roundHalfUp(c.bsaMosteller(70, 170), 3), 1.818);
eq('dubois', c.roundHalfUp(c.bsaDuBois(70, 170), 3), 1.810);
eq('dubois2', c.roundHalfUp(c.bsaDuBois(85, 165), 3), 1.923);
eq('bmi grade I', run('bmi', { weight: 70, height: 170 }).band, 'BMI Grade I (Indian 2025)');
eq('bmi grade III', run('bmi', { weight: 85, height: 165 }).band, 'BMI Grade III (Indian 2025)');
eq('bmi normal', run('bmi', { weight: 50, height: 160 }).band, 'Normal');
eq('bmi grade II', run('bmi', { weight: 60, height: 150 }).band, 'BMI Grade II (Indian 2025)');
eq('indian edges', [22.9, 23.0, 27.5, 27.6, 32.5].map(indianBmiRow), [1, 2, 3, 4, 5]);
eq('who', whoBmiRow(24.2), 1);
r = run('bmi', { weight: 70, height: 170, waist: 92, sex: 'male' });
eq('waist', [extra(r, 'Waist circumference'), r.interpretation.some((l) => l.startsWith('Abdominal adiposity'))], ['92 cm', true]);

// risk scores
r = run('cha2ds2va', { sex: 'female', age: '65to74', htn: true, dm: true });
eq('cha a', [r.value, extra(r, 'CHA₂DS₂-VASc')], ['3', '4']);
r = run('cha2ds2va', { sex: 'male', age: '65to74' });
eq('cha b', [r.value, extra(r, 'CHA₂DS₂-VASc'), r.band], ['1', '1', 'Intermediate']);
r = run('cha2ds2va', { sex: 'female', age: 'lt65' });
eq('cha c', [r.value, extra(r, 'CHA₂DS₂-VASc'), r.band, r.interpretation[1].includes('below')], ['0', '1', 'Low', true]);
eq('cha d', run('cha2ds2va', { sex: 'male', age: 'ge75', stroke: true, chf: true, vasc: true }).value, '6');
r = run('cha2ds2va', { sex: 'female', age: 'ge75', chf: true, htn: true, dm: true, stroke: true, vasc: true });
eq('cha e', [r.value, extra(r, 'CHA₂DS₂-VASc'), [...r.tables[1].highlight]], ['8', '9', [9]]);
r = run('hasbled', { elderly: true, htn: true, inr: 'labile', drugs: true });
eq('hasbled 4', [r.value, r.band], ['4', 'High']);
eq('hasbled 0', run('hasbled', {}).band, 'Low');
eq('hasbled 9', run('hasbled', { htn: true, renal: true, liver: true, stroke: true, bleed: true, inr: 'labile', elderly: true, drugs: true, alcohol: true }).value, '9');
eq('hasbled stable', run('hasbled', { inr: 'stable' }).value, '0');
eq('arc 2 minor', run('archbr', { age75: true, egfr: '30to59', hb: 'normal' }).value, 'HBR');
eq('arc 1 minor', run('archbr', { age75: true, egfr: 'ge60', hb: 'normal' }).value, 'Not HBR');
eq('arc oac', run('archbr', { oac: true, egfr: 'ge60', hb: 'normal' }).value, 'HBR');
eq('arc hb', run('archbr', { egfr: 'ge60', hb: 'low' }).value, 'HBR');
eq('jcto 0', run('jcto', {}).band, 'Easy');
eq('jcto 1', run('jcto', { calcium: true }).band, 'Intermediate');
eq('jcto 2', run('jcto', { blunt: true, length: true }).band, 'Difficult');
r = run('jcto', { blunt: true, calcium: true, bend: true, length: true, retry: true });
eq('jcto 5', [r.value, r.band], ['5', 'Very difficult']);
r = run('duke', { minutes: 9, st: 2, angina: '2' });
eq('duke -9', [r.value, r.band], ['−9', 'Moderate risk']);
r = run('duke', { minutes: 12, st: 0, angina: '0' });
eq('duke 12', [r.value, r.band], ['+12', 'Low risk']);
r = run('duke', { minutes: 4, st: 3, angina: '2' });
eq('duke -19', [r.value, r.band], ['−19', 'High risk']);
eq('duke +5', run('duke', { minutes: 5, st: 0, angina: '0' }).band, 'Low risk');
eq('duke -11', run('duke', { minutes: 4, st: 3, angina: '0' }).band, 'High risk');

// catalogue integrity
const ids = new Set();
for (const d of CALCULATORS) {
  eq('unique ' + d.id, ids.has(d.id), false);
  ids.add(d.id);
  eq('refs ' + d.id, d.references.length > 0, true);
  const fids = new Set();
  for (const f of d.fields) {
    eq(`field ${d.id}.${f.id}`, fids.has(f.id), false);
    fids.add(f.id);
    if (f.type === 'choice' && f.initial) eq(`initial ${d.id}.${f.id}`, f.options.some((o) => o.value === f.initial), true);
    if (f.type === 'number') f.units.forEach((u) => eq(`range ${d.id}.${f.id}.${u.id}`, u.min < u.max, true));
  }
}
eq('count', CALCULATORS.length, 11);

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log('FAIL ' + f));
  process.exit(1);
}
