/* InfuMedz admin - course / book content manager.
 *
 * Lets the admin do on the website what the app's admin screens do, plus
 * arranging:
 *   - create, rename and delete chapters (folders)
 *   - upload lectures (courses) or PDFs (books), several at once, into a
 *     chapter or into the plain list
 *   - put every item in any position: drag it, type its position number,
 *     or use the up/down buttons; reorder the chapters the same way
 *   - rename and delete items
 *
 * The arrangement is edited locally and saved in ONE request
 * (content/arrange/), so customers never see a half-saved order. The
 * position shown is the position customers see: chapters in order, the
 * items inside each, then "Other" items with no chapter. The first
 * FREE_PREVIEW items in that sequence are the free previews in both the app
 * and the website (course_detail_screen.dart `_displayOrder`, course.html).
 *
 * Uploads use the same signed-upload flow as the app: ask for an upload_url,
 * PUT the file to it, then attach the file_url to the course or book.
 */

import { api } from './api.js';
import { fmt, toast } from './ui.js';

const FREE_PREVIEW = 2;
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;   // nginx client_max_body_size on api.chandus7.in
const SORTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js';

const KINDS = {
  course: {
    noun: 'course', Noun: 'Course', item: 'lecture', Item: 'Lecture', items: 'lectures', Items: 'Lectures',
    listKey: 'videos', urlKey: 'video_url', parentKey: 'course', page: '../course.html?id=',
    accept: '.mp4,video/mp4', exts: ['.mp4'], contentType: 'video/mp4', fileWord: 'MP4 video',
    load: (id) => api.course(id),
    presign: (d, h) => api.admin.presignVideo(d, h),
    add: (d, h) => api.admin.addCourseVideo(d, h),
    del: (id, h) => api.admin.deleteCourseVideo(id, h),
    addChapter: (d, h) => api.admin.addCourseChapter(d, h),
    delChapter: (id, h) => api.admin.deleteCourseChapter(id, h),
    arrange: (d, h) => api.admin.arrangeCourse(d, h),
    renameItemKind: 'course_video', renameChapterKind: 'course_chapter',
  },
  book: {
    noun: 'book', Noun: 'Book', item: 'document', Item: 'Document', items: 'documents', Items: 'Documents',
    listKey: 'pdfs', urlKey: 'pdf_url', parentKey: 'book', page: '../book.html?id=',
    accept: '.pdf,application/pdf', exts: ['.pdf'], contentType: 'application/pdf', fileWord: 'PDF',
    load: (id) => api.book(id),
    presign: (d, h) => api.admin.presignPdf(d, h),
    add: (d, h) => api.admin.addBookPdf(d, h),
    del: (id, h) => api.admin.deleteBookPdf(id, h),
    addChapter: (d, h) => api.admin.addBookChapter(d, h),
    delChapter: (id, h) => api.admin.deleteBookChapter(id, h),
    arrange: (d, h) => api.admin.arrangeBook(d, h),
    renameItemKind: 'book_pdf', renameChapterKind: 'book_chapter',
  },
};

/* ── state shared with the console (unsaved-changes guard) ───────────── */

const guard = { dirty: false, uploading: false };

/** True when it is safe to leave the content manager (asks if not). */
export function canLeaveContent() {
  if (guard.uploading) {
    return confirm('Files are still uploading. Leave anyway? Unfinished uploads will be lost.');
  }
  if (guard.dirty) {
    if (!confirm('You have an unsaved arrangement. Leave without saving?')) return false;
    guard.dirty = false;
  }
  return true;
}

window.addEventListener('beforeunload', (e) => {
  if (guard.dirty || guard.uploading) { e.preventDefault(); e.returnValue = ''; }
});

/* ── helpers ─────────────────────────────────────────────────────────── */

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => fmt.esc(s == null ? '' : String(s));

const orderOf = (x) => {
  const n = Number(x && x.order);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};
const byOrderThenTitle = (a, b) =>
  (orderOf(a) - orderOf(b)) || String(a.title || '').toLowerCase().localeCompare(String(b.title || '').toLowerCase());

function niceTitle(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeName(filename) {
  // Same rule as the app (admin_course_flow.dart) and the server's safe_key.
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function fileSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

let sortablePromise = null;
function loadSortable() {
  if (window.Sortable) return Promise.resolve(window.Sortable);
  if (!sortablePromise) {
    sortablePromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SORTABLE_URL;
      s.async = true;
      s.onload = () => resolve(window.Sortable);
      s.onerror = () => { sortablePromise = null; reject(new Error('drag library unavailable')); };
      document.head.appendChild(s);
    });
  }
  return sortablePromise;
}

const ICON = {
  grip: '<svg viewBox="0 0 20 20" class="h-4 w-4" fill="currentColor" aria-hidden="true"><circle cx="7" cy="5" r="1.4"/><circle cx="13" cy="5" r="1.4"/><circle cx="7" cy="10" r="1.4"/><circle cx="13" cy="10" r="1.4"/><circle cx="7" cy="15" r="1.4"/><circle cx="13" cy="15" r="1.4"/></svg>',
  folder: '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2.2h7.4A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>',
  play: '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.8v6.4l5-3.2z" fill="currentColor"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>',
  up: '<svg viewBox="0 0 20 20" class="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M10 5l5 6H5z"/></svg>',
  down: '<svg viewBox="0 0 20 20" class="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M10 15l-5-6h10z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  open: '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
};

/* ── the manager ─────────────────────────────────────────────────────── */

/**
 * Renders the content manager into `panel`.
 *   kind    'course' | 'book'
 *   item    the course/book row ({id, title})
 *   H       () => admin headers
 *   onBack  () => void, returns to the list
 */
export async function openContentManager({ kind, item, panel, H, onBack }) {
  const K = KINDS[kind];
  const st = {
    id: String(item.id),
    title: item.title || '',
    chapters: [],          // [{id, title, items: [{id, title, url, order}]}]
    loose: [],             // items with no chapter
    maxOrder: 0,
    sortables: [],
    queue: [],             // files picked for upload
  };
  guard.dirty = false;
  guard.uploading = false;

  /* ── load ─────────────────────────────────────────────────────────── */

  async function load() {
    panel.innerHTML = '<div class="space-y-3"><div class="sk h-24"></div><div class="sk h-40"></div><div class="sk h-40"></div></div>';
    const data = await K.load(st.id);
    st.title = data.title || st.title;

    const toItem = (v) => ({ id: String(v.id), title: v.title || 'Untitled', url: v[K.urlKey] || '', order: v.order });
    const flat = (data[K.listKey] || []).slice();
    st.maxOrder = flat.reduce((m, v) => Math.max(m, Number(v.order) || 0), 0);

    st.chapters = (data.chapters || []).slice().sort(byOrderThenTitle).map((c) => ({
      id: String(c.id),
      title: c.title || 'Untitled chapter',
      items: (c[K.listKey] || []).slice().sort(byOrderThenTitle).map(toItem),
    }));
    const inChapter = new Set(st.chapters.flatMap((c) => c.items.map((i) => i.id)));
    st.loose = flat.filter((v) => !inChapter.has(String(v.id))).sort(byOrderThenTitle).map(toItem);

    setDirty(false);
    render();
  }

  /* ── sequence helpers (the order customers see) ───────────────────── */

  const sequence = () => st.chapters.flatMap((c) => c.items).concat(st.loose);
  const containers = () => st.chapters.map((c) => c.items).concat([st.loose]);

  function locate(id) {
    for (const list of containers()) {
      const i = list.findIndex((x) => x.id === id);
      if (i >= 0) return { list, index: i };
    }
    return null;
  }

  /** Moves an item so it becomes number `pos` (1-based) in the sequence. */
  function moveToPosition(id, pos) {
    const from = locate(id);
    if (!from) return;
    const [moving] = from.list.splice(from.index, 1);

    const seq = sequence();
    const target = Math.min(Math.max(1, Math.round(pos)), seq.length + 1) - 1;

    if (target < seq.length) {
      const at = locate(seq[target].id);
      at.list.splice(at.index, 0, moving);
    } else {
      // Past the end: last in the "Other" list if it is in use, otherwise
      // last in the final chapter, so it does not jump out of the folders.
      const lists = containers();
      const last = st.loose.length || !st.chapters.length ? st.loose : lists[lists.length - 2];
      last.push(moving);
    }
    setDirty(true);
    render({ focusPos: id });
  }

  function moveChapter(index, delta) {
    const j = index + delta;
    if (j < 0 || j >= st.chapters.length) return;
    const t = st.chapters[index]; st.chapters[index] = st.chapters[j]; st.chapters[j] = t;
    setDirty(true);
    render();
  }

  function setDirty(v) {
    guard.dirty = v;
    const bar = $('[data-save-bar]', panel);
    if (bar) bar.classList.toggle('hidden', !v);
  }

  /* ── render ───────────────────────────────────────────────────────── */

  function itemRow(it, pos) {
    const free = pos <= FREE_PREVIEW;
    return '' +
      '<li class="group flex items-center gap-2 bg-white px-2 py-2 sm:px-3" data-item="' + esc(it.id) + '">' +
        '<span class="dnd-handle cursor-grab touch-none rounded p-1 text-ink-muted hover:bg-chip hover:text-primary active:cursor-grabbing" ' +
          'title="Drag to move" aria-hidden="true">' + ICON.grip + '</span>' +
        '<input type="number" min="1" inputmode="numeric" value="' + pos + '" ' +
          'class="w-14 shrink-0 rounded-lg border border-line bg-canvas px-1.5 py-1 text-center text-sm font-bold text-navy focus:border-primary focus:outline-none" ' +
          'data-pos="' + esc(it.id) + '" aria-label="Position of ' + esc(it.title) + '" title="Type a position and press Enter">' +
        '<span class="shrink-0 text-ink-muted">' + (kind === 'course' ? ICON.play : ICON.pdf) + '</span>' +
        '<span class="min-w-0 flex-1">' +
          '<span class="block break-words text-sm font-medium leading-snug text-navy line-clamp-2" data-title title="' + esc(it.title) + '">' + esc(it.title) + '</span>' +
          (free ? '<span class="badge-free mt-0.5 whitespace-nowrap">Free preview</span>' : '') +
        '</span>' +
        '<span class="flex shrink-0 items-center">' +
          '<button type="button" class="rounded p-1.5 text-ink-soft hover:bg-chip hover:text-primary disabled:opacity-30" data-step="-1" data-id="' + esc(it.id) + '" aria-label="Move up"' + (pos === 1 ? ' disabled' : '') + '>' + ICON.up + '</button>' +
          '<button type="button" class="rounded p-1.5 text-ink-soft hover:bg-chip hover:text-primary disabled:opacity-30" data-step="1" data-id="' + esc(it.id) + '" aria-label="Move down"' + (pos === sequence().length ? ' disabled' : '') + '>' + ICON.down + '</button>' +
          (it.url ? '<a class="hidden rounded p-1.5 text-ink-soft hover:bg-chip hover:text-primary sm:inline-block" href="' + esc(it.url) + '" target="_blank" rel="noopener" aria-label="Open file">' + ICON.open + '</a>' : '') +
          '<button type="button" class="rounded p-1.5 text-ink-soft hover:bg-chip hover:text-primary" data-rename-item="' + esc(it.id) + '" aria-label="Rename">' + ICON.edit + '</button>' +
          '<button type="button" class="rounded p-1.5 text-bad hover:bg-bad/5" data-del-item="' + esc(it.id) + '" aria-label="Delete">' + ICON.trash + '</button>' +
        '</span>' +
      '</li>';
  }

  function listBlock(listId, items, startPos, emptyText) {
    return '<ul class="divide-y divide-line ' + (items.length ? '' : 'min-h-[56px]') + '" data-list="' + esc(listId) + '">' +
      items.map((it, i) => itemRow(it, startPos + i)).join('') +
      '</ul>' +
      (items.length ? '' : '<p class="pointer-events-none -mt-[46px] mb-3 px-4 text-center text-xs text-ink-muted" data-empty-hint>' + emptyText + '</p>');
  }

  function render(opts) {
    st.sortables.forEach((s) => s.destroy());
    st.sortables = [];

    let pos = 1;
    const total = sequence().length;

    const chaptersHtml = st.chapters.map((c, ci) => {
      const start = pos;
      pos += c.items.length;
      return '' +
        '<section class="card overflow-hidden" data-chapter="' + esc(c.id) + '">' +
          '<header class="flex items-center gap-2 border-b border-line bg-canvas/60 px-2 py-2.5 sm:px-3">' +
            '<span class="ch-handle cursor-grab touch-none rounded p-1 text-ink-muted hover:bg-chip hover:text-primary" title="Drag to reorder chapters" aria-hidden="true">' + ICON.grip + '</span>' +
            '<span class="text-primary">' + ICON.folder + '</span>' +
            '<span class="min-w-0 flex-1">' +
              '<span class="block break-words text-sm font-bold leading-snug text-navy line-clamp-2" title="' + esc(c.title) + '">' + esc(c.title) + '</span>' +
              '<span class="text-xs text-ink-muted">Chapter ' + (ci + 1) + ' · ' + c.items.length + ' ' + (c.items.length === 1 ? K.item : K.items) +
                (c.items.length ? ' · positions ' + start + '–' + (start + c.items.length - 1) : '') + '</span>' +
            '</span>' +
            '<span class="flex shrink-0 items-center">' +
              '<button type="button" class="rounded p-1.5 text-ink-soft hover:bg-chip hover:text-primary disabled:opacity-30" data-ch-step="-1" data-index="' + ci + '" aria-label="Move chapter up"' + (ci === 0 ? ' disabled' : '') + '>' + ICON.up + '</button>' +
              '<button type="button" class="rounded p-1.5 text-ink-soft hover:bg-chip hover:text-primary disabled:opacity-30" data-ch-step="1" data-index="' + ci + '" aria-label="Move chapter down"' + (ci === st.chapters.length - 1 ? ' disabled' : '') + '>' + ICON.down + '</button>' +
              '<button type="button" class="rounded p-1.5 text-ink-soft hover:bg-chip hover:text-primary" data-upload-to="' + esc(c.id) + '" aria-label="Upload into this chapter" title="Upload into this chapter">+</button>' +
              '<button type="button" class="rounded p-1.5 text-ink-soft hover:bg-chip hover:text-primary" data-rename-ch="' + esc(c.id) + '" aria-label="Rename chapter">' + ICON.edit + '</button>' +
              '<button type="button" class="rounded p-1.5 text-bad hover:bg-bad/5" data-del-ch="' + esc(c.id) + '" aria-label="Delete chapter">' + ICON.trash + '</button>' +
            '</span>' +
          '</header>' +
          listBlock(c.id, c.items, start, 'Empty — drag ' + K.items + ' here') +
        '</section>';
    }).join('');

    const looseStart = pos;
    const looseHtml = '' +
      '<section class="card overflow-hidden" data-loose>' +
        '<header class="flex items-center gap-2 border-b border-line bg-canvas/60 px-3 py-2.5">' +
          '<span class="min-w-0 flex-1">' +
            '<span class="block text-sm font-bold text-navy">' + (st.chapters.length ? 'Other ' + K.items + ' (no chapter)' : 'All ' + K.items) + '</span>' +
            '<span class="text-xs text-ink-muted">' + st.loose.length + ' ' + (st.loose.length === 1 ? K.item : K.items) +
              (st.chapters.length ? ' · shown after the chapters' : '') + '</span>' +
          '</span>' +
          '<button type="button" class="btn-ghost btn-sm" data-upload-to="">+ Upload here</button>' +
        '</header>' +
        listBlock('loose', st.loose, looseStart, st.chapters.length ? 'Drag ' + K.items + ' here to take them out of a chapter' : 'No ' + K.items + ' yet — upload some above') +
      '</section>';

    panel.innerHTML = '' +
      '<button class="mb-4 text-sm font-medium text-ink-muted hover:text-primary" data-back>&larr; Back to ' + K.noun + 's</button>' +

      '<div class="card mb-4 p-5">' +
        '<div class="flex flex-wrap items-start justify-between gap-3">' +
          '<div class="min-w-0">' +
            '<p class="text-xs font-semibold uppercase tracking-wider text-ink-muted">' + K.Noun + ' content</p>' +
            '<h2 class="mt-1 text-lg">' + esc(st.title) + '</h2>' +
            '<p class="mt-1 text-sm text-ink-muted">' + total + ' ' + (total === 1 ? K.item : K.items) + ' · ' +
              st.chapters.length + ' chapter' + (st.chapters.length === 1 ? '' : 's') +
              ' · <a class="font-medium text-primary hover:underline" target="_blank" rel="noopener" href="' + K.page + encodeURIComponent(st.id) + '">View on website</a></p>' +
          '</div>' +
          '<div class="flex flex-wrap gap-2">' +
            '<button class="btn-ghost btn-sm" data-new-chapter>+ New chapter</button>' +
            '<button class="btn-primary btn-sm" data-upload-to="">+ Upload ' + K.items + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="mt-4 rounded-xl2 border border-line bg-chip/60 p-3 text-sm text-navy">' +
          '<strong>How positions work:</strong> customers see chapters in order, then the ' + K.items + ' inside each, then any with no chapter. ' +
          'Drag the <span class="inline-block align-middle text-ink-muted">' + ICON.grip + '</span> handle, type a new number in the box, or use the arrows — then press <strong>Save arrangement</strong>. ' +
          'The first ' + FREE_PREVIEW + ' are <span class="badge-free">Free preview</span> for everyone.' +
        '</div>' +
        '<div class="mt-4 hidden" data-upload-panel></div>' +
      '</div>' +

      '<div class="space-y-4" data-chapters>' + chaptersHtml + '</div>' +
      '<div class="mt-4">' + looseHtml + '</div>' +

      '<div class="sticky bottom-0 z-10 mt-4 hidden border-t border-line bg-canvas/95 py-4 backdrop-blur" data-save-bar>' +
        '<div class="flex flex-wrap items-center gap-3">' +
          '<button class="btn-primary" data-save>Save arrangement</button>' +
          '<button class="btn-ghost btn-sm" data-discard>Discard changes</button>' +
          '<span class="text-sm text-ink-muted">Unsaved — customers still see the old order.</span>' +
        '</div>' +
      '</div>';

    setDirty(guard.dirty);
    if (st.queue.length) drawUploadPanel();
    wire();

    if (opts && opts.focusPos) {
      const input = $('[data-pos="' + CSS.escape(opts.focusPos) + '"]', panel);
      if (input) { input.scrollIntoView({ block: 'nearest' }); input.focus(); input.select(); }
    }
    enableDrag();
  }

  /* ── drag and drop ────────────────────────────────────────────────── */

  async function enableDrag() {
    let Sortable;
    try { Sortable = await loadSortable(); } catch (_) { return; }   // arrows + numbers still work
    if (!panel.isConnected) return;

    const fromDom = () => {
      const byId = new Map(sequence().map((x) => [x.id, x]));
      const read = (ul) => $$('[data-item]', ul).map((li) => byId.get(li.dataset.item)).filter(Boolean);
      const order = $$('[data-chapter]', panel).map((sec) => sec.dataset.chapter);
      const chapterById = new Map(st.chapters.map((c) => [c.id, c]));
      st.chapters = order.map((id) => chapterById.get(id)).filter(Boolean);
      st.chapters.forEach((c) => { c.items = read($('[data-list="' + CSS.escape(c.id) + '"]', panel)); });
      st.loose = read($('[data-list="loose"]', panel));
      setDirty(true);
      render();
    };

    $$('[data-list]', panel).forEach((ul) => {
      st.sortables.push(Sortable.create(ul, {
        group: 'content-items',
        handle: '.dnd-handle',
        animation: 150,
        ghostClass: 'opacity-40',
        chosenClass: 'bg-chip',
        // Pointer-event dragging instead of native HTML5 drag: the same
        // behaviour with a mouse and on a phone's touch screen, and it
        // auto-scrolls while dragging down a long course.
        forceFallback: true,
        fallbackOnBody: true,
        scroll: true,
        bubbleScroll: true,
        onStart: () => $$('[data-empty-hint]', panel).forEach((p) => p.classList.add('hidden')),
        onEnd: (e) => { if (e.from !== e.to || e.oldIndex !== e.newIndex) fromDom(); else render(); },
      }));
    });

    const wrap = $('[data-chapters]', panel);
    if (wrap && st.chapters.length > 1) {
      st.sortables.push(Sortable.create(wrap, {
        handle: '.ch-handle',
        draggable: '[data-chapter]',
        animation: 150,
        forceFallback: true,
        fallbackOnBody: true,
        ghostClass: 'opacity-40',
        onEnd: (e) => { if (e.oldIndex !== e.newIndex) fromDom(); },
      }));
    }
  }

  /* ── events ───────────────────────────────────────────────────────── */

  function requireClean(what) {
    if (guard.uploading) { toast('Wait for the uploads to finish first.', 'warn'); return false; }
    if (guard.dirty) { toast('Save or discard your arrangement before you ' + what + '.', 'warn'); return false; }
    return true;
  }

  function wire() {
    $('[data-back]', panel).addEventListener('click', () => { if (canLeaveContent()) { guard.dirty = false; onBack(); } });

    $$('[data-pos]', panel).forEach((input) => {
      const apply = () => {
        const n = parseInt(input.value, 10);
        const current = sequence().findIndex((x) => x.id === input.dataset.pos) + 1;
        if (!Number.isFinite(n) || n < 1) { input.value = current; return; }
        if (n !== current) moveToPosition(input.dataset.pos, n);
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
      input.addEventListener('change', apply);
    });

    $$('[data-step]', panel).forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.id;
      const current = sequence().findIndex((x) => x.id === id) + 1;
      moveToPosition(id, current + Number(b.dataset.step));
    }));

    $$('[data-ch-step]', panel).forEach((b) => b.addEventListener('click', () =>
      moveChapter(Number(b.dataset.index), Number(b.dataset.chStep))));

    $$('[data-upload-to]', panel).forEach((b) => b.addEventListener('click', () => openUpload(b.dataset.uploadTo || '')));

    $('[data-new-chapter]', panel).addEventListener('click', newChapter);

    $$('[data-rename-ch]', panel).forEach((b) => b.addEventListener('click', () => {
      const c = st.chapters.find((x) => x.id === b.dataset.renameCh);
      if (c) rename(K.renameChapterKind, c, 'chapter');
    }));
    $$('[data-rename-item]', panel).forEach((b) => b.addEventListener('click', () => {
      const loc = locate(b.dataset.renameItem);
      if (loc) rename(K.renameItemKind, loc.list[loc.index], K.item);
    }));

    $$('[data-del-ch]', panel).forEach((b) => b.addEventListener('click', () => deleteChapter(b.dataset.delCh)));
    $$('[data-del-item]', panel).forEach((b) => b.addEventListener('click', () => deleteItem(b.dataset.delItem)));

    $('[data-save]', panel).addEventListener('click', save);
    $('[data-discard]', panel).addEventListener('click', async () => {
      if (!confirm('Discard your changes and reload the saved order?')) return;
      guard.dirty = false;
      await load().catch((e) => toast(e.message || 'Could not reload.', 'error'));
    });
  }

  /* ── save ─────────────────────────────────────────────────────────── */

  async function save(e) {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Saving…';
    const body = {
      [K.parentKey]: st.id,
      chapters: st.chapters.map((c) => ({ id: c.id, items: c.items.map((x) => x.id) })),
      ungrouped: st.loose.map((x) => x.id),
    };
    try {
      await K.arrange(body, H());
      guard.dirty = false;
      toast('Arrangement saved. The app and website show the new order now.', 'success');
      await load();
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Save arrangement';
      if (err.status === 409) {
        toast(err.message, 'warn', 9000);
      } else {
        toast(err.message || 'Could not save the arrangement.', 'error');
      }
    }
  }

  /* ── chapters ─────────────────────────────────────────────────────── */

  async function newChapter() {
    const title = (prompt('Name of the new chapter (folder):', 'Chapter ' + (st.chapters.length + 1) + ' — ') || '').trim();
    if (!title) return;
    try {
      const created = await K.addChapter({ [K.parentKey]: st.id, title, order: st.chapters.length + 1 }, H());
      // Kept locally so an unsaved arrangement is not thrown away.
      st.chapters.push({ id: String(created.id), title: created.title || title, items: [] });
      if (guard.dirty) toast('Chapter created. Drag ' + K.items + ' into it, then save.', 'success');
      else toast('Chapter created. Drag ' + K.items + ' into it, or upload into it with +.', 'success');
      render();
    } catch (err) { toast(err.message || 'Could not create the chapter.', 'error'); }
  }

  async function deleteChapter(id) {
    const c = st.chapters.find((x) => x.id === id);
    if (!c || !requireClean('delete a chapter')) return;
    const msg = c.items.length
      ? 'Delete the chapter "' + c.title + '"?\n\nIts ' + c.items.length + ' ' + K.items + ' are NOT deleted — they move to "Other ' + K.items + '".'
      : 'Delete the empty chapter "' + c.title + '"?';
    if (!confirm(msg)) return;
    try {
      await K.delChapter(id, H());
      toast('Chapter deleted. Its ' + K.items + ' were kept.', 'success');
      await load();
    } catch (err) { toast(err.message || 'Could not delete the chapter.', 'error'); }
  }

  /* ── items ────────────────────────────────────────────────────────── */

  async function rename(renameKind, obj, word) {
    const title = (prompt('New name for this ' + word + ':', obj.title) || '').trim();
    if (!title || title === obj.title) return;
    try {
      const res = await api.admin.renameContent({ kind: renameKind, id: obj.id, title }, H());
      obj.title = res.title || title;
      toast('Renamed.', 'success');
      render();
    } catch (err) { toast(err.message || 'Could not rename.', 'error'); }
  }

  async function deleteItem(id) {
    const loc = locate(id);
    if (!loc || !requireClean('delete a ' + K.item)) return;
    const it = loc.list[loc.index];
    const typed = prompt('This permanently deletes the ' + K.item + ' "' + it.title + '" and its file. Customers who bought the ' +
      K.noun + ' lose access to it.\n\nType DELETE to confirm:');
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== 'DELETE') return toast('Not confirmed — nothing deleted.', 'warn');
    try {
      await K.del(id, H());
      toast(K.Item + ' deleted.', 'success');
      await load();
    } catch (err) { toast(err.message || 'Could not delete.', 'error'); }
  }

  /* ── upload ───────────────────────────────────────────────────────── */

  let uploadTarget = '';

  function openUpload(chapterId) {
    if (guard.dirty) { toast('Save or discard your arrangement before uploading.', 'warn'); return; }
    uploadTarget = chapterId;
    if (!st.queue.length) st.queue = [];
    drawUploadPanel(true);
  }

  function drawUploadPanel(scroll) {
    const box = $('[data-upload-panel]', panel);
    if (!box) return;
    box.classList.remove('hidden');
    const busy = guard.uploading;

    box.innerHTML = '' +
      '<div class="rounded-xl2 border border-primary/30 bg-white p-4">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
          '<h3 class="text-base">Upload ' + K.items + '</h3>' +
          (busy ? '' : '<button type="button" class="text-sm text-ink-muted hover:text-bad" data-up-close>Close</button>') +
        '</div>' +
        '<div class="mt-3 grid gap-3 sm:grid-cols-2">' +
          '<div><label class="label" for="up-ch">Put them in</label>' +
            '<select id="up-ch" class="field"' + (busy ? ' disabled' : '') + '>' +
              '<option value="">' + (st.chapters.length ? 'No chapter (Other ' + K.items + ')' : 'The ' + K.noun + ' (no chapters yet)') + '</option>' +
              st.chapters.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === uploadTarget ? ' selected' : '') + '>' + esc(c.title) + '</option>').join('') +
            '</select>' +
            '<p class="mt-1 text-xs text-ink-muted">New ' + K.items + ' are added at the end. Arrange them afterwards.</p></div>' +
          '<div><label class="label" for="up-files">' + K.fileWord + ' files</label>' +
            '<input id="up-files" class="field" type="file" multiple accept="' + K.accept + '"' + (busy ? ' disabled' : '') + '>' +
            '<p class="mt-1 text-xs text-ink-muted">' + K.fileWord + ' only, up to 512 MB each. You can pick several.</p></div>' +
        '</div>' +
        (st.queue.length
          ? '<ul class="mt-4 space-y-2">' + st.queue.map((q, i) =>
              '<li class="rounded-xl2 border border-line p-3">' +
                '<div class="flex items-center gap-2">' +
                  '<span class="w-6 shrink-0 text-center text-xs font-bold text-ink-muted">' + (i + 1) + '</span>' +
                  '<input class="field py-1.5" value="' + esc(q.title) + '" data-q-title="' + i + '" aria-label="Title"' + (busy || q.state === 'done' ? ' disabled' : '') + '>' +
                  '<span class="hidden shrink-0 text-xs text-ink-muted sm:inline">' + fileSize(q.file.size) + '</span>' +
                  (busy || q.state === 'done' ? '' : '<button type="button" class="shrink-0 rounded p-1.5 text-bad hover:bg-bad/5" data-q-drop="' + i + '" aria-label="Remove">' + ICON.trash + '</button>') +
                '</div>' +
                '<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-line">' +
                  '<div class="h-full rounded-full ' + (q.state === 'error' ? 'bg-bad' : q.state === 'done' ? 'bg-ok' : 'bg-primary') + ' transition-all" style="width:' + Math.round((q.progress || 0) * 100) + '%"></div>' +
                '</div>' +
                '<p class="mt-1 text-xs ' + (q.state === 'error' ? 'text-bad' : 'text-ink-muted') + '" data-q-status="' + i + '">' + esc(q.status || 'Ready') + '</p>' +
              '</li>').join('') + '</ul>' +
            '<div class="mt-4 flex flex-wrap items-center gap-3">' +
              '<button class="btn-primary" data-up-start' + (busy || !st.queue.some((q) => q.state !== 'done') ? ' disabled' : '') + '>' +
                (busy ? 'Uploading…' : 'Upload ' + st.queue.filter((q) => q.state !== 'done').length + ' file(s)') + '</button>' +
              (busy ? '<span class="text-sm text-ink-muted">Keep this tab open until it finishes.</span>' : '') +
            '</div>'
          : '') +
      '</div>';

    const close = $('[data-up-close]', box);
    if (close) close.addEventListener('click', () => { st.queue = []; box.classList.add('hidden'); box.innerHTML = ''; });

    const sel = $('#up-ch', box);
    if (sel) sel.addEventListener('change', () => { uploadTarget = sel.value; });

    const files = $('#up-files', box);
    if (files) files.addEventListener('change', () => {
      const rejected = [];
      Array.from(files.files).forEach((file) => {
        const lower = file.name.toLowerCase();
        if (!K.exts.some((x) => lower.endsWith(x))) { rejected.push(file.name + ' (not ' + K.fileWord + ')'); return; }
        if (file.size > MAX_UPLOAD_BYTES) { rejected.push(file.name + ' (over 512 MB)'); return; }
        if (file.size === 0) { rejected.push(file.name + ' (empty file)'); return; }
        st.queue.push({ file, title: niceTitle(file.name), progress: 0, state: 'ready', status: 'Ready' });
      });
      if (rejected.length) toast('Skipped: ' + rejected.join(', '), 'warn', 8000);
      drawUploadPanel();
    });

    $$('[data-q-title]', box).forEach((inp) => inp.addEventListener('input', () => { st.queue[Number(inp.dataset.qTitle)].title = inp.value; }));
    $$('[data-q-drop]', box).forEach((b) => b.addEventListener('click', () => { st.queue.splice(Number(b.dataset.qDrop), 1); drawUploadPanel(); }));

    const start = $('[data-up-start]', box);
    if (start) start.addEventListener('click', runUploads);

    if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setQ(i, patch) {
    Object.assign(st.queue[i], patch);
    const box = $('[data-upload-panel]', panel);
    const li = box && $$('li', box)[i];
    if (!li) return;
    const bar = li.querySelector('.h-full');
    if (bar) {
      bar.style.width = Math.round((st.queue[i].progress || 0) * 100) + '%';
      bar.className = 'h-full rounded-full transition-all ' + (st.queue[i].state === 'error' ? 'bg-bad' : st.queue[i].state === 'done' ? 'bg-ok' : 'bg-primary');
    }
    const s = li.querySelector('[data-q-status]');
    if (s) { s.textContent = st.queue[i].status; s.className = 'mt-1 text-xs ' + (st.queue[i].state === 'error' ? 'text-bad' : 'text-ink-muted'); }
  }

  async function runUploads() {
    if (guard.dirty) { toast('Save or discard your arrangement before uploading.', 'warn'); return; }
    const pending = st.queue.map((q, i) => [q, i]).filter(([q]) => q.state !== 'done');
    if (pending.some(([q]) => !q.title.trim())) { toast('Every file needs a title.', 'warn'); return; }

    const chapter = uploadTarget || null;
    guard.uploading = true;
    drawUploadPanel();
    let ok = 0, failed = 0;

    for (const [q, i] of pending) {
      try {
        setQ(i, { state: 'uploading', progress: 0, status: 'Preparing…' });
        const ticket = await K.presign({ filename: safeName(q.file.name), content_type: K.contentType }, H());
        if (!ticket || !ticket.upload_url || !ticket.file_url) throw new Error('The server did not return an upload link.');

        await api.admin.putFile(ticket.upload_url, q.file, (p) =>
          setQ(i, { progress: p * 0.97, status: 'Uploading… ' + Math.round(p * 100) + '% of ' + fileSize(q.file.size) }));

        setQ(i, { status: 'Adding to the ' + K.noun + '…' });
        st.maxOrder += 1;
        const body = { [K.parentKey]: st.id, title: q.title.trim(), [K.urlKey]: ticket.file_url, order: st.maxOrder };
        if (chapter) body.chapter = chapter;
        await K.add(body, H());

        setQ(i, { state: 'done', progress: 1, status: 'Done' });
        ok += 1;
      } catch (err) {
        setQ(i, { state: 'error', status: 'Failed: ' + (err.message || 'upload error') + ' — you can try again.' });
        failed += 1;
      }
    }

    guard.uploading = false;
    st.queue = st.queue.filter((q) => q.state !== 'done');
    if (ok) toast(ok + ' ' + (ok === 1 ? K.item : K.items) + ' added.' + (failed ? ' ' + failed + ' failed.' : ''), failed ? 'warn' : 'success', 7000);
    else if (failed) toast('Upload failed. Check the errors and try again.', 'error');

    if (ok) {
      const keep = st.queue;
      await load().catch((e) => toast(e.message || 'Could not reload.', 'error'));
      st.queue = keep;
      if (keep.length) drawUploadPanel();
    } else {
      drawUploadPanel();
    }
  }

  await load();
}
