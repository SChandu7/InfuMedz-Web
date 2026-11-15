/* Shared bits for the MCQ quiz pages. */
import { fmt } from './ui.js';

export const pct = (p) => (p == null || p === '' || isNaN(Number(p)))
  ? '–'
  : (Number(p) % 1 === 0 ? Number(p).toFixed(0) : Number(p).toFixed(1)) + '%';

export const num = (n) => (n == null ? '–' : (Number(n) % 1 === 0 ? String(Number(n)) : String(Number(n).toFixed(2)).replace(/0$/, '')));

export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));

/** 180 -> "3 hours", 90 -> "1 h 30 min", 0 -> "No time limit". */
export function timeLimit(min) {
  min = Number(min) || 0;
  if (min <= 0) return 'No time limit';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return m + ' min';
  if (!m) return h === 1 ? '1 hour' : h + ' hours';
  return h + ' h ' + m + ' min';
}

/** Countdown text: "2:59:07" or "04:12". */
export function clock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const two = (v) => String(v).padStart(2, '0');
  return h ? h + ':' + two(m) + ':' + two(s) : two(m) + ':' + two(s);
}

export function duration(sec) {
  sec = Number(sec) || 0;
  if (sec <= 0) return '–';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h) return h + 'h ' + m + 'm';
  if (m) return m + 'm';
  return sec + 's';
}

/** Cover image, or a plain branded panel when the admin added none. */
export function cover(url, category, cls = 'aspect-video') {
  if (url) {
    return '<div class="relative ' + cls + ' overflow-hidden bg-chip">' +
      '<img src="' + fmt.esc(url) + '" alt="" loading="lazy" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" ' +
      'onerror="this.parentNode.innerHTML=\'\'">' +
      '</div>';
  }
  return '<div class="grid ' + cls + ' place-items-center bg-chip text-primary">' +
    '<div class="text-center">' +
      '<svg class="mx-auto h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
        '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h5M8 12h5M8 16h3M15.5 11.5l1.5 1.5 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      (category ? '<div class="mt-2 text-xs font-bold text-navy">' + fmt.esc(category) + ' MCQ practice</div>' : '') +
    '</div></div>';
}

/** Catalogue card for a quiz course. */
export function quizCard(q, opts = {}) {
  const owned = !!opts.owned;
  const free = Number(q.price) === 0;
  const meta = [
    plural(q.question_count || 0, 'question'),
    q.section_count ? plural(q.section_count, 'section') : '',
  ].filter(Boolean).join(' · ');
  return '' +
    '<a href="quiz.html?id=' + encodeURIComponent(q.id) + '" class="card-hover group flex flex-col overflow-hidden">' +
      '<div class="relative">' + cover(q.thumbnail_url, q.category_name) +
        '<div class="absolute left-3 top-3 flex gap-1.5">' +
          (owned ? '<span class="badge-own">Owned</span>' : (free ? '<span class="badge-free">Free</span>' : '')) +
        '</div>' +
        '<span class="absolute bottom-3 left-3 rounded bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">' + (q.question_count || 0) + ' MCQs</span>' +
      '</div>' +
      '<div class="flex flex-1 flex-col p-4">' +
        '<div class="mb-2 flex items-center gap-2">' +
          (q.category_name ? '<span class="badge-cat">' + fmt.esc(q.category_name) + '</span>' : '') +
          '<span class="text-xs text-ink-muted">' + meta + '</span>' +
        '</div>' +
        '<h3 class="line-2 text-[15px] font-bold leading-snug text-navy transition-colors group-hover:text-primary">' + fmt.esc(q.title) + '</h3>' +
        '<p class="line-2 mt-1.5 flex-1 text-sm text-ink-muted">' + fmt.esc(q.subtitle || q.description || '') + '</p>' +
        '<div class="mt-4 flex items-end justify-between border-t border-line pt-3">' +
          (owned
            ? '<span class="text-sm font-semibold text-ok">In your library</span>'
            : '<span class="text-lg font-black text-navy">' + (free ? 'Free' : fmt.price(q.price)) + '</span>') +
          (q.buyers_count ? '<span class="text-xs text-ink-muted">' + q.buyers_count + ' enrolled</span>' : '<span class="text-xs text-ink-muted">Results + explanations</span>') +
        '</div>' +
      '</div>' +
    '</a>';
}

/** "Valid till 5 Feb 2027 · 87 days left" style line from an access object. */
export function accessLabel(a) {
  if (!a || !a.expires_at) return '';
  if (a.expired) return 'Expired on ' + fmt.date(a.expires_at);
  const d = Number(a.days_left);
  if (d <= 0) return 'Expires today';
  if (d === 1) return 'Expires tomorrow';
  return 'Valid till ' + fmt.date(a.expires_at) + ' · ' + d + ' days left';
}
