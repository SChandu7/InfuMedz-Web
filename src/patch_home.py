# Home page changes:
#   - the hero visual becomes the admin's AppBanner carousel (carousel_urls),
#     auto-advancing every 3s, matching the app's home carousel
#   - "Courses" / "Books" rows show the admin's popular_courses and
#     popular_books picks, not a most-enrolled guess
#   - the "Most enrolled" hero course card is retired

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "index.html")
s = open(p, encoding="utf-8").read()

if "data-carousel" in s:
    print("index.html already patched - no change")
    raise SystemExit(0)

# ── 1. hero visual -> carousel shell ────────────────────────────
OLD_HERO = """    <!-- Hero visual: the top course, as a real card -->
    <div class="relative">
      <div class="absolute -inset-4 -z-10 rounded-[1.75rem] bg-hero-grad opacity-10 blur-2xl" aria-hidden="true"></div>
      <div data-hero-card class="card overflow-hidden shadow-lift">
        <div class="sk aspect-video rounded-none"></div>
        <div class="space-y-2 p-5"><div class="sk h-4 w-24"></div><div class="sk h-5 w-full"></div></div>
      </div>
    </div>"""

NEW_HERO = """    <!-- Hero visual: the admin's own banner carousel, same images and the
         same 3-second rotation as the app's home screen -->
    <div class="relative">
      <div class="absolute -inset-4 -z-10 rounded-[1.75rem] bg-hero-grad opacity-10 blur-2xl" aria-hidden="true"></div>
      <div data-carousel class="card overflow-hidden shadow-lift">
        <div class="sk aspect-video rounded-none"></div>
      </div>
    </div>"""
assert OLD_HERO in s, "hero visual block not found"
s = s.replace(OLD_HERO, NEW_HERO, 1)

# ── 2. section headings reflect "admin's picks" ─────────────────
s = s.replace(
    """        <p class="prose-brand mt-2 max-w-xl">Watch chapter by chapter, at your own pace. Buy once, keep for life.</p>""",
    """        <p class="prose-brand mt-2 max-w-xl">Hand-picked by our faculty. Watch chapter by chapter, buy once, keep for life.</p>""",
    1)
s = s.replace(
    """        <p class="prose-brand mt-2 max-w-xl">Organised by chapter, searchable, and readable straight in the browser.</p>""",
    """        <p class="prose-brand mt-2 max-w-xl">Hand-picked reference sets, organised by chapter and readable straight in the browser.</p>""",
    1)

# ── 3. swap heroCard() for the carousel renderer ────────────────
OLD_FN_START = "function heroCard(c) {"
start = s.index(OLD_FN_START)
end = s.index("function reviewCard(r) {")

NEW_FN = '''/* The app's home carousel, rebuilt for the web.

   Images, order and count all come from the admin-managed AppBanner record
   (carousel_urls), so whatever is set in the app's admin panel is what shows
   here - no second list to maintain.

   Auto-advances every 3 seconds, matching the app. It pauses on hover and
   while the tab is hidden: a carousel that keeps cycling behind a background
   tab burns battery and lands the visitor on a random slide when they come
   back. Respects prefers-reduced-motion by not auto-advancing at all. */
function mountCarousel(urls) {
  const host = document.querySelector('[data-carousel]');
  if (!host) return;

  const slides = (urls || []).filter(Boolean);
  if (!slides.length) {
    // Nothing configured - drop the panel rather than leave an empty box.
    host.closest('.relative').remove();
    return;
  }

  host.innerHTML =
    '<div class="relative aspect-video overflow-hidden bg-chip">' +
      slides.map(function (u, i) {
        return '<img src="' + fmt.esc(u) + '" alt="" ' +
               (i === 0 ? '' : 'loading="lazy" ') +
               'class="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ' +
               (i === 0 ? 'opacity-100' : 'opacity-0') + '" data-slide="' + i + '">';
      }).join('') +
      (slides.length > 1
        ? '<div class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/45 to-transparent pb-3.5 pt-8">' +
            slides.map(function (_, i) {
              return '<button data-dot="' + i + '" aria-label="Go to slide ' + (i + 1) + '" ' +
                     'class="h-1.5 rounded-full transition-all duration-300 ' +
                     (i === 0 ? 'w-6 bg-white' : 'w-1.5 bg-white/55 hover:bg-white/80') + '"></button>';
            }).join('') +
          '</div>'
        : '') +
    '</div>';

  if (slides.length < 2) return;

  const imgs = Array.from(host.querySelectorAll('[data-slide]'));
  const dots = Array.from(host.querySelectorAll('[data-dot]'));
  let at = 0;
  let timer = null;

  function show(n) {
    at = (n + slides.length) % slides.length;
    imgs.forEach(function (im, i) {
      im.classList.toggle('opacity-100', i === at);
      im.classList.toggle('opacity-0', i !== at);
    });
    dots.forEach(function (d, i) {
      d.className = 'h-1.5 rounded-full transition-all duration-300 ' +
        (i === at ? 'w-6 bg-white' : 'w-1.5 bg-white/55 hover:bg-white/80');
    });
  }

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function start() { if (!still && !timer) timer = setInterval(function () { show(at + 1); }, 3000); }
  function stop()  { if (timer) { clearInterval(timer); timer = null; } }

  dots.forEach(function (d) {
    d.addEventListener('click', function () { stop(); show(Number(d.dataset.dot)); start(); });
  });
  host.addEventListener('mouseenter', stop);
  host.addEventListener('mouseleave', start);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  start();
}

'''
s = s[:start] + NEW_FN + s[end:]

# ── 4. admin picks only, no most-enrolled fallback ──────────────
OLD_PICK = """  // Admin's pinned picks first, then most-enrolled.
  const featured = (all, pinned, limit) => {
    const byId = new Map(all.map((x) => [String(x.id), x]));
    const chosen = (pinned || []).map((id) => byId.get(String(id))).filter(Boolean);
    const rest = all.filter((x) => !chosen.includes(x))
                    .sort((a, b) => (b.buyers_count || 0) - (a.buyers_count || 0));
    return chosen.concat(rest).slice(0, limit);
  };

  const topCourses = featured(live, banner && banner.popular_courses, 4);
  const topBooks   = featured(books, banner && banner.popular_books, 4);

  // Hero card shows the single most-enrolled course.
  const hero = live.slice().sort((a, b) => (b.buyers_count || 0) - (a.buyers_count || 0))[0];
  if (hero) $('[data-hero-card]').innerHTML = heroCard(hero);"""

NEW_PICK = """  // Strictly the admin's picks from the app's admin panel - popular_courses
  // and popular_books on the AppBanner record. If a pick has since been
  // deleted it simply drops out; we do NOT silently backfill with
  // most-enrolled, because then the admin could never tell whether what
  // they see is their selection or the fallback.
  const pick = (all, pinned) => {
    const byId = new Map(all.map((x) => [String(x.id), x]));
    return (pinned || []).map((id) => byId.get(String(id))).filter(Boolean);
  };

  const topCourses = pick(live, banner && banner.popular_courses);
  const topBooks   = pick(books, banner && banner.popular_books);

  mountCarousel(banner && banner.carousel_urls);"""
assert OLD_PICK in s, "featured-picks block not found"
s = s.replace(OLD_PICK, NEW_PICK, 1)

# ── 5. empty-state copy now points the admin at the right place ─
s = s.replace(
    """    : '<p class="col-span-full text-sm text-ink-muted">No courses published yet.</p>';""",
    """    : '<p class="col-span-full text-sm text-ink-muted">No featured courses selected yet. ' +
      '<a href="courses.html" class="font-semibold text-primary hover:underline">Browse all courses</a>.</p>';""",
    1)
s = s.replace(
    """    : '<p class="col-span-full text-sm text-ink-muted">No notes published yet.</p>';""",
    """    : '<p class="col-span-full text-sm text-ink-muted">No featured notes selected yet. ' +
      '<a href="books.html" class="font-semibold text-primary hover:underline">Browse all notes</a>.</p>';""",
    1)

# ── 6. grids size themselves to however many the admin picked ───
s = s.replace(
    """    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-courses></div>""",
    """    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-courses></div>""",
    1)

open(p, "w", encoding="utf-8", newline="\n").write(s)
print("index.html patched: banner carousel (3s auto-advance), admin-picked popular rows")
