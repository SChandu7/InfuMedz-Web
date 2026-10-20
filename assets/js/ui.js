/* InfuMedz website - shared UI.
 *
 * Header, footer, cards, toasts, skeletons and formatting. Rendered from JS
 * so the chrome lives in one file instead of being copy-pasted into nine
 * HTML pages - that duplication is exactly how the app ended up with three
 * competing visual identities before v2.
 *
 * Deliberately web-shaped, not app-shaped: a sticky top nav with a category
 * dropdown, multi-column grids, hover lift on cards, breadcrumbs and a real
 * multi-column footer. None of the phone patterns (bottom tabs, full-bleed
 * single-column cards) carry over. Only the palette and the information
 * architecture do.
 */

import { session } from './session.js';

/* ---- paths ---- */

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
           '<img src="' + rel('assets/img/logo.jpeg') + '" alt="" class="absolute inset-0 h-full w-full object-cover" onerror="this.remove()">' +
         '</span>';
}

export function brandLockup(href) {
  return '<a href="' + rel(href || 'index.html') + '" class="flex shrink-0 items-center gap-2.5">' +
           logoMark() +
           '<span class="text-lg font-black tracking-tight text-navy">Infu<span class="text-primary">Medz</span></span>' +
         '</a>';
}

/* ── formatting ──────────────────────────────────────────── */

export const fmt = {
  /** "14999.00" -> "₹14,999" - Indian digit grouping, no stray decimals. */
  price(value) {
    const n = Number(value);
    if (!isFinite(n)) return '';
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  },

  /** ISO timestamp -> "12 Feb 2026" */
  date(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  /** ISO timestamp -> "2d ago" / "5h ago" / "Just now" */
  ago(iso) {
    if (!iso) return '';
    const then = new Date(iso);
    if (isNaN(then)) return '';
    const secs = Math.floor((Date.now() - then.getTime()) / 1000);
    if (secs < 60) return 'Just now';
    if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
    if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
    if (secs < 2592000) return Math.floor(secs / 86400) + 'd ago';
    return fmt.date(iso);
  },

  /** Defence against stored titles/descriptions containing markup. */
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]).join('').toUpperCase() || '?';
  },
};

/* ── toasts ──────────────────────────────────────────────── */

let toastHost = null;

export function toast(message, kind = 'info', ms = 4000) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'fixed bottom-6 right-6 z-[100] flex flex-col gap-2';
    document.body.appendChild(toastHost);
  }
  const tone = {
    info:    'bg-navy text-white',
    success: 'bg-ok text-white',
    error:   'bg-bad text-white',
    warn:    'bg-warn text-ink',
  }[kind] || 'bg-navy text-white';

  const el = document.createElement('div');
  el.className = 'pointer-events-auto max-w-sm rounded-xl2 px-4 py-3 text-sm font-medium shadow-lift ' +
                 'transition-all duration-200 translate-y-2 opacity-0 ' + tone;
  el.textContent = message;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  toastHost.appendChild(el);
  requestAnimationFrame(() => el.classList.remove('translate-y-2', 'opacity-0'));
  setTimeout(() => {
    el.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => el.remove(), 220);
  }, ms);
}

/* ── header ──────────────────────────────────────────────── */

const NAV = [
  { href: 'index.html',    label: 'Home' },
  { href: 'courses.html',  label: 'Courses' },
  { href: 'books.html',    label: 'Books' },
  { href: 'services.html', label: 'Services' },
  { href: 'about.html',    label: 'About' },
  { href: 'library.html',  label: 'My Library', auth: true },
];

export function renderHeader(active) {
  const user = session.user;
  const here = active || location.pathname.split('/').pop() || 'index.html';

  const links = NAV
    .filter((n) => !n.auth || session.isLoggedIn)
    .map((n) => {
      const cls = n.href === here ? 'nav-link nav-link-active' : 'nav-link';
      return '<a href="' + rel(n.href) + '" class="' + cls + '">' + n.label + '</a>';
    })
    .join('');

  const account = user
    ? '<div class="relative" data-menu>' +
        '<button class="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 ' +
                'transition hover:border-primary/40" data-menu-btn aria-haspopup="true" aria-expanded="false">' +
          '<span class="grid h-8 w-8 place-items-center rounded-full bg-brand-grad text-xs font-bold text-white">' +
            fmt.esc(fmt.initials(user.name)) + '</span>' +
          '<span class="hidden text-sm font-medium text-navy sm:block">' + fmt.esc((user.name || '').split(' ')[0]) + '</span>' +
          '<svg class="h-4 w-4 text-ink-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">' +
            '<path fill-rule="evenodd" d="M5.2 7.5 10 12.3l4.8-4.8 1.2 1.2-6 6-6-6 1.2-1.2Z" clip-rule="evenodd"/></svg>' +
        '</button>' +
        '<div class="absolute right-0 mt-2 hidden w-52 overflow-hidden rounded-xl2 border border-line bg-white py-1 shadow-lift" data-menu-panel>' +
          '<div class="border-b border-line px-4 py-2.5">' +
            '<p class="truncate text-sm font-semibold text-navy">' + fmt.esc(user.name) + '</p>' +
            '<p class="truncate text-xs text-ink-muted">' + fmt.esc(user.email) + '</p>' +
          '</div>' +
          '<a href="' + rel('library.html') + '" class="block px-4 py-2 text-sm text-ink-soft hover:bg-chip hover:text-primary">My Library</a>' +
          '<a href="' + rel('profile.html') + '" class="block px-4 py-2 text-sm text-ink-soft hover:bg-chip hover:text-primary">Profile</a>' +
          '<a href="' + rel('support.html') + '" class="block px-4 py-2 text-sm text-ink-soft hover:bg-chip hover:text-primary">Help &amp; Support</a>' +
          '<button class="block w-full px-4 py-2 text-left text-sm text-bad hover:bg-bad/5" data-logout>Sign out</button>' +
        '</div>' +
      '</div>'
    : '<div class="flex items-center gap-2">' +
        '<a href="' + rel('login.html') + '" class="btn-ghost btn-sm">Sign in</a>' +
        '<a href="' + rel('login.html') + '#signup" class="btn-primary btn-sm">Get started</a>' +
      '</div>';

  const html =
    '<header class="sticky top-0 z-50 border-b border-line bg-white/90 backdrop-blur-md">' +
      '<div class="shell flex h-16 items-center justify-between gap-6">' +
        brandLockup('index.html') +
        '<nav class="hidden items-center gap-7 md:flex" aria-label="Main">' + links + '</nav>' +
        '<div class="flex items-center gap-3">' +
          account +
          '<button class="md:hidden grid h-9 w-9 place-items-center rounded-xl2 border border-line" data-burger aria-label="Open menu">' +
            '<svg class="h-5 w-5 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="hidden border-t border-line bg-white md:hidden" data-mobile-nav>' +
        '<nav class="shell flex flex-col py-2" aria-label="Mobile">' +
          NAV.filter((n) => !n.auth || session.isLoggedIn)
             .map((n) => '<a href="' + rel(n.href) + '" class="py-2.5 text-sm font-medium text-ink-soft hover:text-primary">' + n.label + '</a>')
             .join('') +
        '</nav>' +
      '</div>' +
    '</header>';

  const host = document.querySelector('[data-header]');
  if (host) host.outerHTML = html;
  wireHeader();
}

function wireHeader() {
  const menu = document.querySelector('[data-menu]');
  if (menu) {
    const btn = menu.querySelector('[data-menu-btn]');
    const panel = menu.querySelector('[data-menu-panel]');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !panel.classList.contains('hidden');
      panel.classList.toggle('hidden', open);
      btn.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', () => {
      panel.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') panel.classList.add('hidden');
    });
  }

  const logout = document.querySelector('[data-logout]');
  if (logout) {
    logout.addEventListener('click', () => {
      session.logout();
      location.href = rel('index.html');
    });
  }

  const burger = document.querySelector('[data-burger]');
  const mobile = document.querySelector('[data-mobile-nav]');
  if (burger && mobile) {
    burger.addEventListener('click', () => {
      mobile.classList.toggle('hidden');
      mobile.classList.toggle('md:hidden');
    });
  }
}

/* ── footer ──────────────────────────────────────────────── */

export function renderFooter() {
  const year = new Date().getFullYear();
  const html =
    '<footer class="mt-16 border-t border-line bg-white">' +
      '<div class="shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">' +
        '<div>' +
          '<div class="mb-3">' + brandLockup('index.html') + '</div>' +
          '<p class="prose-brand max-w-xs text-sm">Bridging strong theoretical foundations and real-world clinical practice for medical postgraduates.</p>' +
        '</div>' +
        '<div>' +
          '<h4 class="mb-3 text-sm font-bold text-navy">Learn</h4>' +
          '<ul class="space-y-2 text-sm">' +
            '<li><a href="' + rel('courses.html') + '" class="text-ink-soft hover:text-primary">Video Courses</a></li>' +
            '<li><a href="' + rel('books.html') + '" class="text-ink-soft hover:text-primary">Books &amp; Notes</a></li>' +
            '<li><a href="' + rel('services.html') + '" class="text-ink-soft hover:text-primary">Thesis &amp; Publication</a></li>' +
            '<li><a href="' + rel('library.html') + '" class="text-ink-soft hover:text-primary">My Library</a></li>' +
          '</ul>' +
        '</div>' +
        '<div>' +
          '<h4 class="mb-3 text-sm font-bold text-navy">Support</h4>' +
          '<ul class="space-y-2 text-sm">' +
            '<li><a href="' + rel('support.html') + '" class="text-ink-soft hover:text-primary">Help Centre</a></li>' +
            '<li><a href="' + rel('about.html') + '" class="text-ink-soft hover:text-primary">About Us</a></li>' +
            '<li><a href="tel:+919381740718" class="text-ink-soft hover:text-primary">+91 93817 40718</a></li>' +
            '<li><a href="mailto:infusionmedzzone@gmail.com" class="break-all text-ink-soft hover:text-primary">infusionmedzzone@gmail.com</a></li>' +
          '</ul>' +
        '</div>' +
        '<div>' +
          '<h4 class="mb-3 text-sm font-bold text-navy">Legal</h4>' +
          '<ul class="space-y-2 text-sm">' +
            '<li><a href="' + rel('privacy.html') + '" class="text-ink-soft hover:text-primary">Privacy Policy</a></li>' +
            '<li><a href="' + rel('terms.html') + '" class="text-ink-soft hover:text-primary">Terms of Service</a></li>' +
            '<li><a href="' + rel('refund.html') + '" class="text-ink-soft hover:text-primary">Refund Policy</a></li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="border-t border-line">' +
        '<div class="shell flex flex-col items-center justify-between gap-3 py-5 text-xs text-ink-muted sm:flex-row">' +
          '<p>&copy; ' + year + ' InfuMedz. All rights reserved.</p>' +
          '<p>Also available on <a href="https://play.google.com/store/apps/details?id=com.infumedz.app" ' +
             'class="font-semibold text-primary hover:underline" rel="noopener">Google Play</a></p>' +
        '</div>' +
      '</div>' +
    '</footer>';

  const host = document.querySelector('[data-footer]');
  if (host) host.outerHTML = html;
}

/* ── cards ───────────────────────────────────────────────── */

const FALLBACK_THUMB =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225">' +
    '<rect width="400" height="225" fill="#EAF3FF"/>' +
    '<text x="50%" y="50%" font-family="system-ui" font-size="18" fill="#0E5FD8" ' +
    'text-anchor="middle" dy=".35em">InfuMedz</text></svg>');

/** Course or book card. `kind` is 'course' | 'book'. */
export function itemCard(item, kind, opts = {}) {
  const href = (kind === 'course' ? 'course.html?id=' : 'book.html?id=') + encodeURIComponent(item.id);
  const count = kind === 'course'
    ? (item.videos ? item.videos.length : 0)
    : (item.pdfs ? item.pdfs.length : 0);
  const countLabel = kind === 'course'
    ? count + (count === 1 ? ' lecture' : ' lectures')
    : count + (count === 1 ? ' PDF' : ' PDFs');

  const owned = !!opts.owned;
  const badge = owned
    ? '<span class="badge-own">Owned</span>'
    : (Number(item.price) === 0 ? '<span class="badge-free">Free</span>' : '');

  return '' +
    '<a href="' + href + '" class="card-hover group flex flex-col overflow-hidden">' +
      '<div class="relative aspect-video overflow-hidden bg-chip">' +
        '<img src="' + fmt.esc(item.thumbnail_url || FALLBACK_THUMB) + '" alt="" loading="lazy" ' +
             'class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" ' +
             'onerror="this.src=\'' + FALLBACK_THUMB + '\'">' +
        (badge ? '<div class="absolute left-3 top-3">' + badge + '</div>' : '') +
      '</div>' +
      '<div class="flex flex-1 flex-col p-4">' +
        '<div class="mb-2 flex items-center gap-2">' +
          (item.category_name ? '<span class="badge-cat">' + fmt.esc(item.category_name) + '</span>' : '') +
          '<span class="text-xs text-ink-muted">' + countLabel + '</span>' +
        '</div>' +
        '<h3 class="line-2 text-[15px] font-bold leading-snug text-navy transition-colors group-hover:text-primary">' +
          fmt.esc(item.title) + '</h3>' +
        '<p class="line-2 mt-1.5 flex-1 text-sm text-ink-muted">' + fmt.esc(item.description) + '</p>' +
        '<div class="mt-4 flex items-end justify-between border-t border-line pt-3">' +
          (owned
            ? '<span class="text-sm font-semibold text-ok">In your library</span>'
            : '<span class="text-lg font-black text-navy">' + fmt.price(item.price) + '</span>') +
          (item.buyers_count
            ? '<span class="text-xs text-ink-muted">' + item.buyers_count + ' enrolled</span>'
            : '<span></span>') +
        '</div>' +
      '</div>' +
    '</a>';
}

/** Grid of N shimmering placeholders, so pages never flash empty. */
export function skeletonGrid(n = 8) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out +=
      '<div class="card overflow-hidden">' +
        '<div class="sk aspect-video rounded-none"></div>' +
        '<div class="space-y-2.5 p-4">' +
          '<div class="sk h-3 w-20"></div>' +
          '<div class="sk h-4 w-full"></div>' +
          '<div class="sk h-4 w-2/3"></div>' +
          '<div class="sk mt-3 h-5 w-24"></div>' +
        '</div>' +
      '</div>';
  }
  return out;
}

export function emptyState(title, body, cta) {
  return '' +
    '<div class="card col-span-full px-6 py-16 text-center">' +
      '<div class="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-chip">' +
        '<svg class="h-7 w-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
          '<path d="M4 6h16M4 12h16M4 18h10" stroke-linecap="round"/></svg>' +
      '</div>' +
      '<h3 class="text-lg">' + fmt.esc(title) + '</h3>' +
      '<p class="prose-brand mx-auto mt-1.5 max-w-sm">' + fmt.esc(body) + '</p>' +
      (cta ? '<div class="mt-5">' + cta + '</div>' : '') +
    '</div>';
}

/** Star row. Returns markup only; `value` may be fractional. */
export function stars(value, size = 'h-4 w-4') {
  const v = Number(value) || 0;
  let out = '<span class="inline-flex items-center gap-0.5" aria-label="' + v.toFixed(1) + ' out of 5">';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(v);
    out += '<svg class="' + size + ' ' + (filled ? 'text-warn' : 'text-line') + '" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">' +
           '<path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.5 7.7l5.9-.9L10 1.5z"/></svg>';
  }
  return out + '</span>';
}

/** Page chrome + a guard that reports API failures instead of hanging. */
export function boot(activeNav) {
  renderHeader(activeNav);
  renderFooter();
  window.addEventListener('unhandledrejection', (e) => {
    const m = e.reason && e.reason.message;
    if (m) toast(m, 'error');
  });
}
