# Generates book.html from course.html.
#
# The two detail pages share one layout: dark hero band, viewer, tabbed
# curriculum/reviews/about, sticky purchase rail. Only the noun and the
# viewer differ - a <video> element becomes an embedded PDF reader. Deriving
# one from the other is what keeps them from drifting apart.
#
# Run from the project root:   python src/make_book_page.py

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ROOT, "course.html")
dst = os.path.join(ROOT, "book.html")

s = open(src, encoding="utf-8").read()
missing = []


def sub(old, new, count=0):
    """Replace, recording anything that did not match so a silent drift in
    course.html surfaces as a warning instead of a broken book page."""
    global s
    if old not in s:
        missing.append(old.strip().splitlines()[0][:72])
        return
    s = s.replace(old, new) if count == 0 else s.replace(old, new, count)


# ════ head / meta ════
sub("<title data-title>Course — InfuMedz</title>",
    "<title data-title>Book — InfuMedz</title>")
sub('content="Video lecture course on InfuMedz."',
    'content="Reference notes and question banks on InfuMedz."')
sub("boot('courses.html');", "boot('books.html');")
sub("import { boot, fmt, stars, toast, emptyState } from './assets/js/ui.js';",
    "import { boot, fmt, stars, toast, emptyState } from './assets/js/ui.js';\n"
    "import { mountPdfReader } from './assets/js/pdfreader.js';")
# After the player markup is injected, mount the canvas reader into it.
sub("""function renderPlayer() {
  $('[data-player]').innerHTML = playerMarkup();
  wirePlayer();
  paintList();
}""",
    """function renderPlayer() {
  $('[data-player]').innerHTML = playerMarkup();
  wirePlayer();
  paintList();

  // The markup leaves an empty [data-pdf-host]; PDF.js fills it. Done after
  // injection rather than inside playerMarkup() because mounting is async.
  const host = $('[data-pdf-host]');
  if (host && activeIndex >= 0) {
    mountPdfReader(host, flat[activeIndex].v.pdf_url, flat[activeIndex].v.title);
  }
}""")

# ════ missing-id guard ════
sub("emptyState('No course selected', 'That link is missing a course id.',",
    "emptyState('No book selected', 'That link is missing a book id.',")
sub('\'<a href="courses.html" class="btn-primary btn-sm">Browse courses</a>\')',
    '\'<a href="books.html" class="btn-primary btn-sm">Browse books</a>\')')

# ════ state ════
sub("let course = null;", "let book = null;")
sub("let flat = [];                 // lectures in display order, with lock state",
    "let flat = [];                 // PDFs in display order, with lock state")

# ════ buildFlat ════
sub("  const videos = (course.videos || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));",
    "  const files = (book.pdfs || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));")
sub("  const chapters = (course.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));",
    "  const chapters = (book.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));")
sub("      const mine = videos.filter((v) => String(v.chapter) === String(ch.id));",
    "      const mine = files.filter((v) => String(v.chapter) === String(ch.id));")
sub("    const loose = videos.filter((v) => !v.chapter);",
    "    const loose = files.filter((v) => !v.chapter);")
sub("    if (loose.length) out.push({ heading: chapters.length ? 'Other lectures' : null, items: loose });",
    "    if (loose.length) out.push({ heading: chapters.length ? 'Other chapters' : null, items: loose });")
sub("  } else if (videos.length) {\n    out.push({ heading: null, items: videos });",
    "  } else if (files.length) {\n    out.push({ heading: null, items: files });")

# ════ the viewer: <video> -> embedded PDF reader ════
OLD_POSTER_BTN = """            ? '<button class="group flex flex-col items-center gap-3" data-play-index="' + firstPlayable.n + '">' +
                '<span class="grid h-16 w-16 place-items-center rounded-full bg-white/95 shadow-lift transition-transform group-hover:scale-110">' +
                  '<svg class="ml-1 h-7 w-7 text-primary" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 3.8A1 1 0 0 0 4.8 4.7v10.6a1 1 0 0 0 1.5.9l8.4-5.3a1 1 0 0 0 0-1.7L6.3 3.8Z"/></svg>' +
                '</span>' +
                '<span class="text-sm font-semibold text-white">Watch free preview</span>' +
              '</button>'"""
NEW_POSTER_BTN = """            ? '<button class="group flex flex-col items-center gap-3" data-play-index="' + firstPlayable.n + '">' +
                '<span class="grid h-16 w-16 place-items-center rounded-full bg-white/95 shadow-lift transition-transform group-hover:scale-110">' +
                  '<svg class="h-7 w-7 text-primary" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 0 1 2-2h5.6L16 5.4V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3Zm7 .5V6h2.5L11 3.5Z" clip-rule="evenodd"/></svg>' +
                '</span>' +
                '<span class="text-sm font-semibold text-white">Read free preview</span>' +
              '</button>'"""
sub(OLD_POSTER_BTN, NEW_POSTER_BTN)

sub("'<p class=\"mt-3 text-sm font-semibold text-white\">Buy this course to start watching</p>' +",
    "'<p class=\"mt-3 text-sm font-semibold text-white\">Buy this book to start reading</p>' +")

OLD_VIDEO = """  return '' +
    '<div class="overflow-hidden rounded-xl2 bg-black shadow-lift">' +
      '<video class="aspect-video w-full" controls autoplay playsinline controlsList="nodownload noplaybackrate" ' +
             'disablepictureinpicture oncontextmenu="return false" src="' + fmt.esc(cur.v.video_url) + '"></video>' +
    '</div>' +
    '<div class="mt-4 flex flex-wrap items-center justify-between gap-3">' +
      '<div class="min-w-0">' +
        '<p class="text-xs font-semibold uppercase tracking-wider text-primary">Lecture ' + (cur.n + 1) + ' of ' + flat.length + '</p>' +
        '<h2 class="mt-0.5 truncate text-lg">' + fmt.esc(cur.v.title) + '</h2>' +
      '</div>' +
      '<div class="flex shrink-0 gap-2">' +
        (activeIndex > 0 ? '<button class="btn-ghost btn-sm" data-step="-1">Previous</button>' : '') +
        (flat[activeIndex + 1] && !flat[activeIndex + 1].locked
          ? '<button class="btn-primary btn-sm" data-step="1">Next lecture</button>' : '') +
      '</div>' +
    '</div>';"""

NEW_VIEWER = """  // Rendered to <canvas> by PDF.js, not an <iframe>. Android Chrome has no
  // in-iframe PDF viewer and shows a "PDF / Open" card that downloads the
  // file instead - so an iframe simply does not work on a phone. The canvas
  // reader behaves the same on every browser and gives real controls.
  //
  // Being honest about what this is: it removes the download AFFORDANCE, it
  // is not access control. The file URL is still reachable by anyone who
  // opens DevTools. Signed, expiring media URLs are the actual fix and were
  // deliberately deferred to a later pass.
  return '' +
    '<div data-pdf-host></div>' +
    '<div class="mt-4 flex flex-wrap items-center justify-between gap-3">' +
      '<div class="min-w-0">' +
        '<p class="text-xs font-semibold uppercase tracking-wider text-primary">Chapter ' + (cur.n + 1) + ' of ' + flat.length + '</p>' +
        '<h2 class="mt-0.5 truncate text-lg">' + fmt.esc(cur.v.title) + '</h2>' +
      '</div>' +
      '<div class="flex shrink-0 gap-2">' +
        (activeIndex > 0 ? '<button class="btn-ghost btn-sm" data-step="-1">Previous</button>' : '') +
        (flat[activeIndex + 1] && !flat[activeIndex + 1].locked
          ? '<button class="btn-primary btn-sm" data-step="1">Next chapter</button>' : '') +
      '</div>' +
    '</div>';"""
sub(OLD_VIDEO, NEW_VIEWER)

# ════ list ════
sub("    return '<p class=\"px-5 py-10 text-center text-sm text-ink-muted\">Lectures are being added to this course.</p>';",
    "    return '<p class=\"px-5 py-10 text-center text-sm text-ink-muted\">Chapters are being added to this book.</p>';")
sub("                 '<span class=\"text-xs text-ink-muted\">' + count + ' lectures</span>' +",
    "                 '<span class=\"text-xs text-ink-muted\">' + count + ' PDFs</span>' +")
sub("    toast('Buy this course to unlock all lectures.', 'warn');",
    "    toast('Buy this book to unlock all chapters.', 'warn');")
# the "currently playing" equaliser icon becomes a "currently open" doc icon
# The "currently playing" equaliser bars become a "currently open" document
# icon. Matched on the path data alone, so the surrounding ternary's exact
# indentation cannot break it.
sub('<path d="M6 4h3v12H6zM11 4h3v12h-3z"/>',
    '<path fill-rule="evenodd" d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Zm3 3h8v2H6V7Zm0 4h8v2H6v-2Z" clip-rule="evenodd"/>')
sub("""                        : '<svg class="h-4 w-4 shrink-0 text-ink-muted" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 3.8A1 1 0 0 0 4.8 4.7v10.6a1 1 0 0 0 1.5.9l8.4-5.3a1 1 0 0 0 0-1.7L6.3 3.8Z"/></svg>')) +""",
    """                        : '<svg class="h-4 w-4 shrink-0 text-ink-muted" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 0 1 2-2h5.6L16 5.4V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3Zm7 .5V6h2.5L11 3.5Z" clip-rule="evenodd"/></svg>')) +""")

# ════ reviews ════
sub("What did you think of this course?", "What did you think of this book?")
sub("No reviews yet. Be the first once you enrol.", "No reviews yet. Be the first once you buy it.")

# ════ hero band + rail ════
sub("  const price = Number(course.price) || 0;", "  const price = Number(book.price) || 0;")
sub("textContent = course.title + ' — InfuMedz';", "textContent = book.title + ' — InfuMedz';")
sub("String(course.description || '').slice(0, 155)", "String(book.description || '').slice(0, 155)")
sub('\'<a href="courses.html" class="hover:text-white">Courses</a>',
    '\'<a href="books.html" class="hover:text-white">Books</a>')
sub("fmt.esc(course.title) + '</span>' +", "fmt.esc(book.title) + '</span>' +")
sub("(course.category_name ? '<span class=\"badge bg-white/15 text-white backdrop-blur\">' + fmt.esc(course.category_name)",
    "(book.category_name ? '<span class=\"badge bg-white/15 text-white backdrop-blur\">' + fmt.esc(book.category_name)")
sub("(hasAccess ? '<span class=\"badge bg-ok text-white\">Owned</span>' : '') +",
    "(hasAccess ? '<span class=\"badge bg-ok text-white\">Owned</span>' : '') +")
sub("fmt.esc(course.title) + '</h1>' +", "fmt.esc(book.title) + '</h1>' +")
sub("fmt.esc(course.description) + '</p>' +", "fmt.esc(book.description) + '</p>' +")
sub("            '<span>' + flat.length + ' lectures</span>' +", "            '<span>' + flat.length + ' PDFs</span>' +")
sub("(course.buyers_count ? '<span>' + course.buyers_count + ' enrolled</span>' : '') +",
    "(book.buyers_count ? '<span>' + book.buyers_count + ' readers</span>' : '') +")
sub("fmt.esc(course.thumbnail_url || '')", "fmt.esc(book.thumbnail_url || '')")
sub("'You own this course</p>'", "'You own this book</p>'")

# ════ tabs / about pane ════
sub("'<h3 class=\"text-base\">About this course</h3>' +", "'<h3 class=\"text-base\">About this book</h3>' +")
# (the about-pane description is handled by the global
#  course.description -> book.description replacement above)
sub("""            ['<strong>' + flat.length + '</strong> video lectures, organised by chapter',
             'Lifetime access on this website and the Android app',
             'Watch on desktop, tablet or phone',
             'New lectures added to this course at no extra cost']""",
    """            ['<strong>' + flat.length + '</strong> PDF chapters, organised and searchable',
             'Lifetime access on this website and the Android app',
             'Read in the browser - no download needed',
             'New chapters added to this book at no extra cost']""")
sub("""              ['Lifetime access', 'Web and Android app', 'Chapter-wise structure', 'Secure UPI / card payment']""",
    """              ['Lifetime access', 'Web and Android app', 'Read online, no download', 'Secure UPI / card payment']""")

# ════ review submit ════
sub("await api.addCourseReview({", "await api.addBookReview({")
sub("          user: session.userId, course_id: course.id,", "          user: session.userId, book_id: book.id,")
sub("        reviewData = await api.courseReviews(id);", "        reviewData = await api.bookReviews(id);")

# ════ checkout ════
sub("    order = await api.createCourseOrder(session.userId, course.id);",
    "    order = await api.createBookOrder(session.userId, book.id);")
sub("    description: course.title,", "    description: book.title,")
sub("    image: course.thumbnail_url || undefined,", "    image: book.thumbnail_url || undefined,")
sub("        toast('Payment confirmed — all lectures are unlocked.', 'success');",
    "        toast('Payment confirmed — all chapters are unlocked.', 'success');")

# ════ load ════
sub("""  const [c, rev] = await Promise.all([
    api.course(id),
    api.courseReviews(id).catch(() => reviewData),
  ]);
  course = c;""",
    """  const [b, rev] = await Promise.all([
    api.book(id),
    api.bookReviews(id).catch(() => reviewData),
  ]);
  book = b;""")
sub("api.checkAccess(session.userId, 'course', id)", "api.checkAccess(session.userId, 'book', id)")
sub("  if (Number(course.price) === 0) hasAccess = true;", "  if (Number(book.price) === 0) hasAccess = true;")
sub("emptyState('Course not available', e.message || 'This course could not be loaded.',",
    "emptyState('Book not available', e.message || 'This book could not be loaded.',")
sub('\'<a href="courses.html" class="btn-primary btn-sm">Browse all courses</a>\')',
    '\'<a href="books.html" class="btn-primary btn-sm">Browse all books</a>\')')

# ════ anything still saying course.price in the buy-button reset ════
s = s.replace("fmt.price(course.price)", "fmt.price(book.price)")

open(dst, "w", encoding="utf-8", newline="\n").write(s)

print("book.html written ->", dst)
if missing:
    print("NOT FOUND (" + str(len(missing)) + ") - course.html may have changed:")
    for m in missing:
        print("   " + m)
else:
    print("all replacements applied")

leftover = sorted(set(re.findall(r"\bcourse(?!s\.html|s\b)[A-Za-z_]*", s)))
print("leftover 'course*' identifiers:", leftover or "none")
