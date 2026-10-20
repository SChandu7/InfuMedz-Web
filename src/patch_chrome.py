# Updates the shared chrome in assets/js/ui.js:
#   - brand lockup backed by logo.jpeg, with the lettermark as fallback
#   - rel() so admin/index.html (one level down) resolves assets and links
#   - navigation extended with Services, About, Profile
#   - footer gains real contact details from the app's AppContact

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "assets", "js", "ui.js")
s = open(p, encoding="utf-8").read()

if "export const rel" in s:
    print("ui.js already patched - no change")
    raise SystemExit(0)

# ── 1. path + logo helpers ──────────────────────────────────────
# The divider comments use a long run of box-drawing characters whose exact
# length is not worth matching, so anchor on the stable prefix instead.
import re as _re
_m = _re.search(r"^/\* ── formatting .*$", s, _re.M)
assert _m, "formatting anchor not found"
anchor = _m.group(0)

HELPERS = '''/* ---- paths ---- */

/** admin/index.html sits one level down, so shared assets and links need a
    '../' there and nothing at the root. Worked out once, here, instead of
    being hardcoded per page. */
export const rel = (function () {
  var inSub = location.pathname.indexOf('/admin/') >= 0;
  return function (p) { return inSub ? '../' + p : p; };
})();

/** The brand mark. logo.jpeg sits beside index.html; if it is absent or
    fails to decode, onerror removes the <img> and the gradient lettermark
    underneath shows through - so the header can never display a broken
    image icon. */
function logoMark(size) {
  var px = size || 'h-9 w-9';
  return '<span class="relative grid ' + px + ' shrink-0 place-items-center overflow-hidden rounded-xl2 bg-brand-grad">' +
           '<span class="text-base font-black text-white">I</span>' +
           '<img src="' + rel('logo.jpeg') + '" alt="" class="absolute inset-0 h-full w-full object-cover" onerror="this.remove()">' +
         '</span>';
}

export function brandLockup(href) {
  return '<a href="' + rel(href || 'index.html') + '" class="flex shrink-0 items-center gap-2.5">' +
           logoMark() +
           '<span class="text-lg font-black tracking-tight text-navy">Infu<span class="text-primary">Medz</span></span>' +
         '</a>';
}

'''
s = s.replace(anchor, HELPERS + anchor, 1)

# ── 2. navigation ───────────────────────────────────────────────
old_nav = """const NAV = [
  { href: 'index.html',   label: 'Home' },
  { href: 'courses.html', label: 'Courses' },
  { href: 'books.html',   label: 'Books' },
  { href: 'library.html', label: 'My Library', auth: true },
];"""
new_nav = """const NAV = [
  { href: 'index.html',    label: 'Home' },
  { href: 'courses.html',  label: 'Courses' },
  { href: 'books.html',    label: 'Books' },
  { href: 'services.html', label: 'Services' },
  { href: 'about.html',    label: 'About' },
  { href: 'library.html',  label: 'My Library', auth: true },
];"""
assert old_nav in s, "NAV not found"
s = s.replace(old_nav, new_nav, 1)

# ── 3. header ───────────────────────────────────────────────────
reps = [
    ("""        '<a href="index.html" class="flex shrink-0 items-center gap-2.5">' +
          '<span class="grid h-9 w-9 place-items-center rounded-xl2 bg-brand-grad text-base font-black text-white">I</span>' +
          '<span class="text-lg font-black tracking-tight text-navy">Infu<span class="text-primary">Medz</span></span>' +
        '</a>' +""",
     "        brandLockup('index.html') +"),

    ("""      return '<a href="' + n.href + '" class="' + cls + '">' + n.label + '</a>';""",
     """      return '<a href="' + rel(n.href) + '" class="' + cls + '">' + n.label + '</a>';"""),

    ("""             .map((n) => '<a href="' + n.href + '" class="py-2.5 text-sm font-medium text-ink-soft hover:text-primary">' + n.label + '</a>')""",
     """             .map((n) => '<a href="' + rel(n.href) + '" class="py-2.5 text-sm font-medium text-ink-soft hover:text-primary">' + n.label + '</a>')"""),

    ("""          '<a href="library.html" class="block px-4 py-2 text-sm text-ink-soft hover:bg-chip hover:text-primary">My Library</a>' +
          '<a href="support.html" class="block px-4 py-2 text-sm text-ink-soft hover:bg-chip hover:text-primary">Help &amp; Support</a>' +""",
     """          '<a href="' + rel('library.html') + '" class="block px-4 py-2 text-sm text-ink-soft hover:bg-chip hover:text-primary">My Library</a>' +
          '<a href="' + rel('profile.html') + '" class="block px-4 py-2 text-sm text-ink-soft hover:bg-chip hover:text-primary">Profile</a>' +
          '<a href="' + rel('support.html') + '" class="block px-4 py-2 text-sm text-ink-soft hover:bg-chip hover:text-primary">Help &amp; Support</a>' +"""),

    ("""        '<a href="login.html" class="btn-ghost btn-sm">Sign in</a>' +
        '<a href="login.html#signup" class="btn-primary btn-sm">Get started</a>' +""",
     """        '<a href="' + rel('login.html') + '" class="btn-ghost btn-sm">Sign in</a>' +
        '<a href="' + rel('login.html') + '#signup" class="btn-primary btn-sm">Get started</a>' +"""),

    ("location.href = 'index.html';", "location.href = rel('index.html');"),

    # ── 4. footer ──
    ("""          '<div class="mb-3 flex items-center gap-2.5">' +
            '<span class="grid h-9 w-9 place-items-center rounded-xl2 bg-brand-grad text-base font-black text-white">I</span>' +
            '<span class="text-lg font-black tracking-tight text-navy">Infu<span class="text-primary">Medz</span></span>' +
          '</div>' +""",
     """          '<div class="mb-3">' + brandLockup('index.html') + '</div>' +"""),

    ("""            '<li><a href="courses.html" class="text-ink-soft hover:text-primary">Video Courses</a></li>' +
            '<li><a href="books.html" class="text-ink-soft hover:text-primary">Books &amp; Notes</a></li>' +
            '<li><a href="library.html" class="text-ink-soft hover:text-primary">My Library</a></li>' +""",
     """            '<li><a href="' + rel('courses.html') + '" class="text-ink-soft hover:text-primary">Video Courses</a></li>' +
            '<li><a href="' + rel('books.html') + '" class="text-ink-soft hover:text-primary">Books &amp; Notes</a></li>' +
            '<li><a href="' + rel('services.html') + '" class="text-ink-soft hover:text-primary">Thesis &amp; Publication</a></li>' +
            '<li><a href="' + rel('library.html') + '" class="text-ink-soft hover:text-primary">My Library</a></li>' +"""),

    ("""            '<li><a href="support.html" class="text-ink-soft hover:text-primary">Help Centre</a></li>' +
            '<li><a href="support.html#faq" class="text-ink-soft hover:text-primary">FAQs</a></li>' +
            '<li><a href="support.html#contact" class="text-ink-soft hover:text-primary">Contact Us</a></li>' +""",
     """            '<li><a href="' + rel('support.html') + '" class="text-ink-soft hover:text-primary">Help Centre</a></li>' +
            '<li><a href="' + rel('about.html') + '" class="text-ink-soft hover:text-primary">About Us</a></li>' +
            '<li><a href="tel:+919381740718" class="text-ink-soft hover:text-primary">+91 93817 40718</a></li>' +
            '<li><a href="mailto:infusionmedzzone@gmail.com" class="break-all text-ink-soft hover:text-primary">infusionmedzzone@gmail.com</a></li>' +"""),

    ("""            '<li><a href="privacy.html" class="text-ink-soft hover:text-primary">Privacy Policy</a></li>' +
            '<li><a href="terms.html" class="text-ink-soft hover:text-primary">Terms of Service</a></li>' +
            '<li><a href="refund.html" class="text-ink-soft hover:text-primary">Refund Policy</a></li>' +""",
     """            '<li><a href="' + rel('privacy.html') + '" class="text-ink-soft hover:text-primary">Privacy Policy</a></li>' +
            '<li><a href="' + rel('terms.html') + '" class="text-ink-soft hover:text-primary">Terms of Service</a></li>' +
            '<li><a href="' + rel('refund.html') + '" class="text-ink-soft hover:text-primary">Refund Policy</a></li>' +"""),
]

missing = []
for old, new in reps:
    if old in s:
        s = s.replace(old, new, 1)
    else:
        missing.append(old.strip().splitlines()[0][:70])

open(p, "w", encoding="utf-8", newline="\n").write(s)
print("ui.js patched: logo.jpeg lockup, rel() paths, Services/About/Profile nav, real contacts")
if missing:
    print("NOT FOUND (" + str(len(missing)) + "):")
    for m in missing:
        print("   " + m)
