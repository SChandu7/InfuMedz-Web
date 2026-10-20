# Adds a "Home & Banner" section to the website admin console, so the
# carousel images, the About copy and the four popular course / book picks
# can be edited from the website and not only from the Android app.
#
# Writes to the same AppBanner record the app's admin screen writes to, so
# whichever side you edit, both the app home screen and the website home
# page follow.

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "admin", "index.html")
s = open(p, encoding="utf-8").read()

if "data-banner-form" in s:
    print("admin already has the Home & Banner section - no change")
    raise SystemExit(0)

# ── 1. tab registration ─────────────────────────────────────────
old_tabs = """const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'courses',   label: 'Courses' },
  { id: 'books',     label: 'Books' },"""
new_tabs = """const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'home',      label: 'Home & Banner' },
  { id: 'courses',   label: 'Courses' },
  { id: 'books',     label: 'Books' },"""
assert old_tabs in s, "TABS list not found"
s = s.replace(old_tabs, new_tabs, 1)

# ── 2. the panel itself ─────────────────────────────────────────
anchor = "  async courses() {"
assert anchor in s, "courses panel not found"

PANEL = '''  async home() {
    const [banner, courses, books] = await Promise.all([
      api.banner(),
      api.courses().catch(() => []),
      api.books().catch(() => []),
    ]);

    const live = courses.filter((c) => c.is_active !== false);
    const carousel = (banner.carousel_urls || []).slice();

    // Four slots each, matching kPopularSlots in the app's
    // admin_banner_screen.dart. The backend stores a plain list with no cap,
    // so this number is the only limit on either side.
    const SLOTS = 4;

    const optionList = (rows, selected) =>
      '<option value="">— none —</option>' +
      rows.map((r) =>
        '<option value="' + fmt.esc(r.id) + '"' +
        (String(r.id) === String(selected) ? ' selected' : '') + '>' +
        fmt.esc(r.title) + ' — ' + fmt.price(r.price) + '</option>').join('');

    const slotRows = (rows, picked, kind) => {
      let out = '';
      for (let i = 0; i < SLOTS; i++) {
        out += '<div class="flex items-center gap-2">' +
                 '<span class="w-5 shrink-0 text-xs font-bold text-ink-muted">' + (i + 1) + '</span>' +
                 '<select class="field" data-pick="' + kind + '" data-slot="' + i + '">' +
                   optionList(rows, picked[i]) +
                 '</select>' +
               '</div>';
      }
      return out;
    };

    $('[data-panel]').innerHTML =
      '<form data-banner-form class="grid gap-4 xl:grid-cols-2">' +

        // ── carousel ──
        card(
          '<h2 class="text-base">Home carousel</h2>' +
          '<p class="prose-brand mt-1 text-sm">Shown on the app home screen and as the website hero. ' +
            'Rotates every 3 seconds in the order below.</p>' +
          '<div class="mt-4 space-y-2" data-carousel-list></div>' +
          '<div class="mt-3 flex flex-wrap items-center gap-2">' +
            '<label class="btn-ghost btn-sm cursor-pointer">' +
              '<input type="file" accept="image/*" class="hidden" data-carousel-file> Add image' +
            '</label>' +
            '<span class="text-xs text-ink-muted" data-carousel-note></span>' +
          '</div>') +

        // ── about text ──
        card(
          '<h2 class="text-base">About text</h2>' +
          '<p class="prose-brand mt-1 text-sm">Appears on the app home screen and in the website hero and About page.</p>' +
          '<textarea class="field mt-4" rows="6" data-about>' + fmt.esc(banner.about_text || '') + '</textarea>') +

        // ── popular courses ──
        card(
          '<h2 class="text-base">Popular courses</h2>' +
          '<p class="prose-brand mt-1 text-sm">Up to ' + SLOTS + ', featured on both home screens in this order.</p>' +
          '<div class="mt-4 space-y-2">' + slotRows(live, banner.popular_courses || [], 'course') + '</div>') +

        // ── popular books ──
        card(
          '<h2 class="text-base">Popular books</h2>' +
          '<p class="prose-brand mt-1 text-sm">Up to ' + SLOTS + ', featured on both home screens in this order.</p>' +
          '<div class="mt-4 space-y-2">' + slotRows(books, banner.popular_books || [], 'book') + '</div>') +

      '</form>' +
      '<div class="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 py-4 backdrop-blur">' +
        '<button class="btn-primary" data-save-banner>Save changes</button>' +
        '<a href="../index.html" target="_blank" rel="noopener" class="btn-ghost btn-sm">Preview website</a>' +
        '<span class="text-sm text-ink-muted" data-save-note></span>' +
      '</div>';

    /* ── carousel list ── */

    const drawCarousel = () => {
      $('[data-carousel-list]').innerHTML = carousel.length
        ? carousel.map((u, i) =>
            '<div class="flex items-center gap-3 rounded-xl2 border border-line p-2">' +
              '<img src="' + fmt.esc(u) + '" alt="" class="h-12 w-20 shrink-0 rounded object-cover bg-chip">' +
              '<span class="min-w-0 flex-1 truncate text-xs text-ink-muted">' + fmt.esc(u.split('/').pop()) + '</span>' +
              '<div class="flex shrink-0 gap-1">' +
                (i > 0 ? '<button type="button" class="rounded p-1.5 text-ink-soft hover:bg-chip hover:text-primary" data-move="' + i + '" data-dir="-1" aria-label="Move up">&uarr;</button>' : '') +
                (i < carousel.length - 1 ? '<button type="button" class="rounded p-1.5 text-ink-soft hover:bg-chip hover:text-primary" data-move="' + i + '" data-dir="1" aria-label="Move down">&darr;</button>' : '') +
                '<button type="button" class="rounded p-1.5 text-bad hover:bg-bad/5" data-drop="' + i + '" aria-label="Remove">&times;</button>' +
              '</div>' +
            '</div>').join('')
        : '<p class="rounded-xl2 border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">No images yet. The website hero panel is hidden until you add one.</p>';

      $$('[data-move]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.move), d = Number(b.dataset.dir);
        const t = carousel[i]; carousel[i] = carousel[i + d]; carousel[i + d] = t;
        drawCarousel();
      }));
      $$('[data-drop]').forEach((b) => b.addEventListener('click', () => {
        carousel.splice(Number(b.dataset.drop), 1);
        drawCarousel();
      }));
    };
    drawCarousel();

    $('[data-carousel-file]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const note = $('[data-carousel-note]');
      note.textContent = 'Uploading…';
      try {
        // Reuses the thumbnail endpoint - it just stores an image and hands
        // back a URL, which is exactly what a carousel slide needs.
        const fd = new FormData();
        fd.append('thumbnail', file);
        const up = await api.admin.uploadThumbnail(fd, H());
        if (!up.thumbnail_url) throw new Error('Upload returned no URL');
        carousel.push(up.thumbnail_url);
        drawCarousel();
        note.textContent = 'Added — remember to Save changes.';
      } catch (err) {
        note.textContent = '';
        toast(err.message || 'Could not upload the image.', 'error');
      }
      e.target.value = '';
    });

    /* ── save ── */

    $('[data-save-banner]').addEventListener('click', async (e) => {
      const pick = (kind) => $$('[data-pick="' + kind + '"]')
        .map((sel) => sel.value)
        .filter((v, i, arr) => v && arr.indexOf(v) === i);   // drop blanks and duplicates

      e.target.disabled = true;
      $('[data-save-note]').textContent = 'Saving…';
      try {
        await api.admin.saveBanner({
          about_text: $('[data-about]').value,
          carousel_urls: carousel,
          popular_courses: pick('course'),
          popular_books: pick('book'),
        }, H());
        $('[data-save-note]').textContent = 'Saved. The app and website both pick this up on next load.';
        toast('Home settings saved.', 'success');
      } catch (err) {
        $('[data-save-note]').textContent = '';
        toast(err.message || 'Could not save.', 'error');
      }
      e.target.disabled = false;
    });
  },

'''

s = s.replace(anchor, PANEL + anchor, 1)
open(p, "w", encoding="utf-8", newline="\n").write(s)
print("admin: Home & Banner section added (carousel, about text, 4+4 popular slots)")
