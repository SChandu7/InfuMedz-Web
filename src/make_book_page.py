# Generates book.html from course.html.
#
# The two detail pages are the same page with a different noun: videos become
# PDFs, the inline <video> becomes an inline PDF reader, and the endpoints
# swap. Deriving one from the other keeps them from drifting apart, which is
# exactly how the app ended up with three visual identities in v1.
#
# Run from the project root:  node/python src/make_book_page.py

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ROOT, "course.html")
dst = os.path.join(ROOT, "book.html")

s = open(src, encoding="utf-8").read()

REPS = [
    # ── head ──
    ("<title data-title>Course — InfuMedz</title>",
     "<title data-title>Book — InfuMedz</title>"),
    ('content="Video lecture course on InfuMedz."',
     'content="Reference book and notes on InfuMedz."'),
    ("boot('courses.html');", "boot('books.html');"),

    # ── missing-id guard ──
    ("emptyState('No course selected', 'That link is missing a course id.',",
     "emptyState('No book selected', 'That link is missing a book id.',"),
    ('\'<a href="courses.html" class="btn-primary btn-sm">Browse courses</a>\') + \'</div>\';',
     '\'<a href="books.html" class="btn-primary btn-sm">Browse books</a>\') + \'</div>\';'),

    ("let course = null;", "let book = null;"),

    # ── row renderer ──
    ("function lectureRow(v, n, restricted) {", "function pdfRow(v, n, restricted) {"),
    ('<path d="M6.3 3.8A1 1 0 0 0 4.8 4.7v10.6a1 1 0 0 0 1.5.9l8.4-5.3a1 1 0 0 0 0-1.7L6.3 3.8Z"/>',
     '<path fill-rule="evenodd" d="M4 3a2 2 0 0 1 2-2h5.6L16 5.4V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3Zm7 .5V6h2.5L11 3.5Z" clip-rule="evenodd"/>'),
    ("'data-play=\"' + fmt.esc(v.video_url) + '\"", "'data-open=\"' + fmt.esc(v.pdf_url) + '\""),

    # ── list builder ──
    ("function lectureList() {", "function pdfList() {"),
    ("const videos = (course.videos || []).slice()", "const files = (book.pdfs || []).slice()"),
    ("if (!videos.length) {", "if (!files.length) {"),
    ("Lectures are being added to this course.", "Chapters are being added to this book."),
    ("const chapters = (course.chapters || []).slice()", "const chapters = (book.chapters || []).slice()"),
    ("// same; videos with chapter === null fall into \"Other lectures\".",
     "// same; PDFs with chapter === null fall into \"Other chapters\"."),
    ("const mine = videos.filter(", "const mine = files.filter("),
    ("mine.forEach((v) => { out += lectureRow(v, ++n, !hasAccess); });",
     "mine.forEach((v) => { out += pdfRow(v, ++n, !hasAccess); });"),
    ("const loose = videos.filter(", "const loose = files.filter("),
    ("tracking-wider text-navy\">Other lectures</div>';", "tracking-wider text-navy\">Other chapters</div>';"),
    ("loose.forEach((v) => { out += lectureRow(v, ++n, !hasAccess); });",
     "loose.forEach((v) => { out += pdfRow(v, ++n, !hasAccess); });"),
    ("return videos.map((v) => lectureRow(v, ++n, !hasAccess)).join('');",
     "return files.map((v) => pdfRow(v, ++n, !hasAccess)).join('');"),

    # ── reviews ──
    ("What did you think of this course?", "What did you think of this book?"),
    ("No reviews yet. Be the first once you enrol.", "No reviews yet. Be the first once you buy it."),

    # ── render ──
    ("const videos = course.videos || [];", "const files = book.pdfs || [];"),
    ("const price = Number(course.price) || 0;", "const price = Number(book.price) || 0;"),
    ("textContent = course.title + ' — InfuMedz';", "textContent = book.title + ' — InfuMedz';"),
    ("String(course.description || '').slice(0, 155)", "String(book.description || '').slice(0, 155)"),
    ("You own this course</div>'", "You own this book</div>'"),
    ('\'<a href="courses.html" class="hover:text-primary">Courses</a>',
     '\'<a href="books.html" class="hover:text-primary">Books</a>'),
    ("fmt.esc(course.title) + '</span>' +", "fmt.esc(book.title) + '</span>' +"),
    ("(course.category_name ? '<span class=\"badge-cat\">' + fmt.esc(course.category_name)",
     "(book.category_name ? '<span class=\"badge-cat\">' + fmt.esc(book.category_name)"),
    ("videos.length + (videos.length === 1 ? ' lecture' : ' lectures')",
     "files.length + (files.length === 1 ? ' PDF' : ' PDFs')"),
    ("(course.buyers_count ? '<span class=\"text-xs text-ink-muted\">&middot; ' + course.buyers_count + ' enrolled</span>' : '')",
     "(book.buyers_count ? '<span class=\"text-xs text-ink-muted\">&middot; ' + book.buyers_count + ' readers</span>' : '')"),
    ("fmt.esc(course.title) + '</h1>'", "fmt.esc(book.title) + '</h1>'"),
    ("fmt.esc(course.description) + '</p>'", "fmt.esc(book.description) + '</p>'"),
    ("fmt.esc(course.thumbnail_url || '')", "fmt.esc(book.thumbnail_url || '')"),
    ("&check;</span> Watch on web and mobile app</li>", "&check;</span> Read on web and mobile app</li>"),
    ("'<h2 class=\"text-base\">Course content</h2>'", "'<h2 class=\"text-base\">What is inside</h2>'"),
    ("videos.length + ' lectures' +", "files.length + ' PDFs' +"),
    ("' &middot; first ' + FREE_PREVIEW + ' free to watch'", "' &middot; first ' + FREE_PREVIEW + ' free to read'"),
    ("The first two items in flat order are a free preview for everyone; the",
     "The first two PDFs in flat order are a free preview for everyone; the"),
    ("// rest open only once check-access/ confirms the purchase.",
     "// rest open only once check-access/ confirms the purchase."),
    ("lectureList() +", "pdfList() +"),

    # ── review submit ──
    ("await api.addCourseReview({", "await api.addBookReview({"),
    ("course_id: course.id,", "book_id: book.id,"),
    ("reviewData = await api.courseReviews(id);", "reviewData = await api.bookReviews(id);"),

    # ── checkout ──
    ("order = await api.createCourseOrder(session.userId, course.id);",
     "order = await api.createBookOrder(session.userId, book.id);"),
    ("description: course.title,", "description: book.title,"),
    ("image: course.thumbnail_url || undefined,", "image: book.thumbnail_url || undefined,"),
    ("the course is now in your library.", "the book is now in your library."),

    # ── load ──
    ("const [c, rev] = await Promise.all([", "const [b, rev] = await Promise.all(["),
    ("api.course(id),", "api.book(id),"),
    ("api.courseReviews(id).catch(() => reviewData),", "api.bookReviews(id).catch(() => reviewData),"),
    ("course = c;", "book = b;"),
    ("api.checkAccess(session.userId, 'course', id)", "api.checkAccess(session.userId, 'book', id)"),
    ("if (Number(course.price) === 0) hasAccess = true;", "if (Number(book.price) === 0) hasAccess = true;"),
    ("emptyState('Course not available', e.message || 'This course could not be loaded.',",
     "emptyState('Book not available', e.message || 'This book could not be loaded.',"),
    ('\'<a href="courses.html" class="btn-primary btn-sm">Browse all courses</a>\')',
     '\'<a href="books.html" class="btn-primary btn-sm">Browse all books</a>\')'),
]

missing = []
for old, new in REPS:
    if old not in s:
        missing.append(old[:76])
    else:
        s = s.replace(old, new)

# The inline <video> player becomes an inline PDF reader. Done as a block
# swap rather than a string edit because the whole handler body changes.
OLD_PLAYER = """  // Play a lecture inline.
  document.querySelectorAll('[data-play]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.play;
      const title = btn.dataset.vtitle;
      const slot = $('[data-player-slot]');
      slot.innerHTML =
        '<div class="card overflow-hidden">' +
          '<video class="aspect-video w-full bg-black" controls autoplay playsinline controlsList="nodownload" ' +
                 'src="' + fmt.esc(url) + '"></video>' +
          '<div class="px-4 py-3"><p class="text-sm font-semibold text-navy">' + fmt.esc(title) + '</p></div>' +
        '</div>';
      slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });"""

NEW_PLAYER = """  // Open a PDF in an inline reader. The browser's own PDF viewer handles
  // paging, zoom and search better than anything worth hand-rolling.
  document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.open;
      const title = btn.dataset.vtitle;
      const slot = $('[data-player-slot]');
      slot.innerHTML =
        '<div class="card overflow-hidden">' +
          '<div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">' +
            '<p class="truncate text-sm font-semibold text-navy">' + fmt.esc(title) + '</p>' +
            '<a href="' + fmt.esc(url) + '" target="_blank" rel="noopener" class="btn-ghost btn-sm shrink-0">Full screen</a>' +
          '</div>' +
          '<iframe class="h-[78vh] w-full bg-canvas" src="' + fmt.esc(url) + '#view=FitH" title="' + fmt.esc(title) + '"></iframe>' +
        '</div>';
      slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });"""

if OLD_PLAYER in s:
    s = s.replace(OLD_PLAYER, NEW_PLAYER, 1)
else:
    missing.append("<<player block>>")

# Buy-button label resets reference the price; course -> book there too.
s = s.replace("fmt.price(course.price)", "fmt.price(book.price)")

open(dst, "w", encoding="utf-8", newline="\n").write(s)

print("book.html written ->", dst)
if missing:
    print("NOT FOUND (" + str(len(missing)) + "):")
    for m in missing:
        print("   ", m)
else:
    print("all " + str(len(REPS)) + " replacements applied, plus the player block")

leftover = re.findall(r"\bcourse(?!s\.html)[A-Za-z_]*", s)
print("leftover 'course*' identifiers:", sorted(set(leftover)) or "none")
