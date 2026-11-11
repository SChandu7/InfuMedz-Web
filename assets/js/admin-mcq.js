/* InfuMedz admin - Daily MCQ manager (website).
 *
 * Same features as the app's admin screens (lib/features/daily_mcq/admin_*):
 * every question with its status and answer stats, and a form-style editor:
 * question, topic, image, answer type (one answer / several / typed),
 * options with correct marks, accepted typed answers, explanation, publish
 * now or schedule, how long it stays open, a linked course or book shown
 * after answering, and the "notify subscribers" switch. Backend: daily_mcq.py.
 */

import { api } from './api.js';
import { fmt, toast } from './ui.js';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => fmt.esc(s == null ? '' : String(s));

const WINDOWS = [[12, '12 hours'], [24, '24 hours'], [48, '2 days'], [168, '7 days']];
const STATUS = {
  live: ['LIVE', 'bg-ok/10 text-ok'],
  scheduled: ['SCHEDULED', 'bg-chip text-primary'],
  closed: ['CLOSED', 'bg-canvas text-ink-muted'],
  hidden: ['HIDDEN', 'bg-canvas text-ink-muted'],
};
const TYPE_LABEL = { single: 'One answer', multiple: 'Multiple answers', text: 'Text answer' };

let editorDirty = false;
export function canLeaveMcq() {
  if (!editorDirty) return true;
  if (!confirm('You have an unsaved question. Leave without saving?')) return false;
  editorDirty = false;
  return true;
}

function when(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "2026-11-12T09:30" for <input type=datetime-local>, in local time. */
function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* ═════════════════ list ═════════════════ */

export async function renderMcqAdmin(panel, H) {
  editorDirty = false;
  const data = await api.admin.mcqList(H());
  const items = data.items || [];
  let filter = 'all';

  const latestPublish = () => {
    const t = items.filter((m) => m.status !== 'hidden').map((m) => new Date(m.publish_at).getTime());
    return t.length ? new Date(Math.max(...t)) : null;
  };

  function draw() {
    const count = (s) => items.filter((m) => m.status === s).length;
    const shown = items.filter((m) => filter === 'all' || m.status === filter);
    panel.innerHTML =
      '<div class="grid gap-4 sm:grid-cols-4">' +
        [['Live now', count('live')], ['Scheduled', count('scheduled')], ['Total', items.length], ['Subscribers', data.subscribers || 0]]
          .map(([l, v]) => '<div class="card p-4"><p class="text-xs font-semibold uppercase tracking-wider text-ink-muted">' + l + '</p><p class="mt-1 text-2xl font-black text-navy">' + v + '</p></div>').join('') +
      '</div>' +
      '<div class="mt-5 flex flex-wrap items-center justify-between gap-3">' +
        '<div class="flex flex-wrap gap-2">' +
          [['all', 'All'], ['live', 'Live'], ['scheduled', 'Scheduled'], ['closed', 'Closed'], ['hidden', 'Hidden']].map(([id, l]) =>
            '<button class="rounded-full border px-3.5 py-1.5 text-sm font-semibold ' + (filter === id ? 'border-primary bg-primary text-white' : 'border-line bg-white text-navy hover:border-primary/40') + '" data-filter="' + id + '">' + l + '</button>').join('') +
        '</div>' +
        '<button class="btn-primary btn-sm" data-new>+ New question</button>' +
      '</div>' +
      '<div class="mt-4 space-y-3">' + (shown.length ? shown.map(card).join('') :
        '<div class="card p-10 text-center text-sm text-ink-muted">No questions here yet. Click "New question" to add one.</div>') + '</div>';

    $$('[data-filter]', panel).forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; draw(); }));
    $('[data-new]', panel).addEventListener('click', () => openEditor(panel, H, null, false, latestPublish()));
    $$('[data-edit]', panel).forEach((b) => b.addEventListener('click', () => openEditor(panel, H, items.find((m) => m.id === b.dataset.edit), false, latestPublish())));
    $$('[data-dup]', panel).forEach((b) => b.addEventListener('click', () => openEditor(panel, H, items.find((m) => m.id === b.dataset.dup), true, latestPublish())));
    $$('[data-hide]', panel).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Hide this question? Users will no longer see it, today or in past questions. Its answers and stats are kept.')) return;
      try { await api.admin.mcqHide(b.dataset.hide, H()); toast('Question hidden.', 'success'); renderMcqAdmin(panel, H); }
      catch (e) { toast(e.message || 'Could not hide.', 'error'); }
    }));
    $$('[data-announce]', panel).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Send "New Daily MCQ" again to all ' + (data.subscribers || 0) + ' subscribed user(s)?')) return;
      b.disabled = true;
      try { const r = await api.admin.mcqAnnounce(b.dataset.announce, H()); toast(r.message || 'Sent.', 'success'); renderMcqAdmin(panel, H); }
      catch (e) { b.disabled = false; toast(e.message || 'Could not send.', 'error'); }
    }));
  }

  function card(m) {
    const [label, cls] = STATUS[m.status] || STATUS.closed;
    const c = m.crowd || {};
    return '<div class="card p-4 ' + (m.status === 'live' ? 'ring-1 ring-ok/40' : '') + '">' +
      '<div class="flex flex-wrap items-center gap-2">' +
        '<span class="badge ' + cls + '">' + label + '</span>' +
        '<span class="text-xs text-ink-muted">' + esc(TYPE_LABEL[m.question_type] || '') + (m.topic ? ' · ' + esc(m.topic) : '') + '</span>' +
        '<span class="ml-auto flex flex-wrap gap-1">' +
          '<button class="btn-ghost btn-sm" data-edit="' + esc(m.id) + '">Edit</button>' +
          '<button class="btn-ghost btn-sm" data-dup="' + esc(m.id) + '">Duplicate</button>' +
          (m.status === 'live' ? '<button class="btn-ghost btn-sm" data-announce="' + esc(m.id) + '">Notify again</button>' : '') +
          (m.status !== 'hidden' ? '<button class="rounded-lg px-3 py-1.5 text-sm font-medium text-bad hover:bg-bad/5" data-hide="' + esc(m.id) + '">Hide</button>' : '') +
        '</span>' +
      '</div>' +
      '<p class="mt-2 font-semibold text-navy">' + esc(m.question) + '</p>' +
      '<p class="mt-1.5 text-xs text-ink-muted">' + when(m.publish_at) + ' → ' + when(m.expires_at) +
        (m.notify_on_publish ? ' · ' + (m.notified_at ? 'notified ' + when(m.notified_at) : 'notification sent when it goes live') : '') + '</p>' +
      '<p class="mt-1 text-sm font-semibold text-primary">' + (c.total ? c.total + ' answer' + (c.total === 1 ? '' : 's') + (c.percent_correct != null ? ' · ' + c.percent_correct + '% correct' : '') : 'No answers yet') + '</p>' +
    '</div>';
  }

  draw();
}

/* ═════════════════ editor ═════════════════ */

async function openEditor(panel, H, existing, duplicate, lastPublish) {
  const isEdit = !!existing && !duplicate;
  const [courses, books] = await Promise.all([api.courses().catch(() => []), api.books().catch(() => [])]);

  const st = {
    question: existing ? existing.question : '',
    topic: existing ? existing.topic || '' : '',
    image: existing ? existing.image_url || '' : '',
    type: existing ? existing.question_type : 'single',
    options: existing && existing.question_type !== 'text'
      ? existing.options.map((o) => ({ id: duplicate ? null : o.id, text: o.text, correct: existing.correct_options.includes(o.id) }))
      : [{ text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }],
    accepted: existing ? (existing.accepted_answers || []).slice() : [],
    explanation: existing ? existing.explanation || '' : '',
    notify: existing ? !!existing.notify_on_publish : true,
    related: existing && existing.related_course_id ? 'course:' + existing.related_course_id : existing && existing.related_book_id ? 'book:' + existing.related_book_id : '',
    publishNow: !isEdit,
    publishAt: new Date(),
    windowHours: 24,
    customClose: null,
  };
  if (existing) {
    const span = (new Date(existing.expires_at) - new Date(existing.publish_at)) / 3600000;
    if (WINDOWS.some(([h]) => h === span)) st.windowHours = span; else st.customClose = new Date(existing.expires_at);
    if (isEdit) st.publishAt = new Date(existing.publish_at);
  }
  if (!isEdit) {
    // Daily rhythm: the day after the last scheduled question, same time.
    const next = lastPublish ? new Date(lastPublish.getTime() + 86400000) : null;
    if (next && next > new Date()) { st.publishNow = false; st.publishAt = next; }
    if (duplicate) st.customClose = null;
  }
  const answers = isEdit && existing.crowd ? existing.crowd.total : 0;
  editorDirty = false;
  const dirty = () => { editorDirty = true; };

  const closeAt = () => st.customClose || new Date((st.publishNow ? Date.now() : st.publishAt.getTime()) + st.windowHours * 3600000);

  function optionsHtml() {
    const multi = st.type === 'multiple';
    return '<p class="text-xs text-ink-muted">' + (multi ? 'Tick every correct option.' : 'Choose the one correct option.') + '</p>' +
      '<div class="mt-2 space-y-2">' + st.options.map((o, i) =>
        '<div class="flex items-center gap-2">' +
          '<button type="button" class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border ' + (o.correct ? 'border-ok bg-ok/10 text-ok' : 'border-line text-ink-muted') + '" data-correct="' + i + '" title="Mark correct" aria-label="Mark option ' + String.fromCharCode(65 + i) + ' correct">' +
            (o.correct ? '✓' : (multi ? '☐' : '○')) + '</button>' +
          '<input class="field" data-opt-text="' + i + '" placeholder="Option ' + String.fromCharCode(65 + i) + '" value="' + esc(o.text) + '">' +
          '<button type="button" class="rounded p-2 text-ink-soft hover:bg-chip disabled:opacity-30" data-opt-up="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button>' +
          '<button type="button" class="rounded p-2 text-ink-soft hover:bg-chip disabled:opacity-30" data-opt-down="' + i + '"' + (i === st.options.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button>' +
          '<button type="button" class="rounded p-2 text-bad hover:bg-bad/5 disabled:opacity-30" data-opt-del="' + i + '"' + (st.options.length <= 2 ? ' disabled' : '') + ' aria-label="Remove">×</button>' +
        '</div>').join('') + '</div>' +
      (st.options.length < 8 ? '<button type="button" class="mt-2 text-sm font-semibold text-primary hover:underline" data-opt-add>+ Add option</button>' : '');
  }

  function acceptedHtml() {
    return '<p class="text-xs text-ink-muted">Answers counted as correct. Capitals, spaces and punctuation are ignored. Leave empty to collect answers without marking them right or wrong.</p>' +
      '<div class="mt-2 flex gap-2"><input class="field" data-acc-input placeholder="e.g. Digoxin immune fab"><button type="button" class="btn-ghost btn-sm" data-acc-add>Add</button></div>' +
      '<div class="mt-2 flex flex-wrap gap-2">' + st.accepted.map((a, i) =>
        '<span class="badge-cat">' + esc(a) + ' <button type="button" class="ml-1" data-acc-del="' + i + '" aria-label="Remove">×</button></span>').join('') + '</div>';
  }

  function scheduleHtml() {
    return (isEdit ? '' :
      '<div class="flex flex-wrap gap-2">' +
        '<button type="button" class="rounded-full border px-3.5 py-1.5 text-sm font-semibold ' + (st.publishNow ? 'border-primary bg-primary text-white' : 'border-line bg-white text-navy') + '" data-pub="now">Publish now</button>' +
        '<button type="button" class="rounded-full border px-3.5 py-1.5 text-sm font-semibold ' + (!st.publishNow ? 'border-primary bg-primary text-white' : 'border-line bg-white text-navy') + '" data-pub="later">Schedule</button>' +
      '</div>') +
      (!st.publishNow ? '<div class="mt-3"><label class="label" for="mq-pub">Goes live</label><input id="mq-pub" type="datetime-local" class="field max-w-xs" value="' + toLocalInput(st.publishAt) + '"></div>' : '') +
      '<p class="label mt-3">Open for</p><div class="flex flex-wrap gap-2">' +
        WINDOWS.map(([h, l]) => '<button type="button" class="rounded-full border px-3.5 py-1.5 text-sm font-semibold ' + (!st.customClose && st.windowHours === h ? 'border-primary bg-primary text-white' : 'border-line bg-white text-navy') + '" data-win="' + h + '">' + l + '</button>').join('') +
        '<button type="button" class="rounded-full border px-3.5 py-1.5 text-sm font-semibold ' + (st.customClose ? 'border-primary bg-primary text-white' : 'border-line bg-white text-navy') + '" data-win="custom">Custom</button>' +
      '</div>' +
      (st.customClose ? '<div class="mt-3"><label class="label" for="mq-close">Closes</label><input id="mq-close" type="datetime-local" class="field max-w-xs" value="' + toLocalInput(st.customClose) + '"></div>' : '') +
      '<p class="mt-3 text-sm font-semibold text-navy">Closes ' + closeAt().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + '</p>';
  }

  const section = (title, inner) => '<div class="card p-5"><h3 class="text-base">' + title + '</h3><div class="mt-3">' + inner + '</div></div>';

  function draw() {
    panel.innerHTML =
      '<button class="mb-4 text-sm font-medium text-ink-muted hover:text-primary" data-back>&larr; Back to Daily MCQs</button>' +
      (answers ? '<div class="mb-4 rounded-xl2 border border-warn/40 bg-warn/10 p-3 text-sm text-navy">' + answers + ' user(s) have answered. If you change the correct answer, their results are re-marked automatically.</div>' : '') +
      '<div class="grid gap-4 xl:grid-cols-2">' +
        '<div class="space-y-4">' +
          section('Question',
            '<textarea class="field" rows="4" data-q placeholder="Type the question">' + esc(st.question) + '</textarea>' +
            '<input class="field mt-3" data-topic placeholder="Topic (optional), e.g. ECG, Heart failure" value="' + esc(st.topic) + '">' +
            '<div class="mt-3" data-image-box>' + (st.image
              ? '<div class="flex items-center gap-3"><img src="' + esc(st.image) + '" alt="" class="h-16 w-24 rounded-lg object-cover"><label class="btn-ghost btn-sm cursor-pointer">Change<input type="file" accept="image/*" class="hidden" data-img></label><button type="button" class="text-sm font-medium text-bad" data-img-del>Remove</button></div>'
              : '<label class="btn-ghost btn-sm cursor-pointer">Add an image (ECG, echo, X-ray…)<input type="file" accept="image/*" class="hidden" data-img></label>') + '</div>') +
          section('Answer type',
            '<div class="grid grid-cols-3 gap-2">' + [['single', 'One answer'], ['multiple', 'Several answers'], ['text', 'Typed answer']].map(([t, l]) =>
              '<button type="button" class="rounded-xl border px-2 py-3 text-sm font-bold ' + (st.type === t ? 'border-primary bg-chip text-primary' : 'border-line bg-white text-ink-soft') + '" data-type="' + t + '">' + l + '</button>').join('') + '</div>' +
            '<div class="mt-4" data-answers>' + (st.type === 'text' ? acceptedHtml() : optionsHtml()) + '</div>') +
        '</div>' +
        '<div class="space-y-4">' +
          section('Explanation', '<textarea class="field" rows="6" data-expl placeholder="Shown after answering: why the answer is correct">' + esc(st.explanation) + '</textarea>') +
          section('Schedule', '<div data-schedule>' + scheduleHtml() + '</div>') +
          section('After answering, promote',
            '<p class="text-xs text-ink-muted">Shown under the explanation as "Master this topic".</p>' +
            '<select class="field mt-2" data-related><option value="">Nothing</option>' +
              courses.map((c) => '<option value="course:' + esc(c.id) + '"' + (st.related === 'course:' + c.id ? ' selected' : '') + '>Course · ' + esc(c.title) + '</option>').join('') +
              books.map((b) => '<option value="book:' + esc(b.id) + '"' + (st.related === 'book:' + b.id ? ' selected' : '') + '>Book · ' + esc(b.title) + '</option>').join('') +
            '</select>') +
          section('Notifications',
            '<label class="flex cursor-pointer items-start gap-3"><input type="checkbox" class="mt-1 h-4 w-4" data-notify' + (st.notify ? ' checked' : '') + '>' +
            '<span><span class="block text-sm font-semibold text-navy">Notify subscribers when it goes live</span><span class="block text-xs text-ink-muted">Sent once, to users who turned on Daily MCQ notifications.</span></span></label>') +
        '</div>' +
      '</div>' +
      '<div class="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 py-4 backdrop-blur">' +
        '<button class="btn-primary" data-save>' + (isEdit ? 'Save changes' : st.publishNow ? 'Publish now' : 'Schedule') + '</button>' +
        '<span class="text-sm text-ink-muted" data-save-note></span>' +
      '</div>';
    wire();
  }

  function redrawAnswers() { $('[data-answers]', panel).innerHTML = st.type === 'text' ? acceptedHtml() : optionsHtml(); wireAnswers(); }
  function redrawSchedule() {
    $('[data-schedule]', panel).innerHTML = scheduleHtml();
    $('[data-save]', panel).textContent = isEdit ? 'Save changes' : st.publishNow ? 'Publish now' : 'Schedule';
    wireSchedule();
  }

  function wireAnswers() {
    $$('[data-correct]', panel).forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.correct);
      if (st.type === 'multiple') st.options[i].correct = !st.options[i].correct;
      else st.options.forEach((o, j) => { o.correct = j === i; });
      dirty(); redrawAnswers();
    }));
    $$('[data-opt-text]', panel).forEach((inp) => inp.addEventListener('input', () => { st.options[Number(inp.dataset.optText)].text = inp.value; dirty(); }));
    const move = (i, d) => { const o = st.options.splice(i, 1)[0]; st.options.splice(i + d, 0, o); dirty(); redrawAnswers(); };
    $$('[data-opt-up]', panel).forEach((b) => b.addEventListener('click', () => move(Number(b.dataset.optUp), -1)));
    $$('[data-opt-down]', panel).forEach((b) => b.addEventListener('click', () => move(Number(b.dataset.optDown), 1)));
    $$('[data-opt-del]', panel).forEach((b) => b.addEventListener('click', () => { st.options.splice(Number(b.dataset.optDel), 1); dirty(); redrawAnswers(); }));
    const add = $('[data-opt-add]', panel);
    if (add) add.addEventListener('click', () => { st.options.push({ text: '', correct: false }); dirty(); redrawAnswers(); });
    const accAdd = () => {
      const inp = $('[data-acc-input]', panel);
      const v = inp.value.trim();
      if (v && !st.accepted.some((a) => a.toLowerCase() === v.toLowerCase())) st.accepted.push(v);
      dirty(); redrawAnswers();
    };
    const ab = $('[data-acc-add]', panel);
    if (ab) {
      ab.addEventListener('click', accAdd);
      $('[data-acc-input]', panel).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); accAdd(); } });
    }
    $$('[data-acc-del]', panel).forEach((b) => b.addEventListener('click', () => { st.accepted.splice(Number(b.dataset.accDel), 1); dirty(); redrawAnswers(); }));
  }

  function wireSchedule() {
    $$('[data-pub]', panel).forEach((b) => b.addEventListener('click', () => {
      st.publishNow = b.dataset.pub === 'now';
      if (!st.publishNow && st.publishAt <= new Date()) st.publishAt = new Date(Date.now() + 3600000);
      dirty(); redrawSchedule();
    }));
    const pub = $('#mq-pub', panel);
    if (pub) pub.addEventListener('change', () => { if (pub.value) st.publishAt = new Date(pub.value); dirty(); redrawSchedule(); });
    $$('[data-win]', panel).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.win === 'custom') st.customClose = closeAt();
      else { st.windowHours = Number(b.dataset.win); st.customClose = null; }
      dirty(); redrawSchedule();
    }));
    const cl = $('#mq-close', panel);
    if (cl) cl.addEventListener('change', () => { if (cl.value) st.customClose = new Date(cl.value); dirty(); redrawSchedule(); });
  }

  function wire() {
    $('[data-back]', panel).addEventListener('click', () => { if (canLeaveMcq()) renderMcqAdmin(panel, H); });
    $('[data-q]', panel).addEventListener('input', (e) => { st.question = e.target.value; dirty(); });
    $('[data-topic]', panel).addEventListener('input', (e) => { st.topic = e.target.value; dirty(); });
    $('[data-expl]', panel).addEventListener('input', (e) => { st.explanation = e.target.value; dirty(); });
    $('[data-related]', panel).addEventListener('change', (e) => { st.related = e.target.value; dirty(); });
    $('[data-notify]', panel).addEventListener('change', (e) => { st.notify = e.target.checked; dirty(); });
    $$('[data-type]', panel).forEach((b) => b.addEventListener('click', () => {
      st.type = b.dataset.type;
      if (st.type === 'single') { let seen = false; st.options.forEach((o) => { if (o.correct && seen) o.correct = false; if (o.correct) seen = true; }); }
      dirty(); draw();
    }));
    const img = $('[data-img]', panel);
    img.addEventListener('change', async () => {
      const f = img.files[0];
      if (!f) return;
      $('[data-image-box]', panel).innerHTML = '<p class="text-sm text-ink-muted">Uploading image…</p>';
      try {
        const fd = new FormData();
        fd.append('thumbnail', f);
        const up = await api.admin.uploadThumbnail(fd, H());
        if (!up.thumbnail_url) throw new Error('The upload returned no link');
        st.image = up.thumbnail_url; dirty();
      } catch (e) { toast(e.message || 'Could not upload the image.', 'error'); }
      draw();
    });
    const del = $('[data-img-del]', panel);
    if (del) del.addEventListener('click', () => { st.image = ''; dirty(); draw(); });
    $('[data-save]', panel).addEventListener('click', save);
    wireAnswers();
    wireSchedule();
  }

  function validate() {
    if (!st.question.trim()) return 'Write the question.';
    if (st.type !== 'text') {
      const filled = st.options.filter((o) => o.text.trim());
      if (filled.length < 2) return 'Add at least two options.';
      if (new Set(filled.map((o) => o.text.trim().toLowerCase())).size !== filled.length) return 'Two options have the same text.';
      const correct = filled.filter((o) => o.correct).length;
      if (st.type === 'single' && correct !== 1) return 'Mark the one correct option.';
      if (st.type === 'multiple' && !correct) return 'Mark at least one correct option.';
      if (st.options.some((o) => o.correct && !o.text.trim())) return 'A correct option is empty.';
    }
    if (closeAt() <= (st.publishNow ? new Date() : st.publishAt)) return 'The close time must be after the publish time.';
    return null;
  }

  async function save(e) {
    const problem = validate();
    if (problem) return toast(problem, 'warn');
    const publish = st.publishNow ? new Date() : st.publishAt;
    const [rk, rid] = st.related ? st.related.split(':') : [null, null];
    const body = {
      question: st.question.trim(),
      question_type: st.type,
      topic: st.topic.trim(),
      image_url: st.image,
      explanation: st.explanation.trim(),
      options: st.type === 'text' ? [] : st.options.filter((o) => o.text.trim()).map((o) => Object.assign(o.id ? { id: o.id } : {}, { text: o.text.trim(), correct: o.correct })),
      accepted_answers: st.type === 'text' ? st.accepted : [],
      publish_at: publish.toISOString(),
      expires_at: closeAt().toISOString(),
      notify_on_publish: st.notify,
      related_course_id: rk === 'course' ? rid : null,
      related_book_id: rk === 'book' ? rid : null,
      is_active: true,
    };
    if (isEdit) body.id = existing.id;
    const btn = e.currentTarget;
    btn.disabled = true;
    $('[data-save-note]', panel).textContent = 'Saving…';
    try {
      const r = await api.admin.mcqSave(body, H());
      editorDirty = false;
      toast(r.notified && r.notified[0] ? 'Saved and sent to ' + r.notified[0] + ' device(s).' : publish > new Date(Date.now() + 60000) ? 'Scheduled.' : "Saved — it's live now.", 'success');
      renderMcqAdmin(panel, H);
    } catch (err) {
      btn.disabled = false;
      $('[data-save-note]', panel).textContent = '';
      toast(err.message || 'Could not save.', 'error');
    }
  }

  draw();
}
