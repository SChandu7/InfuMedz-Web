/* Medical calculators - the 11 definitions.
 *
 * Port of the app's lib/features/calculators/definitions/*.dart: the same
 * fields, ranges, cut-offs, wording, tables and references. A definition is
 * data plus a pure compute(v) function; render.js draws any of them. Keep
 * the two copies in step: src/calc_test.mjs checks the same reference cases
 * as the app's tests.
 *
 * Field types: bool (yes/no item), choice (one of several), number (with
 * units; values reach compute() in the first unit's base unit).
 * Result tones are neutral position-on-scale colours: low, moderate, high,
 * neutral.
 */

import {
  avaContinuity, bmi, bsaDuBois, bsaMosteller, cholesterolMgdlPerMmol, cmPerInch,
  creatinineUmolPerMgdl, crclCockcroftGault, dukeTreadmillScore, egfrCkdEpi2021, fmt, fmtSigned,
  fmtSmart, kgPerLb, ldlFriedewald, ldlMartinHopkins, ldlSampson, lvMassAse, lvotArea, martinFactor,
  nonHdl, peakGradient, qtWideQrsAdjusted, qtcBazett, qtcFramingham, qtcFridericia, qtcHodges,
  relativeWallThickness, roundHalfUp, rrSeconds, triglycerideMgdlPerMmol,
} from './core.js';

/* ── building blocks ──────────────────────────────────────── */

const unit = (id, label, min, max, o = {}) => ({
  id, label, min, max,
  decimals: o.decimals ?? 1,
  hint: o.hint || null,
  toBase: o.toBase || ((x) => x * (o.factor ?? 1)),
  fromBase: o.fromBase || ((x) => x / (o.factor ?? 1)),
});

const bool = (id, label, help, points) => ({ type: 'bool', id, label, help, points, required: false });
const choice = (id, label, options, o = {}) => ({ type: 'choice', id, label, options, help: o.help, initial: o.initial ?? null, vertical: !!o.vertical, required: o.required ?? true });
const opt = (value, label, points) => ({ value, label, points });
const number = (id, label, units, o = {}) => ({ type: 'number', id, label, units, help: o.help, unitGroup: o.unitGroup || null, required: o.required ?? true });

const sexField = choice('sex', 'Sex', [opt('male', 'Male'), opt('female', 'Female')], { help: 'Used for sex-specific formulas and cut-offs.' });
const weightField = (o = {}) => number('weight', o.label || 'Body weight', [
  unit('kg', 'kg', 2, 350),
  unit('lb', 'lb', 4.5, 770, { factor: kgPerLb }),
], { help: o.help, required: o.required ?? true });
const heightField = () => number('height', 'Height', [unit('cm', 'cm', 50, 250), unit('in', 'in', 20, 98, { factor: cmPerInch })]);

const EDU = 'For medical education. The result supports, and never replaces, clinical judgement and the full guideline text.';
const ref = (text, url) => ({ text, url: url || null });
const line = (label, value, o = {}) => ({ label, value, note: o.note || null, emphasis: !!o.emphasis });
const table = (title, columns, rows, highlight, footnote) => ({ title, columns, rows, highlight: new Set(highlight), footnote: footnote || null });

function tally() {
  const t = { total: 0, lines: [] };
  t.add = (when, label, pts) => {
    if (!when || !pts) return t;
    t.total += pts;
    t.lines.push(line(label, pts > 0 ? '+' + pts : '−' + -pts));
    return t;
  };
  return t;
}

const result = (r) => Object.assign({ unit: null, extra: [], breakdown: [], interpretation: [], warnings: [], tables: [], blocked: false }, r);
const blocked = (valueLabel, reason, o = {}) => result(Object.assign({ value: '—', valueLabel, band: reason, tone: 'neutral', blocked: true }, o));

/* ═════════════════ CHA2DS2-VA / VASc ═════════════════ */

const FRIBERG = ['0.2', '0.6', '2.2', '3.2', '4.8', '7.2', '9.7', '11.2', '10.8', '12.2'];

const cha2ds2va = {
  id: 'cha2ds2va',
  name: 'CHA₂DS₂-VA / CHA₂DS₂-VASc',
  category: 'Atrial fibrillation',
  summary: 'Stroke risk in atrial fibrillation, to guide oral anticoagulation (ESC 2024 and ACC/AHA 2023).',
  version: 'CHA₂DS₂-VA (ESC 2024) and CHA₂DS₂-VASc (ACC/AHA 2023)',
  keywords: ['af', 'stroke', 'anticoagulation', 'oac', 'vasc', 'chads'],
  fields: [
    sexField,
    choice('age', 'Age', [opt('lt65', 'Under 65'), opt('65to74', '65–74', '+1'), opt('ge75', '75 or over', '+2')]),
    bool('chf', 'Congestive heart failure', 'Clinical heart failure, or objective evidence of LV dysfunction.', '+1'),
    bool('htn', 'Hypertension', 'History of hypertension, or on antihypertensive treatment.', '+1'),
    bool('dm', 'Diabetes mellitus', null, '+1'),
    bool('stroke', 'Prior stroke, TIA or thromboembolism', null, '+2'),
    bool('vasc', 'Vascular disease', 'Prior myocardial infarction or peripheral artery disease.', '+1'),
  ],
  compute(v) {
    const female = v.choice('sex') === 'female';
    const t = tally()
      .add(v.flag('chf'), 'Congestive heart failure', 1)
      .add(v.flag('htn'), 'Hypertension', 1)
      .add(v.choice('age') === 'ge75', 'Age 75 or over', 2)
      .add(v.flag('dm'), 'Diabetes', 1)
      .add(v.flag('stroke'), 'Stroke / TIA / thromboembolism', 2)
      .add(v.flag('vasc'), 'Vascular disease', 1)
      .add(v.choice('age') === '65to74', 'Age 65–74', 1);
    const va = t.total;
    const vasc = va + (female ? 1 : 0);
    const breakdown = t.lines.concat(female ? [line('Female sex (CHA₂DS₂-VASc only)', '+1')] : []);
    const [band, tone, esc] = va === 0
      ? ['Low', 'low', 'Score 0 is below both ESC 2024 treatment thresholds.']
      : va === 1
        ? ['Intermediate', 'moderate', 'ESC 2024: oral anticoagulation should be considered (Class IIa).']
        : ['High', 'high', 'ESC 2024: oral anticoagulation is recommended (Class I).'];
    const accHigh = female ? 3 : 2;
    const acc = vasc >= accHigh
      ? `ACC/AHA 2023 (CHA₂DS₂-VASc ${vasc}): anticoagulation recommended — annual stroke risk ≥2% (Class 1).`
      : vasc === accHigh - 1
        ? `ACC/AHA 2023 (CHA₂DS₂-VASc ${vasc}): anticoagulation is reasonable — annual risk ≥1% to <2% (Class 2a).`
        : `ACC/AHA 2023 (CHA₂DS₂-VASc ${vasc}): below the anticoagulation thresholds (≥${accHigh - 1} for ${female ? 'women' : 'men'}).`;
    return result({
      value: String(va), valueLabel: 'CHA₂DS₂-VA score (0–8)', band, tone,
      extra: [line('CHA₂DS₂-VASc score (0–9)', String(vasc), { note: 'Adds 1 point for female sex' })],
      breakdown,
      interpretation: [esc, acc, 'A bleeding-risk score (e.g. HAS-BLED) is used to find and correct modifiable bleeding risks, not to withhold anticoagulation.'],
      tables: [
        table('ESC 2024 — CHA₂DS₂-VA', ['Score', 'Recommendation'],
          [['0', 'Below treatment thresholds'], ['1', 'OAC should be considered (IIa)'], ['≥2', 'OAC recommended (I)']], [va >= 2 ? 2 : va]),
        table('Annual ischaemic stroke rate by CHA₂DS₂-VASc', ['CHA₂DS₂-VASc', 'Stroke / year'],
          FRIBERG.map((r, i) => [String(i), r + '%']), [vasc],
          'Friberg 2012, untreated Swedish AF cohort (n = 90,490). Rates differ by cohort. No equivalent table exists for CHA₂DS₂-VA, so do not subtract 1 and reuse these rates.'),
      ],
    });
  },
  notes: [
    'Age points are mutually exclusive: 65–74 scores 1, 75 or over scores 2.',
    'ESC 2024 dropped the sex point (CHA₂DS₂-VA, maximum 8). ACC/AHA 2023 keeps CHA₂DS₂-VASc with thresholds of ≥2 for men and ≥3 for women.',
    'Vascular disease in many definitions also includes complex aortic plaque.',
    EDU,
  ],
  references: [
    ref('Lip GYH et al. Refining clinical risk stratification for predicting stroke in AF. Chest 2010;137:263-72.', 'https://doi.org/10.1378/chest.09-1584'),
    ref('Van Gelder IC et al. 2024 ESC Guidelines for the management of atrial fibrillation. Eur Heart J 2024.', 'https://doi.org/10.1093/eurheartj/ehae176'),
    ref('Joglar JA et al. 2023 ACC/AHA/ACCP/HRS Guideline for atrial fibrillation. Circulation 2024;149:e1-e156.', 'https://doi.org/10.1161/CIR.0000000000001193'),
    ref('Friberg L et al. Evaluation of risk stratification schemes for ischaemic stroke and bleeding in 182 678 patients with AF. Eur Heart J 2012;33:1500-10.', 'https://doi.org/10.1093/eurheartj/ehr488'),
  ],
};

/* ═════════════════ HAS-BLED ═════════════════ */

const hasBled = {
  id: 'hasbled',
  name: 'HAS-BLED',
  category: 'Atrial fibrillation',
  summary: 'One-year major bleeding risk in atrial fibrillation on anticoagulation; highlights modifiable risks.',
  version: 'Pisters 2010 definitions',
  keywords: ['bleeding', 'af', 'anticoagulation', 'warfarin', 'doac'],
  fields: [
    bool('htn', 'Uncontrolled hypertension', 'Systolic BP above 160 mmHg.', '+1'),
    bool('renal', 'Abnormal renal function', 'Chronic dialysis, renal transplant, or creatinine ≥200 µmol/L (≥2.26 mg/dL).', '+1'),
    bool('liver', 'Abnormal liver function', 'Chronic liver disease (e.g. cirrhosis), or bilirubin >2× ULN together with AST/ALT/ALP >3× ULN.', '+1'),
    bool('stroke', 'Stroke', 'Previous ischaemic or haemorrhagic stroke.', '+1'),
    bool('bleed', 'Bleeding history or predisposition', 'Previous major bleed, or a predisposition such as anaemia or a bleeding disorder.', '+1'),
    choice('inr', 'Labile INR', [
      opt('novka', 'Not on a VKA (e.g. on a DOAC)'), opt('stable', 'On a VKA, TTR 60% or more'), opt('labile', 'On a VKA, TTR below 60%', '+1'),
    ], { help: 'Applies only to warfarin / acenocoumarol (VKA). Time in therapeutic range (TTR).', initial: 'novka', vertical: true }),
    bool('elderly', 'Elderly: age over 65', 'Derivation uses >65 years, so a 65-year-old scores 0.', '+1'),
    bool('drugs', 'Drugs', 'Concomitant antiplatelet drug or NSAID.', '+1'),
    bool('alcohol', 'Alcohol', '8 or more units (drinks) per week.', '+1'),
  ],
  compute(v) {
    const labile = v.choice('inr') === 'labile';
    const t = tally()
      .add(v.flag('htn'), 'Uncontrolled hypertension', 1)
      .add(v.flag('renal'), 'Abnormal renal function', 1)
      .add(v.flag('liver'), 'Abnormal liver function', 1)
      .add(v.flag('stroke'), 'Stroke', 1)
      .add(v.flag('bleed'), 'Bleeding history / predisposition', 1)
      .add(labile, 'Labile INR', 1)
      .add(v.flag('elderly'), 'Age over 65', 1)
      .add(v.flag('drugs'), 'Antiplatelet / NSAID', 1)
      .add(v.flag('alcohol'), 'Alcohol ≥8 units/week', 1);
    const s = t.total;
    const [band, tone, row] = s === 0 ? ['Low', 'low', 0] : s <= 2 ? ['Moderate', 'moderate', 1] : ['High', 'high', 2];
    const modifiable = [
      v.flag('htn') && 'blood pressure control',
      labile && 'INR control (or a switch to a DOAC)',
      v.flag('drugs') && 'the need for antiplatelets / NSAIDs',
      v.flag('alcohol') && 'alcohol intake',
    ].filter(Boolean);
    return result({
      value: String(s), valueLabel: 'HAS-BLED score (0–9)', band, tone, breakdown: t.lines,
      interpretation: [
        s >= 3 && 'A score of 3 or more marks higher bleeding risk: review the patient more often and correct modifiable factors.',
        modifiable.length && 'Modifiable factors present: ' + modifiable.join(', ') + '.',
        'ACC/AHA 2023: a bleeding score should not be used on its own to decide against anticoagulation in a patient at high stroke risk (Class 3: No Benefit).',
      ].filter(Boolean),
      tables: [table('Risk bands (ACC/AHA 2023)', ['Score', 'Bleeding risk'], [['0', 'Low'], ['1–2', 'Moderate'], ['≥3', 'High']], [row])],
    });
  },
  notes: [
    'Sources word some items differently. ACC/AHA 2023 tables print age ≥65 and creatinine >2.26 mg/dL, and list the liver criteria separately. This calculator follows the original Pisters 2010 definitions; confirm locally which one you use.',
    'The L item scores 0 for patients on a DOAC.',
    'Discrimination is modest (c-index about 0.58–0.59 in a French nationwide study). Reassess periodically.',
    EDU,
  ],
  references: [
    ref('Pisters R et al. A novel user-friendly score (HAS-BLED) to assess 1-year risk of major bleeding in patients with AF. Chest 2010;138:1093-100.', 'https://doi.org/10.1378/chest.10-0134'),
    ref('Joglar JA et al. 2023 ACC/AHA/ACCP/HRS Guideline for atrial fibrillation. Circulation 2024;149:e1-e156.', 'https://doi.org/10.1161/CIR.0000000000001193'),
  ],
};

/* ═════════════════ ARC-HBR ═════════════════ */

const arcHbr = {
  id: 'archbr',
  name: 'ARC-HBR (high bleeding risk)',
  category: 'PCI & antiplatelets',
  summary: 'Academic Research Consortium definition of high bleeding risk in patients undergoing PCI.',
  version: 'ARC-HBR consensus, Urban 2019',
  keywords: ['pci', 'dapt', 'bleeding', 'stent', 'antiplatelet'],
  fields: [
    bool('oac', 'Long-term oral anticoagulation planned', null, 'Major'),
    choice('egfr', 'Kidney function (eGFR, mL/min/1.73 m²)', [opt('ge60', '60 or more'), opt('30to59', '30–59', 'Minor'), opt('lt30', 'Below 30', 'Major')]),
    choice('hb', 'Haemoglobin', [
      opt('normal', 'Men ≥13 g/dL, women ≥12 g/dL'), opt('mild', 'Men 11–12.9 g/dL, women 11–11.9 g/dL', 'Minor'), opt('low', 'Below 11 g/dL', 'Major'),
    ], { vertical: true }),
    bool('age75', 'Age 75 or over', null, 'Minor'),
    choice('bleed', 'Spontaneous bleeding needing hospital admission or transfusion', [
      opt('none', 'None'), opt('minor', 'First such bleed 6–12 months ago', 'Minor'), opt('major', 'Within the past 6 months, or at any time if recurrent', 'Major'),
    ], { vertical: true, initial: 'none' }),
    choice('stroke', 'Stroke or intracranial history', [
      opt('none', 'None'), opt('minor', 'Any ischaemic stroke not meeting the major criterion', 'Minor'),
      opt('major', 'Previous ICH at any time, brain AVM, or moderate–severe ischaemic stroke (NIHSS ≥5) within 6 months', 'Major'),
    ], { vertical: true, initial: 'none' }),
    bool('platelets', 'Platelets below 100 ×10⁹/L', 'Baseline thrombocytopenia.', 'Major'),
    bool('diathesis', 'Chronic bleeding diathesis', 'Clinically significant.', 'Major'),
    bool('liver', 'Liver cirrhosis with portal hypertension', null, 'Major'),
    bool('cancer', 'Active malignancy', 'Diagnosed within 12 months or on active treatment; excludes non-melanoma skin cancer.', 'Major'),
    bool('surgery', 'Major surgery', 'Non-deferrable major surgery planned while on DAPT, or major surgery / trauma within 30 days before PCI.', 'Major'),
    bool('nsaid', 'Long-term oral NSAID or steroid', 'Planned use on 4 or more days a week.', 'Minor'),
  ],
  compute(v) {
    const major = [
      v.flag('oac') && 'Long-term oral anticoagulation',
      v.choice('egfr') === 'lt30' && 'eGFR below 30',
      v.choice('hb') === 'low' && 'Haemoglobin below 11 g/dL',
      v.choice('bleed') === 'major' && 'Recent or recurrent spontaneous bleeding',
      v.choice('stroke') === 'major' && 'ICH / brain AVM / recent moderate–severe stroke',
      v.flag('platelets') && 'Thrombocytopenia',
      v.flag('diathesis') && 'Bleeding diathesis',
      v.flag('liver') && 'Cirrhosis with portal hypertension',
      v.flag('cancer') && 'Active malignancy',
      v.flag('surgery') && 'Major surgery or trauma',
    ].filter(Boolean);
    const minor = [
      v.flag('age75') && 'Age 75 or over',
      v.choice('egfr') === '30to59' && 'eGFR 30–59',
      v.choice('hb') === 'mild' && 'Haemoglobin mildly low',
      v.choice('bleed') === 'minor' && 'Bleed 6–12 months ago',
      v.choice('stroke') === 'minor' && 'Ischaemic stroke (minor criterion)',
      v.flag('nsaid') && 'Long-term NSAID / steroid',
    ].filter(Boolean);
    const hbr = major.length > 0 || minor.length >= 2;
    const row = major.length ? 2 : minor.length >= 2 ? 1 : 0;
    return result({
      value: hbr ? 'HBR' : 'Not HBR', valueLabel: 'ARC-HBR status',
      band: hbr ? 'High bleeding risk' : 'Does not meet the HBR definition', tone: hbr ? 'high' : 'low',
      extra: [line('Major criteria', String(major.length)), line('Minor criteria', String(minor.length))],
      breakdown: major.map((m) => line(m, 'Major')).concat(minor.map((m) => line(m, 'Minor'))),
      interpretation: [
        'High bleeding risk means at least 1 major or at least 2 minor criteria.',
        'ARC-HBR defines it as a 1-year risk of BARC 3 or 5 bleeding of 4% or more, or of intracranial haemorrhage of 1% or more.',
        hbr && 'Guidelines use HBR status when choosing antiplatelet strategy and DAPT duration after PCI.',
      ].filter(Boolean),
      tables: [table('ARC-HBR rule', ['Criteria met', 'Status'], [['No major and 0–1 minor', 'Not HBR'], ['No major and 2 or more minor', 'HBR'], ['1 or more major', 'HBR']], [row])],
    });
  },
  notes: [
    'ARC-HBR is a yes/no definition, not a points score.',
    'Traumatic intracranial bleeding has its own sub-rule in the consensus table; check the original when it applies.',
    EDU,
  ],
  references: [
    ref('Urban P et al. Defining high bleeding risk in patients undergoing PCI: a consensus document from the Academic Research Consortium for High Bleeding Risk. Circulation 2019;140:240-61.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6636810/'),
  ],
};

/* ═════════════════ J-CTO ═════════════════ */

const JCTO = [['0', 'Easy', '87.7%', '92.3%'], ['1', 'Intermediate', '67.1%', '58.3%'], ['2', 'Difficult', '42.4%', '34.8%'], ['≥3', 'Very difficult', '10.0%', '22.2%']];

const jCto = {
  id: 'jcto',
  name: 'J-CTO score',
  category: 'PCI & antiplatelets',
  summary: 'Angiographic difficulty of a coronary chronic total occlusion: chance of guidewire crossing within 30 minutes.',
  version: 'Morino 2011 (Multicenter CTO Registry of Japan)',
  keywords: ['cto', 'chronic total occlusion', 'pci', 'guidewire'],
  fields: [
    bool('blunt', 'Blunt stump', 'Entry point without a tapered stump.', '+1'),
    bool('calcium', 'Calcification', 'Calcification visible within the occluded segment.', '+1'),
    bool('bend', 'Bending over 45°', 'Angulation of more than 45° within the occluded segment.', '+1'),
    bool('length', 'Occlusion length 20 mm or more', 'Measured along the expected vessel course.', '+1'),
    bool('retry', 'Re-try lesion', 'Previously failed PCI attempt on this lesion.', '+1'),
  ],
  compute(v) {
    const t = tally()
      .add(v.flag('blunt'), 'Blunt stump', 1)
      .add(v.flag('calcium'), 'Calcification', 1)
      .add(v.flag('bend'), 'Bending >45°', 1)
      .add(v.flag('length'), 'Length ≥20 mm', 1)
      .add(v.flag('retry'), 'Re-try lesion', 1);
    const s = t.total;
    const row = s >= 3 ? 3 : s;
    return result({
      value: String(s), valueLabel: 'J-CTO score (0–5)', band: JCTO[row][1],
      tone: ['low', 'moderate', 'moderate', 'high'][row],
      extra: [line('Guidewire crossing ≤30 min (derivation)', JCTO[row][2])],
      breakdown: t.lines,
      interpretation: [
        'J-CTO predicts successful guidewire crossing within 30 minutes, not overall procedural success.',
        'Use it alongside the full angiographic assessment when planning the procedure.',
      ],
      tables: [table('Guidewire crossing within 30 min', ['Score', 'Group', 'Derivation', 'Validation'], JCTO, [row], '494 native CTO lesions, Morino 2011.')],
    });
  },
  notes: [
    'The original abstract states occlusion length >20 mm; most operators and later scores (e.g. CASTLE) use ≥20 mm, as here. Only a lesion of exactly 20 mm is affected.',
    'PROGRESS-CTO and CASTLE are alternatives developed in hybrid-approach and European registries.',
    EDU,
  ],
  references: [
    ref('Morino Y et al. Predicting successful guidewire crossing through chronic total occlusion of native coronary lesions within 30 minutes: the J-CTO score. JACC Cardiovasc Interv 2011;4:213-21.', 'https://doi.org/10.1016/j.jcin.2010.09.024'),
  ],
};

/* ═════════════════ QTc ═════════════════ */

const QTC_NAMES = { fridericia: 'Fridericia', bazett: 'Bazett', framingham: 'Framingham', hodges: 'Hodges' };
const qtcBy = (f, qt, hr) => f === 'bazett' ? qtcBazett(qt, hr) : f === 'framingham' ? qtcFramingham(qt, hr) : f === 'hodges' ? qtcHodges(qt, hr) : qtcFridericia(qt, hr);

const qtc = {
  id: 'qtc',
  name: 'QTc (corrected QT)',
  category: 'ECG & exercise testing',
  summary: 'Heart-rate corrected QT by Fridericia, Bazett, Framingham and Hodges, with sex-specific cut-offs.',
  version: 'Fridericia default (Vandenberk 2016); AHA/ACCF/HRS 2009 cut-offs',
  keywords: ['qt', 'ecg', 'long qt', 'torsades', 'bazett', 'fridericia'],
  fields: [
    number('qt', 'Measured QT interval', [unit('ms', 'ms', 200, 800, { decimals: 0, hint: 'Enter QT in milliseconds (e.g. 400), not seconds.' })],
      { help: 'From QRS onset to the end of the T wave, in the lead with the longest QT.' }),
    number('hr', 'Heart rate', [
      unit('bpm', 'bpm', 30, 220, { decimals: 0 }),
      unit('rr', 'RR ms', 273, 2000, { decimals: 0, toBase: (rr) => 60000 / rr, fromBase: (hr) => 60000 / hr }),
    ], { help: 'Ventricular rate on the same ECG, or the preceding RR interval.' }),
    sexField,
    choice('formula', 'Main formula', [opt('fridericia', 'Fridericia'), opt('bazett', 'Bazett'), opt('framingham', 'Framingham'), opt('hodges', 'Hodges')],
      { help: 'Fridericia and Framingham correct for rate better than Bazett.', initial: 'fridericia' }),
    number('qrs', 'QRS duration (optional)', [unit('ms', 'ms', 40, 300, { decimals: 0 })], { help: 'If 120 ms or more, a wide-QRS adjusted estimate is also shown.', required: false }),
    number('baseline', 'Baseline QTc (optional)', [unit('ms', 'ms', 250, 700, { decimals: 0 })], { help: 'Earlier QTc by the same formula, to see the change.', required: false }),
  ],
  compute(v) {
    const qt = v.number('qt'), hr = v.number('hr');
    const female = v.choice('sex') === 'female';
    const formula = v.choice('formula') || 'fridericia';
    const name = QTC_NAMES[formula];
    const main = roundHalfUp(qtcBy(formula, qt, hr), 0);
    const prolongedAt = female ? 460 : 450;
    const baseline = v.number('baseline');
    const change = baseline == null ? null : main - roundHalfUp(baseline, 0);
    const bigRise = change != null && change > 60;
    const [row, band, tone] = main > 500 ? [3, 'Markedly prolonged', 'high']
      : main >= prolongedAt ? [2, 'Prolonged', 'moderate']
        : main <= 390 ? [0, 'Short', 'moderate'] : [1, 'Normal range', 'low'];
    const qrs = v.number('qrs');
    const wide = qrs != null && qrs >= 120;
    const adjusted = wide ? qtcBy(formula, qtWideQrsAdjusted(qt, qrs), hr) : null;
    const warnings = [
      formula === 'bazett' && (hr < 60 || hr > 90) &&
        `Bazett over-corrects at fast heart rates and under-corrects at slow rates. At ${fmt(hr)} bpm, compare with Fridericia (${fmt(qtcFridericia(qt, hr))} ms).`,
      hr > 120 && 'At very fast rates every formula becomes less reliable; repeat at a slower rate if possible.',
      wide && `QRS ${fmt(qrs)} ms: part of the QT is depolarisation. The adjusted value is an estimate and tends to overestimate; never use it alone to dismiss a QTc above 500 ms.`,
    ].filter(Boolean);
    return result({
      value: fmt(main), unit: 'ms', valueLabel: 'QTc, ' + name,
      band: bigRise && main <= 500 ? band + ' · rise over 60 ms' : band,
      tone: bigRise ? 'high' : tone,
      extra: Object.keys(QTC_NAMES).map((f) => line(QTC_NAMES[f], fmt(qtcBy(f, qt, hr)) + ' ms', { emphasis: f === formula }))
        .concat([line('RR interval', fmt(rrSeconds(hr) * 1000) + ' ms')])
        .concat(change != null ? [line('Change from baseline', fmtSigned(change) + ' ms')] : [])
        .concat(adjusted != null ? [line(`Wide-QRS adjusted (${name})`, fmt(adjusted) + ' ms', { note: 'Bogossian: QT − 0.485 × QRS, then corrected. An estimate.' })] : []),
      warnings,
      interpretation: [
        'Cut-offs: prolonged ≥450 ms in men and ≥460 ms in women; short ≤390 ms.',
        (main > 500 || bigRise) && 'QTc above 500 ms, or a rise of more than 60 ms from baseline, is associated with a higher risk of torsade de pointes. Review QT-prolonging drugs, potassium and magnesium.',
        'Torsade risk rises gradually (about 5–7% per 10 ms in congenital long QT data); there is no level below which the risk is zero.',
      ].filter(Boolean),
      tables: [table('QTc cut-offs', ['QTc', 'Category'], [
        ['≤390 ms', 'Short'], ['Men <450, women <460 ms', 'Normal range'], ['Men ≥450, women ≥460 ms', 'Prolonged'], ['>500 ms', 'Markedly prolonged'], ['Rise >60 ms from baseline', 'Large increase'],
      ], bigRise ? [row, 4] : [row], 'AHA/ACCF/HRS 2009 (Rautaharju) and AHA 2010 hospital monitoring statement (Drew).')],
    });
  },
  notes: [
    'All four formulas give the same value at 60 bpm.',
    'Atrial fibrillation: one option is to calculate QTc for the shortest and longest RR intervals and average them.',
    'Long-QT syndrome diagnosis uses separate criteria (e.g. ESC 2022) and is outside this calculator.',
    EDU,
  ],
  references: [
    ref('Vandenberk B et al. Which QT correction formulae to use for QT monitoring? J Am Heart Assoc 2016;5:e003264.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4937268/'),
    ref('Rautaharju PM et al. AHA/ACCF/HRS recommendations for the standardization and interpretation of the ECG, part IV: the ST segment, T and U waves, and the QT interval. Circulation 2009;119:e241-50.', 'https://pubmed.ncbi.nlm.nih.gov/19228821/'),
    ref('Drew BJ et al. Prevention of torsade de pointes in hospital settings: a scientific statement from the AHA and ACCF. Circulation 2010;121:1047-60.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3056123/'),
    ref('Sagie A et al. An improved method for adjusting the QT interval for heart rate (the Framingham Heart Study). Am J Cardiol 1992;70:797-801.', 'https://pubmed.ncbi.nlm.nih.gov/1519533/'),
    ref('Bogossian H et al. New formula for evaluation of the QT interval in patients with left bundle branch block. Heart Rhythm 2014;11:2273-7.', 'https://pubmed.ncbi.nlm.nih.gov/25149024/'),
  ],
};

/* ═════════════════ Duke treadmill ═════════════════ */

const dukeTreadmill = {
  id: 'duke',
  name: 'Duke treadmill score',
  category: 'ECG & exercise testing',
  summary: 'Prognosis from a Bruce-protocol exercise ECG in suspected coronary artery disease.',
  version: 'Mark 1987 / 1991',
  keywords: ['tmt', 'exercise', 'stress test', 'treadmill', 'bruce', 'dts'],
  fields: [
    number('minutes', 'Exercise time', [unit('min', 'min', 0, 30)], { help: 'Total minutes on the Bruce protocol.' }),
    number('st', 'Maximum ST deviation', [unit('mm', 'mm', 0, 10)], { help: 'Largest ST depression or elevation in mm, during or after exercise (0 if none).' }),
    choice('angina', 'Angina during the test', [opt('0', 'None', '0'), opt('1', 'Non-limiting angina', '1'), opt('2', 'Exercise-limiting angina', '2')], { vertical: true }),
  ],
  compute(v) {
    const minutes = v.number('minutes'), st = v.number('st');
    const angina = Number(v.choice('angina'));
    const score = roundHalfUp(dukeTreadmillScore(minutes, st, angina), 1);
    const [row, band, tone] = score >= 5 ? [0, 'Low risk', 'low'] : score <= -11 ? [2, 'High risk', 'high'] : [1, 'Moderate risk', 'moderate'];
    return result({
      value: fmtSigned(score, 1), valueLabel: 'Duke treadmill score (−25 to +15)', band, tone,
      breakdown: [line('Exercise time', '+' + fmtSmart(minutes))]
        .concat(st > 0 ? [line(`ST deviation (5 × ${fmtSmart(st)} mm)`, '−' + fmtSmart(5 * st))] : [])
        .concat(angina > 0 ? [line(`Angina index (4 × ${angina})`, '−' + 4 * angina)] : []),
      interpretation: [
        'Score = exercise minutes − (5 × ST deviation in mm) − (4 × angina index).',
        'In the derivation cohort about 34% of patients were low risk, 53% moderate and 13% high risk; cardiovascular mortality rises across the groups.',
        tone === 'high' && 'A high-risk score usually prompts further evaluation of coronary anatomy.',
      ].filter(Boolean),
      tables: [table('Risk groups', ['Score', 'Group'], [['+5 or more', 'Low risk'], ['−10 to +4', 'Moderate risk'], ['−11 or less', 'High risk']], [row])],
    });
  },
  notes: [
    'Validated for the Bruce protocol; minutes on other protocols are not interchangeable.',
    'ST changes cannot be interpreted when the resting ECG has LBBB, a paced rhythm, pre-excitation or marked resting ST depression.',
    EDU,
  ],
  references: [
    ref('Mark DB et al. Exercise treadmill score for predicting prognosis in coronary artery disease. Ann Intern Med 1987;106:793-800.', 'https://doi.org/10.7326/0003-4819-106-6-793'),
    ref('Mark DB et al. Prognostic value of a treadmill exercise score in outpatients with suspected coronary artery disease. N Engl J Med 1991;325:849-53.', 'https://doi.org/10.1056/NEJM199109193251204'),
  ],
};

/* ═════════════════ Kidney ═════════════════ */

const KDIGO = [['G1', '≥90', 'Normal or high'], ['G2', '60–89', 'Mildly decreased'], ['G3a', '45–59', 'Mildly to moderately decreased'],
  ['G3b', '30–44', 'Moderately to severely decreased'], ['G4', '15–29', 'Severely decreased'], ['G5', '<15', 'Kidney failure']];

export function kdigoStage(e) {
  if (e >= 90) return 0;
  if (e >= 60) return 1;
  if (e >= 45) return 2;
  if (e >= 30) return 3;
  if (e >= 15) return 4;
  return 5;
}

const kidneyFunction = {
  id: 'egfr',
  name: 'eGFR & creatinine clearance',
  category: 'Lab calculators',
  summary: 'CKD-EPI 2021 eGFR with KDIGO stage, and Cockcroft-Gault creatinine clearance for drug (DOAC) dosing.',
  version: 'CKD-EPI 2021 (race-free) and Cockcroft-Gault 1976',
  keywords: ['kidney', 'renal', 'creatinine', 'ckd', 'crcl', 'doac', 'gfr'],
  fields: [
    sexField,
    number('age', 'Age', [unit('y', 'years', 18, 110, { decimals: 0 })], { help: 'Adults only (18 years or over).' }),
    number('scr', 'Serum creatinine', [
      unit('mgdl', 'mg/dL', 0.1, 25, { decimals: 2, hint: 'Values above 25 look like µmol/L — switch the unit.' }),
      unit('umol', 'µmol/L', 9, 2210, { decimals: 0, factor: 1 / creatinineUmolPerMgdl, hint: 'Values below 9 look like mg/dL — switch the unit.' }),
    ], { help: 'Standardised (IDMS-traceable) creatinine from a stable patient.' }),
    weightField({ label: 'Body weight (optional)', help: 'Needed for Cockcroft-Gault creatinine clearance. Use actual body weight.', required: false }),
  ],
  compute(v) {
    const female = v.choice('sex') === 'female';
    const age = v.number('age'), scr = v.number('scr');
    const shown = roundHalfUp(egfrCkdEpi2021(scr, age, female), 0);
    const stage = kdigoStage(shown);
    const weight = v.number('weight');
    const crclShown = weight == null ? null : roundHalfUp(crclCockcroftGault(scr, age, weight, female), 0);
    return result({
      value: fmt(shown), unit: 'mL/min/1.73 m²', valueLabel: 'eGFR, CKD-EPI 2021',
      band: KDIGO[stage][0] + ' · ' + KDIGO[stage][2],
      tone: stage <= 1 ? 'low' : stage <= 3 ? 'moderate' : 'high',
      extra: [line('Creatinine', `${fmt(scr, 2)} mg/dL = ${fmt(scr * creatinineUmolPerMgdl)} µmol/L`)]
        .concat(crclShown != null ? [line('Creatinine clearance (Cockcroft-Gault)', fmt(crclShown) + ' mL/min', { emphasis: true, note: 'Not indexed to body surface area' })] : []),
      warnings: [
        crclShown != null && (Math.abs(crclShown - shown) >= 10 || [15, 30, 50].some((t) => (crclShown < t) !== (shown < t))) &&
          `eGFR ${fmt(shown)} and creatinine clearance ${fmt(crclShown)} fall differently against common dosing thresholds (15, 30, 50). DOAC labels use Cockcroft-Gault creatinine clearance, so use that value for dose decisions.`,
        (age >= 80 || (weight != null && (weight < 50 || weight > 120))) &&
          'Creatinine-based estimates are less accurate at extremes of age, body size or muscle mass. KDIGO suggests eGFR with cystatin C when accuracy matters.',
      ].filter(Boolean),
      interpretation: [
        'CKD requires reduced eGFR or markers of kidney damage (e.g. albuminuria) present for more than 3 months. One value does not establish CKD or its stage.',
        'G1 or G2 without markers of kidney damage does not meet the definition of CKD.',
        crclShown == null && 'Add body weight to see creatinine clearance, which DOAC labels use for dosing.',
        'Estimates assume stable kidney function; they are not valid in acute kidney injury.',
      ].filter(Boolean),
      tables: [table('KDIGO 2024 GFR categories', ['Stage', 'mL/min/1.73 m²', 'Description'], KDIGO, [stage], 'Stage uses the eGFR as displayed (whole number).')],
    });
  },
  notes: [
    'CKD-EPI 2021: 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1.200 × 0.9938^age × 1.012 (if female); κ 0.7 / 0.9, α −0.241 / −0.302. No race coefficient.',
    'Cockcroft-Gault: (140 − age) × weight / (72 × Scr) × 0.85 (if female).',
    'Albuminuria categories (A1 <30, A2 30–300, A3 >300 mg/g) complete KDIGO staging.',
    EDU,
  ],
  references: [
    ref('Inker LA et al. New creatinine- and cystatin C-based equations to estimate GFR without race. N Engl J Med 2021;385:1737-49.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8822996/'),
    ref('Cockcroft DW, Gault MH. Prediction of creatinine clearance from serum creatinine. Nephron 1976;16:31-41.', 'https://pubmed.ncbi.nlm.nih.gov/1244564/'),
    ref('KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of CKD. Kidney Int 2024;105(4S):S117-S314.', 'https://pubmed.ncbi.nlm.nih.gov/38490803/'),
  ],
};

/* ═════════════════ LDL-C ═════════════════ */

const GOALS = { low: [100, 130], high: [70, 100], veryhigh: [55, 85] };
const GOAL_ROW = { low: 0, high: 1, veryhigh: 2 };

const ldlCholesterol = {
  id: 'ldl',
  name: 'LDL-C (Martin/Hopkins, Sampson)',
  category: 'Lab calculators',
  summary: 'Calculated LDL cholesterol and non-HDL cholesterol from a standard lipid profile.',
  version: 'Martin/Hopkins 2013, Sampson/NIH 2020, Friedewald 1972; CSI 2024 goals',
  keywords: ['lipid', 'cholesterol', 'ldl', 'friedewald', 'triglycerides', 'non-hdl', 'statin'],
  fields: [
    number('tc', 'Total cholesterol', [unit('mgdl', 'mg/dL', 50, 1000, { decimals: 0 }), unit('mmol', 'mmol/L', 1.3, 25.9, { decimals: 2, factor: cholesterolMgdlPerMmol })], { unitGroup: 'lipid' }),
    number('hdl', 'HDL cholesterol', [unit('mgdl', 'mg/dL', 5, 200, { decimals: 0 }), unit('mmol', 'mmol/L', 0.13, 5.2, { decimals: 2, factor: cholesterolMgdlPerMmol })], { unitGroup: 'lipid' }),
    number('tg', 'Triglycerides', [unit('mgdl', 'mg/dL', 10, 10000, { decimals: 0 }), unit('mmol', 'mmol/L', 0.11, 113, { decimals: 2, factor: triglycerideMgdlPerMmol })],
      { help: 'Fasting or non-fasting.', unitGroup: 'lipid' }),
    choice('risk', 'Risk category (optional)', [
      opt('low', 'Low risk'), opt('high', 'High risk (e.g. diabetes or hypertension)'), opt('veryhigh', 'Very high risk (e.g. prior MI, angina, stroke, CKD)'),
    ], { help: 'To compare with the CSI 2024 goal.', required: false, vertical: true }),
  ],
  compute(v) {
    const tc = v.number('tc'), hdl = v.number('hdl'), tg = v.number('tg');
    const si = v.unitOf('tc') === 'mmol';
    const chol = (mg) => si ? fmt(mg / cholesterolMgdlPerMmol, 2) + ' mmol/L' : fmt(mg) + ' mg/dL';
    const other = (mg) => si ? fmt(mg) + ' mg/dL' : fmt(mg / cholesterolMgdlPerMmol, 2) + ' mmol/L';
    if (hdl >= tc) return blocked('LDL-C', 'HDL cholesterol must be lower than total cholesterol. Check the values and units.');

    const nh = nonHdl(tc, hdl);
    const risk = v.choice('risk');
    const goal = risk ? GOALS[risk] : null;
    const goalTable = table('LDL-C goals — CSI 2024', ['Risk category', 'LDL-C', 'Non-HDL-C'],
      [['Low', '<100 mg/dL', '<130 mg/dL'], ['High', '<70 mg/dL', '<100 mg/dL'], ['Very high', '<55 mg/dL', '<85 mg/dL']],
      risk ? [GOAL_ROW[risk]] : [],
      'Cardiological Society of India 2024. ESC/EAS and ACC/AHA 2026 also use <55 (very high) and <70 mg/dL (high). 1 mmol/L = 38.67 mg/dL.');
    const nonHdlLine = line('Non-HDL cholesterol', chol(nh), { note: other(nh), emphasis: true });

    if (tg > 800) {
      return blocked('LDL-C', 'Triglycerides above 800 mg/dL (9.0 mmol/L): no LDL-C equation is reliable.', {
        extra: [nonHdlLine], tables: [goalTable],
        warnings: ['Request a directly measured LDL-C (or beta-quantification). Non-HDL cholesterol can still be used.'],
      });
    }
    const martin = ldlMartinHopkins(tc, hdl, tg);
    const sampson = ldlSampson(tc, hdl, tg);
    const friedewald = ldlFriedewald(tc, hdl, tg);
    const useSampson = tg >= 400;
    const ldl = useSampson ? sampson : martin;
    const method = useSampson ? 'Sampson/NIH' : 'Martin/Hopkins';
    const ldlRounded = roundHalfUp(ldl, 0);
    if (ldlRounded < 1) {
      return blocked('LDL-C', 'The equations give no usable LDL-C for these values. Check them, or measure LDL-C directly.', { extra: [nonHdlLine], tables: [goalTable] });
    }
    let band, tone;
    if (!goal) { band = 'Choose a risk category to compare with a goal'; tone = 'neutral'; }
    else if (ldlRounded < goal[0]) { band = `Below the <${fmt(goal[0])} mg/dL goal`; tone = 'low'; }
    else { band = `Above the <${fmt(goal[0])} mg/dL goal`; tone = 'high'; }

    return result({
      value: si ? fmt(ldl / cholesterolMgdlPerMmol, 2) : fmt(ldl), unit: si ? 'mmol/L' : 'mg/dL',
      valueLabel: 'LDL-C, ' + method, band, tone,
      extra: [
        line('LDL-C in ' + (si ? 'mg/dL' : 'mmol/L'), other(ldl)),
        nonHdlLine,
        line('Martin/Hopkins', chol(martin), { emphasis: !useSampson, note: 'Factor ' + martinFactor(tg, nh).toFixed(1) + (useSampson ? ' · outside validated range (TG ≥400)' : '') }),
        line('Sampson/NIH', chol(sampson), { emphasis: useSampson }),
        line('Friedewald', tg < 400 ? chol(friedewald) : 'Not valid', { note: tg < 400 ? 'Comparison only' : 'Not used at TG ≥400 mg/dL' }),
      ],
      warnings: [
        useSampson && 'Triglycerides 400–800 mg/dL: Sampson/NIH is used. Consider confirming with a direct LDL-C.',
        !useSampson && ldlRounded < 70 && tg >= 150 && martin - friedewald >= 5 &&
          `Friedewald under-reads at low LDL-C with raised triglycerides (here by ${fmt(martin - friedewald)} mg/dL).`,
      ].filter(Boolean),
      interpretation: [
        'ACC/AHA 2026 prefers Martin/Hopkins or Sampson/NIH over Friedewald, counts South Asian ancestry as a risk-enhancing factor, and advises measuring Lp(a) at least once.',
        goal && ldlRounded >= goal[0] && `Reaching the <${fmt(goal[0])} mg/dL goal needs a reduction of more than ${fmt((ldlRounded - goal[0]) / ldlRounded * 100)}% from ${fmt(ldlRounded)} mg/dL.`,
        goal && `Non-HDL-C goal for this category: <${fmt(goal[1])} mg/dL (current ${fmt(nh)} mg/dL).`,
      ].filter(Boolean),
      tables: [goalTable],
    });
  },
  notes: [
    "Martin/Hopkins uses a TG-to-VLDL factor from a 180-cell table (by triglycerides and non-HDL-C) instead of Friedewald's fixed 5.",
    'This calculator uses Martin/Hopkins for TG below 400 mg/dL and Sampson/NIH for 400–800 mg/dL, and gives no LDL-C above 800 mg/dL.',
    'Conversion: cholesterol mg/dL = mmol/L × 38.67; triglycerides mg/dL = mmol/L × 88.57.',
    'Goal tables differ between guidelines (CSI 2024, LAI, ESC/EAS, ACC/AHA 2026). Use the framework your practice follows.',
    EDU,
  ],
  references: [
    ref('Martin SS et al. Comparison of a novel method vs the Friedewald equation for estimating LDL-C. JAMA 2013;310:2061-8.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4226221/'),
    ref('Sampson M et al. A new equation for calculation of LDL-C in patients with normolipidemia and/or hypertriglyceridemia. JAMA Cardiol 2020;5:540-8.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7240357/'),
    ref('Friedewald WT et al. Estimation of the concentration of LDL cholesterol in plasma, without use of the preparative ultracentrifuge. Clin Chem 1972;18:499-502.', 'https://pubmed.ncbi.nlm.nih.gov/4337382/'),
    ref('Gupta et al. Cardiological Society of India dyslipidaemia guidelines, 2024 (PubMed 38171390).', 'https://pubmed.ncbi.nlm.nih.gov/38171390/'),
  ],
};

/* ═════════════════ Aortic valve area ═════════════════ */

const aorticValveArea = {
  id: 'ava',
  name: 'Aortic valve area (continuity)',
  category: 'Echocardiography',
  summary: 'Aortic stenosis grading from LVOT size and Doppler VTIs, with gradients, AVA index and velocity ratio.',
  version: 'Continuity equation; ESC/EACTS 2025 and ACC/AHA 2020 grading',
  keywords: ['aortic stenosis', 'as', 'echo', 'valve', 'lvot', 'vti', 'gradient', 'tavi'],
  fields: [
    number('lvotd', 'LVOT diameter', [
      unit('cm', 'cm', 1.0, 3.5, { decimals: 2, hint: 'Values above 3.5 look like millimetres — switch the unit.' }),
      unit('mm', 'mm', 10, 35, { decimals: 0, factor: 0.1 }),
    ], { help: 'Mid-systolic, inner edge to inner edge. Errors are squared in the result.', unitGroup: 'lvot' }),
    number('lvotvti', 'LVOT VTI', [unit('cm', 'cm', 5, 60)], { help: 'Pulsed-wave Doppler velocity-time integral in the LVOT.' }),
    number('avvti', 'Aortic valve VTI', [unit('cm', 'cm', 10, 250)], { help: 'Continuous-wave Doppler VTI across the valve (best window).' }),
    number('vmax', 'Peak aortic velocity (optional)', [unit('ms', 'm/s', 0.5, 8, { decimals: 2, hint: 'Enter velocity in m/s (e.g. 4.2), not cm/s.' })], { required: false }),
    number('meang', 'Mean gradient (optional)', [unit('mmhg', 'mmHg', 1, 200, { decimals: 0 })], { help: 'From the traced continuous-wave envelope.', required: false }),
    number('bsa', 'Body surface area (optional)', [unit('m2', 'm²', 0.5, 3.5, { decimals: 2 })], { help: 'For AVA index and stroke volume index.', required: false }),
  ],
  compute(v) {
    const d = v.number('lvotd'), lvotVti = v.number('lvotvti'), avVti = v.number('avvti');
    const vmax = v.number('vmax'), mean = v.number('meang'), bsa = v.number('bsa');
    const sv = lvotArea(d) * lvotVti;
    const ava = avaContinuity(d, lvotVti, avVti);
    const avaR = roundHalfUp(ava, 2);
    const dvi = roundHalfUp(lvotVti / avVti, 2);
    const avai = bsa == null ? null : roundHalfUp(ava / bsa, 2);
    const svi = bsa == null ? null : sv / bsa;
    const [row, band, tone] = avaR <= 1.0 ? [2, 'Severe range by AVA', 'high'] : avaR <= 1.5 ? [1, 'Moderate range by AVA', 'moderate'] : [0, 'Mild range by AVA', 'low'];
    const gradeVmax = (x) => x >= 5 ? 'very severe range' : x >= 4 ? 'severe range' : x >= 3 ? 'moderate range' : 'below 3.0 m/s';
    const gradeMean = (x) => x >= 60 ? 'very severe range' : x >= 40 ? 'severe range' : x >= 20 ? 'moderate range' : 'mild range';
    const gradeAvai = (x) => x <= 0.6 ? 'severe range' : x <= 0.85 ? 'moderate range' : 'mild range';
    const gradeDvi = (x) => x <= 0.25 ? 'severe range' : x <= 0.5 ? 'moderate range' : 'mild range';
    const severeGradient = (mean != null && roundHalfUp(mean, 0) >= 40) || (vmax != null && roundHalfUp(vmax, 1) >= 4.0);
    const lowGradient = mean != null && roundHalfUp(mean, 0) < 40;
    const lowFlow = svi != null && roundHalfUp(svi, 0) <= 35;
    return result({
      value: fmt(avaR, 2), unit: 'cm²', valueLabel: 'Aortic valve area', band, tone,
      extra: [line('LVOT stroke volume', fmt(sv) + ' mL')]
        .concat(svi != null ? [line('Stroke volume index', fmt(svi) + ' mL/m²', { note: lowFlow ? 'Low flow (≤35 mL/m²)' : 'Normal flow (>35 mL/m²)' })] : [])
        .concat(avai != null ? [line('AVA index', fmt(avai, 2) + ' cm²/m²', { note: gradeAvai(avai) })] : [])
        .concat([line('Velocity ratio (LVOT VTI / AV VTI)', fmt(dvi, 2), { note: gradeDvi(dvi) })])
        .concat(vmax != null ? [line('Peak gradient (4V²)', fmt(peakGradient(vmax)) + ' mmHg', { note: `Vmax ${fmt(vmax, 1)} m/s · ${gradeVmax(roundHalfUp(vmax, 1))}` })] : [])
        .concat(mean != null ? [line('Mean gradient', fmt(mean) + ' mmHg', { note: gradeMean(roundHalfUp(mean, 0)) })] : []),
      warnings: [
        lvotVti >= avVti && 'LVOT VTI is not lower than the aortic valve VTI. Check the sample positions and Doppler alignment.',
        avaR <= 1.0 && lowGradient && 'Discordant grading: AVA in the severe range with a mean gradient below 40 mmHg. Consider low-flow, low-gradient AS — check stroke volume index, LVEF, and consider dobutamine stress echo or CT calcium score.',
        avaR > 1.0 && severeGradient && 'Discordant grading: gradient in the severe range with AVA above 1.0 cm². Re-check the LVOT diameter and consider high-flow states (e.g. aortic regurgitation, anaemia).',
      ].filter(Boolean),
      interpretation: [
        'AVA = π × (LVOT diameter / 2)² × LVOT VTI / AV VTI.',
        'Grade aortic stenosis by integrating all parameters (velocity, gradient, AVA, flow, valve morphology), never from one number.',
        lowFlow && 'Stroke volume index ≤35 mL/m² indicates low flow, which lowers gradients.',
      ].filter(Boolean),
      tables: [table('Aortic stenosis grading', ['Grade', 'Vmax m/s', 'Mean mmHg', 'AVA cm²', 'AVAi cm²/m²'], [
        ['Mild', '2.6–2.9', '<20', '>1.5', '>0.85'], ['Moderate', '3.0–3.9', '20–39', '1.0–1.5', '0.60–0.85'], ['Severe', '≥4.0', '≥40', '≤1.0', '≤0.6'],
      ], [row], 'ESC/EACTS 2025 and ACC/AHA 2020 (ACC/AHA mild Vmax 2.0–2.9). Very severe: Vmax ≥5 m/s or mean ≥60 mmHg. Velocity ratio: >0.50 mild, 0.25–0.50 moderate, ≤0.25 severe.')],
    });
  },
  notes: [
    'Low-flow AS: stroke volume index ≤35 mL/m². Calcium score favouring severe AS: >1200 AU in women, >2000 AU in men (ESC 2025).',
    'Measure the LVOT diameter and VTI at the same level.',
    EDU,
  ],
  references: [
    ref('Praz F et al. 2025 ESC/EACTS Guidelines for the management of valvular heart disease. Eur Heart J 2025.'),
    ref('Otto CM et al. 2020 ACC/AHA Guideline for the management of patients with valvular heart disease. Circulation 2021;143:e72-e227.', 'https://pubmed.ncbi.nlm.nih.gov/33332150/'),
    ref('Baumgartner H et al. Recommendations on the echocardiographic assessment of aortic valve stenosis: a focused update from the EACVI and ASE. J Am Soc Echocardiogr 2017;30:372-92.', 'https://pubmed.ncbi.nlm.nih.gov/28385280/'),
  ],
};

/* ═════════════════ LV mass ═════════════════ */

const DIM_UNITS = () => [
  unit('cm', 'cm', 0.3, 10, { decimals: 2, hint: 'Values above 10 look like millimetres — switch the unit.' }),
  unit('mm', 'mm', 3, 100, { decimals: 0, factor: 0.1 }),
];
const GEOMETRY = [['Normal geometry', 'Normal', '≤0.42'], ['Concentric remodelling', 'Normal', '>0.42'], ['Eccentric hypertrophy', 'Increased', '≤0.42'], ['Concentric hypertrophy', 'Increased', '>0.42']];

const lvMass = {
  id: 'lvmass',
  name: 'LV mass & geometry',
  category: 'Echocardiography',
  summary: 'Linear (cube) LV mass, LV mass index and relative wall thickness, with ASE/EACVI geometry class.',
  version: 'ASE/EACVI 2015 chamber quantification',
  keywords: ['lvh', 'hypertrophy', 'echo', 'rwt', 'lv mass', 'remodelling', 'devereux'],
  fields: [
    number('lvidd', 'LV internal diameter, diastole (LVIDd)', DIM_UNITS(), { unitGroup: 'dims' }),
    number('ivsd', 'Septal wall thickness, diastole (IVSd)', DIM_UNITS(), { unitGroup: 'dims' }),
    number('pwd', 'Posterior wall thickness, diastole (PWd)', DIM_UNITS(), { unitGroup: 'dims' }),
    sexField,
    number('bsa', 'Body surface area', [unit('m2', 'm²', 0.5, 3.5, { decimals: 2 })], { help: 'From the echo report, or use the BMI & BSA calculator.' }),
  ],
  compute(v) {
    const lvidd = v.number('lvidd'), ivsd = v.number('ivsd'), pwd = v.number('pwd'), bsa = v.number('bsa');
    const female = v.choice('sex') === 'female';
    if (lvidd < 2 || ivsd > lvidd || pwd > lvidd) return blocked('LV mass', 'These dimensions are not plausible together. Check that all three use the same unit.');
    const mass = lvMassAse(lvidd, ivsd, pwd);
    const lvmi = roundHalfUp(mass / bsa, 0);
    const rwt = roundHalfUp(relativeWallThickness(pwd, lvidd), 2);
    const lvh = lvmi > (female ? 95 : 115);
    const thick = rwt > 0.42;
    const row = (lvh ? 2 : 0) + (thick ? 1 : 0);
    return result({
      value: fmt(mass), unit: 'g', valueLabel: 'LV mass', band: GEOMETRY[row][0],
      tone: lvh ? 'high' : thick ? 'moderate' : 'low',
      extra: [
        line('LV mass index', fmt(lvmi) + ' g/m²', { emphasis: true, note: 'Upper normal ' + (female ? '95 (women)' : '115 (men)') + ' g/m²' }),
        line('Relative wall thickness', fmt(rwt, 2), { note: 'Cut-off 0.42' }),
      ],
      warnings: [
        ivsd >= 1.5 && ivsd / pwd >= 1.3 && 'Septum is much thicker than the posterior wall (asymmetric hypertrophy). The cube formula assumes symmetric walls; consider other causes such as HCM.',
      ].filter(Boolean),
      interpretation: [
        'LV mass = 0.8 × 1.04 × [(LVIDd + IVSd + PWd)³ − LVIDd³] + 0.6 g.',
        'LV hypertrophy: LV mass index above 115 g/m² in men or 95 g/m² in women. RWT = 2 × PWd / LVIDd.',
      ],
      tables: [table('LV geometry (ASE/EACVI 2015)', ['Pattern', 'LV mass index', 'RWT'], GEOMETRY, [row])],
    });
  },
  notes: [
    'Enter all three dimensions in the same unit, measured at end-diastole in the parasternal long-axis view.',
    'Linear methods assume a normal LV shape; they are less accurate with distorted ventricles or regional wall-motion abnormalities.',
    EDU,
  ],
  references: [
    ref('Lang RM et al. Recommendations for cardiac chamber quantification by echocardiography in adults: an update from the ASE and EACVI. J Am Soc Echocardiogr 2015;28:1-39.', 'https://pubmed.ncbi.nlm.nih.gov/25559473/'),
    ref('Devereux RB et al. Echocardiographic assessment of left ventricular hypertrophy: comparison to necropsy findings. Am J Cardiol 1986;57:450-8.', 'https://pubmed.ncbi.nlm.nih.gov/2936235/'),
  ],
};

/* ═════════════════ BMI & BSA ═════════════════ */

const INDIAN = [['<18.5', 'Underweight'], ['18.5–22.9', 'Normal'], ['23.0–24.9', 'Grade I'], ['25.0–27.5', 'Grade II'], ['27.6–32.4', 'Grade III'], ['≥32.5', 'Grade IV']];
const WHO = [['<18.5', 'Underweight'], ['18.5–24.9', 'Normal'], ['25.0–29.9', 'Overweight'], ['30.0–34.9', 'Obesity class I'], ['35.0–39.9', 'Obesity class II'], ['≥40.0', 'Obesity class III']];

export function indianBmiRow(b) {
  if (b < 18.5) return 0;
  if (b < 23) return 1;
  if (b < 25) return 2;
  if (b < 27.6) return 3;
  if (b < 32.5) return 4;
  return 5;
}

export function whoBmiRow(b) {
  if (b < 18.5) return 0;
  if (b < 25) return 1;
  if (b < 30) return 2;
  if (b < 35) return 3;
  if (b < 40) return 4;
  return 5;
}

const bmiBsa = {
  id: 'bmi',
  name: 'BMI & body surface area',
  category: 'General',
  summary: 'Body mass index with Indian (2025) or WHO classes, body surface area, and waist-based markers.',
  version: 'Indian consensus 2025 / WHO; Mosteller and Du Bois BSA',
  keywords: ['bmi', 'bsa', 'obesity', 'weight', 'height', 'waist', 'mosteller'],
  fields: [
    weightField(),
    heightField(),
    choice('framework', 'Classification', [opt('india', 'Indian 2025'), opt('who', 'WHO')],
      { help: 'Indian cut-offs are lower than WHO because of higher cardiometabolic risk at lower BMI.', initial: 'india' }),
    choice('sex', 'Sex (optional)', [opt('male', 'Male'), opt('female', 'Female')], { help: 'Only needed for the waist circumference cut-off.', required: false }),
    number('waist', 'Waist circumference (optional)', [unit('cm', 'cm', 40, 250, { decimals: 0 }), unit('in', 'in', 16, 98, { factor: cmPerInch })],
      { help: 'Measured midway between the lowest rib and the iliac crest.', required: false }),
  ],
  compute(v) {
    const w = v.number('weight'), h = v.number('height');
    const indian = (v.choice('framework') || 'india') === 'india';
    const value = roundHalfUp(bmi(w, h), 1);
    const row = indian ? indianBmiRow(value) : whoBmiRow(value);
    const rows = indian ? INDIAN : WHO;
    const waist = v.number('waist');
    const sex = v.choice('sex');
    const whtr = waist == null ? null : waist / h;
    const waistLimit = sex == null ? null : sex === 'female' ? 80 : 90;
    const highWaist = waist != null && waistLimit != null && roundHalfUp(waist, 0) >= waistLimit;
    const highWhtr = whtr != null && roundHalfUp(whtr, 2) > 0.5;
    return result({
      value: fmt(value, 1), unit: 'kg/m²', valueLabel: 'Body mass index',
      band: indian && row >= 2 ? `BMI ${rows[row][1]} (Indian 2025)` : rows[row][1],
      tone: row === 1 ? 'low' : row === 0 || row === 2 ? 'moderate' : 'high',
      extra: [line('BSA (Mosteller)', fmt(bsaMosteller(w, h), 2) + ' m²', { emphasis: true }), line('BSA (Du Bois)', fmt(bsaDuBois(w, h), 2) + ' m²')]
        .concat(whtr != null ? [line('Waist-to-height ratio', fmt(whtr, 2), { note: highWhtr ? 'Above 0.5' : '0.5 or below' })] : [])
        .concat(waist != null && waistLimit != null ? [line('Waist circumference', fmt(waist) + ' cm', { note: (highWaist ? 'At or above' : 'Below') + ` the ${fmt(waistLimit)} cm cut-off` })] : []),
      interpretation: [
        indian
          ? 'The 2025 Indian definition uses BMI above 23 kg/m² as the entry point for obesity. Stage 1: no functional limitation or obesity-related disease. Stage 2: raised waist or waist-to-height ratio plus symptoms that limit daily activity, or an obesity-related disease.'
          : 'WHO classes are for general populations; Asian Indians carry higher cardiometabolic risk at lower BMI.',
        (highWaist || highWhtr) && 'Abdominal adiposity marker present (waist ≥90 cm men / ≥80 cm women, or waist-to-height ratio above 0.5).',
        waist == null && 'Add waist circumference (and sex) to check abdominal adiposity.',
        'BMI does not separate fat from muscle. Not for children, pregnancy, or marked oedema.',
      ].filter(Boolean),
      tables: [table(indian ? 'BMI classes — Indian 2025 (kg/m²)' : 'BMI classes — WHO (kg/m²)', ['BMI', 'Class'], rows, [row],
        indian ? 'Revised definition of obesity in Asian Indians, 2025. Abdominal cut-offs: waist ≥90 cm men, ≥80 cm women; waist-to-height ratio >0.5.' : null)],
    });
  },
  notes: [
    'BMI = weight (kg) / height (m)².',
    'BSA: Mosteller √(height cm × weight kg / 3600); Du Bois 0.007184 × weight^0.425 × height^0.725.',
    EDU,
  ],
  references: [
    ref('Revised definition of obesity in Asian Indians living in India. Diabetes Metab Syndr 2025.', 'https://doi.org/10.1016/j.dsx.2024.102989'),
    ref('WHO Expert Consultation. Appropriate body-mass index for Asian populations and its implications for policy and intervention strategies. Lancet 2004;363:157-63.', 'https://pubmed.ncbi.nlm.nih.gov/14726171/'),
    ref('Mosteller RD. Simplified calculation of body-surface area. N Engl J Med 1987;317:1098.', 'https://pubmed.ncbi.nlm.nih.gov/3657876/'),
    ref('Du Bois D, Du Bois EF. A formula to estimate the approximate surface area if height and weight be known. Arch Intern Med 1916;17:863-71.', 'https://pubmed.ncbi.nlm.nih.gov/2520314/'),
  ],
};

/** In list order; categories appear in the order of their first calculator. */
export const CALCULATORS = [cha2ds2va, hasBled, arcHbr, jCto, qtc, dukeTreadmill, kidneyFunction, ldlCholesterol, aorticValveArea, lvMass, bmiBsa];

export const byId = (id) => CALCULATORS.find((c) => c.id === id) || null;

/** Value accessor handed to compute(); numbers already in base units. */
export function makeValues(values, units = {}) {
  return {
    flag: (id) => values[id] === true,
    choice: (id) => values[id] ?? null,
    number: (id) => (typeof values[id] === 'number' ? values[id] : null),
    unitOf: (id) => units[id] || null,
  };
}

/** Defaults the screen starts from: switches off, choices at their initial value. */
export function defaults(def) {
  const out = {};
  def.fields.forEach((f) => { out[f.id] = f.type === 'bool' ? false : f.type === 'choice' ? f.initial : null; });
  return out;
}
