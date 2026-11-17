/* "Revise with MCQs" on a video course or book page: the quiz courses the
 * admin linked to it (related_course_id / related_book_id). Draws nothing
 * when there are none or the list can't load. */
import { api } from './api.js';
import { fmt } from './ui.js';

let all = null;

export async function mountRevise(host, { courseId, bookId }) {
  if (!host) return;
  try {
    all = all || api.quizzes();
    const list = (await all) || [];
    const mine = (Array.isArray(list) ? list : []).filter((q) =>
      (courseId && String(q.related_course_id) === String(courseId)) || (bookId && String(q.related_book_id) === String(bookId)));
    if (!mine.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="mt-6"><h3 class="text-base">Revise with MCQs</h3><div class="mt-3 space-y-3">' + mine.map((q) => {
      const price = Number(q.price) || 0;
      const facts = [q.quiz_count ? q.quiz_count + ' quiz' + (q.quiz_count === 1 ? '' : 'zes') : '', (q.question_count || 0) + ' MCQs',
        q.chapter_count ? q.chapter_count + ' chapter' + (q.chapter_count === 1 ? '' : 's') : ''].filter(Boolean).join(' · ');
      return '<a href="quiz.html?id=' + encodeURIComponent(q.id) + '" class="card-hover flex items-center gap-4 border-primary/25 bg-chip/40 p-4">' +
        '<span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-white">' +
          '<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg></span>' +
        '<span class="min-w-0 flex-1"><span class="line-2 block font-bold text-navy">' + fmt.esc(q.title) + '</span>' +
          '<span class="block text-xs text-ink-muted">' + facts + '</span></span>' +
        '<span class="shrink-0 text-sm font-bold text-primary">' + (price ? fmt.price(price) : 'Free') + ' →</span></a>';
    }).join('') + '</div></div>';
  } catch (_) { host.innerHTML = ''; }
}
