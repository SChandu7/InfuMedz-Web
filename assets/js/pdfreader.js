/* InfuMedz website - inline PDF reader.
 *
 * WHY THIS EXISTS, rather than an <iframe>
 * ----------------------------------------
 * An <iframe src="file.pdf"> renders fine on desktop Chrome, Firefox and
 * Safari. On ANDROID Chrome it does not render at all - the browser has no
 * in-page PDF viewer, so it shows a grey "PDF / filename / Open" card, and
 * tapping Open downloads the file or hands it to another app. That is the
 * mobile bug this module fixes: the reader must stay inside the page, and
 * the file must not be downloadable from the UI.
 *
 * So the PDF is fetched and drawn to <canvas> with PDF.js, which behaves
 * identically on every browser including mobile, and gives us real reading
 * controls (page jump, zoom, fit-width, fullscreen) instead of whatever the
 * browser's built-in viewer happens to offer.
 *
 * REQUIRES CORS on the media host. PDF.js fetches the bytes with JavaScript,
 * which is a cross-origin request from infumedz.chandus7.in to
 * api.chandus7.in. Without Access-Control-Allow-Origin on nginx's /media/
 * location the browser blocks it - so loadFailed() says exactly that rather
 * than leaving a blank panel.
 *
 * Pages render lazily through an IntersectionObserver. A 200-page book would
 * otherwise try to rasterise every page at once and lock up the tab.
 */

const PDFJS_VERSION = '3.11.174';

/* Bumped only when media caching needs busting - see the note in
   mountPdfReader() about the pre-CORS cached responses. */
const CACHE_BUST = '1';
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VERSION;

let libPromise = null;

/** Load PDF.js once, on first use - not on every page of the site. */
function loadLib() {
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const el = document.createElement('script');
    el.src = CDN + '/pdf.min.js';
    el.onload = () => {
      if (!window.pdfjsLib) return reject(new Error('PDF library failed to initialise'));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + '/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    el.onerror = () => reject(new Error('Could not load the PDF library'));
    document.head.appendChild(el);
  });
  return libPromise;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ── chrome ──────────────────────────────────────────────── */

function shell(title) {
  return '' +
  '<div class="overflow-hidden rounded-xl2 border border-line bg-white shadow-lift" data-reader>' +

    // toolbar
    '<div class="sticky top-16 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-canvas/95 px-3 py-2.5 backdrop-blur" data-toolbar>' +
      '<span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-chip text-primary">' +
        '<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 3a2 2 0 0 1 2-2h5.6L16 5.4V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3Zm7 .5V6h2.5L11 3.5Z" clip-rule="evenodd"/></svg>' +
      '</span>' +
      '<p class="min-w-0 flex-1 truncate text-sm font-semibold text-navy">' + esc(title) + '</p>' +

      // page controls
      '<div class="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-white px-1 py-0.5">' +
        '<button class="rounded p-1.5 text-ink-soft transition-colors hover:bg-chip hover:text-primary disabled:opacity-40" data-prev aria-label="Previous page">' +
          '<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.7 15.7 7 10l5.7-5.7 1.4 1.4L9.8 10l4.3 4.3-1.4 1.4Z" clip-rule="evenodd"/></svg></button>' +
        '<input class="w-11 rounded border-0 bg-transparent p-0 text-center text-sm font-semibold text-navy focus:outline-none focus:ring-0" ' +
               'inputmode="numeric" value="1" data-page-input aria-label="Page number">' +
        '<span class="pr-1 text-sm text-ink-muted">/ <span data-total>?</span></span>' +
        '<button class="rounded p-1.5 text-ink-soft transition-colors hover:bg-chip hover:text-primary disabled:opacity-40" data-next aria-label="Next page">' +
          '<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.3 4.3 13 10l-5.7 5.7-1.4-1.4L10.2 10 5.9 5.7l1.4-1.4Z" clip-rule="evenodd"/></svg></button>' +
      '</div>' +

      // zoom + fullscreen
      '<div class="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-white px-1 py-0.5">' +
        '<button class="rounded p-1.5 text-ink-soft transition-colors hover:bg-chip hover:text-primary" data-zoom="-1" aria-label="Zoom out">' +
          '<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M5 9h10v2H5z"/></svg></button>' +
        '<button class="rounded px-1.5 py-1 text-xs font-semibold text-ink-soft transition-colors hover:bg-chip hover:text-primary" data-fit aria-label="Fit to width">' +
          '<span data-zoom-label>Fit</span></button>' +
        '<button class="rounded p-1.5 text-ink-soft transition-colors hover:bg-chip hover:text-primary" data-zoom="1" aria-label="Zoom in">' +
          '<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 5h2v4h4v2h-4v4H9v-4H5V9h4z"/></svg></button>' +
        '<span class="mx-0.5 h-4 w-px bg-line"></span>' +
        '<button class="rounded p-1.5 text-ink-soft transition-colors hover:bg-chip hover:text-primary" data-full aria-label="Full screen">' +
          '<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3h6v2H5v4H3V3Zm14 0v6h-2V5h-4V3h6ZM3 11h2v4h4v2H3v-6Zm14 0v6h-6v-2h4v-4h2Z"/></svg></button>' +
      '</div>' +
    '</div>' +

    // page canvas area
    '<div class="relative overflow-y-auto overscroll-contain bg-[#525659]" data-scroll ' +
         'style="height:min(82vh,1000px)">' +
      '<div class="flex flex-col items-center gap-3 py-3" data-pages>' +
        '<div class="flex h-40 items-center gap-2 text-sm text-white/70">' +
          '<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>' +
          'Loading document…</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function failure(message, detail) {
  return '' +
  '<div class="rounded-xl2 border border-line bg-white p-8 text-center shadow-card">' +
    '<span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-bad/10">' +
      '<svg class="h-6 w-6 text-bad" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm1-11v5H9V7h2Zm0 6v2H9v-2h2Z" clip-rule="evenodd"/></svg>' +
    '</span>' +
    '<h3 class="mt-4 text-base">' + esc(message) + '</h3>' +
    (detail ? '<p class="prose-brand mx-auto mt-2 max-w-md text-sm">' + esc(detail) + '</p>' : '') +
    '<button class="btn-ghost btn-sm mt-5" onclick="location.reload()">Try again</button>' +
  '</div>';
}

/* ── mount ───────────────────────────────────────────────── */

/**
 * Render `url` into `container` as a scrollable, zoomable reader.
 * No download or print control is exposed anywhere.
 */
export async function mountPdfReader(container, url, title) {
  container.innerHTML = shell(title);

  const root   = container.querySelector('[data-reader]');
  const scroll = container.querySelector('[data-scroll]');
  const pages  = container.querySelector('[data-pages]');
  const input  = container.querySelector('[data-page-input]');
  const total  = container.querySelector('[data-total]');
  const zlabel = container.querySelector('[data-zoom-label]');

  let pdf = null;
  let zoom = 0;            // 0 = fit width; otherwise a multiplier step
  let current = 1;
  let observer = null;

  let lib;
  try {
    lib = await loadLib();
  } catch (e) {
    container.innerHTML = failure('Could not load the PDF reader',
      'The PDF library did not load. Check your connection and try again.');
    return;
  }

  try {
    // A stable ?v= parameter, not a timestamp. The media host served these
    // files without CORS headers before 20 Oct 2026, and any browser that
    // fetched one during that window has a cached copy with no
    // Access-Control-Allow-Origin recorded against it - which keeps failing
    // forever, because the cache hit never reaches the server. Changing the
    // URL sidesteps that entry once; because the value is fixed rather than
    // random, the new URL then caches normally and a 50 MB book is not
    // re-downloaded on every open.
    //
    // The proper server-side fix is `Vary: Origin` on the /media/ location,
    // which stops a non-CORS response ever being reused for a CORS request.
    // Bump CACHE_BUST if media caching ever misbehaves again.
    const bust = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + CACHE_BUST;
    pdf = await lib.getDocument({ url: bust, withCredentials: false }).promise;
  } catch (e) {
    // The overwhelmingly likely cause is a missing CORS header on the media
    // host, which looks identical to a network error from in here. Say what
    // it probably is instead of a generic failure.
    const msg = String((e && e.message) || '');
    const corsLike = /fetch|network|cors|failed/i.test(msg);
    container.innerHTML = failure(
      'This document could not be opened',
      corsLike
        ? 'The file could not be fetched from the media server. If this affects every ' +
          'document, the media host is missing its cross-origin header.'
        : msg || 'The file may be missing or damaged.');
    return;
  }

  total.textContent = pdf.numPages;
  input.setAttribute('max', String(pdf.numPages));

  /* Canvas width for the current zoom. Fit-width is the default because it
     is the only setting that reads well on a phone without pinching. */
  function targetWidth() {
    const avail = Math.max(280, scroll.clientWidth - 24);
    if (zoom === 0) return avail;
    return Math.max(240, Math.min(avail * Math.pow(1.25, zoom), avail * 3));
  }

  function build() {
    if (observer) observer.disconnect();
    pages.innerHTML = '';

    const width = targetWidth();

    for (let n = 1; n <= pdf.numPages; n++) {
      const holder = document.createElement('div');
      holder.className = 'relative bg-white shadow-lift';
      holder.dataset.pageHolder = String(n);
      // Placeholder height keeps the scrollbar honest before a page renders;
      // A4 ratio is close enough for every document here.
      holder.style.width = width + 'px';
      holder.style.minHeight = Math.round(width * 1.414) + 'px';
      pages.appendChild(holder);
    }

    // Render a little ahead of the viewport so scrolling feels continuous.
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) renderPage(Number(entry.target.dataset.pageHolder), width);
      });
    }, { root: scroll, rootMargin: '600px 0px' });

    Array.from(pages.children).forEach((el) => observer.observe(el));

    // Track which page is in view so the number in the toolbar is truthful.
    scroll.onscroll = () => {
      const mid = scroll.scrollTop + scroll.clientHeight / 2;
      let best = 1;
      Array.from(pages.children).forEach((el, i) => {
        if (el.offsetTop <= mid) best = i + 1;
      });
      if (best !== current) {
        current = best;
        if (document.activeElement !== input) input.value = String(current);
      }
    };

    zlabel.textContent = zoom === 0 ? 'Fit' : Math.round(Math.pow(1.25, zoom) * 100) + '%';
  }

  const rendered = new Set();

  async function renderPage(n, width) {
    const holder = pages.querySelector('[data-page-holder="' + n + '"]');
    if (!holder || rendered.has(n + ':' + width)) return;
    rendered.add(n + ':' + width);

    let page;
    try { page = await pdf.getPage(n); } catch (_) { return; }

    const base = page.getViewport({ scale: 1 });
    const scale = width / base.width;
    const vp = page.getViewport({ scale });

    // Draw at device pixel ratio so text is sharp on phones and retina
    // screens, then scale the element back down with CSS.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width * dpr);
    canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.display = 'block';

    holder.style.minHeight = '';
    holder.style.height = Math.round(vp.height) + 'px';
    holder.innerHTML = '';
    holder.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    try {
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    } catch (_) { /* a cancelled render during fast scroll is fine */ }

    // Page number, bottom-right, so a reader knows where they are.
    const tag = document.createElement('span');
    tag.className = 'pointer-events-none absolute bottom-1.5 right-2 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white';
    tag.textContent = n;
    holder.appendChild(tag);
  }

  function goTo(n) {
    const target = Math.max(1, Math.min(pdf.numPages, Number(n) || 1));
    const el = pages.querySelector('[data-page-holder="' + target + '"]');
    if (!el) return;

    // Smooth scrolling is nice for next/previous, but for a long jump it
    // drags the viewport through every page in between and the observer
    // renders all of them - jumping to page 300 of a 388-page book would
    // rasterise 300 canvases. Anything beyond a few pages jumps instantly.
    const far = Math.abs(target - current) > 3;
    scroll.scrollTo({ top: el.offsetTop - 12, behavior: far ? 'auto' : 'smooth' });

    current = target;
    input.value = String(target);
  }

  /* ── controls ── */

  container.querySelector('[data-prev]').addEventListener('click', () => goTo(current - 1));
  container.querySelector('[data-next]').addEventListener('click', () => goTo(current + 1));

  input.addEventListener('change', () => goTo(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); goTo(input.value); input.blur(); }
  });

  container.querySelectorAll('[data-zoom]').forEach((b) => {
    b.addEventListener('click', () => {
      const dir = Number(b.dataset.zoom);
      zoom = Math.max(-2, Math.min(4, (zoom === 0 ? 0 : zoom) + dir));
      rendered.clear();
      const keep = current;
      build();
      goTo(keep);
    });
  });

  container.querySelector('[data-fit]').addEventListener('click', () => {
    zoom = 0;
    rendered.clear();
    const keep = current;
    build();
    goTo(keep);
  });

  container.querySelector('[data-full]').addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => { /* refused - not worth a toast */ });
    }
  });

  // In fullscreen the viewer should use the whole screen, not 82vh.
  document.addEventListener('fullscreenchange', () => {
    const full = document.fullscreenElement === root;
    scroll.style.height = full ? 'calc(100vh - 52px)' : 'min(82vh,1000px)';
    // No site header inside the fullscreen element, so the 64px offset that
    // keeps the toolbar clear of it would leave a gap instead.
    const tb = container.querySelector('[data-toolbar]');
    if (tb) { tb.classList.toggle('top-16', !full); tb.classList.toggle('top-0', full); }
    rendered.clear();
    const keep = current;
    build();
    goTo(keep);
  });

  // Arrow keys and PageUp/PageDown, but only while the reader has focus, so
  // they do not hijack the page when someone is scrolling the article.
  root.setAttribute('tabindex', '-1');
  root.addEventListener('keydown', (e) => {
    if (e.target === input) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goTo(current + 1); }
    if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   { e.preventDefault(); goTo(current - 1); }
  });

  // Re-fit on resize / orientation change, debounced.
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (zoom !== 0) return;            // only fit-width needs re-measuring
      rendered.clear();
      const keep = current;
      build();
      goTo(keep);
    }, 250);
  });

  build();
}
