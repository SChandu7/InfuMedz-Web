/* InfuMedz admin - MCQ quiz courses (website).
 *
 * Same features as the app's admin (lib/features/quiz/admin/*), plus a
 * paste-to-import for adding many questions at once. Backend: quiz_courses.py.
 *
 *   list      every quiz with status, questions, buyers, attempts, average
 *   quiz      Chapters (course -> chapters -> quizzes -> questions: add,
 *             order, move, per-quiz timer and free flag), Details (cover,
 *             price, category, scoring, linked course/book, publish),
 *             Import (paste text into a quiz), Access (grant 12 months)
 */

import { api } from './api.js';
import { fmt, toast } from './ui.js';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => fmt.esc(s == null ? '' : String(s));
const pct = (p) => (p == null ? '–' : (Number(p) % 1 === 0 ? Number(p).toFixed(0) : Number(p).toFixed(1)) + '%');
const TYPE_LABEL = { single: 'One answer', multiple: 'Several answers', text: 'Typed answer' };
const MAX_OPTIONS = 8;

let dirty = false;
export function canLeaveQuiz() {
  if (!dirty) return true;
  if (!confirm('You have unsaved changes. Leave without saving?')) return false;
  dirty = false;
  return true;
}

function guard() {
  if (!dirty) return true;
  if (!confirm('You have unsaved changes. Discard them?')) return false;
  dirty = false;
  return true;
}

async function upload(file, H) {
  const fd = new FormData();
  fd.append('thumbnail', file);
  const up = await api.admin.uploadThumbnail(fd, H());
  if (!up.thumbnail_url) throw new Error('The upload returned no link');
  return up.thumbnail_url;
}

/* ═════════════════ list ═════════════════ */

export async function renderQuizAdmin(panel, H) {
  dirty = false;
  const data = await api.admin.quizList(H());
  const items = data.items || [];
  const cats = data.categories || [];
  let filter = 'all';

  function draw() {
    const sum = (k) => items.reduce((a, q) => a + (q[k] || 0), 0);
    const shown = items.filter((q) => filter === 'all' || (filter === 'published' ? q.is_published : filter === 'draft' ? !q.is_published : String(q.category_id) === filter));
    panel.innerHTML =
      '<div class="grid gap-4 sm:grid-cols-4">' +
        [['Published', items.filter((q) => q.is_published).length + ' / ' + items.length], ['Questions', sum('question_count')], ['Buyers', sum('buyers_count')], ['Attempts', sum('attempts')]]
          .map(([l, v]) => '<div class="card p-4"><p class="text-xs font-semibold uppercase tracking-wider text-ink-muted">' + l + '</p><p class="mt-1 text-2xl font-black text-navy">' + v + '</p></div>').join('') +
      '</div>' +
      '<div class="mt-5 flex flex-wrap items-center justify-between gap-3"><div class="flex flex-wrap gap-2">' +
        [['all', 'All'], ['published', 'Published'], ['draft', 'Drafts']].concat(cats.map((c) => [String(c.id), c.name])).map(([id, l]) =>
          '<button class="rounded-full border px-3.5 py-1.5 text-sm font-semibold ' + (filter === id ? 'border-primary bg-primary text-white' : 'border-line bg-white text-navy hover:border-primary/40') + '" data-filter="' + esc(id) + '">' + esc(l) + '</button>').join('') +
      '</div><button class="btn-primary btn-sm" data-new>+ New quiz</button></div>' +
      '<div class="mt-4 space-y-3">' + (shown.length ? shown.map(row).join('') :
        '<div class="card p-10 text-center"><p class="font-bold text-navy">' + (items.length ? 'No quizzes match this filter.' : 'No quiz courses yet') + '</p>' +
        (items.length ? '' : '<p class="mt-1 text-sm text-ink-muted">Create a course, add chapters, quizzes and questions, then publish it. It appears on the website and in the app under MCQ Quizzes.</p>') + '</div>') + '</div>';
    $$('[data-filter]', panel).forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; draw(); }));
    $('[data-new]', panel).addEventListener('click', () => openQuiz(panel, H, null, cats));
    $$('[data-open]', panel).forEach((b) => b.addEventListener('click', () => openQuiz(panel, H, b.dataset.open, cats)));
  }

  function row(q) {
    return '<button class="card flex w-full items-center gap-4 p-4 text-left hover:shadow-lift" data-open="' + esc(q.id) + '">' +
      '<div class="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-chip">' + (q.thumbnail_url ? '<img src="' + esc(q.thumbnail_url) + '" alt="" class="h-full w-full object-cover">' : '') + '</div>' +
      '<div class="min-w-0 flex-1">' +
        '<div class="flex items-center gap-2"><p class="line-1 font-bold text-navy">' + esc(q.title) + '</p>' +
          '<span class="badge ' + (q.is_published ? 'bg-ok/10 text-ok' : 'bg-warn/15 text-ink') + '">' + (q.is_published ? 'PUBLISHED' : 'DRAFT') + '</span>' +
          (q.is_featured ? '<span class="badge bg-chip text-primary">ON HOME</span>' : '') + '</div>' +
        '<p class="mt-0.5 text-sm text-ink-muted">' + esc(q.category_name) + ' · ' + (Number(q.price) === 0 ? 'Free' : fmt.price(q.price)) + ' · ' + (q.chapter_count || q.section_count || 0) + ' chapters · ' + (q.quiz_count || 0) + ' quizzes · ' + q.question_count + ' questions' + '</p>' +
        '<p class="text-xs text-ink-muted">' + q.buyers_count + ' buyers · ' + q.attempts + ' attempts' + (q.avg_percent != null ? ' · average ' + pct(q.avg_percent) : '') + '</p>' +
      '</div><span class="text-ink-muted">›</span></button>';
  }

  draw();
}

/* ═════════════════ one quiz ═════════════════ */

async function openQuiz(panel, H, quizId, cats) {
  if (!guard()) return;
  let tab = quizId ? 'questions' : 'details';
  let D = null; // {quiz, sections, tests, questions, categories, courses, books}
  const openQuizzes = new Set();

  async function reload() {
    D = await api.admin.quizDetail(quizId, H());
    cats = D.categories || cats;
  }

  async function draw() {
    const q = D ? D.quiz : null;
    const tabs = [['questions', 'Chapters' + (D ? ' (' + D.sections.length + ')' : '')], ['details', 'Details'], ['import', 'Import'], ['access', 'Access']];
    panel.innerHTML =
      '<div class="flex flex-wrap items-center gap-3">' +
        '<button class="btn-ghost btn-sm" data-back>&larr; All quizzes</button>' +
        '<h2 class="line-1 min-w-0 flex-1 text-xl">' + esc(q ? q.title : 'New quiz') + '</h2>' +
        (q ? '<span class="badge ' + (q.is_published ? 'bg-ok/10 text-ok' : 'bg-warn/15 text-ink') + '">' + (q.is_published ? 'PUBLISHED' : 'DRAFT') + '</span>' +
          '<button class="btn-ghost btn-sm" data-publish>' + (q.is_published ? 'Unpublish' : 'Publish') + '</button>' +
          '<a class="btn-ghost btn-sm" target="_blank" href="../quiz.html?id=' + encodeURIComponent(q.id) + '">View page</a>' +
          '<button class="rounded-lg px-3 py-1.5 text-sm font-medium text-bad hover:bg-bad/5" data-delete>Delete</button>' : '') +
      '</div>' +
      '<div class="mt-4 flex gap-1 border-b border-line">' + tabs.map(([id, l]) =>
        '<button class="-mb-px border-b-2 px-4 py-2 text-sm font-semibold ' + (tab === id ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-navy') + '" data-tab="' + id + '"' + (!q && id !== 'details' ? ' disabled title="Save the details first"' : '') + '>' + l + '</button>').join('') + '</div>' +
      '<div class="mt-5" data-body></div>';
    $('[data-back]', panel).addEventListener('click', () => { if (guard()) renderQuizAdmin(panel, H); });
    $$('[data-tab]', panel).forEach((b) => b.addEventListener('click', () => { if (!b.disabled && guard()) { tab = b.dataset.tab; draw(); } }));
    if (q) {
      $('[data-publish]', panel).addEventListener('click', () => saveDetails({ is_published: !q.is_published }));
      $('[data-delete]', panel).addEventListener('click', async () => {
        if (!confirm('Delete "' + q.title + '"? It disappears from the catalogue and cannot be bought. Buyers keep their past results.')) return;
        try { await api.admin.quizDelete(q.id, H()); toast('Quiz deleted.', 'success'); dirty = false; renderQuizAdmin(panel, H); }
        catch (e) { toast(e.message || 'Could not delete.', 'error'); }
      });
    }
    const body = $('[data-body]', panel);
    if (tab === 'details') details(body);
    else if (tab === 'questions') questions(body);
    else if (tab === 'import') importer(body);
    else access(body);
  }

  /* ── details ── */

  async function saveDetails(overrides) {
    const q = D ? D.quiz : {};
    const f = $('[data-details]', panel);
    const val = (n) => (f ? f.elements[n].value : undefined);
    const body = f ? {
      title: val('title').trim(), subtitle: val('subtitle').trim(), category_id: Number(val('category_id')),
      price: val('price').trim() || '0', thumbnail_url: f.dataset.thumb || '',
      highlights: val('highlights').split('\n').map((s) => s.trim()).filter(Boolean),
      description: val('description').trim(), instructions: val('instructions').trim(),
      pass_percent: Number(val('pass_percent')), negative_mark: Number(val('negative_mark')),
      free_preview_count: Number(val('free_preview_count')),
      related_course_id: val('related_course_id') || null,
      related_book_id: val('related_book_id') || null,
      is_featured: f.elements.featured.checked,
    } : {
      title: q.title, subtitle: q.subtitle, category_id: q.category_id, price: q.price, thumbnail_url: q.thumbnail_url,
      highlights: q.highlights, description: q.description, instructions: q.instructions,
      pass_percent: q.pass_percent, negative_mark: q.negative_mark, free_preview_count: q.free_preview_count,
      related_course_id: q.related_course_id || null, related_book_id: q.related_book_id || null,
      is_featured: !!q.is_featured,
    };
    Object.assign(body, overrides || {});
    if (quizId) body.id = quizId;
    if (!('is_published' in body)) body.is_published = !!q.is_published;
    if (!body.title) return toast('Give the quiz a title.', 'warn');
    try {
      const r = await api.admin.quizSave(body, H());
      const isNew = !quizId;
      quizId = r.item.id;
      dirty = false;
      await reload();
      toast(isNew ? 'Course created. Now add chapters and quizzes.' : ('is_published' in (overrides || {}) ? (body.is_published ? 'Published.' : 'Unpublished.') : 'Saved.'), 'success');
      if (isNew) tab = 'questions';
      draw();
    } catch (e) { toast(e.message || 'Could not save.', 'error'); }
  }

  function details(body) {
    const q = D ? D.quiz : { pass_percent: 50, negative_mark: 0, free_preview_count: 2, highlights: [], price: '' };
    const sel = (name, opts, cur) => '<select class="field" name="' + name + '">' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
    const lab = (t, inner, hint) => '<label class="block"><span class="mb-1.5 block text-sm font-semibold text-navy">' + t + '</span>' + inner + (hint ? '<span class="mt-1 block text-xs text-ink-muted">' + hint + '</span>' : '') + '</label>';
    body.innerHTML =
      '<form class="grid gap-5 lg:grid-cols-[1fr_280px]" data-details data-thumb="' + esc(q.thumbnail_url || '') + '">' +
        '<div class="card space-y-4 p-5">' +
          lab('Title', '<input class="field" name="title" maxlength="255" value="' + esc(q.title || '') + '" placeholder="e.g. NEET-PG Cardiology Grand Test">') +
          lab('One-line summary', '<input class="field" name="subtitle" maxlength="255" value="' + esc(q.subtitle || '') + '" placeholder="e.g. 300 exam-level MCQs with explanations">') +
          '<div class="grid gap-4 sm:grid-cols-2">' +
            lab('Category', sel('category_id', cats.map((c) => [c.id, c.name]), q.category_id || (cats[0] && cats[0].id))) +
            lab('Price (₹)', '<input class="field" name="price" inputmode="decimal" value="' + esc(q.price === '' ? '' : q.price) + '" placeholder="499">', '0 = free') +
          '</div>' +
          lab('Highlights', '<textarea class="field" name="highlights" rows="4" placeholder="One per line">' + esc((q.highlights || []).join('\n')) + '</textarea>', 'Shown as bullet points on the quiz page (up to 8).') +
          lab('Description', '<textarea class="field" name="description" rows="6">' + esc(q.description || '') + '</textarea>') +
          lab('Instructions (optional)', '<textarea class="field" name="instructions" rows="3" placeholder="Leave empty for the standard text">' + esc(q.instructions || '') + '</textarea>') +
          '<div class="grid gap-4 sm:grid-cols-3">' +
            lab('Pass mark', sel('pass_percent', [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80].concat([q.pass_percent]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map((v) => [v, v + '%']), q.pass_percent)) +
            lab('Wrong answer', sel('negative_mark', [[0, 'No penalty'], [0.25, '−0.25 mark'], [0.33, '−0.33 mark'], [0.5, '−0.5 mark'], [1, '−1 mark']], Number(q.negative_mark))) +
            lab('Free sample questions', sel('free_preview_count', [0, 1, 2, 3, 4, 5].map((v) => [v, v === 0 ? 'None' : String(v)]), q.free_preview_count)) +
          '</div>' +
          '<label class="flex items-start gap-3 rounded-xl border border-line p-4"><input type="checkbox" name="featured" class="mt-1 h-4 w-4 accent-primary"' + (q.is_featured ? ' checked' : '') + '>' +
            '<span><span class="block text-sm font-semibold text-navy">Show in Popular Quizzes</span>' +
            '<span class="block text-xs text-ink-muted">Listed on the app and website home screens once published.</span></span></label>' +
          '<div class="rounded-xl border border-line p-4"><p class="text-sm font-semibold text-navy">Revise with MCQs</p>' +
            '<p class="text-xs text-ink-muted">Link this quiz course to a video course or book. It then shows on that page as "Revise with MCQs". Time limits are set per quiz in Chapters.</p>' +
            '<div class="mt-3 grid gap-4 sm:grid-cols-2">' +
              lab('Linked video course', sel('related_course_id', [['', 'None']].concat(((D && D.courses) || []).map((c) => [c.id, c.title])), q.related_course_id || '')) +
              lab('Linked book', sel('related_book_id', [['', 'None']].concat(((D && D.books) || []).map((b) => [b.id, b.title])), q.related_book_id || '')) +
            '</div>' +
          '</div>' +
          '<div class="flex justify-end"><button class="btn-primary" type="submit">' + (D ? 'Save details' : 'Create quiz') + '</button></div>' +
        '</div>' +
        '<div class="card h-fit p-5"><p class="text-sm font-semibold text-navy">Cover image</p>' +
          '<div class="mt-3 aspect-video overflow-hidden rounded-lg bg-chip" data-thumb-preview>' + (q.thumbnail_url ? '<img src="' + esc(q.thumbnail_url) + '" class="h-full w-full object-cover" alt="">' : '') + '</div>' +
          '<label class="btn-ghost btn-sm mt-3 w-full cursor-pointer">Upload image<input type="file" accept="image/*" class="hidden" data-thumb-file></label>' +
          '<p class="mt-2 text-xs text-ink-muted">16:9 works best. Without one, a plain branded panel is shown.</p></div>' +
      '</form>';
    const form = $('[data-details]', body);
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('submit', (e) => { e.preventDefault(); saveDetails(); });
    form.addEventListener('change', () => { dirty = true; });
    $('[data-thumb-file]', body).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const url = await upload(file, H);
        form.dataset.thumb = url; dirty = true;
        $('[data-thumb-preview]', body).innerHTML = '<img src="' + esc(url) + '" class="h-full w-full object-cover" alt="">';
      } catch (err) { toast(err.message || 'Upload failed.', 'error'); }
    });
  }

  /* ── chapters, quizzes, questions ── */

  const tests = () => D.tests || [];
  const chapterTitle = (sid) => ((D.sections.find((x) => x.id === sid) || {}).title || 'General');
  const testLabel = (t) => chapterTitle(t.section_id) + ' › ' + t.title;
  const mins = (m) => (m < 60 ? m + ' min' : (m % 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : (m / 60) + (m === 60 ? ' hour' : ' hours')));

  /* Quizzes in chapter order, then questions grouped quiz by quiz. */
  function orderedTests(sections, ts) {
    const ids = new Set(sections.map((x) => x.id));
    const out = [];
    sections.forEach((sec) => out.push(...ts.filter((t) => t.section_id === sec.id)));
    return out.concat(ts.filter((t) => !ids.has(t.section_id)));
  }
  function groupQuestions(ts, qs) {
    const ids = new Set(ts.map((t) => t.id));
    const out = [];
    ts.forEach((t) => out.push(...qs.filter((x) => x.test_id === t.id)));
    return out.concat(qs.filter((x) => !ids.has(x.test_id)));
  }

  async function arrange(sections, ts, qs) {
    const ot = orderedTests(sections, ts);
    try {
      await api.admin.quizArrange(quizId, {
        sections: sections.map((x) => x.id),
        tests: ot.map((t) => ({ id: t.id, section_id: t.section_id })),
        questions: groupQuestions(ot, qs).map((x) => ({ id: x.id, test_id: x.test_id || null, section_id: x.section_id || null })),
      }, H());
    } catch (e) { toast(e.message || 'Could not save the order.', 'error'); }
    await reload(); draw();
  }

  function questions(body) {
    const secs = D.sections, ts = orderedTests(secs, tests());
    const loose = D.questions.filter((x) => !ts.some((t) => t.id === x.test_id));
    const quizBlock = (t, ti, list) => {
      const qs = D.questions.filter((x) => x.test_id === t.id);
      const facts = [qs.length + ' question' + (qs.length === 1 ? '' : 's'), t.time_limit_minutes ? '⏱ ' + mins(t.time_limit_minutes) : 'No time limit', t.attempts ? t.attempts + ' attempts' : ''].filter(Boolean).join(' · ');
      return '<details class="border-t border-line" data-quiz="' + esc(t.id) + '"' + (openQuizzes.has(t.id) ? ' open' : '') + '>' +
        '<summary class="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-canvas">' +
          '<span class="text-ink-muted">▸</span>' +
          '<span class="flex-1 font-semibold text-navy">' + esc(t.title) + (t.is_free ? ' <span class="badge bg-ok/10 text-ok">FREE</span>' : '') +
            '<span class="block text-xs font-normal ' + (qs.length ? 'text-ink-muted' : 'text-warn') + '">' + esc(facts) + '</span></span>' +
          '<button class="btn-ghost btn-sm" data-tadd-q="' + esc(t.id) + '">+ Question</button>' +
          '<button class="btn-ghost btn-sm" data-tedit="' + esc(t.id) + '">Settings</button>' +
          (ti > 0 ? '<button class="btn-ghost btn-sm" data-tup="' + esc(t.id) + '" title="Move quiz up">↑</button>' : '') +
          (ti < list.length - 1 ? '<button class="btn-ghost btn-sm" data-tdown="' + esc(t.id) + '" title="Move quiz down">↓</button>' : '') +
          (secs.length > 1 ? '<select class="rounded-md border border-line px-1.5 py-1 text-xs" data-tmove="' + esc(t.id) + '" title="Move to chapter">' +
            secs.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === t.section_id ? ' selected' : '') + '>' + esc(x.title) + '</option>').join('') + '</select>' : '') +
          '<button class="rounded-lg px-2.5 py-1.5 text-sm text-bad hover:bg-bad/5" data-tdel="' + esc(t.id) + '">Delete</button>' +
        '</summary>' +
        '<div class="bg-canvas/40">' + (qs.length ? qs.map((x, i) => qrow(x, i + 1, i === 0, i === qs.length - 1)).join('') : '<p class="px-4 py-4 text-sm text-ink-muted">No questions yet.</p>') + '</div>' +
      '</details>';
    };
    const chapter = (sec, si) => {
      const list = ts.filter((t) => t.section_id === sec.id);
      return '<div class="card overflow-hidden">' +
        '<div class="flex flex-wrap items-center gap-2 bg-canvas px-4 py-2.5">' +
          '<p class="flex-1 font-bold text-navy">' + esc(sec.title) + ' <span class="font-normal text-ink-muted">· ' + list.length + ' quiz' + (list.length === 1 ? '' : 'zes') + '</span></p>' +
          '<button class="btn-ghost btn-sm" data-tnew="' + esc(sec.id) + '">+ Quiz</button>' +
          (si > 0 ? '<button class="btn-ghost btn-sm" data-sup="' + si + '" title="Move chapter up">↑</button>' : '') +
          (si < secs.length - 1 ? '<button class="btn-ghost btn-sm" data-sdown="' + si + '" title="Move chapter down">↓</button>' : '') +
          '<button class="btn-ghost btn-sm" data-srename="' + esc(sec.id) + '">Rename</button>' +
          '<button class="rounded-lg px-2.5 py-1.5 text-sm text-bad hover:bg-bad/5" data-sdel="' + esc(sec.id) + '">Remove</button>' +
        '</div>' +
        (list.length ? list.map((t, i) => quizBlock(t, i, list)).join('') : '<p class="border-t border-line px-4 py-4 text-sm text-ink-muted">No quizzes yet. <button class="font-semibold text-primary hover:underline" data-tnew="' + esc(sec.id) + '">Add the first quiz</button></p>') +
      '</div>';
    };
    body.innerHTML =
      '<div class="flex flex-wrap gap-2"><button class="btn-primary btn-sm" data-snew>+ Add chapter</button>' +
      (secs.length ? '<button class="btn-ghost btn-sm" data-tnew="">+ Add quiz</button><button class="btn-ghost btn-sm" data-goimport>Paste many questions</button>' : '') + '</div>' +
      '<p class="mt-2 text-xs text-ink-muted">Course › chapters › quizzes › questions. Buyers can retake every quiz as often as they like; each attempt is saved.</p>' +
      (!D.quiz.is_published ? '<p class="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-ink">Draft: students can\'t see this course yet. ' + (D.questions.length ? 'Publish it from the top bar when it\'s ready.' : 'Add a chapter, a quiz and its questions, then publish.') + '</p>' : '') +
      (loose.length ? '<p class="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-ink">' + loose.length + ' older question(s) aren\'t in a quiz yet. They\'re grouped into quizzes automatically when the server update runs.</p>' : '') +
      '<div class="mt-4 space-y-4">' + (secs.length ? secs.map(chapter).join('') : '<div class="card p-10 text-center"><p class="font-bold text-navy">No chapters yet</p><p class="mt-1 text-sm text-ink-muted">Add a chapter (e.g. "Ch 12 - Heart failure"), then add two or more quizzes to it.</p></div>') + '</div>';

    $$('details[data-quiz]', body).forEach((el) => el.addEventListener('toggle', () => { if (el.open) openQuizzes.add(el.dataset.quiz); else openQuizzes.delete(el.dataset.quiz); }));
    // Buttons inside <summary> must not toggle the quiz open/closed.
    $$('summary button, summary select', body).forEach((el) => el.addEventListener('click', (e) => e.preventDefault()));
    $('[data-snew]', body).addEventListener('click', () => sectionDialog());
    const gi = $('[data-goimport]', body);
    if (gi) gi.addEventListener('click', () => { tab = 'import'; draw(); });
    $$('[data-tnew]', body).forEach((b) => b.addEventListener('click', () => quizDialog(null, b.dataset.tnew || (secs[0] && secs[0].id))));
    $$('[data-tedit]', body).forEach((b) => b.addEventListener('click', () => quizDialog(tests().find((t) => t.id === b.dataset.tedit))));
    $$('[data-tadd-q]', body).forEach((b) => b.addEventListener('click', () => { openQuizzes.add(b.dataset.taddQ); editor(null, b.dataset.taddQ); }));
    $$('[data-edit]', body).forEach((b) => b.addEventListener('click', () => editor(D.questions.find((x) => x.id === b.dataset.edit))));
    $$('[data-srename]', body).forEach((b) => b.addEventListener('click', () => sectionDialog(secs.find((x) => x.id === b.dataset.srename))));
    $$('[data-sdel]', body).forEach((b) => b.addEventListener('click', async () => {
      const sec = secs.find((x) => x.id === b.dataset.sdel);
      const n = ts.filter((t) => t.section_id === sec.id).length;
      if (n) return toast('Move or delete its ' + n + ' quiz' + (n === 1 ? '' : 'zes') + ' first.', 'warn');
      if (!confirm('Remove the empty chapter "' + sec.title + '"?')) return;
      try { await api.admin.quizSectionDelete(sec.id, H()); toast('Chapter removed.', 'success'); await reload(); draw(); }
      catch (e) { toast(e.message || 'Could not remove.', 'error'); }
    }));
    const moveSec = (i, d) => { const s2 = secs.slice(); const [x] = s2.splice(i, 1); s2.splice(i + d, 0, x); arrange(s2, ts, D.questions); };
    $$('[data-sup]', body).forEach((b) => b.addEventListener('click', () => moveSec(Number(b.dataset.sup), -1)));
    $$('[data-sdown]', body).forEach((b) => b.addEventListener('click', () => moveSec(Number(b.dataset.sdown), 1)));
    const moveT = (id, d) => {
      const all = ts.slice();
      const t = all.find((x) => x.id === id);
      const grp = all.filter((x) => x.section_id === t.section_id);
      const j = grp.indexOf(t) + d;
      if (j < 0 || j >= grp.length) return;
      const a = all.indexOf(t), b2 = all.indexOf(grp[j]);
      [all[a], all[b2]] = [all[b2], all[a]];
      arrange(secs, all, D.questions);
    };
    $$('[data-tup]', body).forEach((b) => b.addEventListener('click', () => moveT(b.dataset.tup, -1)));
    $$('[data-tdown]', body).forEach((b) => b.addEventListener('click', () => moveT(b.dataset.tdown, 1)));
    $$('[data-tmove]', body).forEach((el) => el.addEventListener('change', async () => {
      try { await api.admin.quizTestMove(el.dataset.tmove, { section_id: el.value }, H()); toast('Quiz moved.', 'success'); }
      catch (e) { toast(e.message || 'Could not move the quiz.', 'error'); }
      await reload(); draw();
    }));
    $$('[data-tdel]', body).forEach((b) => b.addEventListener('click', async () => {
      const t = tests().find((x) => x.id === b.dataset.tdel);
      if (!confirm('Delete the quiz "' + t.title + '" and its ' + (t.question_count || 0) + ' question(s)? Past results still show them.')) return;
      try { const r = await api.admin.quizTestDelete(t.id, H()); toast(r.message || 'Quiz deleted.', 'success'); await reload(); draw(); }
      catch (e) { toast(e.message || 'Could not delete.', 'error'); }
    }));
    const moveQ = (id, d) => {
      const all = groupQuestions(ts, D.questions);
      const x = all.find((y) => y.id === id);
      const grp = all.filter((y) => (y.test_id || null) === (x.test_id || null));
      const j = grp.indexOf(x) + d;
      if (j < 0 || j >= grp.length) return;
      const a = all.indexOf(x), b2 = all.indexOf(grp[j]);
      [all[a], all[b2]] = [all[b2], all[a]];
      arrange(secs, ts, all);
    };
    $$('[data-qup]', body).forEach((b) => b.addEventListener('click', () => moveQ(b.dataset.qup, -1)));
    $$('[data-qdown]', body).forEach((b) => b.addEventListener('click', () => moveQ(b.dataset.qdown, 1)));
    $$('[data-qtest]', body).forEach((el) => el.addEventListener('change', () => {
      const t = tests().find((y) => y.id === el.value);
      const moved = D.questions.map((x) => (x.id === el.dataset.qtest ? Object.assign({}, x, { test_id: el.value, section_id: t ? t.section_id : null }) : x));
      const x = moved.find((y) => y.id === el.dataset.qtest);
      openQuizzes.add(el.value);
      arrange(secs, ts, moved.filter((y) => y.id !== x.id).concat([x]));
    }));
    $$('[data-qdel]', body).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this question? New attempts won\'t include it; past results still show it.')) return;
      try { await api.admin.quizQuestionDelete(b.dataset.qdel, H()); toast('Question deleted.', 'success'); await reload(); draw(); }
      catch (e) { toast(e.message || 'Could not delete.', 'error'); }
    }));
  }

  function qrow(x, n, first, last) {
    const st = x.stats;
    const meta = [TYPE_LABEL[x.question_type], x.topic, x.marks !== 1 ? x.marks + ' marks' : '', x.image_url ? 'image' : '',
      st && st.correct_pct != null ? st.correct_pct + '% correct (' + st.answered + ')' : ''].filter(Boolean).join(' · ');
    const ts = orderedTests(D.sections, tests());
    return '<div class="flex items-start gap-3 border-t border-line px-4 py-3">' +
      '<span class="w-8 shrink-0 pt-0.5 text-sm font-bold text-ink-muted">' + n + '.</span>' +
      '<div class="min-w-0 flex-1"><button class="line-2 text-left text-sm font-medium text-ink hover:text-primary" data-edit="' + esc(x.id) + '">' + esc(x.question) + '</button>' +
        '<p class="mt-0.5 text-xs text-ink-muted">' + esc(meta) + (x.explanation ? '' : ' · <span class="font-semibold text-warn">no explanation</span>') + '</p></div>' +
      '<div class="flex shrink-0 items-center gap-1">' +
        (ts.length > 1 ? '<select class="max-w-[11rem] rounded-md border border-line px-1.5 py-1 text-xs" data-qtest="' + esc(x.id) + '" title="Move to quiz">' +
          ts.map((t) => '<option value="' + esc(t.id) + '"' + (t.id === x.test_id ? ' selected' : '') + '>' + esc(testLabel(t)) + '</option>').join('') + '</select>' : '') +
        (first ? '' : '<button class="rounded px-1.5 py-1 text-sm hover:bg-canvas" data-qup="' + esc(x.id) + '" title="Move up">↑</button>') +
        (last ? '' : '<button class="rounded px-1.5 py-1 text-sm hover:bg-canvas" data-qdown="' + esc(x.id) + '" title="Move down">↓</button>') +
        '<button class="rounded px-1.5 py-1 text-sm text-bad hover:bg-bad/5" data-qdel="' + esc(x.id) + '" title="Delete">✕</button>' +
      '</div></div>';
  }

  async function sectionDialog(sec) {
    const title = prompt(sec ? 'Rename chapter' : 'New chapter name (e.g. Ch 12 - Heart failure)', sec ? sec.title : '');
    if (title == null || !title.trim()) return;
    try {
      const r = await api.admin.quizSectionSave(quizId, { id: sec ? sec.id : undefined, title: title.trim(), description: sec ? sec.description : '' }, H());
      await reload();
      if (!sec && r.section) { toast('Chapter added. Now add a quiz to it.', 'success'); return quizDialog(null, r.section.id); }
      draw();
    } catch (e) { toast(e.message || 'Could not save the chapter.', 'error'); }
  }

  /* Add or edit a quiz inside a chapter: name, chapter, timer, free. */
  function quizDialog(t, chapterId) {
    if (!guard()) return;
    const body = $('[data-body]', panel);
    const cur = t || { title: '', description: '', section_id: chapterId, time_limit_minutes: 0, is_free: false };
    body.innerHTML =
      '<form class="card max-w-2xl space-y-4 p-5" data-tform>' +
        '<div class="flex items-center justify-between"><h3 class="text-lg">' + (t ? 'Quiz settings' : 'New quiz') + '</h3><button type="button" class="btn-ghost btn-sm" data-cancel>Cancel</button></div>' +
        '<div class="grid gap-4 sm:grid-cols-2">' +
          '<label class="block"><span class="mb-1.5 block text-sm font-semibold text-navy">Quiz name</span><input class="field" name="title" maxlength="200" value="' + esc(cur.title) + '" placeholder="e.g. Quiz 1, Mock test A"></label>' +
          '<label class="block"><span class="mb-1.5 block text-sm font-semibold text-navy">Chapter</span><select class="field" name="section_id">' +
            D.sections.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === cur.section_id ? ' selected' : '') + '>' + esc(x.title) + '</option>').join('') + '</select></label>' +
        '</div>' +
        '<label class="block"><span class="mb-1.5 block text-sm font-semibold text-navy">Description (optional)</span><textarea class="field" name="description" rows="2">' + esc(cur.description || '') + '</textarea></label>' +
        '<div class="rounded-xl border border-line p-4">' +
          '<label class="flex items-start gap-3"><input type="checkbox" name="timed" class="mt-1 h-4 w-4 accent-primary"' + (cur.time_limit_minutes ? ' checked' : '') + '>' +
            '<span><span class="block text-sm font-semibold text-navy">Time limit</span><span class="block text-xs text-ink-muted">The countdown starts when a student starts this quiz. At zero, their saved answers are submitted automatically.</span></span></label>' +
          '<div class="mt-3 flex flex-wrap items-center gap-2' + (cur.time_limit_minutes ? '' : ' hidden') + '" data-timebox>' +
            '<input class="field w-28" name="minutes" type="number" min="1" max="600" value="' + esc(cur.time_limit_minutes || 60) + '"><span class="text-sm text-ink-muted">minutes</span>' +
            [15, 30, 60, 120, 180].map((m) => '<button type="button" class="rounded-full border border-line px-3 py-1 text-xs font-semibold text-navy hover:border-primary" data-minutes="' + m + '">' + mins(m) + '</button>').join('') +
          '</div>' +
        '</div>' +
        '<label class="flex items-start gap-3 rounded-xl border border-line p-4"><input type="checkbox" name="free" class="mt-1 h-4 w-4 accent-primary"' + (cur.is_free ? ' checked' : '') + '>' +
          '<span><span class="block text-sm font-semibold text-navy">Free quiz</span><span class="block text-xs text-ink-muted">Anyone signed in can take it without buying the course - a good taster.</span></span></label>' +
        '<div class="flex justify-end"><button class="btn-primary" type="submit">' + (t ? 'Save quiz' : 'Create quiz') + '</button></div>' +
      '</form>';
    const f = $('[data-tform]', body);
    f.addEventListener('input', () => { dirty = true; });
    f.elements.timed.addEventListener('change', (e) => { $('[data-timebox]', body).classList.toggle('hidden', !e.target.checked); });
    $$('[data-minutes]', body).forEach((b) => b.addEventListener('click', () => { f.elements.minutes.value = b.dataset.minutes; dirty = true; }));
    $('[data-cancel]', body).addEventListener('click', () => { if (guard()) draw(); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const timed = f.elements.timed.checked, m = Number(f.elements.minutes.value);
      if (!f.elements.title.value.trim()) return toast('Give the quiz a name.', 'warn');
      if (timed && !(m >= 1 && m <= 600)) return toast('Enter a time limit between 1 and 600 minutes.', 'warn');
      try {
        const r = await api.admin.quizTestSave(quizId, {
          id: t ? t.id : undefined, section_id: f.elements.section_id.value, title: f.elements.title.value.trim(),
          description: f.elements.description.value.trim(), time_limit_minutes: timed ? m : 0, is_free: f.elements.free.checked,
        }, H());
        dirty = false;
        if (r.test) openQuizzes.add(r.test.id);
        await reload();
        toast(t ? 'Quiz saved.' : 'Quiz created. Add its questions.', 'success');
        if (!t && r.test) editor(null, r.test.id); else draw();
      } catch (err) { toast(err.message || 'Could not save the quiz.', 'error'); }
    });
  }

  /* ── question editor ── */

  function editor(existing, testId) {
    if (!guard()) return;
    const st = existing ? {
      id: existing.id, test_id: existing.test_id || '', type: existing.question_type, question: existing.question, image: existing.image_url || '',
      topic: existing.topic || '', marks: existing.marks || 1, explanation: existing.explanation || '',
      options: existing.options.map((o) => ({ id: o.id, text: o.text, correct: existing.correct_options.includes(o.id) })),
      accepted: (existing.accepted_answers || []).slice(),
    } : { test_id: testId || ((orderedTests(D.sections, tests())[0] || {}).id) || '', type: 'single', question: '', image: '', topic: '', marks: 1, explanation: '', options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }], accepted: [] };
    let saved = 0;
    const body = $('[data-body]', panel);

    function paint() {
      const multi = st.type === 'multiple';
      body.innerHTML =
        '<div class="card space-y-5 p-5">' +
          '<div class="flex items-center justify-between"><h3 class="text-lg">' + (st.id ? 'Edit question' : 'New question') + '</h3><button class="btn-ghost btn-sm" data-cancel>Cancel</button></div>' +
          '<div class="grid gap-4 sm:grid-cols-3">' +
            '<label class="block sm:col-span-2"><span class="mb-1.5 block text-sm font-semibold text-navy">Quiz</span><select class="field" data-f="test_id">' +
              orderedTests(D.sections, tests()).map((t) => '<option value="' + esc(t.id) + '"' + (t.id === st.test_id ? ' selected' : '') + '>' + esc(testLabel(t)) + '</option>').join('') + '</select></label>' +
            '<label class="block"><span class="mb-1.5 block text-sm font-semibold text-navy">Marks</span><select class="field" data-f="marks">' + [1, 2, 3, 4, 5].map((m) => '<option' + (m === st.marks ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></label>' +
          '</div>' +
          '<div><span class="mb-1.5 block text-sm font-semibold text-navy">Answer type</span><div class="inline-flex overflow-hidden rounded-lg border border-line">' +
            Object.entries(TYPE_LABEL).map(([k, l]) => '<button class="px-4 py-2 text-sm font-semibold ' + (st.type === k ? 'bg-primary text-white' : 'bg-white text-navy hover:bg-canvas') + '" data-type="' + k + '">' + l + '</button>').join('') + '</div></div>' +
          '<label class="block"><span class="mb-1.5 block text-sm font-semibold text-navy">Question</span><textarea class="field" rows="4" data-f="question">' + esc(st.question) + '</textarea></label>' +
          '<div>' + (st.image ? '<div class="relative inline-block"><img src="' + esc(st.image) + '" class="max-h-56 rounded-lg border border-line" alt=""><button class="absolute right-1 top-1 rounded-full bg-white px-2 text-sm shadow" data-img-del>✕</button></div>' : '') +
            '<label class="btn-ghost btn-sm mt-2 cursor-pointer">' + (st.image ? 'Replace image' : 'Add image (ECG, echo, X-ray…)') + '<input type="file" accept="image/*" class="hidden" data-img></label></div>' +
          (st.type === 'text'
            ? '<div><span class="mb-1.5 block text-sm font-semibold text-navy">Accepted answers</span><p class="mb-2 text-xs text-ink-muted">Matched ignoring capitals and extra spaces. Add spelling variants and abbreviations.</p>' +
                '<div class="mb-2 flex flex-wrap gap-1.5">' + st.accepted.map((a, i) => '<span class="inline-flex items-center gap-1 rounded-full bg-chip px-3 py-1 text-sm text-navy">' + esc(a) + '<button data-acc-del="' + i + '" class="text-ink-muted hover:text-bad">✕</button></span>').join('') + '</div>' +
                '<div class="flex gap-2"><input class="field" data-acc-input placeholder="e.g. Adenosine"><button class="btn-ghost" data-acc-add>Add</button></div></div>'
            : '<div><span class="mb-1.5 block text-sm font-semibold text-navy">Options — tick ' + (multi ? 'every correct one' : 'the correct one') + '</span><div class="space-y-2">' +
                st.options.map((o, i) => '<div class="flex items-center gap-2">' +
                  '<button class="grid h-8 w-8 shrink-0 place-items-center ' + (multi ? 'rounded-md' : 'rounded-full') + ' border-2 ' + (o.correct ? 'border-ok bg-ok text-white' : 'border-line text-ink-muted') + '" data-correct="' + i + '" title="Mark correct">' + (o.correct ? '✓' : String.fromCharCode(65 + i)) + '</button>' +
                  '<input class="field ' + (o.correct ? 'border-ok' : '') + '" data-opt="' + i + '" value="' + esc(o.text) + '" placeholder="Option ' + String.fromCharCode(65 + i) + '">' +
                  (i > 0 ? '<button class="rounded px-1.5 py-1 hover:bg-canvas" data-oup="' + i + '">↑</button>' : '<span class="w-6"></span>') +
                  (st.options.length > 2 ? '<button class="rounded px-1.5 py-1 text-bad hover:bg-bad/5" data-odel="' + i + '">✕</button>' : '') +
                '</div>').join('') + '</div>' +
                (st.options.length < MAX_OPTIONS ? '<button class="btn-ghost btn-sm mt-2" data-oadd>+ Add option</button>' : '') + '</div>') +
          '<label class="block"><span class="mb-1.5 block text-sm font-semibold text-navy">Explanation</span><textarea class="field" rows="4" data-f="explanation" placeholder="Shown in the result: why the answer is correct">' + esc(st.explanation) + '</textarea></label>' +
          '<label class="block"><span class="mb-1.5 block text-sm font-semibold text-navy">Topic (optional)</span><input class="field" data-f="topic" value="' + esc(st.topic) + '" placeholder="e.g. ECG, Heart failure - used in the topic analysis"></label>' +
          '<div class="flex flex-wrap justify-end gap-2">' + (st.id ? '' : '<button class="btn-ghost" data-save-next>Save &amp; add next</button>') + '<button class="btn-primary" data-save>Save question</button></div>' +
        '</div>';

      $$('[data-f]', body).forEach((el) => el.addEventListener('input', () => { st[el.dataset.f] = el.dataset.f === 'marks' ? Number(el.value) : el.value; dirty = true; }));
      $$('[data-f]', body).forEach((el) => el.addEventListener('change', () => { st[el.dataset.f] = el.dataset.f === 'marks' ? Number(el.value) : el.value; dirty = true; }));
      $$('[data-opt]', body).forEach((el) => el.addEventListener('input', () => { st.options[Number(el.dataset.opt)].text = el.value; dirty = true; }));
      $$('[data-type]', body).forEach((b) => b.addEventListener('click', () => {
        if (st.type === 'multiple' && b.dataset.type === 'single' && st.options.filter((o) => o.correct).length > 1) st.options.forEach((o) => { o.correct = false; });
        st.type = b.dataset.type; dirty = true; paint();
      }));
      $$('[data-correct]', body).forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.correct);
        if (st.type === 'multiple') st.options[i].correct = !st.options[i].correct;
        else st.options.forEach((o, j) => { o.correct = j === i; });
        dirty = true; paint();
      }));
      $$('[data-oup]', body).forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.oup); [st.options[i - 1], st.options[i]] = [st.options[i], st.options[i - 1]]; paint(); }));
      $$('[data-odel]', body).forEach((b) => b.addEventListener('click', () => { st.options.splice(Number(b.dataset.odel), 1); paint(); }));
      const oadd = $('[data-oadd]', body);
      if (oadd) oadd.addEventListener('click', () => { st.options.push({ text: '' }); paint(); });
      const accAdd = () => { const el = $('[data-acc-input]', body); const v = el.value.trim(); if (v && !st.accepted.some((a) => a.toLowerCase() === v.toLowerCase())) st.accepted.push(v); dirty = true; paint(); };
      const aa = $('[data-acc-add]', body);
      if (aa) { aa.addEventListener('click', accAdd); $('[data-acc-input]', body).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); accAdd(); } }); }
      $$('[data-acc-del]', body).forEach((b) => b.addEventListener('click', () => { st.accepted.splice(Number(b.dataset.accDel), 1); paint(); }));
      $('[data-img]', body).addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try { st.image = await upload(f, H); dirty = true; paint(); } catch (err) { toast(err.message || 'Upload failed.', 'error'); }
      });
      const idel = $('[data-img-del]', body);
      if (idel) idel.addEventListener('click', () => { st.image = ''; dirty = true; paint(); });
      $('[data-cancel]', body).addEventListener('click', () => { if (guard()) draw(); });
      $('[data-save]', body).addEventListener('click', () => save(false));
      const sn = $('[data-save-next]', body);
      if (sn) sn.addEventListener('click', () => save(true));
    }

    function problem() {
      if (!st.test_id) return 'Choose the quiz this question belongs to (add a chapter and a quiz first).';
      if (!st.question.trim()) return 'Write the question.';
      if (st.type === 'text') return st.accepted.length ? '' : 'Add at least one accepted answer.';
      const filled = st.options.filter((o) => o.text.trim());
      if (filled.length < 2) return 'Add at least two options.';
      if (new Set(filled.map((o) => o.text.trim().toLowerCase())).size !== filled.length) return 'Two options have the same text.';
      const c = filled.filter((o) => o.correct).length;
      if (st.type === 'single' && c !== 1) return 'Mark the one correct option.';
      if (st.type === 'multiple' && !c) return 'Mark at least one correct option.';
      if (st.options.some((o) => o.correct && !o.text.trim())) return 'A correct option is empty.';
      return '';
    }

    async function save(next) {
      const p = problem();
      if (p) return toast(p, 'warn');
      try {
        await api.admin.quizQuestionSave(quizId, {
          id: st.id, test_id: st.test_id, question: st.question.trim(), question_type: st.type,
          topic: st.topic.trim(), image_url: st.image, explanation: st.explanation.trim(), marks: st.marks,
          options: st.type === 'text' ? [] : st.options.filter((o) => o.text.trim()).map((o) => (o.id ? { id: o.id, text: o.text.trim(), correct: !!o.correct } : { text: o.text.trim(), correct: !!o.correct })),
          accepted_answers: st.type === 'text' ? st.accepted : [],
        }, H());
        dirty = false;
        saved++;
        await reload();
        if (next) {
          Object.assign(st, { question: '', image: '', explanation: '', options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }], accepted: [] });
          toast('Saved (' + saved + '). Write the next question.', 'success');
          paint();
          $('[data-f="question"]', body).focus();
        } else {
          toast('Question saved.', 'success');
          openQuizzes.add(st.test_id);
          draw();
        }
      } catch (e) { toast(e.message || 'Could not save.', 'error'); }
    }

    paint();
  }

  /* ── import ── */

  function importer(body) {
    body.innerHTML =
      '<div class="grid gap-5 lg:grid-cols-[1fr_320px]">' +
        '<div class="card p-5"><h3 class="text-lg">Paste questions</h3>' +
          '<p class="mt-1 text-sm text-ink-muted">Leave a blank line between questions. Mark correct options with * at the end. Several * = several answers. Use "Answer:" for a typed answer.</p>' +
          '<textarea class="field mt-3 font-mono text-sm" rows="16" data-paste placeholder="Q: Normal PR interval in adults?\nA) 120-200 ms *\nB) 40-80 ms\nC) 300 ms\nTopic: ECG basics\nExplanation: 0.12 to 0.20 seconds.\n\nQ: Drug of choice to terminate PSVT?\nAnswer: Adenosine | adenosine"></textarea>' +
          '<div class="mt-3 flex flex-wrap items-center gap-3">' +
            '<label class="text-sm">Into quiz <select class="field ml-1 inline-block w-auto py-1.5" data-isec>' + orderedTests(D.sections, tests()).map((t) => '<option value="' + esc(t.id) + '">' + esc(testLabel(t)) + '</option>').join('') + '</select></label>' +
            '<button class="btn-ghost btn-sm" data-preview>Check</button><button class="btn-primary btn-sm" data-import disabled>Import</button></div>' +
        '</div>' +
        '<div class="card h-fit p-5" data-result><p class="text-sm text-ink-muted">Paste questions and press Check to preview them here.</p></div>' +
      '</div>';
    let parsed = [];
    const ta = $('[data-paste]', body);
    ta.addEventListener('input', () => { dirty = !!ta.value.trim(); $('[data-import]', body).disabled = true; });
    $('[data-preview]', body).addEventListener('click', () => {
      const { items, errors } = parsePaste(ta.value);
      parsed = items;
      $('[data-result]', body).innerHTML =
        '<p class="font-bold text-navy">' + items.length + ' question' + (items.length === 1 ? '' : 's') + ' ready</p>' +
        (errors.length ? '<ul class="mt-2 space-y-1 text-sm text-bad">' + errors.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '<p class="mt-1 text-sm text-ok">No problems found.</p>') +
        '<ol class="mt-3 max-h-80 list-decimal space-y-1 overflow-auto pl-5 text-sm text-ink-soft">' + items.slice(0, 50).map((q) => '<li>' + esc(q.question.slice(0, 90)) + ' <span class="text-ink-muted">(' + TYPE_LABEL[q.question_type] + ')</span></li>').join('') + '</ol>';
      $('[data-import]', body).disabled = !items.length || errors.length > 0;
    });
    $('[data-import]', body).addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const into = $('[data-isec]', body).value;
        if (!into) { e.target.disabled = false; return toast('Add a chapter and a quiz first.', 'warn'); }
        const r = await api.admin.quizImport(quizId, { test_id: into, questions: parsed }, H());
        openQuizzes.add(into);
        dirty = false;
        toast(r.message || 'Imported.', 'success');
        await reload(); tab = 'questions'; draw();
      } catch (err) { e.target.disabled = false; toast(err.message || 'Import failed.', 'error'); }
    });
  }

  /* ── access ── */

  async function access(body) {
    body.innerHTML = '<div class="card max-w-xl p-5"><h3 class="text-lg">Give a user access</h3>' +
      '<p class="mt-1 text-sm text-ink-muted">Grants 12 months of access to this quiz, on top of any time they have left. Use for support cases or complimentary access.</p>' +
      '<input class="field mt-4" data-usearch placeholder="Search by name, e-mail or phone">' +
      '<div class="mt-3 max-h-80 divide-y divide-line overflow-auto" data-ulist><p class="py-3 text-sm text-ink-muted">Loading users…</p></div></div>';
    let users = [];
    try { const r = await api.admin.users(H()); users = Array.isArray(r) ? r : (r.users || r.results || []); }
    catch (e) { $('[data-ulist]', body).innerHTML = '<p class="py-3 text-sm text-bad">' + esc(e.message) + '</p>'; return; }
    const paintUsers = (q) => {
      q = (q || '').trim().toLowerCase();
      const rows = users.filter((u) => !q || [u.name, u.email, u.phone].join(' ').toLowerCase().includes(q)).slice(0, 30);
      $('[data-ulist]', body).innerHTML = rows.length ? rows.map((u) =>
        '<div class="flex items-center justify-between gap-3 py-2.5"><div class="min-w-0"><p class="line-1 text-sm font-semibold text-navy">' + esc(u.name || 'No name') + '</p><p class="line-1 text-xs text-ink-muted">' + esc(u.email || u.phone || '') + '</p></div>' +
        '<button class="btn-ghost btn-sm" data-grant="' + esc(u.id || u.user_id) + '">Grant 12 months</button></div>').join('') : '<p class="py-3 text-sm text-ink-muted">No users match.</p>';
      $$('[data-grant]', body).forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        try { const r = await api.admin.quizGrant({ user_id: b.dataset.grant, quiz_id: quizId }, H()); toast(r.message || 'Granted.', 'success'); b.textContent = 'Granted'; }
        catch (e) { b.disabled = false; toast(e.message || 'Could not grant.', 'error'); }
      }));
    };
    $('[data-usearch]', body).addEventListener('input', (e) => paintUsers(e.target.value));
    paintUsers('');
  }

  if (quizId) await reload();
  draw();
}

/* ═════════════════ paste parser ═════════════════ */

/** Text blocks -> question objects the import endpoint accepts. Exported for tests. */
export function parsePaste(text) {
  const items = [], errors = [];
  const blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  blocks.forEach((block, bi) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const q = { question: '', question_type: 'single', options: [], accepted_answers: [], topic: '', explanation: '', marks: 1 };
    let mode = 'q';
    lines.forEach((line) => {
      let m;
      if ((m = line.match(/^(?:Q(?:uestion)?\s*\d*\s*[:.)-]|\d+\s*[.)])\s*(.*)$/i)) && !q.question) { q.question = m[1]; mode = 'q'; }
      else if ((m = line.match(/^[A-Ha-h]\s*[).:-]\s*(.+)$/))) {
        let t = m[1].trim(); const correct = /\*\s*$/.test(t) || /\((correct|ans)\)\s*$/i.test(t);
        t = t.replace(/\s*\*\s*$/, '').replace(/\s*\((correct|ans)\)\s*$/i, '').trim();
        q.options.push({ text: t, correct }); mode = 'o';
      }
      else if ((m = line.match(/^Answer\s*:\s*(.+)$/i))) { q.question_type = 'text'; q.accepted_answers = m[1].split('|').map((s) => s.trim()).filter(Boolean); mode = 'a'; }
      else if ((m = line.match(/^Topic\s*:\s*(.*)$/i))) { q.topic = m[1].trim(); mode = 't'; }
      else if ((m = line.match(/^Marks\s*:\s*(\d+)$/i))) { q.marks = Math.max(1, Math.min(20, Number(m[1]))); }
      else if ((m = line.match(/^(?:Explanation|Exp)\s*:\s*(.*)$/i))) { q.explanation = m[1].trim(); mode = 'e'; }
      else if ((m = line.match(/^Image\s*:\s*(https:\/\/\S+)$/i))) { q.image_url = m[1]; }
      else if (mode === 'e') q.explanation += (q.explanation ? '\n' : '') + line;
      else if (mode === 'q') q.question += (q.question ? '\n' : '') + line;
      else errors.push('Question ' + (bi + 1) + ': could not read "' + line.slice(0, 40) + '"');
    });
    const n = 'Question ' + (bi + 1);
    if (!q.question.trim()) { errors.push(n + ': no question text.'); return; }
    if (q.question_type === 'text') {
      q.options = [];
      if (!q.accepted_answers.length) errors.push(n + ': "Answer:" is empty.');
    } else {
      const c = q.options.filter((o) => o.correct).length;
      if (q.options.length < 2) errors.push(n + ': needs at least two options (A) ... B) ...).');
      else if (q.options.length > MAX_OPTIONS) errors.push(n + ': more than ' + MAX_OPTIONS + ' options.');
      else if (!c) errors.push(n + ': mark the correct option with *.');
      if (c > 1) q.question_type = 'multiple';
    }
    items.push(q);
  });
  return { items, errors };
}
